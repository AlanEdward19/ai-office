import type { AgentEvent } from "./agent-event";
import type { DeskRecord } from "./desks";
import type { JobForm } from "./job-form";

export type PlacedAgent = {
  id: string;
  x: number;
  z: number;
  form: JobForm | null;
  event: AgentEvent;
};

const CLOUD_SPOT = { x: 0.15, z: -1.6 };

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
 * Desks keep the ficha. The Cursor cloud observation updates the earliest
 * Cursor desk. With no Cursor hire, that same event stands in the lobby.
 */
export function bindAgents(input: {
  desks: readonly DeskRecord[];
  observed: AgentEvent | null;
  owner: string;
}): PlacedAgent[] {
  const desks = [...input.desks].sort((a, b) => {
    const byTime = a.createdAt.localeCompare(b.createdAt);
    return byTime === 0 ? a.id.localeCompare(b.id) : byTime;
  });
  let bound = false;
  const placed: PlacedAgent[] = desks.map((desk, index) => {
    const slot = deskSlot(index);
    const takeObserved =
      !bound &&
      input.observed !== null &&
      input.observed.provider === "cursor" &&
      input.observed.origin === "cloud" &&
      desk.form.provider === "cursor";
    if (takeObserved) bound = true;
    return {
      id: desk.id,
      x: slot.x,
      z: slot.z,
      form: desk.form,
      event: takeObserved && input.observed
        ? input.observed
        : hireEvent(desk, input.owner, desk.createdAt),
    };
  });
  if (input.observed && !bound) {
    placed.push({
      id: `observed:${input.observed.provider}`,
      x: CLOUD_SPOT.x,
      z: CLOUD_SPOT.z,
      form: null,
      event: input.observed,
    });
  }
  return placed;
}
