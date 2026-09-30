import type { AgentStatus } from "./agent-event";

export type ClaudeAgentList =
  | { ok: true; status: AgentStatus; live: boolean }
  | { ok: false };

/**
 * Live Claude Code sessions from `claude agents --json`.
 * `waiting` is a permission or input prompt. Background `state` covers a
 * session whose process has already exited. An empty list is not a session.
 * Paths and prompt text are ignored.
 */
export function statusFromClaudeAgentList(value: unknown): ClaudeAgentList {
  if (!Array.isArray(value)) return { ok: false };
  if (value.length === 0) return { ok: true, status: "idle", live: false };
  let working = false;
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const status = typeof record.status === "string" ? record.status : "";
    const state = typeof record.state === "string" ? record.state : "";
    const waiting = typeof record.waitingFor === "string" && record.waitingFor.trim().length > 0;
    if (status === "waiting" || state === "blocked" || waiting) {
      return { ok: true, status: "blocked", live: true };
    }
    if (status === "busy" || status === "shell" || state === "working") working = true;
  }
  return { ok: true, status: working ? "working" : "idle", live: true };
}

/** The command prints a JSON array. A banner before it is not session text we keep. */
export function parseClaudeAgentsOutput(raw: string): unknown | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const direct = parseJson(trimmed);
  if (direct !== undefined) return direct;
  const start = trimmed.indexOf("[");
  const end = trimmed.lastIndexOf("]");
  if (start < 0 || end <= start) return null;
  const sliced = parseJson(trimmed.slice(start, end + 1));
  return sliced === undefined ? null : sliced;
}

function parseJson(raw: string): unknown | undefined {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}
