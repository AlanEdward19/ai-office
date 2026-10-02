import "server-only";

import { isAgentEvent, type AgentEvent } from "@/domain/agent-event";
import { isMachinePresence, presentLocalEvent, type MachinePresence } from "@/domain/local-hooks";
import { openLocalStream } from "@/server/local-stream";

/**
 * Reads the local Cursor, Claude Code, and Codex status this process already
 * produces, and keeps that report on the floor while a page is open.
 * It does not invent a session the followers did not emit.
 */
let controller: AbortController | null = null;
let restart: ReturnType<typeof setTimeout> | null = null;

export function ensureLocalWatch() {
  if (controller) return;
  const next = new AbortController();
  controller = next;
  const response = openLocalStream(new Request("http://127.0.0.1/api/local", { signal: next.signal }));
  void readWatch(response, next.signal);
}

export function stopLocalWatch() {
  if (restart) {
    clearTimeout(restart);
    restart = null;
  }
  const current = controller;
  controller = null;
  current?.abort();
}

async function readWatch(response: Response, signal: AbortSignal) {
  const agents = new Map<string, AgentEvent>();
  let presence: MachinePresence | null = null;
  let buffer = "";
  const flush = async (online: boolean) => {
    const machineId = presence?.machineId ?? [...agents.values()][0]?.machineId;
    const owner = presence?.owner ?? [...agents.values()][0]?.owner;
    if (!machineId || !owner) return;
    const { noteObservedLocals } = await import("@/server/office-channel");
    noteObservedLocals({
      machineId,
      owner,
      online: online && (presence?.online ?? true),
      agents: [...agents.values()],
    });
  };
  const touch = setInterval(() => {
    void flush(true);
  }, 4_000);
  touch.unref();
  try {
    const reader = response.body?.getReader();
    if (!reader) return;
    const decoder = new TextDecoder();
    while (!signal.aborted) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      const taken = takeEvents(buffer);
      buffer = taken.rest;
      for (const item of taken.events) {
        if (item.event === "agent") {
          const parsed = parseJson(item.data);
          if (!isAgentEvent(parsed) || parsed.origin !== "local") continue;
          agents.set(parsed.provider, parsed);
          await flush(true);
        } else if (item.event === "presence") {
          const parsed = parseJson(item.data);
          if (!isMachinePresence(parsed)) continue;
          presence = parsed;
          if (!parsed.online) {
            for (const [provider, agent] of agents) agents.set(provider, presentLocalEvent(agent, false));
          }
          await flush(parsed.online);
        }
      }
    }
  } catch {
    /* The page abort ends the read. */
  } finally {
    clearInterval(touch);
    if (!signal.aborted) await flush(false);
    if (controller && !signal.aborted) {
      controller = null;
      restart = setTimeout(() => {
        restart = null;
        ensureLocalWatch();
      }, 1_000);
      restart.unref();
    }
  }
}

function parseJson(data: string): unknown {
  try {
    return JSON.parse(data) as unknown;
  } catch {
    return null;
  }
}

function takeEvents(buffer: string): { events: { event: string; data: string }[]; rest: string } {
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";
  const events: { event: string; data: string }[] = [];
  for (const part of parts) {
    if (!part.trim() || part.startsWith(":")) continue;
    let event = "message";
    const data: string[] = [];
    for (const line of part.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data.push(line.slice(5).trim());
    }
    if (data.length > 0) events.push({ event, data: data.join("\n") });
  }
  return { events, rest };
}
