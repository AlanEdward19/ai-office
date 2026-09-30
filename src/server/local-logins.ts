import "server-only";

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";

import {
  authenticatedProviderIds,
  claudeCredentialsIndicateLogin,
  claudeCredentialsPath,
  codexAuthIndicatesLogin,
  codexAuthPath,
  cursorAuthIndicatesLogin,
  cursorCliAuthPath,
  cursorIdeDbPath,
} from "@/domain/logins";
import type { ProviderId } from "@/domain/providers";

function readJson(file: string): unknown | null {
  try {
    const stat = fs.statSync(file);
    if (!stat.isFile() || stat.size <= 0 || stat.size > 1_000_000) return null;
    return JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
  } catch {
    return null;
  }
}

function commandStatus(bin: string, args: string[]): Promise<number | null> {
  return new Promise((resolve) => {
    const child = spawn(bin, args, { stdio: "ignore" });
    const timer = setTimeout(() => {
      child.kill();
      resolve(null);
    }, 4000);
    child.on("error", () => {
      clearTimeout(timer);
      resolve(null);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve(code);
    });
  });
}

function cursorIdeHasSession(homeDir: string): Promise<boolean> {
  const db = cursorIdeDbPath(homeDir, process.platform, process.env.XDG_CONFIG_HOME);
  if (!fs.existsSync(db)) return Promise.resolve(false);
  return new Promise((resolve) => {
    const child = spawn(
      "sqlite3",
      [
        "-readonly",
        db,
        "SELECT CASE WHEN length(value) > 0 THEN 1 ELSE 0 END FROM ItemTable WHERE key = 'cursorAuth/accessToken' LIMIT 1;",
      ],
      { stdio: ["ignore", "pipe", "ignore"] },
    );
    let output = "";
    const timer = setTimeout(() => {
      child.kill();
      resolve(false);
    }, 2000);
    child.stdout.on("data", (chunk: Buffer) => {
      if (output.length < 8) output += chunk.toString();
    });
    child.on("error", () => {
      clearTimeout(timer);
      resolve(false);
    });
    child.on("close", () => {
      clearTimeout(timer);
      resolve(output.trim() === "1");
    });
  });
}

function cursorCliLoggedIn(homeDir: string): boolean {
  return cursorCliAuthPath(homeDir, process.env.XDG_CONFIG_HOME).some((file) =>
    cursorAuthIndicatesLogin(readJson(file)),
  );
}

/**
 * Detects which hiring companies already have a login on this machine.
 * File contents and command output never leave this process.
 */
export async function detectAuthenticatedProviders(): Promise<ProviderId[]> {
  const homeDir = os.homedir();
  const [claudeStatus, codexStatus, ideSession] = await Promise.all([
    commandStatus("claude", ["auth", "status"]),
    commandStatus("codex", ["login", "status"]),
    cursorIdeHasSession(homeDir),
  ]);

  return authenticatedProviderIds({
    cursor:
      Boolean(process.env.CURSOR_API_KEY?.trim()) ||
      cursorCliLoggedIn(homeDir) ||
      ideSession,
    anthropic:
      Boolean(process.env.ANTHROPIC_API_KEY?.trim()) ||
      Boolean(process.env.ANTHROPIC_AUTH_TOKEN?.trim()) ||
      claudeCredentialsIndicateLogin(
        readJson(claudeCredentialsPath(homeDir, process.env.CLAUDE_CONFIG_DIR)),
      ) ||
      claudeStatus === 0,
    openai:
      Boolean(process.env.OPENAI_API_KEY?.trim()) ||
      codexAuthIndicatesLogin(readJson(codexAuthPath(homeDir, process.env.CODEX_HOME))) ||
      codexStatus === 0,
  });
}
