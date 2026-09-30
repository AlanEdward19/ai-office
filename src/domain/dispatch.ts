import type { JobForm } from "./job-form";
import { isProviderId, PROVIDER_LABELS, type ProviderId } from "./providers";

export type DropRefusal =
  | "no_desk"
  | "desk_without_form"
  | "provider_not_logged_in"
  | "dispatch_not_available";

export type DropDecision =
  | { ok: true; deskId: string; provider: "cursor" }
  | { ok: false; reason: DropRefusal; provider: ProviderId | null };

/**
 * A card can leave the board only onto a desk that already keeps a ficha.
 * Cursor is the only company with a dispatch. The others stay refused.
 */
export function decideDrop(input: {
  desk: { id: string; form: JobForm | null } | null;
  loggedIn: readonly ProviderId[];
}): DropDecision {
  if (!input.desk) return { ok: false, reason: "no_desk", provider: null };
  if (!input.desk.form) {
    return { ok: false, reason: "desk_without_form", provider: null };
  }
  const provider = input.desk.form.provider;
  if (!input.loggedIn.includes(provider)) {
    return { ok: false, reason: "provider_not_logged_in", provider };
  }
  if (provider !== "cursor") {
    return { ok: false, reason: "dispatch_not_available", provider };
  }
  return { ok: true, deskId: input.desk.id, provider: "cursor" };
}

export function serverDispatchCopy(code: string, provider: ProviderId | null): string {
  if (code === "provider_not_logged_in" || code === "dispatch_not_available") {
    return refusalCopy(code, provider);
  }
  if (code === "cursor_key_missing") {
    return "Defina CURSOR_API_KEY nesta máquina para iniciar o cloud agent. O card continua no quadro.";
  }
  if (code === "wrong_project") {
    return "Essa issue não é deste projeto. O card não foi disparado.";
  }
  if (code === "cursor_rejected") {
    return "A chave do Cursor foi recusada. Ela fica só nesta máquina.";
  }
  if (code === "missing_key") {
    return "Defina LINEAR_API_KEY nesta máquina para ligar a issue ao disparo.";
  }
  return "Não foi possível disparar o card. Ele continua no quadro.";
}

export function refusalCopy(reason: DropRefusal, provider: ProviderId | null): string {
  if (reason === "no_desk") return "Solte o card em uma mesa.";
  if (reason === "desk_without_form") {
    return "Esta mesa não tem ficha. Use a ficha de vaga para contratar, e só então solte o card.";
  }
  if (reason === "provider_not_logged_in") {
    const company = provider ? PROVIDER_LABELS[provider] : "A empresa desta ficha";
    return `${company} não está logada nesta máquina. O card continua no quadro.`;
  }
  const company = provider ? PROVIDER_LABELS[provider] : "Essa empresa";
  return `Ainda não existe disparo para ${company}. O card volta para o quadro até esse disparo existir.`;
}

export function cursorDispatchName(issue: { identifier: string; title: string }): string {
  const name = `${issue.identifier} ${issue.title}`.trim();
  return name.slice(0, 100);
}

export function cursorCreateBody(issue: {
  identifier: string;
  title: string;
  url: string;
  description: string | null;
}): { name: string; prompt: { text: string } } {
  return {
    name: cursorDispatchName(issue),
    prompt: { text: cursorDispatchPrompt(issue) },
  };
}

export function cursorDispatchPrompt(issue: {
  identifier: string;
  title: string;
  url: string;
  description: string | null;
}): string {
  const lines = [
    `Work on Linear issue ${issue.identifier}: ${issue.title}.`,
    issue.url ? `Issue: ${issue.url}` : "",
  ].filter((line) => line.length > 0);
  if (issue.description) {
    lines.push("", issue.description.slice(0, 6000));
  }
  return lines.join("\n");
}

export function cursorAgentPageUrl(id: string, url: string | null): string {
  if (url && /^https:\/\/cursor\.com\/agents\/[^/\s]+$/.test(url)) return url;
  return `https://cursor.com/agents/${id}`;
}

export function dispatchAttachment(agentUrl: string): { title: string; url: string } {
  return { title: "Cloud agent do Cursor", url: agentUrl };
}

