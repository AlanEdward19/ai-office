export const AGENT_PROFILES_STORAGE_KEY = "escritorio-de-ia.agent-profiles";

export type AgentProfile = { agentId: string; name: string };

function validProfile(agentId: unknown, name: unknown): boolean {
  return typeof agentId === "string" && !!agentId.trim()
    && typeof name === "string" && name.trim().length >= 1 && name.trim().length <= 60;
}

export function serializeAgentProfiles(profiles: readonly AgentProfile[]): string {
  return JSON.stringify({ version: 1, profiles });
}

export function loadAgentProfiles(raw: string | null): AgentProfile[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.profiles)) return [];
    const profiles: AgentProfile[] = [];
    for (const entry of parsed.profiles) {
      if (!entry || !validProfile(entry.agentId, entry.name)) continue;
      if (profiles.some((profile) => profile.agentId === entry.agentId)) continue;
      profiles.push({ agentId: entry.agentId, name: entry.name.trim() });
    }
    return profiles;
  } catch {
    return [];
  }
}

export function renameAgentProfile(
  profiles: readonly AgentProfile[], agentId: string, name: string,
): AgentProfile[] {
  if (!validProfile(agentId, name)) throw new Error("Informe um nome de 1 a 60 caracteres e um agente válido.");
  const profile = { agentId, name: name.trim() };
  return profiles.some((entry) => entry.agentId === agentId)
    ? profiles.map((entry) => entry.agentId === agentId ? profile : entry)
    : [...profiles, profile];
}
