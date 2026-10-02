import type { RoutineVisual } from "./agent-routines";
import { isAgentEvent, type AgentEvent } from "./agent-event";
import { presentLocalEvent } from "./local-hooks";
import { DESK_CAPACITY, LOCAL_CAPACITY } from "./office-map";
import { deskSlot, localWingSlot, type PlacedAgent } from "./placement";

/** Loopback status port. The office page reads it; it is not the shared server. */
export const LOCAL_DESK_PORT = 3848;
export const LOCAL_REPORT_STALE_MS = 12_000;
export const LOCAL_REPORT_DROP_MS = 30_000;

const WING_PROVIDERS = ["cursor", "anthropic", "openai"] as const;

export type LocalMachineReport = {
  machineId: string;
  owner: string;
  online: boolean;
  agents: AgentEvent[];
};

export type StoredLocalReport = {
  report: LocalMachineReport;
  seenAt: number;
};

type FloorRoom = { id: string; name: string; x: number; z: number };

type Floor = {
  hostName: string;
  hostTimeZone?: string;
  localOffline: boolean;
  rooms: FloorRoom[];
  agents: PlacedAgent[];
  routines?: RoutineVisual[];
};

/** A local report is only the status fields a machine actually sent. */
export function readLocalMachineReport(value: unknown): LocalMachineReport | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const machineId = clip(record.machineId, 80);
  const owner = clip(record.owner, 80);
  if (!machineId || !owner || typeof record.online !== "boolean" || !Array.isArray(record.agents)) {
    return null;
  }
  const agents: AgentEvent[] = [];
  const seen = new Set<string>();
  for (const entry of record.agents) {
    if (agents.length >= WING_PROVIDERS.length) break;
    if (!isAgentEvent(entry) || entry.origin !== "local" || entry.machineId !== machineId) continue;
    if (!WING_PROVIDERS.includes(entry.provider as (typeof WING_PROVIDERS)[number])) continue;
    if (seen.has(entry.provider)) continue;
    seen.add(entry.provider);
    agents.push({
      provider: entry.provider,
      origin: "local",
      owner: entry.owner.trim().slice(0, 80),
      machineId,
      projectId: null,
      status: entry.status,
      observedAt: entry.observedAt.trim().slice(0, 40),
    });
  }
  return { machineId, owner, online: record.online, agents };
}

/**
 * Local agents name the person or machine that sent the status.
 * Cloud agents name the account or desk and never borrow a machine id.
 */
export function agentPlaceLabel(agent: {
  event: Pick<AgentEvent, "origin" | "owner">;
  form?: { role: string } | null;
  displayName?: string;
}): string {
  if (agent.event.origin === "local") {
    return `Local · ${agent.event.owner.trim() || "esta máquina"}`;
  }
  const desk = agent.displayName?.trim() || agent.form?.role?.trim();
  const who = agent.event.owner.trim() || "esta conta";
  return desk ? `Nuvem · ${who} · ${desk}` : `Nuvem · ${who}`;
}

/** One offline host must not mark another machine's local agent offline. */
export function localAgentOffline(
  origin: AgentEvent["origin"],
  machineOnline: boolean | undefined,
  sceneOffline: boolean,
): boolean {
  if (origin !== "local") return false;
  if (machineOnline === false) return true;
  if (machineOnline === true) return false;
  return sceneOffline;
}

export function officeLanUrls(
  entries: readonly { address?: string; internal?: boolean; family?: string | number }[],
  port: number,
): string[] {
  if (!Number.isInteger(port) || port < 1 || port > 65535) return [];
  const urls: string[] = [];
  for (const entry of entries) {
    if (!isIpv4(entry.family) || entry.internal) continue;
    const address = entry.address?.trim() ?? "";
    if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(address)) continue;
    const url = `http://${address}:${port}`;
    if (!urls.includes(url)) urls.push(url);
  }
  return urls;
}

