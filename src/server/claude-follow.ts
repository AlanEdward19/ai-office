import "server-only";
import {recordProviderHistory} from "./agent-history";

import { spawn } from "node:child_process";

import type { AgentEvent, AgentStatus } from "@/domain/agent-event";
import { parseClaudeAgentsOutput, statusFromClaudeAgentList } from "@/domain/claude-session";
import { localAgentEvent } from "@/domain/local-hooks";
import { isAbortError } from "@/domain/observe-cursor";
import { abortableSleep } from "@/server/abortable-sleep";

const OUTPUT_CAP = 1_000_000;

/**
 * Reads `claude agents --json` only while the page request is open.
 * It does not start a session, and it does not keep cwd, names, or prompts.
 */
export async function followClaudeSessions(options: {
  signal: AbortSignal;
  loggedIn: boolean;
  claudeBin: string | null;
  machineId: string;
  owner: string;
  emit: (event: AgentEvent) => void;
}): Promise<void> {
  if (!options.loggedIn || !options.claudeBin || options.signal.aborted) return;

  let last: AgentStatus | null = null;
  const emitStatus = (status: AgentStatus) => {
    if (status === last || options.signal.aborted) return;
    last = status;
    options.emit(
      localAgentEvent({
        provider: "anthropic",
        owner: options.owner,
        machineId: options.machineId,
        status,
        observedAt: new Date().toISOString(),
      }),
    );
  };

  const settle = () => {
    if (!options.signal.aborted && (last === "working" || last === "blocked")) emitStatus("idle");
  };

  try {
    while (!options.signal.aborted) {
      const listed = await readClaudeAgents(options.claudeBin, options.signal);
      if (options.signal.aborted) return;
      if (!listed || !listed.live) {
        if (last === "working" || last === "blocked") emitStatus("idle");
      } else if (!options.signal.aborted) {
        last = listed.status;
        options.emit(
          localAgentEvent({
            provider: "anthropic",
            owner: options.owner,
            machineId: options.machineId,
            status: listed.status,
            observedAt: new Date().toISOString(),
          }),
        );
      }
      await abortableSleep(1000, options.signal);
    }
  } catch (error) {
    if (!isAbortError(error)) settle();
  } finally {
    settle();
  }
}

async function readClaudeAgents(bin: string, signal: AbortSignal) {
  if (signal.aborted) return null;
  const output = await capture(bin, ["agents", "--json"], signal);
  if (output === null) return null;
  const parsed = parseClaudeAgentsOutput(output);
  void recordProviderHistory("anthropic",parsed).catch(()=>{});
  const listed = statusFromClaudeAgentList(parsed);
  return listed.ok ? listed : null;
}

function capture(bin: string, args: string[], signal: AbortSignal): Promise<string | null> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve(null);
      return;
    }
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "ignore"] });
    let output = "";
    let overflow = false;
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const finish = (value: string | null) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      resolve(value);
    };
    const onAbort = () => {
      child.kill();
      finish(null);
    };
    timer = setTimeout(() => {
      child.kill();
      finish(null);
    }, 4000);
    signal.addEventListener("abort", onAbort, { once: true });
    child.stdout.on("data", (chunk: Buffer) => {
      if (overflow || output.length >= OUTPUT_CAP) {
        overflow = true;
        return;
      }
      output += chunk.toString("utf8");
      if (output.length > OUTPUT_CAP) overflow = true;
    });
    child.on("error", () => {
      clearTimeout(timer);
      finish(null);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (overflow || code !== 0) {
        finish(null);
        return;
      }
      finish(output);
    });
  });
}
