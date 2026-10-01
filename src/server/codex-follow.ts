import "server-only";
import {recordProviderHistory} from "./agent-history";

import { spawn } from "node:child_process";
import readline from "node:readline";

import type { AgentEvent, AgentStatus } from "@/domain/agent-event";
import { codexPoll, onCodexMessage, openCodexWatch, parseCodexLine } from "@/domain/codex-app-server";
import { localAgentEvent } from "@/domain/local-hooks";
import { isAbortError } from "@/domain/observe-cursor";
import { abortableSleep } from "@/server/abortable-sleep";

/**
 * Reads the local Codex app-server only while the page request is open.
 * It lists threads. It does not start a thread, a turn, or a cloud fleet.
 */
export async function followCodexAppServer(options: {
  signal: AbortSignal;
  loggedIn: boolean;
  machineId: string;
  owner: string;
  emit: (event: AgentEvent) => void;
}): Promise<void> {
  if (!options.loggedIn || options.signal.aborted) return;

  const child = spawn("codex", ["app-server"], {
    stdio: ["pipe", "pipe", "ignore"],
    env: process.env,
  });
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    if (!child.killed) child.kill("SIGTERM");
    child.stdout?.destroy();
  };
  options.signal.addEventListener("abort", close, { once: true });
  child.on("error", close);
  child.on("exit", close);

  const opened = openCodexWatch();
  const write = (message: unknown) => {
    if (closed || !child.stdin.writable) return;
    child.stdin.write(`${JSON.stringify(message)}\n`);
  };
  for (const message of opened.send) write(message);

  let last: AgentStatus | null = null;
  const emitStatus = (status: AgentStatus | null) => {
    if (!status || status === last || options.signal.aborted) return;
    last = status;
    options.emit(
      localAgentEvent({
        provider: "openai",
        owner: options.owner,
        machineId: options.machineId,
        status,
        observedAt: new Date().toISOString(),
      }),
    );
  };

  const polling = (async () => {
    try {
      while (!options.signal.aborted && !closed) {
        await abortableSleep(1000, options.signal);
        for (const message of codexPoll(opened.state)) write(message);
      }
    } catch (error) {
      if (!isAbortError(error)) throw error;
    }
  })();

  const lines = readline.createInterface({ input: child.stdout });
  try {
    for await (const line of lines) {
      if (options.signal.aborted) break;
      const parsed = parseCodexLine(line);
      if (!parsed) continue;
      void recordProviderHistory("openai",parsed).catch(()=>{});
      const next = onCodexMessage(opened.state, parsed);
      for (const message of next.send) write(message);
      emitStatus(next.status);
    }
  } finally {
    lines.close();
    close();
    if (!options.signal.aborted && (last === "working" || last === "blocked")) {
      options.emit(
        localAgentEvent({
          provider: "openai",
          owner: options.owner,
          machineId: options.machineId,
          status: "idle",
          observedAt: new Date().toISOString(),
        }),
      );
    }
    await polling.catch(() => undefined);
  }
}