export function mergeFloor(input: {
  previous: Floor | null;
  incoming: Floor | null;
  reports: readonly StoredLocalReport[];
  now: number;
  hostMachineId: string | null;
  hostPresent: boolean;
  /** Publish replaces the host machine's locals. A hire or a guest report keeps them. */
  hostLocalsFrom: "incoming" | "keep";
  /** Status this machine itself observed. It wins over a republish that omitted it. */
  hostReport?: StoredLocalReport | null;
  rooms?: FloorRoom[];
}): Floor | null {
  const previous = input.previous;
  const incoming = input.incoming;
  const hostLocals = hostLocalAgents({
    source: input.hostLocalsFrom === "incoming" ? incoming : previous,
    hostMachineId: input.hostMachineId,
    hostPresent: input.hostPresent,
    publishedOffline:
      input.hostLocalsFrom === "incoming" ? Boolean(incoming?.localOffline) : Boolean(previous?.localOffline),
    hostReport: input.hostReport ?? null,
    now: input.now,
  });
  const guestAgents = placeGuestAgents(input.reports, input.now, input.hostMachineId, hostLocals.length);
  if (!previous && !incoming && guestAgents.length === 0 && hostLocals.length === 0) return null;

  const hostName = clip(incoming?.hostName, 40) || clip(previous?.hostName, 40) || "Escritório";
  const hostTimeZone = incoming?.hostTimeZone ?? previous?.hostTimeZone;
  const rooms = input.rooms ?? unionRooms(previous?.rooms ?? [], incoming?.rooms ?? []);
  const cloud = unionCloud(previous?.agents ?? [], incoming?.agents ?? []);
  const locals = [...hostLocals, ...guestAgents].slice(0, LOCAL_CAPACITY);
  const routines = incoming?.routines ?? previous?.routines;

  return {
    hostName,
    ...(hostTimeZone ? { hostTimeZone } : {}),
    localOffline: hostWingOffline({
      hostPresent: input.hostPresent,
      hostReport: input.hostReport ?? null,
      hostMachineId: input.hostMachineId,
      now: input.now,
      incomingOffline: incoming?.localOffline,
      previousOffline: previous?.localOffline,
    }),
    rooms,
    agents: [...cloud, ...locals],
    ...(routines ? { routines } : {}),
  };
}

/** The wing follows this machine's own report. A page that lost the presence stream cannot mark it offline. */
function hostWingOffline(input: {
  hostPresent: boolean;
  hostReport: StoredLocalReport | null;
  hostMachineId: string | null;
  now: number;
  incomingOffline: boolean | undefined;
  previousOffline: boolean | undefined;
}): boolean {
  if (!input.hostPresent) return true;
  const report = input.hostReport;
  if (report && (!input.hostMachineId || report.report.machineId === input.hostMachineId)) {
    const age = input.now - report.seenAt;
    if (age > LOCAL_REPORT_STALE_MS) return true;
    return !report.report.online;
  }
  return Boolean(input.incomingOffline ?? input.previousOffline);
}

export function nextCloudSlot(agents: readonly PlacedAgent[]): { x: number; z: number } | null {
  const count = agents.filter((agent) => agent.event.origin === "cloud").length;
  if (count >= DESK_CAPACITY) return null;
  return deskSlot(count);
}

function hostLocalAgents(input: {
  source: Floor | null;
  hostMachineId: string | null;
  hostPresent: boolean;
  publishedOffline: boolean;
  hostReport: StoredLocalReport | null;
  now: number;
}): PlacedAgent[] {
  const report = input.hostReport;
  if (report && (!input.hostMachineId || report.report.machineId === input.hostMachineId)) {
    return localsFromHostReport(input.source?.agents ?? [], report, input.now);
  }
  const online = input.hostPresent && !input.publishedOffline;
  return localsForHost(input.source?.agents ?? [], input.hostMachineId)
    .slice(0, LOCAL_CAPACITY)
    .map((agent) => ({
      ...agent,
      machineOnline: online,
      form: agent.form ? { ...agent.form } : null,
      event: presentLocalEvent({ ...agent.event }, online),
    }));
}

