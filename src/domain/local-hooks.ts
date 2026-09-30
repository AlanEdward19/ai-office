import type { AgentEvent, AgentStatus } from "./agent-event";
import type { ProviderId } from "./providers";

/** Marks the hook commands this app inserts. User hooks never carry it. */
export const HOOK_MARK = "escritorio-de-ia-hook";

export const CURSOR_LOCAL_HOOKS = ["sessionStart", "postToolUse", "stop", "sessionEnd"] as const;
export const CLAUDE_LOCAL_HOOKS = [
  "SessionStart",
  "PreToolUse",
  "PermissionRequest",
  "Stop",
  "SessionEnd",
] as const;

export type CursorLocalHook = (typeof CURSOR_LOCAL_HOOKS)[number];
export type ClaudeLocalHook = (typeof CLAUDE_LOCAL_HOOKS)[number];
export type LocalHookProvider = "cursor" | "anthropic";

const SESSION_START = new Set(["sessionStart", "SessionStart"]);
const TOOL_USE = new Set(["postToolUse", "PreToolUse", "PostToolUse"]);
const BLOCKED = new Set(["PermissionRequest"]);
const STOP = new Set(["stop", "Stop"]);
const SESSION_END = new Set(["sessionEnd", "SessionEnd"]);

const OWNER_KEYS = ["user_email", "user_name", "name", "userName", "email"] as const;

export type HookLine = {
  provider: LocalHookProvider;
  hook: string;
  body: Record<string, unknown>;
  at: string;
};

export type MachinePresence = {
  machineId: string;
  online: boolean;
  owner: string;
};

export type HookConfigResult =
  | { ok: true; config: Record<string, unknown>; changed: boolean }
  | { ok: false; reason: "invalid" };

export function isMachinePresence(value: unknown): value is MachinePresence {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.machineId === "string" &&
    record.machineId.trim().length > 0 &&
    typeof record.online === "boolean" &&
    typeof record.owner === "string" &&
    record.owner.trim().length > 0
  );
}

function hookStatus(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const status = (body as Record<string, unknown>).status;
  return typeof status === "string" ? status.trim().toLowerCase() : null;
}

/** Maps an official Cursor or Claude Code hook onto the shared agent status. */
export function statusFromLocalHook(hook: string, body: unknown): AgentStatus | null {
  const name = hook.trim();
  if (BLOCKED.has(name)) return "blocked";
  if (SESSION_START.has(name) || TOOL_USE.has(name)) return "working";
  if (STOP.has(name)) {
    const status = hookStatus(body);
    if (status === "aborted" || status === "error") return "idle";
    return "done";
  }
  if (SESSION_END.has(name)) return "idle";
  return null;
}

export function ownerFromHook(body: unknown, fallback: string): string {
  const safeFallback = fallback.trim() || "esta máquina";
  if (!body || typeof body !== "object") return safeFallback;
  const record = body as Record<string, unknown>;
  for (const key of OWNER_KEYS) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return safeFallback;
}

export function localAgentEvent(input: {
  provider: ProviderId;
  owner: string;
  machineId: string;
  status: AgentStatus;
  observedAt: string;
}): AgentEvent {
  return {
    provider: input.provider,
    origin: "local",
    owner: input.owner.trim() || "esta máquina",
    machineId: input.machineId,
    projectId: null,
    status: input.status,
    observedAt: input.observedAt,
  };
}

/** A closed page or a missing machine never keeps a local agent working or blocked. */
export function presentLocalEvent(event: AgentEvent, machineOnline: boolean): AgentEvent {
  if (
    event.origin === "local" &&
    !machineOnline &&
    (event.status === "working" || event.status === "blocked")
  ) {
    return { ...event, status: "idle" };
  }
  return event;
}

export function parseHookLine(line: string): HookLine | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    const value = JSON.parse(trimmed) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const record = value as Record<string, unknown>;
    if (record.provider !== "cursor" && record.provider !== "anthropic") return null;
    if (typeof record.hook !== "string" || record.hook.trim().length === 0) return null;
    const body =
      record.body && typeof record.body === "object" && !Array.isArray(record.body)
        ? (record.body as Record<string, unknown>)
        : {};
    return {
      provider: record.provider,
      hook: record.hook,
      body,
      at: typeof record.at === "string" ? record.at : "",
    };
  } catch {
    return null;
  }
}

/** Complete spool lines become events. A trailing partial line stays buffered. */
export function takeHookLines(buffer: string): { lines: HookLine[]; rest: string } {
  const parts = buffer.split("\n");
  const rest = parts.pop() ?? "";
  const lines: HookLine[] = [];
  for (const part of parts) {
    const parsed = parseHookLine(part);
    if (parsed) lines.push(parsed);
  }
  return { lines, rest };
}

function parseConfig(raw: string | null): { ok: true; value: Record<string, unknown> | null } | { ok: false } {
  if (raw === null || raw.trim() === "") return { ok: true, value: null };
  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false };
    return { ok: true, value: value as Record<string, unknown> };
  } catch {
    return { ok: false };
  }
}

function commandOf(entry: unknown): string | null {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
  const command = (entry as { command?: unknown }).command;
  return typeof command === "string" ? command : null;
}

