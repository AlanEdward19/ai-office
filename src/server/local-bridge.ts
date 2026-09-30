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
  machineId: string;
  owner: string;
  accept: LocalHookAccept;
  cursorInstalled: boolean;
  claudeInstalled: boolean;
  cursorCreated: boolean;
  claudeCreated: boolean;
};

export type LocalBridge = {
  machineId: string;
  owner: string;
  spoolPath: string;
  accept: LocalHookAccept;
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
      cursorCreated: false,
      claudeCreated: false,
    };
  }
  return host[STATE_KEY];
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

function uninstall(file: string, strip: (raw: string | null) => HookConfigResult, created: boolean) {
  const raw = readText(file);
  if (raw === "unreadable" || raw === null) return;
  const stripped = strip(raw);
  if (!stripped.ok) return;
  if (created && configIsOnlyOurs(stripped.config)) {
    fs.unlinkSync(file);
    return;
  }
  if (!stripped.changed) return;
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
  state.cursorCreated = cursorRaw === null;
  state.claudeCreated = claudeRaw === null;
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

function deactivate(state: BridgeState) {
  if (state.cursorInstalled) uninstall(CURSOR_HOOKS_FILE, stripCursorHooks, state.cursorCreated);
  if (state.claudeInstalled) uninstall(CLAUDE_SETTINGS_FILE, stripClaudeSettings, state.claudeCreated);
  state.cursorInstalled = false;
  state.claudeInstalled = false;
  state.cursorCreated = false;
  state.claudeCreated = false;
  state.accept = { cursor: false, anthropic: false };
}

export function retainLocalBridge(): LocalBridge {
  const state = bridgeState();
  if (state.timer) {
    clearTimeout(state.timer);
    state.timer = null;
  }
  state.count += 1;
  if (state.count === 1) {
    try {
      activate(state);
    } catch {
      state.accept = { cursor: false, anthropic: false };
      state.cursorInstalled = false;
      state.claudeInstalled = false;
      state.cursorCreated = false;
      state.claudeCreated = false;
      if (!state.machineId) state.machineId = "offline";
    }
  }
  return {
    machineId: state.machineId,
    owner: state.owner,
    spoolPath: SPOOL_FILE,
    accept: { ...state.accept },
    release() {
      state.count = Math.max(0, state.count - 1);
      if (state.count > 0 || state.timer) return;
      state.timer = setTimeout(() => {
        state.timer = null;
        if (state.count === 0) deactivate(state);
      }, UNINSTALL_GRACE_MS);
    },
  };
}

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
        const stat = await fs.promises.stat(file);
        if (stat.size < offset) return { ok: true, chunk: "", offset: stat.size, reset: true };
        if (stat.size === offset) return { ok: true, chunk: "", offset };
        handle = await fs.promises.open(file, "r");
        const length = stat.size - offset;
        const buffer = Buffer.alloc(length);
        await handle.read(buffer, 0, length, offset);
        return { ok: true, chunk: buffer.toString("utf8"), offset: stat.size };
      } catch {
        return { ok: false };
      } finally {
        await handle?.close();
      }
    },
  };
}
