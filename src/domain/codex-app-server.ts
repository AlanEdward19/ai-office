import type { AgentStatus } from "./agent-event";

/**
 * Codex thread status from the local app-server.
 * `waitingOnApproval` is an active flag, not a separate type.
 * notLoaded and systemError are not a running session.
 */
export function statusFromCodexThread(status: unknown): AgentStatus | null {
  if (!status || typeof status !== "object") return null;
  const record = status as Record<string, unknown>;
  if (record.type === "idle" || record.type === "notLoaded" || record.type === "systemError") {
    return "idle";
  }
  if (record.type !== "active") return null;
  const flags = Array.isArray(record.activeFlags) ? record.activeFlags : [];
  if (flags.includes("waitingOnApproval")) return "blocked";
  return "working";
}

/** One desk follows every listed thread: approval wins, then active work, otherwise idle. */
export function combineCodexThreadStatuses(statuses: Iterable<AgentStatus>): AgentStatus {
  let working = false;
  for (const status of statuses) {
    if (status === "blocked") return "blocked";
    if (status === "working") working = true;
  }
  return working ? "working" : "idle";
}

export type CodexWatch = {
  ready: boolean;
  nextId: number;
  pending: Map<number, "init" | "list" | "loaded" | "read">;
  threads: Map<string, AgentStatus>;
  pages: number;
};

const CLIENT = {
  name: "escritorio-de-ia",
  title: "Escritório de IA",
  version: "0.1.0",
};

export function openCodexWatch(): { state: CodexWatch; send: unknown[] } {
  const state: CodexWatch = {
    ready: false,
    nextId: 1,
    pending: new Map([[0, "init"]]),
    threads: new Map(),
    pages: 0,
  };
  return {
    state,
    send: [
      {
        method: "initialize",
        id: 0,
        params: { clientInfo: CLIENT },
      },
      { method: "initialized", params: {} },
    ],
  };
}

function listRequest(id: number, cursor: string | null) {
  return {
    method: "thread/list",
    id,
    params: { cursor, limit: 25, sortKey: "updated_at" },
  };
}

function loadedRequest(id: number) {
  return { method: "thread/loaded/list", id };
}

function readRequest(id: number, threadId: string) {
  return {
    method: "thread/read",
    id,
    params: { threadId, includeTurns: false },
  };
}

/** Ask again while the page is open. Does not start a thread or a turn. */
export function codexPoll(state: CodexWatch): unknown[] {
  if (!state.ready || state.pending.size > 0) return [];
  const listId = state.nextId;
  const loadedId = state.nextId + 1;
  state.nextId += 2;
  state.pages = 0;
  state.pending.set(listId, "list");
  state.pending.set(loadedId, "loaded");
  return [listRequest(listId, null), loadedRequest(loadedId)];
}

function rememberThread(state: CodexWatch, thread: unknown) {
  if (!thread || typeof thread !== "object") return;
  const record = thread as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id : "";
  const status = statusFromCodexThread(record.status);
  if (!id || !status) return;
  state.threads.set(id, status);
}

export function onCodexMessage(
  state: CodexWatch,
  message: unknown,
): { send: unknown[]; status: AgentStatus | null } {
  if (!message || typeof message !== "object") return { send: [], status: null };
  const record = message as Record<string, unknown>;
  const send: unknown[] = [];

  if (record.method === "thread/status/changed") {
    const params =
      record.params && typeof record.params === "object"
        ? (record.params as Record<string, unknown>)
        : null;
    const threadId = params && typeof params.threadId === "string" ? params.threadId : "";
    const status = params ? statusFromCodexThread(params.status) : null;
    if (threadId && status) state.threads.set(threadId, status);
    return { send, status: state.ready ? combineCodexThreadStatuses(state.threads.values()) : null };
  }

  if (typeof record.id !== "number") return { send, status: null };
  const kind = state.pending.get(record.id);
  if (!kind) return { send, status: null };
  state.pending.delete(record.id);
  if (record.error) return { send, status: state.ready ? combineCodexThreadStatuses(state.threads.values()) : null };
  const result =
    record.result && typeof record.result === "object"
      ? (record.result as Record<string, unknown>)
      : null;

  if (kind === "init") {
    state.ready = true;
    send.push(...codexPoll(state));
    return { send, status: null };
  }

  if (kind === "list" && result && Array.isArray(result.data)) {
    for (const thread of result.data) rememberThread(state, thread);
    state.pages += 1;
    const nextCursor = typeof result.nextCursor === "string" ? result.nextCursor : null;
    if (nextCursor && state.pages < 3) {
      const id = state.nextId;
      state.nextId += 1;
      state.pending.set(id, "list");
      send.push(listRequest(id, nextCursor));
    }
  }

  if (kind === "loaded" && result && Array.isArray(result.data)) {
    for (const entry of result.data) {
      if (typeof entry !== "string" || !entry.trim()) continue;
      const id = state.nextId;
      state.nextId += 1;
      state.pending.set(id, "read");
      send.push(readRequest(id, entry));
    }
  }

  if (result && result.thread) rememberThread(state, result.thread);

  return {
    send,
    status: state.ready ? combineCodexThreadStatuses(state.threads.values()) : null,
  };
}

export function parseCodexLine(line: string): unknown | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return null;
  }
}

/**
 * Grok has no presence API. A selected control, a form, or any other UI
 * state is not a presence event, so it cannot make a desk work.
 */
export function statusFromGrokPresence(event: unknown): null {
  void event;
  return null;
}