export function dispatchComment(agentUrl: string): string {
  return `Disparo do escritório. Cloud agent do Cursor: ${agentUrl}`;
}

export type CreatedCursorAgent = {
  id: string;
  url: string;
  status: string | null;
  runId: string | null;
};

export function readCreatedCursorAgent(payload: unknown): CreatedCursorAgent | null {
  if (!payload || typeof payload !== "object") return null;
  const agent = (payload as { agent?: unknown }).agent;
  if (!agent || typeof agent !== "object") return null;
  const record = agent as Record<string, unknown>;
  if (typeof record.id !== "string" || !record.id.trim()) return null;
  const id = record.id.trim();
  const url = typeof record.url === "string" ? record.url : null;
  const run = (payload as { run?: unknown }).run;
  const runId =
    run && typeof run === "object" && typeof (run as { id?: unknown }).id === "string"
      ? (run as { id: string }).id
      : null;
  return {
    id,
    url: cursorAgentPageUrl(id, url),
    status: typeof record.status === "string" ? record.status : null,
    runId,
  };
}

export function readLinkSuccess(payload: unknown, field: "attachmentCreate" | "commentCreate"): boolean {
  if (!payload || typeof payload !== "object") return false;
  const data = (payload as { data?: unknown }).data;
  if (!data || typeof data !== "object") return false;
  const created = (data as Record<string, unknown>)[field];
  if (!created || typeof created !== "object") return false;
  return (created as { success?: unknown }).success === true;
}

export function nearestDeskId(
  points: readonly { id: string; x: number; y: number }[],
  pointerX: number,
  pointerY: number,
  radius: number,
): string | null {
  let best: { id: string; distance: number } | null = null;
  for (const point of points) {
    const distance = Math.hypot(point.x - pointerX, point.y - pointerY);
    if (distance > radius) continue;
    if (!best || distance < best.distance || (distance === best.distance && point.id < best.id)) {
      best = { id: point.id, distance };
    }
  }
  return best?.id ?? null;
}

export const DISPATCHES_STORAGE_KEY = "escritorio-de-ia.dispatches";

export type DispatchRecord = {
  issueId: string;
  projectId: string;
  deskId: string;
  provider: ProviderId;
  cursorAgentId: string | null;
  cursorAgentUrl: string | null;
  createdAt: string;
};

export function serializeDispatches(dispatches: readonly DispatchRecord[]): string {
  return JSON.stringify({ version: 1, dispatches });
}

export function loadDispatches(raw: string | null): DispatchRecord[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as { version?: unknown; dispatches?: unknown };
    if (parsed.version !== 1 || !Array.isArray(parsed.dispatches)) return [];
    return parsed.dispatches.flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const record = entry as Record<string, unknown>;
      if (typeof record.issueId !== "string" || !record.issueId) return [];
      if (typeof record.projectId !== "string" || !record.projectId) return [];
      if (typeof record.deskId !== "string" || !record.deskId) return [];
      if (!isProviderId(record.provider)) return [];
      if (typeof record.createdAt !== "string") return [];
      return [
        {
          issueId: record.issueId,
          projectId: record.projectId,
          deskId: record.deskId,
          provider: record.provider,
          cursorAgentId:
            typeof record.cursorAgentId === "string" && record.cursorAgentId
              ? record.cursorAgentId
              : null,
          cursorAgentUrl:
            typeof record.cursorAgentUrl === "string" && record.cursorAgentUrl
              ? record.cursorAgentUrl
              : null,
          createdAt: record.createdAt,
        },
      ];
    });
  } catch {
    return [];
  }
}

export function preferredCursorDeskId(dispatches: readonly DispatchRecord[]): string | null {
  const linked = dispatches.filter(
    (record) => record.provider === "cursor" && record.cursorAgentId,
  );
  linked.sort((a, b) => {
    const byTime = b.createdAt.localeCompare(a.createdAt);
    return byTime === 0 ? a.issueId.localeCompare(b.issueId) : byTime;
  });
  return linked[0]?.deskId ?? null;
}

export function dispatchForIssue(
  dispatches: readonly DispatchRecord[],
  projectId: string,
  issueId: string,
): DispatchRecord | null {
  return (
    dispatches.find((record) => record.projectId === projectId && record.issueId === issueId) ??
    null
  );
}