/**
 * A session this machine reported is drawn, working only while that report says so.
 * A hired seat stays, but it is not shown working unless the report includes it.
 */
function localsFromHostReport(
  sceneAgents: readonly PlacedAgent[],
  stored: StoredLocalReport,
  now: number,
): PlacedAgent[] {
  const age = now - stored.seenAt;
  const dropped = age > LOCAL_REPORT_DROP_MS;
  const online = stored.report.online && age <= LOCAL_REPORT_STALE_MS;
  const sceneLocals = sceneAgents.filter(
    (agent) => agent.event.origin === "local" && agent.event.machineId === stored.report.machineId,
  );
  const byProvider = new Map(stored.report.agents.map((event) => [event.provider, event]));
  const used = new Set<string>();
  const placed: PlacedAgent[] = [];
  let slot = 0;
  for (const agent of sceneLocals) {
    if (!agent.form || slot >= LOCAL_CAPACITY) continue;
    const event = dropped ? undefined : byProvider.get(agent.event.provider);
    if (event) used.add(event.provider);
    const next = event ?? { ...agent.event, status: "idle" as const };
    placed.push({
      ...agent,
      machineOnline: online && !dropped,
      form: { ...agent.form },
      event: presentLocalEvent(next, online && !dropped),
    });
    slot += 1;
  }
  if (dropped) return placed;
  for (const event of stored.report.agents) {
    if (used.has(event.provider) || slot >= LOCAL_CAPACITY) continue;
    placed.push({
      id: `local:${event.machineId}:${event.provider}`,
      ...localWingSlot(slot),
      form: null,
      machineOnline: online,
      event: presentLocalEvent(event, online),
    });
    slot += 1;
  }
  return placed;
}

function localsForHost(agents: readonly PlacedAgent[], hostMachineId: string | null): PlacedAgent[] {
  if (!hostMachineId) return [];
  return agents.filter(
    (agent) => agent.event.origin === "local" && agent.event.machineId === hostMachineId,
  );
}

function placeGuestAgents(
  reports: readonly StoredLocalReport[],
  now: number,
  hostMachineId: string | null,
  startSlot: number,
): PlacedAgent[] {
  const placed: PlacedAgent[] = [];
  let slot = startSlot;
  const ordered = [...reports].sort((a, b) => a.report.machineId.localeCompare(b.report.machineId));
  for (const stored of ordered) {
    if (stored.report.machineId === hostMachineId) continue;
    const age = now - stored.seenAt;
    if (age > LOCAL_REPORT_DROP_MS) continue;
    const online = stored.report.online && age <= LOCAL_REPORT_STALE_MS;
    for (const event of stored.report.agents) {
      if (slot >= LOCAL_CAPACITY) return placed;
      placed.push({
        id: `local:${event.machineId}:${event.provider}`,
        ...localWingSlot(slot),
        form: null,
        machineOnline: online,
        event: presentLocalEvent(event, online),
      });
      slot += 1;
    }
  }
  return placed;
}

function unionRooms(previous: readonly FloorRoom[], incoming: readonly FloorRoom[]): FloorRoom[] {
  const rooms = new Map<string, FloorRoom>();
  for (const room of previous) rooms.set(room.id, { ...room });
  for (const room of incoming) rooms.set(room.id, { ...room });
  return [...rooms.values()];
}

function unionCloud(previous: readonly PlacedAgent[], incoming: readonly PlacedAgent[]): PlacedAgent[] {
  const cloud = new Map<string, PlacedAgent>();
  for (const agent of [...previous, ...incoming]) {
    if (agent.event.origin !== "cloud" || agent.event.machineId !== null) continue;
    cloud.set(agent.id, {
      ...agent,
      form: agent.form ? { ...agent.form } : null,
      event: { ...agent.event, machineId: null },
    });
  }
  return [...cloud.values()].slice(0, DESK_CAPACITY);
}

function clip(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function isIpv4(family: string | number | undefined): boolean {
  return family === "IPv4" || family === 4;
}
