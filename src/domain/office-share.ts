import {readRoutineVisual,type RoutineVisual} from "./agent-routines";
import { readTimeZone } from "./office-time";
import { isAgentEvent, type AgentEvent } from "./agent-event";
import { isClaudeCloudLabel } from "./claude-cloud-status";
import { presentLocalEvent } from "./local-hooks";
import {
  LOCAL_REPORT_STALE_MS,
  mergeFloor,
  nextCloudSlot,
  readLocalMachineReport,
  type StoredLocalReport,
} from "./office-machines";
import type { JobForm } from "./job-form";
import { hireEvent, type PlacedAgent } from "./placement";
import { PROJECT_CAPACITY } from "./office-map";
import { isProviderId } from "./providers";

export type OfficeRole = "host" | "interact" | "observer";

export type OfficeAction =
  | "publish"
  | "hire"
  | "drop"
  | "dispatch"
  | "create_card"
  | "open_room";

export type SharedRoom = {
  id: string;
  name: string;
  x: number;
  z: number;
};

/** Status the colleague is allowed to see. No transcript, path, or secret. */
export type SharedScene = {
  hostName: string;
  hostTimeZone?: string;
  localOffline: boolean;
  rooms: SharedRoom[];
  agents: PlacedAgent[];
  routines?: RoutineVisual[];
};

const ROOM_CAP = 24;
const AGENT_CAP = 48;

export function canPerform(role: OfficeRole, action: OfficeAction): boolean {
  if (role === "host") return true;
  if (role === "interact") return action !== "publish";
  return false;
}

export function decideSignIn(input: {
  intent: OfficeRole;
  name: string;
  machineName: string;
  hostName: string | null;
  hostTaken: boolean;
}):
  | { ok: true; role: OfficeRole; name: string }
  | { ok: false; reason: "same_person" | "host_taken" | "name_required" } {
  const machine = input.machineName.trim();
  if (input.intent === "host") {
    if (!machine) return { ok: false, reason: "name_required" };
    if (input.hostTaken) return { ok: false, reason: "host_taken" };
    return { ok: true, role: "host", name: machine.slice(0, 40) };
  }
  const name = input.name.trim().slice(0, 40);
  if (!name) return { ok: false, reason: "name_required" };
  const host = input.hostName?.trim() ?? "";
  if (
    name.toLowerCase() === machine.toLowerCase() ||
    (host.length > 0 && name.toLowerCase() === host.toLowerCase())
  ) {
    return { ok: false, reason: "same_person" };
  }
  return { ok: true, role: input.intent, name };
}

function finiteCoord(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) > 400) return null;
  return value;
}

function clip(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/** Rebuilds a scene from the status fields. A Claude cloud label is kept only from the closed set. Extra keys are dropped. */
export function readSharedScene(value: unknown): SharedScene | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const hostName = clip(record.hostName, 40);
  if (!hostName) return null;
  if (typeof record.localOffline !== "boolean") return null;
  if (!Array.isArray(record.rooms) || !Array.isArray(record.agents)) return null;

  const rooms: SharedRoom[] = [];
  for (const entry of record.rooms) {
    if (rooms.length >= ROOM_CAP) break;
    if (!entry || typeof entry !== "object") continue;
    const room = entry as Record<string, unknown>;
    const id = clip(room.id, 80);
    const x = finiteCoord(room.x);
    const z = finiteCoord(room.z);
    if (!id || x === null || z === null) continue;
    rooms.push({ id, name: clip(room.name, 80) || "Sem nome", x, z });
  }

  const agents: PlacedAgent[] = [];
  for (const entry of record.agents) {
    if (agents.length >= AGENT_CAP) break;
    if (!entry || typeof entry !== "object") continue;
    const agent = entry as Record<string, unknown>;
    const id = clip(agent.id, 80);
    const x = finiteCoord(agent.x);
    const z = finiteCoord(agent.z);
    if (!id || x === null || z === null) continue;
    const event = readEvent(agent.event);
    if (!event) continue;
    const form = readForm(agent.form);
    if (form === undefined) continue;
    const claudeCloudLabel = readClaudeLabel(agent.claudeCloudLabel);
    const machineOnline = typeof agent.machineOnline === "boolean" ? agent.machineOnline : undefined;
    agents.push({ id, x, z, form, event, claudeCloudLabel, ...(clip(agent.displayName,60)?{displayName:clip(agent.displayName,60)}:{}), ...(machineOnline === undefined ? {} : { machineOnline }) });
  }

  return { hostName, ...(readTimeZone(record.hostTimeZone) ? { hostTimeZone: readTimeZone(record.hostTimeZone) } : {}), localOffline: record.localOffline, rooms, agents, ...(Array.isArray(record.routines) ? {routines:record.routines.slice(0,49).flatMap((r:unknown)=>{const visual=readRoutineVisual(r);return visual?[visual]:[];})} : {}) };
}

function readClaudeLabel(value: unknown): string | null {
  if (value == null) return null;
  return isClaudeCloudLabel(value) ? value : null;
}

