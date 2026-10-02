import "server-only";

import { randomBytes } from "node:crypto";
import dgram from "node:dgram";

import type { CallPeer } from "@/domain/call";
import {
  freshLanPeers,
  LAN_DISCOVERY_PORT,
  LAN_MULTICAST,
  LAN_OFFICE_PORT,
  lanPeerSyncUrl,
  lanSourceAddress,
  readLanBeacon,
  readLanPeerSync,
  type LanBeacon,
} from "@/domain/lan-discovery";
import { officeMachineIdentity } from "@/server/local-bridge";
import { ensureLocalWatch, stopLocalWatch } from "@/server/local-watch";

/**
 * While a page is open, this process announces itself on the local network and
 * exchanges people, call signals, and the local agents it actually observed.
 * The sockets are unref'd and closed when the last page is gone.
 */

type Heard = LanBeacon & { address: string; seenAt: number; people: CallPeer[] };

const KEY = "__escritorioLanBridge";

type Bridge = {
  viewers: number;
  beatAt: number;
  token: string;
  socket: dgram.Socket | null;
  timers: ReturnType<typeof setInterval>[];
  stopTimer: ReturnType<typeof setTimeout> | null;
  pushing: boolean;
  heard: Map<string, Heard>;
  ran: boolean;
};

function bridge(): Bridge {
  const host = globalThis as typeof globalThis & { [KEY]?: Bridge };
  if (!host[KEY]) {
    host[KEY] = {
      viewers: 0,
      beatAt: 0,
      token: randomBytes(16).toString("hex"),
      socket: null,
      timers: [],
      stopTimer: null,
      pushing: false,
      heard: new Map(),
      ran: false,
    };
  }
  return host[KEY];
}

function needed(state: Bridge) {
  return state.viewers > 0 || Date.now() - state.beatAt < 4_000;
}

export function retainLanOffice() {
  const state = bridge();
  state.viewers += 1;
  if (state.stopTimer) {
    clearTimeout(state.stopTimer);
    state.stopTimer = null;
  }
  ensureLanOffice();
}

export function releaseLanOffice() {
  const state = bridge();
  state.viewers = Math.max(0, state.viewers - 1);
  scheduleStop();
}

export function beatLanOffice(): { name: string }[] {
  const state = bridge();
  state.beatAt = Date.now();
  ensureLanOffice();
  scheduleStop();
  return peerNames();
}

export function lanPeerNames(): { name: string }[] {
  return peerNames();
}

export function ingestLanPeer(body: unknown): { ok: true } | { ok: false; reason: "invalid" | "closed" | "forbidden" } {
  const state = bridge();
  if (!state.ran || !needed(state)) return { ok: false, reason: "closed" };
  const sync = readLanPeerSync(body);
  if (!sync) return { ok: false, reason: "invalid" };
  const heard = state.heard.get(sync.machineId);
  if (!heard || heard.token !== sync.token || Date.now() - heard.seenAt > 5_000) {
    return { ok: false, reason: "forbidden" };
  }
  const self = officeMachineIdentity().machineId;
  if (sync.machineId === self) return { ok: true };
  heard.people = sync.people;
  heard.seenAt = Date.now();
  void applySync(sync);
  return { ok: true };
}

function peerNames() {
  const now = Date.now();
  return freshLanPeers([...bridge().heard.values()], now).map((peer) => ({ name: peer.name }));
}

function ensureLanOffice() {
  const state = bridge();
  if (state.ran) return;
  state.ran = true;
  ensureLocalWatch();
  const socket = dgram.createSocket({ type: "udp4", reuseAddr: true });
  state.socket = socket;
  socket.on("error", () => {
    /* A NIC without multicast still lets this page run. */
  });
  socket.on("message", (message, remote) => {
    const address = lanSourceAddress(remote.address);
    if (!address) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(message.toString("utf8")) as unknown;
    } catch {
      return;
    }
    const beacon = readLanBeacon(parsed);
    if (!beacon || beacon.machineId === officeMachineIdentity().machineId) return;
    const previous = state.heard.get(beacon.machineId);
    state.heard.set(beacon.machineId, {
      ...beacon,
      address,
      seenAt: Date.now(),
      people: previous?.people ?? [],
    });
  });
  socket.bind(LAN_DISCOVERY_PORT, () => {
    try {
      socket.addMembership(LAN_MULTICAST);
      socket.setMulticastTTL(1);
      socket.setMulticastLoopback(true);
    } catch {
      /* Membership can fail in a container without a multicast route. */
    }
  });
  socket.unref();
  const announce = setInterval(() => {
    if (!needed(state)) {
      scheduleStop();
      return;
    }
    void announceBeacon();
    void pushPeers();
    void expirePeers();
  }, 250);
  announce.unref();
  state.timers.push(announce);
}

