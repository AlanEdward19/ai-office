"use client";

import {
  DESKS_STORAGE_KEY,
  loadDesks,
  serializeDesks,
  type DeskRecord,
} from "@/domain/desks";
import { DESK_CAPACITY } from "@/domain/office-map";
import { createPeerId } from "@/domain/call";
import type { JobForm } from "@/domain/job-form";

let snapshot = "";
let loaded = false;
const listeners = new Set<() => void>();

function readStorage() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  snapshot = window.localStorage.getItem(DESKS_STORAGE_KEY) ?? "";
}

function publish(next: string) {
  window.localStorage.setItem(DESKS_STORAGE_KEY, next);
  snapshot = next;
  for (const listener of listeners) listener();
}

export const deskStore = {
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
  desksFrom(raw: string): DeskRecord[] {
    return loadDesks(raw || null);
  },
  adopt(desk: DeskRecord) {
    readStorage();
    const current = loadDesks(snapshot || null);
    if (current.some((item) => item.id === desk.id)) return;
    publish(serializeDesks([...current, desk]));
  },
  add(form: JobForm): DeskRecord {
    readStorage();
    if (loadDesks(snapshot || null).length >= DESK_CAPACITY) throw new Error("Capacidade atingida: nove postos. Os corredores devem permanecer livres.");
    const desk: DeskRecord = {
      id: createPeerId(),
      form,
      createdAt: new Date().toISOString(),
    };
    publish(serializeDesks([...loadDesks(snapshot || null), desk]));
    return desk;
  },
};