function isMarked(entry: unknown): boolean {
  const command = commandOf(entry);
  return command !== null && command.includes(HOOK_MARK);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function mergeCursorHooks(
  existing: string | null,
  commands: Record<CursorLocalHook, string>,
): HookConfigResult {
  const parsed = parseConfig(existing);
  if (!parsed.ok) return { ok: false, reason: "invalid" };
  const source = parsed.value ?? {};
  if ("version" in source && source.version !== 1) return { ok: false, reason: "invalid" };
  const hooksIn = source.hooks;
  if (hooksIn !== undefined && !asRecord(hooksIn)) return { ok: false, reason: "invalid" };
  const hooks: Record<string, unknown> = {};
  let changed = parsed.value === null || source.version !== 1;
  for (const [name, value] of Object.entries(hooksIn ?? {})) {
    if (!Array.isArray(value)) return { ok: false, reason: "invalid" };
    const kept = value.filter((entry) => !isMarked(entry));
    if (kept.length !== value.length) changed = true;
    if (kept.length > 0 || !CURSOR_LOCAL_HOOKS.includes(name as CursorLocalHook)) hooks[name] = kept;
  }
  for (const name of CURSOR_LOCAL_HOOKS) {
    const list = Array.isArray(hooks[name]) ? [...(hooks[name] as unknown[])] : [];
    const command = commands[name];
    if (!list.some((entry) => commandOf(entry) === command)) {
      list.push({ command });
      changed = true;
    }
    hooks[name] = list;
  }
  return { ok: true, config: { ...source, version: 1, hooks }, changed };
}

export function stripCursorHooks(existing: string | null): HookConfigResult {
  const parsed = parseConfig(existing);
  if (!parsed.ok) return { ok: false, reason: "invalid" };
  if (!parsed.value) return { ok: true, config: {}, changed: false };
  const source = parsed.value;
  if ("version" in source && source.version !== 1) return { ok: false, reason: "invalid" };
  if (source.hooks === undefined) return { ok: true, config: { ...source }, changed: false };
  const hooksIn = asRecord(source.hooks);
  if (!hooksIn) return { ok: false, reason: "invalid" };
  const hooks: Record<string, unknown> = {};
  let changed = false;
  for (const [name, value] of Object.entries(hooksIn)) {
    if (!Array.isArray(value)) return { ok: false, reason: "invalid" };
    const kept = value.filter((entry) => !isMarked(entry));
    if (kept.length !== value.length) changed = true;
    if (kept.length > 0) hooks[name] = kept;
  }
  return { ok: true, config: { ...source, hooks }, changed };
}

function matcherFor(name: ClaudeLocalHook): string {
  return name === "PreToolUse" || name === "PermissionRequest" ? "*" : "";
}

function stripClaudeGroups(
  groups: unknown[],
): { ok: true; groups: unknown[]; changed: boolean } | { ok: false } {
  const next: unknown[] = [];
  let changed = false;
  for (const group of groups) {
    const record = asRecord(group);
    if (!record || !Array.isArray(record.hooks)) return { ok: false };
    const hooks = record.hooks.filter((hook) => !isMarked(hook));
    if (hooks.length !== record.hooks.length) changed = true;
    if (hooks.length === 0) {
      changed = true;
      continue;
    }
    next.push(hooks.length === record.hooks.length ? group : { ...record, hooks });
  }
  return { ok: true, groups: next, changed };
}

function groupHasCommand(group: unknown, command: string): boolean {
  const record = asRecord(group);
  if (!record || !Array.isArray(record.hooks)) return false;
  return record.hooks.some((hook) => commandOf(hook) === command);
}

export function mergeClaudeSettings(
  existing: string | null,
  commands: Record<ClaudeLocalHook, string>,
): HookConfigResult {
  const parsed = parseConfig(existing);
  if (!parsed.ok) return { ok: false, reason: "invalid" };
  const source = parsed.value ?? {};
  if (source.hooks !== undefined && !asRecord(source.hooks)) return { ok: false, reason: "invalid" };
  const hooks: Record<string, unknown> = {};
  let changed = parsed.value === null;
  for (const [name, value] of Object.entries(source.hooks ?? {})) {
    if (!Array.isArray(value)) return { ok: false, reason: "invalid" };
    const stripped = stripClaudeGroups(value);
    if (!stripped.ok) return { ok: false, reason: "invalid" };
    if (stripped.changed) changed = true;
    if (stripped.groups.length > 0) hooks[name] = stripped.groups;
  }
  for (const name of CLAUDE_LOCAL_HOOKS) {
    const list = Array.isArray(hooks[name]) ? [...(hooks[name] as unknown[])] : [];
    const command = commands[name];
    if (!list.some((group) => groupHasCommand(group, command))) {
      list.push({ matcher: matcherFor(name), hooks: [{ type: "command", command }] });
      changed = true;
    }
    hooks[name] = list;
  }
  return { ok: true, config: { ...source, hooks }, changed };
}

export function stripClaudeSettings(existing: string | null): HookConfigResult {
  const parsed = parseConfig(existing);
  if (!parsed.ok) return { ok: false, reason: "invalid" };
  if (!parsed.value) return { ok: true, config: {}, changed: false };
  const source = parsed.value;
  if (source.hooks === undefined) return { ok: true, config: { ...source }, changed: false };
  const hooksIn = asRecord(source.hooks);
  if (!hooksIn) return { ok: false, reason: "invalid" };
  const hooks: Record<string, unknown> = {};
  let changed = false;
  for (const [name, value] of Object.entries(hooksIn)) {
    if (!Array.isArray(value)) return { ok: false, reason: "invalid" };
    const stripped = stripClaudeGroups(value);
    if (!stripped.ok) return { ok: false, reason: "invalid" };
    if (stripped.changed) changed = true;
    if (stripped.groups.length > 0) hooks[name] = stripped.groups;
  }
  return { ok: true, config: { ...source, hooks }, changed };
}