function readForm(value: unknown): PlacedAgent["form"] | undefined {
  if (value === null) return null;
  if (!value || typeof value !== "object") return undefined;
  const form = value as Record<string, unknown>;
  const role = clip(form.role, 80);
  if (!role || !isProviderId(form.provider)) return undefined;
  return { role, provider: form.provider };
}

function readEvent(value: unknown): AgentEvent | null {
  if (!value || typeof value !== "object") return null;
  const event = value as Record<string, unknown>;
  const candidate = {
    provider: event.provider,
    origin: event.origin,
    owner: clip(event.owner, 80),
    machineId: event.machineId === null ? null : clip(event.machineId, 80) || null,
    projectId: event.projectId === null ? null : clip(event.projectId, 80) || null,
    status: event.status,
    observedAt: clip(event.observedAt, 40),
  };
  return isAgentEvent(candidate) ? candidate : null;
}

/** The host page closed. That machine's local agents stop working. Other machines stay as reported. */
export function sceneWithoutHost(scene: SharedScene, hostMachineId?: string | null): SharedScene {
  return {
    hostName: scene.hostName,
    ...(scene.hostTimeZone ? { hostTimeZone: scene.hostTimeZone } : {}),
    localOffline: true,
    ...(scene.routines?{routines:scene.routines.map(r=>({...r,state:r.state==='working'?'sleeping' as const:r.state}))}:{}),
    rooms: scene.rooms.map((room) => ({ ...room })),
    agents: scene.agents.map((agent) => {
      const hostLocal =
        agent.event.origin === "local" &&
        (!hostMachineId || agent.event.machineId === hostMachineId);
      if (!hostLocal) {
        return {
          ...agent,
          form: agent.form ? { ...agent.form } : null,
          event: { ...agent.event },
        };
      }
      return {
        ...agent,
        machineOnline: false,
        form: agent.form ? { ...agent.form } : null,
        event: presentLocalEvent(agent.event, false),
      };
    }),
  };
}

type Listener = (scene: SharedScene | null) => void;

type Member = {
  role: OfficeRole;
  listener: Listener;
};

