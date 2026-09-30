"use client";

import {
  DISPATCHES_STORAGE_KEY,
  loadDispatches,
  serializeDispatches,
  type DispatchRecord,
} from "@/domain/dispatch";

let snapshot = "";
let loaded = false;
const listeners = new Set<() => void>();

function readStorage() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  snapshot = window.localStorage.getItem(DISPATCHES_STORAGE_KEY) ?? "";
}

function publish(next: string) {
  snapshot = next;
  window.localStorage.setItem(DISPATCHES_STORAGE_KEY, next);
  for (const listener of listeners) listener();
}

export const dispatchStore = {
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
  recordsFrom(raw: string): DispatchRecord[] {
    return loadDispatches(raw || null);
  },
  save(record: DispatchRecord) {
    readStorage();
    const current = loadDispatches(snapshot || null).filter(
      (item) => !(item.projectId === record.projectId && item.issueId === record.issueId),
    );
    publish(serializeDispatches([...current, record]));
  },
};
