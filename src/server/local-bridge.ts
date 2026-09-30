import "server-only";

import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  HOOK_MARK,
  mergeClaudeSettings,
  mergeCursorHooks,
  stripClaudeSettings,
  stripCursorHooks,
  type ClaudeLocalHook,
  type CursorLocalHook,
  type HookConfigResult,
} from "@/domain/local-hooks";
import type { LocalHookAccept, LocalSpool } from "@/domain/observe-local";

const HOME = path.join(os.homedir(), ".escritorio-de-ia");
const MACHINE_FILE = path.join(HOME, "machine-id");
const SPOOL_FILE = path.join(HOME, "spool.jsonl");
const SCRIPT_FILE = path.join(HOME, `${HOOK_MARK}.mjs`);
const CURSOR_HOOKS_FILE = path.join(os.homedir(), ".cursor", "hooks.json");
const CLAUDE_SETTINGS_FILE = path.join(os.homedir(), ".claude", "settings.json");
const STATE_KEY = "__escritorioDeIaLocalBridge";
const UNINSTALL_GRACE_MS = 500;

const HOOK_SCRIPT = `import { appendFileSync, readFileSync } from "node:fs";

const provider = process.argv[2];
const hook = process.argv[3];
const spool = process.argv[4];
let raw = "";
try {
  raw = readFileSync(0, "utf8");
} catch {
  raw = "";
}
let parsed = {};
try {
  parsed = raw.trim() ? JSON.parse(raw) : {};
} catch {
  parsed = {};
}
const body = {};
if (parsed && typeof parsed === "object") {
  for (const key of ["status", "user_email", "user_name", "name", "userName", "email"]) {
    const value = parsed[key];
    if (typeof value === "string" && value.trim()) body[key] = value.trim();
  }
}
try {
  appendFileSync(spool, JSON.stringify({ provider, hook, body, at: new Date().toISOString() }) + "\\n");
} catch {
  /* The agent must keep going. A missed line is not a block. */
}
process.stdout.write("{}\\n");
`;

type BridgeState = {
  count: number;
  timer: ReturnType<typeof setTimeout> | null;
  watchdog: ReturnType<typeof setInterval> | null;
  lastBeat: number;
  epoch: number;
  machineId: string;
  owner: string;
  accept: LocalHookAccept;
  cursorInstalled: boolean;
  claudeInstalled: boolean;
};

export type LocalBridge = {
  machineId: string;
  owner: string;
  spoolPath: string;
  accept: LocalHookAccept;
  beat: () => void;
  release: () => void;
};

function bridgeState(): BridgeState {
  const host = globalThis as typeof globalThis & { [STATE_KEY]?: BridgeState };
  if (!host[STATE_KEY]) {
    host[STATE_KEY] = {
      count: 0,
      timer: null,
      machineId: "",
      owner: "esta máquina",
      accept: { cursor: false, anthropic: false },
      cursorInstalled: false,
      claudeInstalled: false,
      watchdog: null,
      lastBeat: 0,
      epoch: 0,
    };
  }
  const state = host[STATE_KEY];
  state.watchdog ??= null;
  state.lastBeat ??= 0;
  state.epoch ??= 0;
  return state;
}

