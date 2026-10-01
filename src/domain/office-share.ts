import {readRoutineVisual,type RoutineVisual} from "./agent-routines";
import { readTimeZone } from "./office-time";
import { isAgentEvent, type AgentEvent } from "./agent-event";
import { presentLocalEvent } from "./local-hooks";
import type { PlacedAgent } from "./placement";
import { isProviderId } from "./providers";

export type OfficeRole = "host" | "colleague";

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
  void action;
  return role === "host";
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
  return { ok: true, role: "colleague", name };
}

function finiteCoord(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) > 400) return null;
  return value;
}

function clip(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/** Rebuilds a scene from the seven agent fields. Extra keys are dropped. */
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
    agents.push({ id, x, z, form, event, ...(clip(agent.displayName, 60) ? { displayName: clip(agent.displayName, 60) } : {}) });
  }

  return { hostName, ...(readTimeZone(record.hostTimeZone) ? { hostTimeZone: readTimeZone(record.hostTimeZone) } : {}), localOffline: record.localOffline, rooms, agents, ...(Array.isArray(record.routines) ? {routines:record.routines.slice(0,49).flatMap((r:unknown)=>{const visual=readRoutineVisual(r);return visual?[visual]:[];})} : {}) };
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

/** The host page closed. Colleagues keep the rooms, without a working local agent. */
export function sceneWithoutHost(scene: SharedScene): SharedScene {
  return {
    hostName: scene.hostName,
    ...(scene.hostTimeZone ? { hostTimeZone: scene.hostTimeZone } : {}),
    localOffline: true,
    ...(scene.routines?{routines:scene.routines.map(r=>({...r,state:r.state==='working'?'sleeping' as const:r.state}))}:{}),
    rooms: scene.rooms.map((room) => ({ ...room })),
    agents: scene.agents.map((agent) => ({
      ...agent,
      form: agent.form ? { ...agent.form } : null,
      event: presentLocalEvent(agent.event, false),
    })),
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
  const members = new Set<Member>();

  const hostCount = () => {
    let count = 0;
    for (const member of members) if (member.role === "host") count += 1;
    return count;
  };

  const fanout = () => {
    for (const member of members) member.listener(snapshot);
  };

  const wipe = () => {
    snapshot = null;
    fanout();
    options.onEmpty?.();
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
          snapshot = sceneWithoutHost(snapshot);
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
      snapshot = clean;
      fanout();
      return { ok: true as const };
    },
  };
}
