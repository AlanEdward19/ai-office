import type { AgentEvent, AgentStatus } from "./agent-event";
import {
  isTerminalRun,
  mapCursorToAgentStatus,
  mapStreamStatus,
  ownerFromCursorMe,
  selectCloudAgent,
  type CursorAgentSummary,
} from "./cursor-status";
import { readStreamStatus, type SseMessage } from "./sse";

export type CursorCloudClient = {
  me(signal: AbortSignal): Promise<unknown>;
  listAgents(signal: AbortSignal): Promise<CursorAgentSummary[]>;
  getRun(agentId: string, runId: string, signal: AbortSignal): Promise<{ status: string | null }>;
  streamRun(agentId: string, runId: string, signal: AbortSignal): AsyncIterable<SseMessage>;
};

export class ObserveHttpError extends Error {
  constructor(readonly status: number) {
    super(`cursor_http_${status}`);
    this.name = "ObserveHttpError";
  }
}

export function isAbortError(error: unknown): boolean {
  return (
    (error instanceof Error && error.name === "AbortError") ||
    (typeof error === "object" &&
      error !== null &&
      "name" in error &&
      (error as { name?: string }).name === "AbortError")
  );
}

function cloudEvent(owner: string, status: AgentStatus, observedAt: string): AgentEvent {
  return {
    provider: "cursor",
    origin: "cloud",
    owner,
    machineId: null,
    projectId: null,
    status,
    observedAt,
  };
}

/**
 * Runs only for the lifetime of `signal`. The route aborts that signal when
 * the browser disconnects, so nothing keeps polling after the page closes.
 */
export async function observeCursorCloudAgent(options: {
  client: CursorCloudClient;
  signal: AbortSignal;
  emit: (event: AgentEvent) => void;
  notify: (notice: { message: string }) => void;
  sleep: (ms: number, signal: AbortSignal) => Promise<void>;
  now?: () => string;
}): Promise<void> {
  const now = options.now ?? (() => new Date().toISOString());
  let owner = "Cursor";
  let ownerLoaded = false;
  let currentId: string | null = null;
  let streamedRunId: string | null = null;
  let lastStatus: AgentStatus | null = null;
  let lastNotice: string | null = null;
  let authNoticeSent = false;

  const notify = (message: string) => {
    if (message === lastNotice) return;
    lastNotice = message;
    options.notify({ message });
  };

  const push = (status: AgentStatus) => {
    if (options.signal.aborted || status === lastStatus) return;
    lastStatus = status;
    options.emit(cloudEvent(owner, status, now()));
  };

  const failAuth = async (status: number) => {
    if (!authNoticeSent) {
      authNoticeSent = true;
      notify(
        status === 401
          ? "A chave do Cursor foi recusada. Ela fica só nesta máquina."
          : "Não foi possível ler os cloud agents do Cursor.",
      );
    }
    await options.sleep(status === 401 ? 30_000 : 8_000, options.signal);
  };

  try {
    while (!options.signal.aborted) {
      if (!ownerLoaded) {
        try {
          owner = ownerFromCursorMe(await options.client.me(options.signal));
          ownerLoaded = true;
        } catch (error) {
          if (isAbortError(error)) return;
          if (error instanceof ObserveHttpError) {
            await failAuth(error.status);
            continue;
          }
          await failAuth(0);
          continue;
        }
      }

      let agents: CursorAgentSummary[];
      try {
        agents = await options.client.listAgents(options.signal);
      } catch (error) {
        if (isAbortError(error)) return;
        if (error instanceof ObserveHttpError) {
          await failAuth(error.status);
          continue;
        }
        notify("A lista de cloud agents não respondeu. Tentando de novo.");
        await options.sleep(8_000, options.signal);
        continue;
      }

      const selected = selectCloudAgent(agents, currentId);
      if (!selected) {
        if (currentId !== null) {
          currentId = null;
          streamedRunId = null;
          lastStatus = null;
        }
        notify(
          "Nenhum cloud agent do Cursor ainda. O observador continua enquanto a página estiver aberta.",
        );
        await options.sleep(5_000, options.signal);
        continue;
      }

      if (selected.id !== currentId) {
        currentId = selected.id;
        streamedRunId = null;
        lastStatus = null;
      }
      notify(
        selected.name
          ? `Observando o cloud agent "${selected.name}".`
          : "Observando um cloud agent do Cursor.",
      );

      let runStatus: string | null = null;
      if (selected.latestRunId) {
        try {
          const run = await options.client.getRun(selected.id, selected.latestRunId, options.signal);
          runStatus = run.status;
        } catch (error) {
          if (isAbortError(error)) return;
          runStatus = null;
        }
      }

      const mapped = mapCursorToAgentStatus({
        agentStatus: selected.status,
        runStatus,
      });
      if (mapped) push(mapped);

      const runId = selected.latestRunId;
      const shouldStream =
        Boolean(runId) &&
        runId !== streamedRunId &&
        !isTerminalRun(runStatus) &&
        (runStatus === "RUNNING" ||
          runStatus === "CREATING" ||
          selected.status?.toUpperCase() === "ACTIVE");

      if (shouldStream && runId) {
        try {
          for await (const message of options.client.streamRun(selected.id, runId, options.signal)) {
            if (options.signal.aborted) return;
            if (message.event === "status" || message.event === "result") {
              const fromStream = mapStreamStatus(readStreamStatus(message.data));
              if (fromStream) push(fromStream);
            }
            if (message.event === "result" || message.event === "done" || message.event === "error") {
              break;
            }
          }
          streamedRunId = runId;
        } catch (error) {
          if (isAbortError(error)) return;
          if (error instanceof ObserveHttpError && error.status === 410) {
            try {
              const run = await options.client.getRun(selected.id, runId, options.signal);
              const fallback = mapCursorToAgentStatus({
                agentStatus: selected.status,
                runStatus: run.status,
              });
              if (fallback) push(fallback);
            } catch (followUp) {
              if (isAbortError(followUp)) return;
            }
            streamedRunId = runId;
          }
        }
      }

      await options.sleep(4_000, options.signal);
    }
  } catch (error) {
    if (isAbortError(error)) return;
    throw error;
  }
}
