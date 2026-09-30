import type { LinearProject } from "./rooms";

export const ROOMS_STORAGE_KEY = "escritorio-de-ia.rooms";

export type RoomBindError = "project_required" | "project_unknown" | "room_exists";

export function loadOpenedRooms(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as { version?: unknown; projectIds?: unknown };
    if (parsed.version !== 1 || !Array.isArray(parsed.projectIds)) return [];
    const ids: string[] = [];
    for (const entry of parsed.projectIds) {
      if (typeof entry !== "string") continue;
      const id = entry.trim();
      if (!id || ids.includes(id)) continue;
      ids.push(id);
    }
    return ids;
  } catch {
    return [];
  }
}

export function serializeOpenedRooms(projectIds: readonly string[]): string {
  return JSON.stringify({ version: 1, projectIds });
}

/**
 * A room is the Linear project id. The name is never stored and never used as the key.
 * A project that already has a room cannot be bound again. An empty choice creates nothing.
 */
export function bindRoom(
  opened: readonly string[],
  projects: readonly Pick<LinearProject, "id">[],
  projectId: string,
): { ok: true; projectIds: string[] } | { ok: false; error: RoomBindError } {
  const id = projectId.trim();
  if (!id) return { ok: false, error: "project_required" };
  if (!projects.some((project) => project.id === id)) {
    return { ok: false, error: "project_unknown" };
  }
  if (opened.includes(id)) return { ok: false, error: "room_exists" };
  return { ok: true, projectIds: [...opened, id] };
}

export function projectsWithoutRooms(
  projects: readonly LinearProject[],
  opened: readonly string[],
): LinearProject[] {
  const taken = new Set(opened);
  return projects.filter((project) => project.id.trim().length > 0 && !taken.has(project.id));
}

/** Names come from the current project list. Unknown ids do not become rooms. */
export function roomsFromBindings(
  projects: readonly LinearProject[],
  opened: readonly string[],
): LinearProject[] {
  const byId = new Map(projects.map((project) => [project.id, project]));
  const rooms: LinearProject[] = [];
  for (const id of opened) {
    const project = byId.get(id);
    if (!project) continue;
    rooms.push({ id: project.id, name: project.name });
  }
  return rooms;
}
