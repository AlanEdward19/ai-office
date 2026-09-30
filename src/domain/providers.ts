export const PROVIDER_IDS = ["cursor", "anthropic", "openai"] as const;

export type ProviderId = (typeof PROVIDER_IDS)[number];

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  cursor: "Cursor",
  anthropic: "Anthropic (Claude)",
  openai: "OpenAI (Codex)",
};

export function isProviderId(value: unknown): value is ProviderId {
  return (
    value === "cursor" || value === "anthropic" || value === "openai"
  );
}
