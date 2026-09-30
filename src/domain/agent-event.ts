import { isProviderId, type ProviderId } from "./providers";

export const AGENT_ORIGINS = ["cloud", "local"] as const;
export const AGENT_STATUSES = ["idle", "working", "blocked", "done"] as const;

export type AgentOrigin = (typeof AGENT_ORIGINS)[number];
export type AgentStatus = (typeof AGENT_STATUSES)[number];

/**
 * The only agent snapshot the scene is allowed to read.
 * Local agents are not observed in this phase; the shape already carries
 * origin and machineId so a later wing can fill them in.
 */
export type AgentEvent = {
  provider: ProviderId;
  origin: AgentOrigin;
  owner: string;
  machineId: string | null;
  projectId: string | null;
  status: AgentStatus;
  observedAt: string;
};

export const STATUS_LABELS: Record<AgentStatus, string> = {
  idle: "Ocioso",
  working: "Trabalhando",
  blocked: "Bloqueado",
  done: "Concluído",
};

export function isAgentEvent(value: unknown): value is AgentEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Record<string, unknown>;
  return (
    isProviderId(event.provider) &&
    (event.origin === "cloud" || event.origin === "local") &&
    typeof event.owner === "string" &&
    event.owner.trim().length > 0 &&
    (event.machineId === null || typeof event.machineId === "string") &&
    (event.projectId === null || typeof event.projectId === "string") &&
    (event.status === "idle" ||
      event.status === "working" ||
      event.status === "blocked" ||
      event.status === "done") &&
    typeof event.observedAt === "string" &&
    event.observedAt.length > 0 &&
    (event.origin === "local" || event.machineId === null)
  );
}
