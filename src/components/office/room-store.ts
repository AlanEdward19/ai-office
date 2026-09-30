"use client";

import {
  bindRoom,
  loadOpenedRooms,
  ROOMS_STORAGE_KEY,
  serializeOpenedRooms,
  type RoomBindError,
} from "@/domain/opened-rooms";
import type { LinearProject } from "@/domain/rooms";

let snapshot = "";
let loaded = false;
const listeners = new Set<() => void>();

function readStorage() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  snapshot = window.localStorage.getItem(ROOMS_STORAGE_KEY) ?? "";
}

function publish(next: string) {
  snapshot = next;
  window.localStorage.setItem(ROOMS_STORAGE_KEY, next);
  for (const listener of listeners) listener();
}

export const roomStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot() {
    readStorage();
    return snapshot;
  },
  getServerSnapshot() {
    return "";
  },
  idsFrom(raw: string): string[] {
    return loadOpenedRooms(raw || null);
  },
  bind(
    projectId: string,
    projects: readonly LinearProject[],
  ): { ok: true; projectIds: string[] } | { ok: false; error: RoomBindError } {
    readStorage();
    const result = bindRoom(loadOpenedRooms(snapshot || null), projects, projectId);
    if (result.ok) publish(serializeOpenedRooms(result.projectIds));
    return result;
  },
};
