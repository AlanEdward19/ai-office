import type { ProviderId } from "./providers";

export function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function cursorAuthIndicatesLogin(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return nonEmptyString(record.accessToken) || nonEmptyString(record.access_token);
}

export function claudeCredentialsIndicateLogin(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.keys(value as object).length > 0;
}

export function codexAuthIndicatesLogin(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if (
    nonEmptyString(record.OPENAI_API_KEY) ||
    nonEmptyString(record.apiKey) ||
    nonEmptyString(record.api_key)
  ) {
    return true;
  }
  const tokens = record.tokens;
  if (!tokens || typeof tokens !== "object") return false;
  const tokenRecord = tokens as Record<string, unknown>;
  return (
    nonEmptyString(tokenRecord.access_token) || nonEmptyString(tokenRecord.refresh_token)
  );
}

/** Only these three companies can appear. Unauthenticated ones are omitted. */
export function authenticatedProviderIds(flags: {
  cursor: boolean;
  anthropic: boolean;
  openai: boolean;
}): ProviderId[] {
  const ids: ProviderId[] = [];
  if (flags.cursor) ids.push("cursor");
  if (flags.anthropic) ids.push("anthropic");
  if (flags.openai) ids.push("openai");
  return ids;
}

export function cursorCliAuthPath(homeDir: string, xdgConfigHome?: string): string[] {
  const configHome = xdgConfigHome?.trim() || `${homeDir}/.config`;
  const primary = `${configHome}/cursor/auth.json`;
  const fallback = `${homeDir}/.config/cursor/auth.json`;
  return primary === fallback ? [primary] : [primary, fallback];
}

export function cursorIdeDbPath(homeDir: string, platform: NodeJS.Platform, xdgConfigHome?: string): string {
  if (platform === "darwin") {
    return `${homeDir}/Library/Application Support/Cursor/User/globalStorage/state.vscdb`;
  }
  if (platform === "win32") {
    return `${homeDir}/AppData/Roaming/Cursor/User/globalStorage/state.vscdb`;
  }
  const configHome = xdgConfigHome?.trim() || `${homeDir}/.config`;
  return `${configHome}/Cursor/User/globalStorage/state.vscdb`;
}

export function claudeCredentialsPath(homeDir: string, claudeConfigDir?: string): string {
  const dir = claudeConfigDir?.trim() || `${homeDir}/.claude`;
  return `${dir}/.credentials.json`;
}

export function codexAuthPath(homeDir: string, codexHome?: string): string {
  const dir = codexHome?.trim() || `${homeDir}/.codex`;
  return `${dir}/auth.json`;
}
