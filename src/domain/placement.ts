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
};

const CLOUD_SPOT = { x: 0.15, z: -1.6 };

/** Right of the lobby floor. Local seats never share a cloud desk coordinate. */
export const LOCAL_WING = { x: 11.15, z: 0.2 };

export function localWingSlot(index: number): { x: number; z: number } {
  const col = index % 2;
  const row = Math.floor(index / 2);
  return { x: LOCAL_WING.x + col * 2.2, z: LOCAL_WING.z + row * 2.05 };
}

export function localWingPlate(): { x: number; z: number; width: number; depth: number } {
  const origin = localWingSlot(0);
  const across = localWingSlot(1);
  const down = localWingSlot(2);
  return {
    x: (origin.x + across.x) / 2,
    z: (origin.z + down.z) / 2,
    width: across.x - origin.x + 2.6,
    depth: down.z - origin.z + 2.4,
  };
}

export function deskSlot(index: number): { x: number; z: number } {
  const col = index % 3;
  const row = Math.floor(index / 3);
  return { x: -2.2 + col * 2.35, z: 0.35 + row * 2.15 };
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
  const placed: PlacedAgent[] = desks.map((desk, index) => {
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
  if (observed && !bound) {
    placed.push({
      id: `observed:${observed.provider}`,
      x: CLOUD_SPOT.x,
      z: CLOUD_SPOT.z,
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

  for (const desk of desks) {
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