function announceBeacon() {
  const state = bridge();
  const socket = state.socket;
  if (!socket || !needed(state)) return;
  const identity = officeMachineIdentity();
  const packet = Buffer.from(
    JSON.stringify({
      v: 1,
      machineId: identity.machineId,
      name: identity.owner.slice(0, 40) || "esta máquina",
      port: LAN_OFFICE_PORT,
      token: state.token,
    }),
  );
  try {
    socket.send(packet, LAN_DISCOVERY_PORT, LAN_MULTICAST);
  } catch {
    /* The socket can still be binding. */
  }
}

async function pushPeers() {
  const state = bridge();
  if (state.pushing || !needed(state)) return;
  const peers = freshLanPeers([...state.heard.values()], Date.now());
  if (peers.length === 0) return;
  state.pushing = true;
  try {
    const { peerOfficeRecord } = await import("@/server/office-channel");
    const { localCallPeers, pullRemoteSignals } = await import("@/server/call-channel");
    const office = peerOfficeRecord();
    const signals = pullRemoteSignals();
    const identity = officeMachineIdentity();
    const body = JSON.stringify({
      machineId: identity.machineId,
      token: state.token,
      owner: office.owner || identity.owner,
      online: office.online,
      agents: office.agents,
      rooms: office.rooms,
      cloud: office.cloud,
      people: localCallPeers(),
      signals,
    });
    const results = await Promise.all(
      peers.map(async (peer) => {
        const url = lanPeerSyncUrl(peer.address, peer.port);
        if (!url) return false;
        try {
          const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
            signal: AbortSignal.timeout(800),
          });
          return response.ok;
        } catch {
          return false;
        }
      }),
    );
    if (results.some((ok) => !ok) && signals.length > 0) {
      const { requeueRemoteSignals } = await import("@/server/call-channel");
      requeueRemoteSignals(signals);
    }
  } finally {
    state.pushing = false;
  }
}

async function applySync(sync: NonNullable<ReturnType<typeof readLanPeerSync>>) {
  const [{ acceptPeerOffice }, { deliverOfficeSignal, replaceRemotePeers }] = await Promise.all([
    import("@/server/office-channel"),
    import("@/server/call-channel"),
  ]);
  acceptPeerOffice({
    report: { machineId: sync.machineId, owner: sync.owner, online: sync.online, agents: sync.agents },
    rooms: sync.rooms,
    cloud: sync.cloud,
  });
  for (const signal of sync.signals) deliverOfficeSignal(signal);
  publishRemotes(replaceRemotePeers);
}

function publishRemotes(replace: (peers: Heard["people"]) => void) {
  const people = freshLanPeers([...bridge().heard.values()], Date.now()).flatMap((peer) => peer.people);
  replace(people);
}

async function expirePeers() {
  const state = bridge();
  const now = Date.now();
  let changed = false;
  for (const [id, peer] of state.heard) {
    if (now - peer.seenAt <= 5_000) continue;
    state.heard.delete(id);
    changed = true;
    const { acceptPeerOffice } = await import("@/server/office-channel");
    acceptPeerOffice({
      report: { machineId: id, owner: peer.name, online: false, agents: [] },
      rooms: [],
      cloud: [],
    });
  }
  if (!changed) return;
  const { replaceRemotePeers } = await import("@/server/call-channel");
  publishRemotes(replaceRemotePeers);
}

function scheduleStop() {
  const state = bridge();
  if (needed(state) || state.stopTimer) return;
  state.stopTimer = setTimeout(() => {
    state.stopTimer = null;
    if (needed(state)) return;
    void stopLanOffice();
  }, 500);
  state.stopTimer.unref();
}

async function stopLanOffice() {
  const state = bridge();
  if (!state.ran) return;
  const peers = [...state.heard.values()];
  const identity = officeMachineIdentity();
  const goodbye = JSON.stringify({
    machineId: identity.machineId,
    token: state.token,
    owner: identity.owner,
    online: false,
    agents: [],
    rooms: [],
    cloud: [],
    people: [],
    signals: [],
  });
  await Promise.all(
    peers.map(async (peer) => {
      const url = lanPeerSyncUrl(peer.address, peer.port);
      if (!url) return;
      try {
        await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: goodbye,
          signal: AbortSignal.timeout(400),
        });
      } catch {
        /* The other page may already be gone. */
      }
    }),
  );
  for (const timer of state.timers) clearInterval(timer);
  state.timers = [];
  state.socket?.close();
  state.socket = null;
  state.heard.clear();
  state.ran = false;
  stopLocalWatch();
  const [{ releaseIdleOffice }, { replaceRemotePeers }] = await Promise.all([
    import("@/server/office-channel"),
    import("@/server/call-channel"),
  ]);
  replaceRemotePeers([]);
  releaseIdleOffice();
}
