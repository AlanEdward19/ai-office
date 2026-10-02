import { parseCallSignal, readCallPeer, type CallPeer, type CallSignal } from "./call";
import { readLocalMachineReport, type LocalMachineReport } from "./office-machines";
import { readSharedScene, type SharedRoom } from "./office-share";
import type { PlacedAgent } from "./placement";

/** Organization-local multicast. TTL 1 keeps it on the link. */
export const LAN_MULTICAST = "239.255.84.47";
export const LAN_DISCOVERY_PORT = 47847;
export const LAN_OFFICE_PORT = 3847;
export const LAN_PEER_TTL_MS = 5_000;

const TOKEN = /^[a-f0-9]{32}$/;
const MACHINE = /^[A-Za-z0-9_-]{8,80}$/;

export type LanBeacon = {
  v: 1;
  machineId: string;
  name: string;
  port: number;
  token: string;
};

export type LanPeerSignal = {
  from: string;
  to: string;
  signal: CallSignal;
};

export type LanPeerSync = {
  machineId: string;
  token: string;
  owner: string;
  online: boolean;
  agents: LocalMachineReport["agents"];
  rooms: SharedRoom[];
  cloud: PlacedAgent[];
  people: CallPeer[];
  signals: LanPeerSignal[];
};

export function isPrivateLanAddress(address: string): boolean {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(address.trim());
  if (!match) return false;
  const parts = match.slice(1).map(Number);
  if (parts.some((part) => part > 255)) return false;
  const a = parts[0] ?? -1;
  const b = parts[1] ?? -1;
  if (a === 10) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 169 && b === 254) return true;
  return false;
}

export function lanSourceAddress(address: string): string | null {
  const v4 = address.startsWith("::ffff:") ? address.slice("::ffff:".length) : address;
  return isPrivateLanAddress(v4) ? v4 : null;
}

export function readLanBeacon(value: unknown): LanBeacon | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (record.v !== 1) return null;
  if (typeof record.machineId !== "string" || !MACHINE.test(record.machineId)) return null;
  if (typeof record.token !== "string" || !TOKEN.test(record.token)) return null;
  if (record.port !== LAN_OFFICE_PORT) return null;
  const name = typeof record.name === "string" ? record.name.trim().slice(0, 40) : "";
  if (!name) return null;
  return { v: 1, machineId: record.machineId, name, port: LAN_OFFICE_PORT, token: record.token };
}

export function lanPeerSyncUrl(address: string, port: number): string | null {
  if (!isPrivateLanAddress(address) || port !== LAN_OFFICE_PORT) return null;
  return `http://${address}:${port}/api/office/lan-peer`;
}

export function freshLanPeers<T extends { seenAt: number }>(peers: readonly T[], now: number): T[] {
  return peers.filter((peer) => {
    const age = now - peer.seenAt;
    return age >= 0 && age <= LAN_PEER_TTL_MS;
  });
}

/** The other office's report. Cloud desks stay cloud. People and signals are capped. */
export function readLanPeerSync(value: unknown): LanPeerSync | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.machineId !== "string" || !MACHINE.test(record.machineId)) return null;
  if (typeof record.token !== "string" || !TOKEN.test(record.token)) return null;
  if (typeof record.owner !== "string" || !record.owner.trim() || typeof record.online !== "boolean") return null;
  const report = readLocalMachineReport({
    machineId: record.machineId,
    owner: record.owner,
    online: record.online,
    agents: record.agents,
  });
  if (!report) return null;
  const scene = readSharedScene({
    hostName: report.owner,
    localOffline: !report.online,
    rooms: Array.isArray(record.rooms) ? record.rooms : [],
    agents: Array.isArray(record.cloud) ? record.cloud : [],
  });
  if (!scene) return null;
  const cloud = scene.agents.filter((agent) => agent.event.origin === "cloud" && agent.event.machineId === null);
  const people: CallPeer[] = [];
  if (Array.isArray(record.people)) {
    for (const entry of record.people) {
      if (people.length >= 8) break;
      const peer = readCallPeer(entry);
      if (peer) people.push(peer);
    }
  }
  const signals: LanPeerSignal[] = [];
  if (Array.isArray(record.signals)) {
    for (const entry of record.signals) {
      if (signals.length >= 20 || !entry || typeof entry !== "object") continue;
      const signalRecord = entry as Record<string, unknown>;
      if (typeof signalRecord.from !== "string" || typeof signalRecord.to !== "string") continue;
      const signal = parseCallSignal(signalRecord.signal);
      if (!signal) continue;
      signals.push({ from: signalRecord.from, to: signalRecord.to, signal });
    }
  }
  return {
    machineId: report.machineId,
    token: record.token,
    owner: report.owner,
    online: report.online,
    agents: report.agents,
    rooms: scene.rooms,
    cloud,
    people,
    signals,
  };
}
