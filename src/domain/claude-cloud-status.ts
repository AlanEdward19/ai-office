import { STATUS_LABELS, type AgentStatus } from "./agent-event";
import type { DispatchRecord } from "./dispatch";
import { isAbortError } from "./observe-cursor";
import type { PlacedAgent } from "./placement";

export const CLAUDE_CLOUD_API_STATUSES = ["running", "idle", "terminated"] as const;

export type ClaudeCloudApiStatus = (typeof CLAUDE_CLOUD_API_STATUSES)[number];

export const CLAUDE_CLOUD_FAILURES = {
  missingKey: "falha: ANTHROPIC_API_KEY ausente",
  rejected: "falha: Anthropic recusou a chave",
  unavailable: "falha: Anthropic não respondeu",
  invalid: "falha: lista inválida",
} as const;

export type ClaudeCloudFailure = (typeof CLAUDE_CLOUD_FAILURES)[keyof typeof CLAUDE_CLOUD_FAILURES];

export type ClaudeCloudSessionStatus = {
  id: string;
  status: ClaudeCloudApiStatus;
};

export type ClaudeCloudReport =
  | { ok: true; sessions: ClaudeCloudSessionStatus[] }
  | { ok: false; error: ClaudeCloudFailure };

const FAILURES = new Set<string>(Object.values(CLAUDE_CLOUD_FAILURES));
const API_STATUSES = new Set<string>(CLAUDE_CLOUD_API_STATUSES);

export function isClaudeCloudLabel(value: unknown): value is string {
  return typeof value === "string" && (value === "unknown" || API_STATUSES.has(value) || FAILURES.has(value));
}

export function claudeCloudFailureForHttp(status: number): ClaudeCloudFailure {
  if (status === 401 || status === 403) return CLAUDE_CLOUD_FAILURES.rejected;
  return CLAUDE_CLOUD_FAILURES.unavailable;
}

/**
 * One page of `GET /v1/sessions`. Only id and running/idle/terminated are kept.
 * Any other status, including rescheduling, is omitted rather than remapped.
 * Titles, usage, and metadata are dropped.
 */
export function readClaudeSessionList(payload: unknown): ClaudeCloudSessionStatus[] | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const data = (payload as { data?: unknown }).data;
  if (!Array.isArray(data)) return null;
  const sessions: ClaudeCloudSessionStatus[] = [];
  for (const entry of data) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id.trim() : "";
    if (!id || id.length > 120) continue;
    if (!API_STATUSES.has(String(record.status))) continue;
    sessions.push({ id, status: record.status as ClaudeCloudApiStatus });
  }
  return sessions;
}

export function readClaudeNextPage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const next = (payload as { next_page?: unknown }).next_page;
  if (typeof next !== "string") return null;
  const trimmed = next.trim();
  if (!trimmed || trimmed.length > 500) return null;
  return trimmed;
}

export function parseClaudeCloudReport(value: unknown): ClaudeCloudReport | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.ok === false) {
    return isClaudeCloudFailure(record.error) ? { ok: false, error: record.error } : null;
  }
  if (record.ok !== true) return null;
  const sessions = readClaudeSessionList({ data: record.sessions });
  if (!sessions) return null;
  return { ok: true, sessions };
}

export type ClaudeCloudClient = {
  listSessions(signal: AbortSignal): Promise<unknown>;
};

/**
 * Polls only while `signal` is alive. A failed call emits the failure.
 * It never emits idle to fill a gap.
 */
export async function observeClaudeCloudSessions(options: {
  client: ClaudeCloudClient;
  signal: AbortSignal;
  emit: (report: ClaudeCloudReport) => void;
  sleep: (ms: number, signal: AbortSignal) => Promise<void>;
}): Promise<void> {
  try {
    while (!options.signal.aborted) {
      try {
        const payload = await options.client.listSessions(options.signal);
        if (options.signal.aborted) return;
        const sessions = readClaudeSessionList(payload);
        options.emit(
          sessions
            ? { ok: true, sessions }
            : { ok: false, error: CLAUDE_CLOUD_FAILURES.invalid },
        );
      } catch (error) {
        if (isAbortError(error) || options.signal.aborted) return;
        const status = error instanceof ClaudeStatusHttpError ? error.status : 0;
        options.emit({
          ok: false,
          error: status ? claudeCloudFailureForHttp(status) : CLAUDE_CLOUD_FAILURES.unavailable,
        });
      }
      await options.sleep(4_000, options.signal);
    }
  } catch (error) {
    if (isAbortError(error)) return;
    throw error;
  }
}

export class ClaudeStatusHttpError extends Error {
  constructor(readonly status: number) {
    super(`anthropic_http_${status}`);
    this.name = "ClaudeStatusHttpError";
  }
}

/**
 * The hired Claude cloud desk shows the API status of the session this desk
 * started. No matching row, and no report yet, are unknown. A failure is the
 * error text. The internal hire event is not used as a stand-in.
 */
export function applyClaudeCloudLabels(
  agents: readonly PlacedAgent[],
  dispatches: readonly DispatchRecord[],
  report: ClaudeCloudReport | null,
): PlacedAgent[] {
  return agents.map((agent) => {
    if (agent.event.origin !== "cloud" || agent.form?.provider !== "anthropic") {
      return { ...agent, claudeCloudLabel: null };
    }
    return { ...agent, claudeCloudLabel: labelForDesk(agent.id, dispatches, report) };
  });
}

export function placedStatusText(agent: {
  claudeCloudLabel?: string | null;
  event: { status: AgentStatus };
}): string {
  if (agent.claudeCloudLabel) return agent.claudeCloudLabel;
  return STATUS_LABELS[agent.event.status];
}

function labelForDesk(
  deskId: string,
  dispatches: readonly DispatchRecord[],
  report: ClaudeCloudReport | null,
): string {
  if (!report) return "unknown";
  if (!report.ok) return report.error;
  const started = dispatches
    .filter(
      (record) =>
        record.provider === "anthropic" &&
        record.deskId === deskId &&
        record.claudeSessionId,
    )
    .sort((a, b) => {
      const byTime = b.createdAt.localeCompare(a.createdAt);
      return byTime === 0 ? a.issueId.localeCompare(b.issueId) : byTime;
    });
  const sessionId = started[0]?.claudeSessionId;
  if (!sessionId) return "unknown";
  const found = report.sessions.find((session) => session.id === sessionId);
  return found ? found.status : "unknown";
}

function isClaudeCloudFailure(value: unknown): value is ClaudeCloudFailure {
  return typeof value === "string" && FAILURES.has(value);
}