function readText(file: string): string | null | "unreadable" {
  try {
    return fs.readFileSync(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    return "unreadable";
  }
}

function writeJson(file: string, config: Record<string, unknown>) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`);
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

function hookCommand(provider: "cursor" | "anthropic", hook: string): string {
  return `node ${shellQuote(SCRIPT_FILE)} ${provider} ${hook} ${shellQuote(SPOOL_FILE)}`;
}

function readOrCreateMachineId(): string {
  try {
    const existing = fs.readFileSync(MACHINE_FILE, "utf8").trim();
    if (existing) return existing;
  } catch {
    /* created below */
  }
  const id = randomUUID();
  try {
    fs.writeFileSync(MACHINE_FILE, `${id}\n`, { flag: "wx" });
    return id;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    const existing = fs.readFileSync(MACHINE_FILE, "utf8").trim();
    if (!existing) throw error;
    return existing;
  }
}

function install(
  file: string,
  merge: (raw: string | null) => HookConfigResult,
): boolean {
  const raw = readText(file);
  if (raw === "unreadable") return false;
  const merged = merge(raw);
  if (!merged.ok) return false;
  writeJson(file, merged.config);
  return true;
}

function configIsOnlyOurs(config: Record<string, unknown>): boolean {
  const hooks = config.hooks;
  const hooksEmpty =
    hooks === undefined ||
    (typeof hooks === "object" &&
      hooks !== null &&
      !Array.isArray(hooks) &&
      Object.keys(hooks).length === 0);
  return Object.keys(config).every((key) => key === "hooks" || key === "version") && hooksEmpty;
}

function uninstall(file: string, strip: (raw: string | null) => HookConfigResult) {
  const raw = readText(file);
  if (raw === "unreadable" || raw === null) return;
  const stripped = strip(raw);
  if (!stripped.ok || !stripped.changed) return;
  if (configIsOnlyOurs(stripped.config)) {
    fs.unlinkSync(file);
    return;
  }
  writeJson(file, stripped.config);
}

function cursorCommands(): Record<CursorLocalHook, string> {
  return {
    sessionStart: hookCommand("cursor", "sessionStart"),
    postToolUse: hookCommand("cursor", "postToolUse"),
    stop: hookCommand("cursor", "stop"),
    sessionEnd: hookCommand("cursor", "sessionEnd"),
  };
}

function claudeCommands(): Record<ClaudeLocalHook, string> {
  return {
    SessionStart: hookCommand("anthropic", "SessionStart"),
    PreToolUse: hookCommand("anthropic", "PreToolUse"),
    Stop: hookCommand("anthropic", "Stop"),
    SessionEnd: hookCommand("anthropic", "SessionEnd"),
  };
}

function activate(state: BridgeState) {
  fs.mkdirSync(HOME, { recursive: true });
  state.machineId = readOrCreateMachineId();
  state.owner = os.userInfo().username.trim() || "esta máquina";
  fs.writeFileSync(SCRIPT_FILE, HOOK_SCRIPT);
  if (!fs.existsSync(SPOOL_FILE)) fs.writeFileSync(SPOOL_FILE, "");
  const cursorRaw = readText(CURSOR_HOOKS_FILE);
  const claudeRaw = readText(CLAUDE_SETTINGS_FILE);
  state.accept = {
    cursor: cursorRaw === "unreadable" ? false : install(CURSOR_HOOKS_FILE, (raw) => mergeCursorHooks(raw, cursorCommands())),
    anthropic:
      claudeRaw === "unreadable"
        ? false
        : install(CLAUDE_SETTINGS_FILE, (raw) => mergeClaudeSettings(raw, claudeCommands())),
  };
  state.cursorInstalled = state.accept.cursor;
  state.claudeInstalled = state.accept.anthropic;
}

function sweepMarked(file: string, strip: (raw: string | null) => HookConfigResult) {
  const raw = readText(file);
  if (!raw || raw === "unreadable" || !raw.includes(HOOK_MARK)) return;
  const stripped = strip(raw);
  if (!stripped.ok || !stripped.changed) return;
  if (configIsOnlyOurs(stripped.config)) {
    fs.unlinkSync(file);
    return;
  }
  writeJson(file, stripped.config);
}

/** Drops hook commands when no open page is still reading the spool. */
function ensureWatchdog(state: BridgeState) {
  if (state.watchdog) return;
  const timer = setInterval(() => {
    const epoch = state.epoch;
    const live = state.count > 0 && Date.now() - state.lastBeat < 8_000;
    if (live || state.epoch !== epoch) return;
    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = null;
    }
    state.count = 0;
    if (state.epoch !== epoch) return;
    deactivate(state);
    sweepMarked(CURSOR_HOOKS_FILE, stripCursorHooks);
    sweepMarked(CLAUDE_SETTINGS_FILE, stripClaudeSettings);
    if (state.count === 0 && state.epoch === epoch) {
      clearInterval(timer);
      state.watchdog = null;
    }
  }, 1_000);
  timer.unref();
  state.watchdog = timer;
}

function deactivate(state: BridgeState) {
  if (state.cursorInstalled) uninstall(CURSOR_HOOKS_FILE, stripCursorHooks);
  if (state.claudeInstalled) uninstall(CLAUDE_SETTINGS_FILE, stripClaudeSettings);
  state.cursorInstalled = false;
  state.claudeInstalled = false;
  state.accept = { cursor: false, anthropic: false };
}

export function retainLocalBridge(): LocalBridge {
  const state = bridgeState();
  ensureWatchdog(state);
  state.epoch += 1;
  if (state.timer) {
    clearTimeout(state.timer);
    state.timer = null;
  }
  state.lastBeat = Date.now();
  state.count += 1;
  if (state.count === 1) {
    try {
      activate(state);
    } catch {
      state.accept = { cursor: false, anthropic: false };
      state.cursorInstalled = false;
      state.claudeInstalled = false;
      if (!state.machineId) state.machineId = "offline";
    }
  }
  return {
    machineId: state.machineId,
    owner: state.owner,
    spoolPath: SPOOL_FILE,
    accept: { ...state.accept },
    beat() {
      state.lastBeat = Date.now();
    },
    release() {
      state.count = Math.max(0, state.count - 1);
      if (state.count > 0 || state.timer) return;
      state.timer = setTimeout(() => {
        state.timer = null;
        if (state.count === 0) deactivate(state);
      }, UNINSTALL_GRACE_MS);
      state.timer.unref();
    },
  };
}

const bridge = bridgeState();
if (bridge.watchdog) {
  clearInterval(bridge.watchdog);
  bridge.watchdog = null;
}
ensureWatchdog(bridge);

export function fileSpool(file: string): LocalSpool {
  return {
    async size() {
      try {
        const stat = await fs.promises.stat(file);
        return stat.size;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return 0;
        return null;
      }
    },
    async read(offset) {
      let handle: fs.promises.FileHandle | null = null;
      try {
        handle = await fs.promises.open(file, "r");
        const stat = await handle.stat();
        if (stat.size < offset) return { ok: true, chunk: "", offset: stat.size, reset: true };
        if (stat.size === offset) return { ok: true, chunk: "", offset };
        const length = stat.size - offset;
        const buffer = Buffer.alloc(length);
        await handle.read(buffer, 0, length, offset);
        return { ok: true, chunk: buffer.toString("utf8"), offset: stat.size };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          return { ok: true, chunk: "", offset: 0, reset: true };
        }
        return { ok: false };
      } finally {
        await handle?.close();
      }
    },
  };
}
