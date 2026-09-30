import { isProviderId, type ProviderId } from "./providers";

export const AGENT_ORIGINS = ["cloud", "local"] as const;
export const AGENT_STATUSES = ["idle", "working", "blocked", "done"] as const;

export type AgentOrigin = (typeof AGENT_ORIGINS)[number];
export type AgentStatus = (typeof AGENT_STATUSES)[number];

/**
 * The only agent snapshot the scene is allowed to read.
 * A cloud event keeps machineId null. A local event carries the machine id
 * issued by the bridge that lives only while a page is open.
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
  const machineOk =
    (event.origin === "cloud" && event.machineId === null) ||
    (event.origin === "local" &&
      typeof event.machineId === "string" &&
      event.machineId.trim().length > 0);
  return (
    isProviderId(event.provider) &&
    machineOk &&
    typeof event.owner === "string" &&
    event.owner.trim().length > 0 &&
    (event.projectId === null || typeof event.projectId === "string") &&
    (event.status === "idle" ||
      event.status === "working" ||
      event.status === "blocked" ||
      event.status === "done") &&
    typeof event.observedAt === "string" &&
    event.observedAt.length > 0
  );
}
