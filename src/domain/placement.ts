import {DESK_CAPACITY,LOCAL_CAPACITY,LOCAL_POSTS,LOCAL_AREA} from "./office-map";
import { isAgentEvent, type AgentEvent } from "./agent-event";
import type { DeskRecord } from "./desks";
import type { JobForm } from "./job-form";
import { presentLocalEvent } from "./local-hooks";

export type PlacedAgent = {
  id: string;
  displayName?: string;
  x: number;
  z: number;
  form: JobForm | null;
  event: AgentEvent;
  /** Managed Agents status, unknown, or a failure. Null on every other desk. */
  claudeCloudLabel?: string | null;
  /** Set when a local machine reported itself. False means that machine stopped sending. */
  machineOnline?: boolean;
};


/** Right of the lobby floor. Local seats never share a cloud desk coordinate. */
export const LOCAL_WING = LOCAL_POSTS;

export function localWingSlot(index: number): { x: number; z: number } {
  if(!Number.isInteger(index)||index<0||index>=LOCAL_CAPACITY)throw new Error("Capacidade da ala local atingida (9)." );
  const col = index % 2;
  const row = Math.floor(index / 2);
  return { x: LOCAL_POSTS.x + col * LOCAL_POSTS.columnGap, z: LOCAL_POSTS.z - row * LOCAL_POSTS.rowGap };
}

export function localWingPlate(): { x: number; z: number; width: number; depth: number } {
  return {x:LOCAL_AREA.x,z:LOCAL_AREA.z,width:LOCAL_AREA.width,depth:LOCAL_AREA.depth};
}

export function deskSlot(index: number): { x: number; z: number } {
  if(!Number.isInteger(index)||index<0||index>=DESK_CAPACITY)throw new Error("Capacidade de postos atingida (9).");
  const col = index % 3;
  const row = Math.floor(index / 3);
  return { x: -2.2 + col * 2.9, z: -3.4 + row * 2.75 };
}

export function hireEvent(
  desk: DeskRecord,
  owner: string,
  observedAt: string,
): AgentEvent {
  return {
    provider: desk.form.provider,
    origin: "cloud",
    owner,
    machineId: null,
    projectId: null,
    status: "idle",
    observedAt,
  };
}

/**
 * Desks keep the ficha. The Cursor cloud observation updates the desk that
 * received a dispatch, or the earliest Cursor desk when none has. With no
 * Cursor hire, that same event stands in the lobby.
 */
export function bindAgents(input: {
  desks: readonly DeskRecord[];
  observed: AgentEvent | null;
  owner: string;
  preferredDeskId?: string | null;
}): PlacedAgent[] {
  const desks = [...input.desks].sort((a, b) => {
    const byTime = a.createdAt.localeCompare(b.createdAt);
    return byTime === 0 ? a.id.localeCompare(b.id) : byTime;
  });
  const observed =
    input.observed && input.observed.origin === "cloud" ? input.observed : null;
  const preferred = input.preferredDeskId
    ? desks.find(
        (desk) => desk.id === input.preferredDeskId && desk.form.provider === "cursor",
      )?.id
    : null;
  let bound = false;
  const cloudReserve=observed&&!desks.some(d=>d.form.provider==="cursor")?1:0;
  const placed: PlacedAgent[] = desks.slice(0,DESK_CAPACITY-cloudReserve).map((desk, index) => {
    const slot = deskSlot(index);
    const eligible =
      observed !== null &&
      observed.provider === "cursor" &&
      observed.origin === "cloud" &&
      desk.form.provider === "cursor";
    const takeObserved = !bound && eligible && (preferred ? desk.id === preferred : true);
    if (takeObserved) bound = true;
    return {
      id: desk.id,
      x: slot.x,
      z: slot.z,
      form: desk.form,
      event: takeObserved && observed ? observed : hireEvent(desk, input.owner, desk.createdAt),
    };
  });
  if (observed && !bound && placed.length<DESK_CAPACITY) {
    placed.push({
      id: `observed:${observed.provider}`,
      ...deskSlot(placed.length),
      form: null,
      event: observed,
    });
  }
  return placed;
}

