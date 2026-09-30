import "server-only";

import { spawn } from "node:child_process";

import {
  claudeCloudArgs,
  claudeCloudFailure,
  parseClaudeAuthStatusOutput,
  parseClaudeCloudStart,
  readClaudeAuthStatus,
  type ClaudeCloudSession,
} from "@/domain/claude-cloud";

const OUTPUT_CAP = 1_000_000;

export class ClaudeCloudError extends Error {
  constructor(readonly code: "cli_missing" | "auth" | "rejected" | "unreadable") {
    super(code);
    this.name = "ClaudeCloudError";
  }
}

/**
 * Starts one Claude Code session on claude.ai by running `claude --cloud`.
 * The CLI reads its own login. This module does not read a key file and does
 * not set one. It does not keep the command output after the session URL is read.
 */
export async function startClaudeCloudSession(input: {
  bin: string | null;
  prompt: string;
  cwd: string;
  signal?: AbortSignal;
}): Promise<ClaudeCloudSession> {
  if (!input.bin) throw new ClaudeCloudError("cli_missing");
  const signal = input.signal ?? new AbortController().signal;
  if (signal.aborted) throw abortError();

  const auth = await runClaude(input.bin, ["auth", "status"], input.cwd, signal, 8_000);
  if (signal.aborted) throw abortError();
  if (!auth) throw new ClaudeCloudError("rejected");
  if (auth.code === 1) throw new ClaudeCloudError("auth");
  if (auth.code !== 0) throw new ClaudeCloudError("rejected");
  const read = readClaudeAuthStatus(parseClaudeAuthStatusOutput(auth.output));
  if (read.parsed && !read.cloud) throw new ClaudeCloudError("auth");

  const started = await runClaude(
    input.bin,
    [...claudeCloudArgs(input.prompt)],
    input.cwd,
    signal,
    180_000,
  );
  if (signal.aborted) throw abortError();
  if (!started) throw new ClaudeCloudError("rejected");
  const session = parseClaudeCloudStart(started.output);
  if (session && (started.code === 0 || started.timedOut)) return session;
  if (started.code !== 0 || started.timedOut) {
    throw new ClaudeCloudError(claudeCloudFailure(started.output));
  }
  throw new ClaudeCloudError("unreadable");
}

function abortError(): Error {
  return Object.assign(new Error("aborted"), { name: "AbortError" });
}

type ClaudeRun = { code: number | null; output: string; timedOut: boolean };

function runClaude(
  bin: string,
  args: string[],
  cwd: string,
  signal: AbortSignal,
  timeoutMs: number,
): Promise<ClaudeRun | null> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve(null);
      return;
    }
    const child = spawn(bin, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    let settled = false;
    let timedOut = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let killTimer: ReturnType<typeof setTimeout> | null = null;
    const finish = (value: ClaudeRun | null) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      if (killTimer) clearTimeout(killTimer);
      signal.removeEventListener("abort", onAbort);
      resolve(value);
    };
    const onAbort = () => {
      child.kill();
      finish(null);
    };
    timer = setTimeout(() => {
      timedOut = true;
      child.kill();
      killTimer = setTimeout(() => {
        child.kill("SIGKILL");
        finish({ code: null, output, timedOut: true });
      }, 2_000);
    }, timeoutMs);
    signal.addEventListener("abort", onAbort, { once: true });
    const onData = (chunk: Buffer) => {
      if (output.length >= OUTPUT_CAP) return;
      output += chunk.toString("utf8");
      if (output.length > OUTPUT_CAP) output = output.slice(0, OUTPUT_CAP);
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("error", () => finish(null));
    child.on("close", (code) => {
      finish({ code, output, timedOut });
    });
  });
}
