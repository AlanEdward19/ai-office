import type { AgentEvent } from "./agent-event";
import {
  localAgentEvent,
  ownerFromHook,
  statusFromLocalHook,
  takeHookLines,
  type LocalHookProvider,
  type MachinePresence,
} from "./local-hooks";
import { isAbortError } from "./observe-cursor";

export type SpoolRead =
  | { ok: true; chunk: string; offset: number; reset?: boolean }
  | { ok: false };

export type LocalSpool = {
  /** Bytes already on disk. The loop seeks here so old lines are not replayed. */
  size(signal: AbortSignal): Promise<number | null>;
  read(offset: number, signal: AbortSignal): Promise<SpoolRead>;
};

export type LocalHookAccept = {
  cursor: boolean;
  anthropic: boolean;
};

/**
 * Reads the local spool only while `signal` is alive. A failed read marks the
 * machine offline and does not emit a working event.
 */
export async function observeLocalMachine(options: {
  machineId: string;
  owner: string;
  signal: AbortSignal;
  spool: LocalSpool;
  accept: LocalHookAccept;
  emit: (event: AgentEvent) => void;
  presence: (presence: MachinePresence) => void;
  notify: (notice: { message: string }) => void;
  sleep: (ms: number, signal: AbortSignal) => Promise<void>;
  now?: () => string;
  pollMs?: number;
}): Promise<void> {
  const now = options.now ?? (() => new Date().toISOString());
  const pollMs = options.pollMs ?? 500;
  let offset: number | null = null;
  let buffer = "";
  let online = false;
  const lastSignature = new Map<LocalHookProvider, string>();
  let lastNotice: string | null = null;

  const notify = (message: string) => {
    if (options.signal.aborted || message === lastNotice) return;
    lastNotice = message;
    options.notify({ message });
  };

  const publishPresence = (next: boolean) => {
    if (options.signal.aborted) return;
    online = next;
    options.presence({
      machineId: options.machineId,
      online: next,
      owner: options.owner,
    });
  };

  const providerAccepted = (provider: LocalHookProvider) =>
    provider === "cursor" ? options.accept.cursor : options.accept.anthropic;

  try {
    offset = await options.spool.size(options.signal);
    if (options.signal.aborted) return;
    if (offset === null) {
      publishPresence(false);
      notify("A máquina local não está legível. O agente não fica trabalhando.");
    } else {
      publishPresence(true);
      const blocked = [
        options.accept.cursor ? null : "Cursor",
        options.accept.anthropic ? null : "Claude Code",
      ].filter((name): name is string => name !== null);
      notify(
        blocked.length > 0
          ? `Não alterei os hooks de ${blocked.join(" e ")} porque a configuração não é JSON válido. Essa parte da ala fica ociosa.`
          : "Ala local ligada nesta máquina. Fechar a página remove os hooks.",
      );
    }

    while (!options.signal.aborted) {
      if (offset === null) {
        offset = await options.spool.size(options.signal);
        if (options.signal.aborted) return;
        if (offset === null) {
          if (online) {
            publishPresence(false);
            notify("A máquina local não está legível. O agente não fica trabalhando.");
          }
          await options.sleep(pollMs, options.signal);
          continue;
        }
        buffer = "";
        publishPresence(true);
      }

      const read = await options.spool.read(offset, options.signal);
      if (options.signal.aborted) return;
      if (!read.ok) {
        offset = null;
        buffer = "";
        if (online) {
          publishPresence(false);
          notify("A máquina local não está legível. O agente não fica trabalhando.");
        }
        await options.sleep(pollMs, options.signal);
        continue;
      }

      if (read.reset) buffer = "";
      if (!online) publishPresence(true);
      offset = read.offset;
      if (read.chunk) {
        buffer += read.chunk;
        const taken = takeHookLines(buffer);
        buffer = taken.rest;
        for (const line of taken.lines) {
          if (options.signal.aborted) return;
          if (!online || !providerAccepted(line.provider)) continue;
          const status = statusFromLocalHook(line.hook, line.body);
          if (!status) continue;
          const owner = ownerFromHook(line.body, options.owner);
          const signature = `${status}\0${owner}`;
          if (lastSignature.get(line.provider) === signature) continue;
          if (options.signal.aborted) return;
          lastSignature.set(line.provider, signature);
          options.emit(
            localAgentEvent({
              provider: line.provider,
              owner,
              machineId: options.machineId,
              status,
              observedAt: line.at || now(),
            }),
          );
        }
      }
      if (options.signal.aborted) return;
      await options.sleep(pollMs, options.signal);
    }
  } catch (error) {
    if (isAbortError(error)) return;
    throw error;
  }
}