const WING_PROVIDERS = ["cursor", "anthropic", "openai"] as const;
type WingProvider = (typeof WING_PROVIDERS)[number];

function isWingProvider(provider: string): provider is WingProvider {
  return provider === "cursor" || provider === "anthropic" || provider === "openai";
}

/**
 * Hired Cursor, Claude, and OpenAI desks get a second seat in the local wing.
 * The cloud desk id is never reused. OpenAI follows the local Codex app-server,
 * not a cloud fleet.
 */
export function bindLocalWing(input: {
  desks: readonly DeskRecord[];
  observed: {
    cursor: AgentEvent | null;
    anthropic: AgentEvent | null;
    openai: AgentEvent | null;
  };
  owner: string;
  machineId: string | null;
  machineOnline: boolean;
}): PlacedAgent[] {
  const owner = input.owner.trim() || "esta máquina";
  const desks = [...input.desks]
    .filter((desk) => isWingProvider(desk.form.provider))
    .sort((a, b) => {
      const byTime = a.createdAt.localeCompare(b.createdAt);
      return byTime === 0 ? a.id.localeCompare(b.id) : byTime;
    });
  const bound: Record<WingProvider, boolean> = { cursor: false, anthropic: false, openai: false };
  const placed: PlacedAgent[] = [];
  let slot = 0;

  const fallbackCount=WING_PROVIDERS.filter(p=>input.observed[p]&&isAgentEvent(input.observed[p])&&!desks.some(d=>d.form.provider===p)).length;
  for (const desk of desks.slice(0,LOCAL_CAPACITY-fallbackCount)) {
    const provider = desk.form.provider as WingProvider;
    const candidate = input.observed[provider];
    const take =
      !bound[provider] &&
      candidate !== null &&
      candidate.origin === "local" &&
      candidate.provider === provider &&
      isAgentEvent(candidate);
    if (take) bound[provider] = true;
    const machineId = take && candidate ? candidate.machineId : input.machineId;
    if (!machineId || !machineId.trim()) continue;
    if(slot>=LOCAL_CAPACITY)continue;
    const position = localWingSlot(slot);
    slot += 1;
    const idle: AgentEvent = {
      provider,
      origin: "local",
      owner,
      machineId,
      projectId: null,
      status: "idle",
      observedAt: desk.createdAt,
    };
    placed.push({
      id: `local:${desk.id}`,
      x: position.x,
      z: position.z,
      form: desk.form,
      event: presentLocalEvent(take && candidate ? candidate : idle, input.machineOnline),
    });
  }

  for (const provider of WING_PROVIDERS) {
    if (bound[provider]) continue;
    const candidate = input.observed[provider];
    if (!candidate || candidate.origin !== "local" || candidate.provider !== provider) continue;
    if (!isAgentEvent(candidate)) continue;
    if(slot>=LOCAL_CAPACITY)continue;
    const position = localWingSlot(slot);
    slot += 1;
    placed.push({
      id: `local-observed:${provider}`,
      x: position.x,
      z: position.z,
      form: null,
      event: presentLocalEvent(candidate, input.machineOnline),
    });
  }

  return placed;
}

export function localWingOverflow(desks:readonly DeskRecord[],observed:Partial<Record<WingProvider,AgentEvent|null>>):number {
 const hired=desks.filter(d=>isWingProvider(d.form.provider));
 const unbound=WING_PROVIDERS.filter(p=>observed[p]&&isAgentEvent(observed[p])&&!hired.some(d=>d.form.provider===p)).length;
 return Math.max(0,hired.length+unbound-LOCAL_CAPACITY);
}
export function cloudDeskOverflow(desks:readonly DeskRecord[],observed:AgentEvent|null):number {
 return Math.max(0,desks.length+(observed?.origin==='cloud'&&!desks.some(d=>d.form.provider==='cursor')?1:0)-DESK_CAPACITY);
}