export function createOfficeHub(options: { graceMs: number; onEmpty?: () => void }) {
  let snapshot: SharedScene | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let refreshTimer: ReturnType<typeof setTimeout> | null = null;
  let hostMachineId: string | null = null;
  let hostReport: StoredLocalReport | null = null;
  const reports = new Map<string, StoredLocalReport>();
  const members = new Set<Member>();

  const hostCount = () => {
    let count = 0;
    for (const member of members) if (member.role === "host") count += 1;
    return count;
  };

  const fanout = () => {
    for (const member of members) member.listener(snapshot);
  };

  const clearRefresh = () => {
    if (!refreshTimer) return;
    clearTimeout(refreshTimer);
    refreshTimer = null;
  };

  const wipe = () => {
    snapshot = null;
    hostMachineId = null;
    hostReport = null;
    reports.clear();
    clearRefresh();
    fanout();
    options.onEmpty?.();
  };

  const applyFloor = (
    incoming: SharedScene | null,
    hostLocalsFrom: "incoming" | "keep",
    rooms?: SharedScene["rooms"],
  ) => {
    const next = mergeFloor({
      previous: snapshot,
      incoming,
      reports: [...reports.values()],
      now: Date.now(),
      hostMachineId,
      hostPresent: hostCount() > 0,
      hostLocalsFrom,
      hostReport,
      ...(rooms ? { rooms } : {}),
    });
    snapshot = next as SharedScene | null;
  };

  const scheduleRefresh = () => {
    clearRefresh();
    if ((reports.size === 0 && !hostReport) || members.size === 0) return;
    const timerId = setTimeout(() => {
      refreshTimer = null;
      if (members.size === 0) return;
      applyFloor(null, "keep");
      fanout();
      scheduleRefresh();
    }, LOCAL_REPORT_STALE_MS);
    refreshTimer = timerId;
    if (typeof timerId === "object" && timerId && "unref" in timerId) timerId.unref();
  };

  return {
    viewerCount() {
      return members.size;
    },
    hostCount,
    snapshot() {
      return snapshot;
    },
    join(role: OfficeRole, listener: Listener) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      const member: Member = { role, listener };
      members.add(member);
      listener(snapshot);
      return () => {
        if (!members.delete(member)) return;
        if (hostCount() === 0 && snapshot && members.size > 0) {
          const live =
            hostReport &&
            hostReport.report.online &&
            Date.now() - hostReport.seenAt <= LOCAL_REPORT_STALE_MS;
          if (live) applyFloor(null, "keep");
          else snapshot = sceneWithoutHost(snapshot, hostMachineId);
          fanout();
        }
        if (members.size > 0) return;
        const finish = () => {
          timer = null;
          if (members.size === 0) wipe();
        };
        if (options.graceMs <= 0) finish();
        else timer = setTimeout(finish, options.graceMs);
      };
    },
    publish(role: OfficeRole, scene: unknown) {
      if (!canPerform(role, "publish")) return { ok: false as const, reason: "read_only" as const };
      if (members.size <= 0) return { ok: false as const, reason: "closed" as const };
      const clean = readSharedScene(scene);
      if (!clean) return { ok: false as const, reason: "invalid" as const };
      const detected = singleLocalMachine(clean.agents);
      if (detected && !hostReport) hostMachineId = detected;
      applyFloor(clean, "incoming");
      fanout();
      return { ok: true as const };
    },
    /** This machine's own observer. A later publish cannot erase a session it still reports. */
    noteHostLocal(report: unknown) {
      const clean = readLocalMachineReport(report);
      if (!clean) return { ok: false as const, reason: "invalid" as const };
      hostMachineId = clean.machineId;
      hostReport = { report: clean, seenAt: Date.now() };
      if (members.size > 0) {
        applyFloor(null, "keep");
        fanout();
        scheduleRefresh();
      } else {
        applyFloor(null, "keep");
      }
      return { ok: true as const };
    },
    hostLocalReport() {
      return hostReport;
    },
    /** Drops peer-built state once no page is joined and discovery has stopped. */
    releaseIdle() {
      if (members.size > 0) return;
      hostReport = null;
      hostMachineId = null;
      reports.clear();
      snapshot = null;
      clearRefresh();
    },
    acceptPeerScene(input: { report: unknown; rooms: SharedRoom[]; cloud: PlacedAgent[] }) {
      if (members.size <= 0) return { ok: false as const, reason: "closed" as const };
      const clean = readLocalMachineReport(input.report);
      if (!clean) return { ok: false as const, reason: "invalid" as const };
      if (!(hostMachineId && clean.machineId === hostMachineId)) {
        reports.set(clean.machineId, { report: clean, seenAt: Date.now() });
        scheduleRefresh();
      }
      const hostName = (snapshot?.hostName ?? clean.owner.slice(0, 40)) || "Escritório";
      applyFloor(
        {
          hostName,
          ...(snapshot?.hostTimeZone ? { hostTimeZone: snapshot.hostTimeZone } : {}),
          localOffline: snapshot?.localOffline ?? false,
          rooms: input.rooms,
          agents: input.cloud,
        },
        "keep",
      );
      fanout();
      return { ok: true as const };
    },
    reportLocal(report: unknown) {
      if (members.size <= 0) return { ok: false as const, reason: "closed" as const };
      const clean = readLocalMachineReport(report);
      if (!clean) return { ok: false as const, reason: "invalid" as const };
      if (hostMachineId && clean.machineId === hostMachineId) {
        return { ok: true as const };
      }
      reports.set(clean.machineId, { report: clean, seenAt: Date.now() });
      applyFloor(null, "keep");
      fanout();
      scheduleRefresh();
      return { ok: true as const };
    },
    hire(role: OfficeRole, input: { id: string; form: JobForm; owner: string; observedAt: string }) {
      if (!canPerform(role, "hire")) return { ok: false as const, reason: "read_only" as const };
      if (members.size <= 0) return { ok: false as const, reason: "closed" as const };
      const slot = nextCloudSlot(snapshot?.agents ?? []);
      if (!slot) return { ok: false as const, reason: "capacity" as const };
      if ((snapshot?.agents ?? []).some((agent) => agent.id === input.id)) {
        return { ok: false as const, reason: "exists" as const };
      }
      const agent: PlacedAgent = {
        id: input.id,
        x: slot.x,
        z: slot.z,
        form: input.form,
        event: hireEvent(
          { id: input.id, form: input.form, createdAt: input.observedAt },
          input.owner,
          input.observedAt,
        ),
      };
      applyFloor(partialScene(snapshot, input.owner, [agent]), "keep");
      fanout();
      return { ok: true as const };
    },
    openRoom(role: OfficeRole, rooms: SharedRoom[]) {
      if (!canPerform(role, "open_room")) return { ok: false as const, reason: "read_only" as const };
      if (members.size <= 0) return { ok: false as const, reason: "closed" as const };
      if (rooms.length > PROJECT_CAPACITY) return { ok: false as const, reason: "capacity" as const };
      applyFloor(partialScene(snapshot, snapshot?.hostName ?? "Escritório", []), "keep", rooms);
      fanout();
      return { ok: true as const };
    },
  };
}

function singleLocalMachine(agents: readonly PlacedAgent[]): string | null {
  const ids = new Set(
    agents.flatMap((agent) =>
      agent.event.origin === "local" && agent.event.machineId ? [agent.event.machineId] : [],
    ),
  );
  if (ids.size !== 1) return null;
  return [...ids][0] ?? null;
}

function partialScene(current: SharedScene | null, owner: string, agents: PlacedAgent[]): SharedScene {
  return {
    hostName: (current?.hostName ?? owner.slice(0, 40)) || "Escritório",
    ...(current?.hostTimeZone ? { hostTimeZone: current.hostTimeZone } : {}),
    localOffline: current?.localOffline ?? false,
    rooms: [],
    agents,
  };
}
