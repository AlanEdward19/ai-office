export type LinearProject = {
  id: string;
  name: string;
};

export type PlacedRoom = LinearProject & {
  x: number;
  z: number;
};

export const LOBBY = { width: 18, depth: 12 };
export const RECEPTION = { x: -5.4, z: 4.15 };
export const CEO_CORNER = { x: 6.15, z: -3.55 };

const ROOM_FLOORS = ["#e7d3b4", "#d7e0dc", "#ead8cc", "#d9d3e6", "#e4dcc8", "#d5e2ea"];

export function roomColor(projectId: string): string {
  let hash = 0;
  for (const char of projectId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return ROOM_FLOORS[hash % ROOM_FLOORS.length];
}

export function roomSlot(index: number): { x: number; z: number } {
  const perRow = 4;
  const roomW = 4.2;
  const roomD = 4.6;
  const gap = 0.35;
  const col = index % perRow;
  const row = Math.floor(index / perRow);
  const rowWidth = perRow * roomW + (perRow - 1) * gap;
  const startX = -rowWidth / 2 + roomW / 2;
  const x = startX + col * (roomW + gap);
  const z = -LOBBY.depth / 2 - roomD / 2 - 0.7 - row * (roomD + gap);
  return { x, z };
}

/** Stable layout: the project id is the identity, the name is only a label. */
export function layoutRooms(projects: readonly LinearProject[]): PlacedRoom[] {
  return [...projects]
    .filter((project) => project.id.trim().length > 0)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((project, index) => ({
      id: project.id,
      name: project.name.trim() || "Sem nome",
      ...roomSlot(index),
    }));
}

export function readLinearPage(payload: unknown): {
  projects: LinearProject[];
  viewerName: string | null;
  hasNextPage: boolean;
  endCursor: string | null;
} {
  if (!payload || typeof payload !== "object") {
    throw new Error("linear_invalid");
  }
  const data = (payload as { data?: unknown }).data;
  if (!data || typeof data !== "object") throw new Error("linear_invalid");
  const record = data as Record<string, unknown>;
  const viewer = record.viewer;
  let viewerName: string | null = null;
  if (viewer && typeof viewer === "object") {
    const person = viewer as Record<string, unknown>;
    if (typeof person.name === "string" && person.name.trim()) viewerName = person.name.trim();
    else if (typeof person.email === "string" && person.email.trim()) {
      viewerName = person.email.trim();
    }
  }
  const projects = record.projects;
  if (!projects || typeof projects !== "object") throw new Error("linear_invalid");
  const connection = projects as Record<string, unknown>;
  const nodes = Array.isArray(connection.nodes) ? connection.nodes : [];
  const pageInfo =
    connection.pageInfo && typeof connection.pageInfo === "object"
      ? (connection.pageInfo as Record<string, unknown>)
      : {};
  return {
    viewerName,
    projects: nodes.flatMap((node) => {
      if (!node || typeof node !== "object") return [];
      const item = node as Record<string, unknown>;
      if (typeof item.id !== "string" || !item.id.trim()) return [];
      const name = typeof item.name === "string" ? item.name.trim() : "";
      return [{ id: item.id, name: name || "Sem nome" }];
    }),
    hasNextPage: pageInfo.hasNextPage === true,
    endCursor: typeof pageInfo.endCursor === "string" ? pageInfo.endCursor : null,
  };
}
