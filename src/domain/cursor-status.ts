import type { AgentStatus } from "./agent-event";

export type CursorAgentSummary = {
  id: string;
  name?: string;
  status?: string;
  env?: { type?: string } | null;
  latestRunId?: string | null;
};

const TERMINAL_RUNS = new Set(["FINISHED", "ERROR", "CANCELLED", "EXPIRED"]);

export function isCloudAgent(agent: CursorAgentSummary): boolean {
  if (agent.status?.toUpperCase() === "ARCHIVED") return false;
  const type = agent.env?.type;
  return type === undefined || type === "cloud";
}

/**
 * Prefer an agent that is working right now. Otherwise keep the one already
 * on screen, then the newest cloud agent. List order is newest first.
 */
export function selectCloudAgent(
  agents: readonly CursorAgentSummary[],
  currentId: string | null,
): CursorAgentSummary | null {
  const cloud = agents.filter(isCloudAgent);
  const active = cloud.find((agent) => agent.status?.toUpperCase() === "ACTIVE");
  if (active) return active;
  if (currentId) {
    const current = cloud.find((agent) => agent.id === currentId);
    if (current) return current;
  }
  return cloud[0] ?? null;
}

/**
 * ACTIVE or RUNNING become working. FINISHED becomes done.
 * IDLE becomes idle. Anything else is left unmapped.
 */
export function mapCursorToAgentStatus(input: {
  agentStatus?: string | null;
  runStatus?: string | null;
}): AgentStatus | null {
  const run = input.runStatus?.toUpperCase() ?? null;
  const agent = input.agentStatus?.toUpperCase() ?? null;
  if (run === "RUNNING" || agent === "ACTIVE") return "working";
  if (run === "FINISHED") return "done";
  if (agent === "IDLE") return "idle";
  return null;
}

export function mapStreamStatus(status: string | null | undefined): AgentStatus | null {
  const value = status?.toUpperCase();
  if (value === "RUNNING" || value === "ACTIVE") return "working";
  if (value === "FINISHED") return "done";
  return null;
}

export function isTerminalRun(status: string | null | undefined): boolean {
  return TERMINAL_RUNS.has(status?.toUpperCase() ?? "");
}

export function readAgentList(payload: unknown): CursorAgentSummary[] {
  if (!payload || typeof payload !== "object" || !("items" in payload)) {
    throw new Error("cursor_list_invalid");
  }
  const items = (payload as { items?: unknown }).items;
  if (!Array.isArray(items)) throw new Error("cursor_list_invalid");
  return items.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    if (typeof record.id !== "string" || !record.id) return [];
    const envRecord =
      record.env && typeof record.env === "object"
        ? (record.env as Record<string, unknown>)
        : null;
    return [
      {
        id: record.id,
        name: typeof record.name === "string" ? record.name : undefined,
        status: typeof record.status === "string" ? record.status : undefined,
        env: envRecord
          ? { type: typeof envRecord.type === "string" ? envRecord.type : undefined }
          : null,
        latestRunId:
          typeof record.latestRunId === "string" ? record.latestRunId : null,
      },
    ];
  });
}

export function readRunStatus(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const status = (payload as { status?: unknown }).status;
  return typeof status === "string" ? status : null;
}

export function ownerFromCursorMe(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "Cursor";
  const record = payload as Record<string, unknown>;
  const name = [record.userFirstName, record.userLastName]
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .join(" ")
    .trim();
  if (name) return name;
  if (typeof record.userEmail === "string" && record.userEmail.trim()) {
    return record.userEmail.trim();
  }
  return "Cursor";
}
