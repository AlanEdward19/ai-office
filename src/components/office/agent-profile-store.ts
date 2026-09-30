"use client";

import {
  AGENT_PROFILES_STORAGE_KEY,
  loadAgentProfiles,
  renameAgentProfile,
  serializeAgentProfiles,
} from "@/domain/agent-profile";

let snapshot = "";
let loaded = false;
const listeners = new Set<() => void>();

function readStorage() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    snapshot = window.localStorage.getItem(AGENT_PROFILES_STORAGE_KEY) ?? "";
  } catch {
    snapshot = "";
  }
}

export const agentProfileStore = {
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
  profilesFrom(raw: string) {
    return loadAgentProfiles(raw || null);
  },
  rename(agentId: string, name: string) {
    readStorage();
    snapshot = serializeAgentProfiles(renameAgentProfile(loadAgentProfiles(snapshot || null), agentId, name));
    try {
      window.localStorage.setItem(AGENT_PROFILES_STORAGE_KEY, snapshot);
    } catch {
      // Keep the current session usable when browser storage is unavailable.
    }
    for (const listener of listeners) listener();
  },
};
