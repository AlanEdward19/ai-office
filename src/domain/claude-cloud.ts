import { cursorDispatchPrompt } from "./dispatch";

export type ClaudeCloudSession = {
  id: string;
  url: string;
};

export type ClaudeAuthRead = { parsed: true; cloud: boolean } | { parsed: false };

const CREATED = /^Created (?:cloud|remote) session:/;
const VIEW =
  /^View:\s+https:\/\/claude\.ai\/code\/(session_[A-Za-z0-9]+)(?:\?\S*)?\s*$/;

/**
 * `claude --cloud` opens a Claude Code session on claude.ai.
 * The binary uses the login it already has. This does not add a key.
 */
export function claudeCloudArgs(prompt: string): readonly ["--cloud", string] {
  return ["--cloud", prompt];
}

export function claudeCloudPrompt(issue: {
  identifier: string;
  title: string;
  url: string;
  description: string | null;
}): string {
  return cursorDispatchPrompt(issue);
}

/** `claude auth status` JSON. Only a claude.ai login can open a cloud session. */
export function readClaudeAuthStatus(value: unknown): ClaudeAuthRead {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { parsed: false };
  const record = value as Record<string, unknown>;
  if (typeof record.loggedIn !== "boolean" || typeof record.authMethod !== "string") {
    return { parsed: false };
  }
  return { parsed: true, cloud: record.loggedIn === true && record.authMethod === "claude.ai" };
}

export function parseClaudeAuthStatusOutput(raw: string): unknown | null {
  const trimmed = stripAnsi(raw).trim();
  if (!trimmed) return null;
  const direct = parseJson(trimmed);
  if (direct !== undefined) return direct;
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  const sliced = parseJson(trimmed.slice(start, end + 1));
  return sliced === undefined ? null : sliced;
}

/**
 * Success is the CLI's own lines: `Created cloud session` (or the older
 * `Created remote session`) and `View: https://claude.ai/code/session_…`.
 * The title is not kept. A URL anywhere else is not a session.
 */
export function parseClaudeCloudStart(raw: string): ClaudeCloudSession | null {
  const lines = stripAnsi(raw)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (!lines.some((line) => CREATED.test(line))) return null;
  let found: ClaudeCloudSession | null = null;
  for (const line of lines) {
    const match = line.match(VIEW);
    if (!match) continue;
    const id = match[1];
    if (!id) continue;
    found = { id, url: `https://claude.ai/code/${id}` };
  }
  return found;
}

/** Known CLI failures that mean the claude.ai login is missing. The text is not returned. */
export function claudeCloudFailure(output: string): "auth" | "rejected" {
  const text = stripAnsi(output).toLowerCase();
  if (
    text.includes("api key authentication is not sufficient") ||
    text.includes("unable to get organization uuid") ||
    text.includes("cloud sessions aren't available")
  ) {
    return "auth";
  }
  return "rejected";
}

export function claudeCloudAttachment(url: string): { title: string; url: string } {
  return { title: "Sessão Claude na nuvem", url };
}

export function claudeCloudComment(url: string): string {
  return `Disparo do escritório. Sessão Claude na nuvem: ${url}`;
}

export function claudeCloudStartedCopy(linked: boolean): string {
  const lead = linked
    ? "Card na mesa do Claude. A sessão na nuvem foi aberta pelo CLI já logado."
    : "A sessão Claude na nuvem foi aberta, mas o Linear não gravou o vínculo.";
  return `${lead} A mesa mostra running, idle ou terminated da lista da Anthropic enquanto a página está aberta. Se a chamada falha, ou se essa sessão não está na lista, a mesa não fica ociosa: mostra a falha ou unknown.`;
}

function stripAnsi(value: string): string {
  return value.replace(/\u001b\[[0-9;]*[A-Za-z]/g, "");
}

function parseJson(raw: string): unknown | undefined {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}
