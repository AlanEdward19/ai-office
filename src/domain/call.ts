/**
 * A direct call between open pages. The hub forwards one signal and forgets it.
 * Nothing here is an agent event, and nothing is kept after the last page leaves.
 */

export type CallSignal =
  | { type: "offer"; sdp: string }
  | { type: "answer"; sdp: string }
  | { type: "ice"; candidate: string; sdpMid: string | null; sdpMLineIndex: number | null }
  | { type: "media"; audio: boolean; video: boolean };

export type CallPeer = {
  id: string;
  name: string;
};

export type CallDownlink =
  | { type: "roster"; self: string; peers: CallPeer[] }
  | { type: "signal"; from: string; signal: CallSignal };

const PEER_ID = /^[A-Za-z0-9_-]{8,80}$/;
const SDP_MAX = 24_000;

export function isPeerId(value: string): boolean {
  return PEER_ID.test(value);
}

/** The lower id offers. The other side only answers, so the two pages do not glare. */
export function callInitiator(localId: string, remoteId: string): boolean {
  return localId < remoteId;
}

export function parseCallSignal(value: unknown): CallSignal | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (record.type === "offer" || record.type === "answer") {
    if (typeof record.sdp !== "string") return null;
    if (!record.sdp.trimStart().startsWith("v=0") || record.sdp.length > SDP_MAX) return null;
    return { type: record.type, sdp: record.sdp };
  }
  if (record.type === "ice") {
    if (typeof record.candidate !== "string") return null;
    const candidate = record.candidate.trim();
    if (!candidate || candidate.length > 2000) return null;
    const mid = record.sdpMid === undefined ? null : record.sdpMid;
    if (mid !== null && typeof mid !== "string") return null;
    const line = record.sdpMLineIndex === undefined ? null : record.sdpMLineIndex;
    if (line !== null && (typeof line !== "number" || !Number.isInteger(line) || line < 0 || line > 64)) {
      return null;
    }
    return {
      type: "ice",
      candidate,
      sdpMid: mid === null ? null : mid.slice(0, 32),
      sdpMLineIndex: line,
    };
  }
  if (record.type === "media") {
    if (typeof record.audio !== "boolean" || typeof record.video !== "boolean") return null;
    return { type: "media", audio: record.audio, video: record.video };
  }
  return null;
}

type Member = {
  id: string;
  name: string;
  token: string;
  listener: (event: CallDownlink) => void;
};

export function createCallHub() {
  const members = new Map<string, Member>();

  const peers = (): CallPeer[] =>
    [...members.values()]
      .map((member) => ({ id: member.id, name: member.name }))
      .sort((a, b) => a.id.localeCompare(b.id));

  const sendRoster = () => {
    const roster = peers();
    for (const member of members.values()) {
      member.listener({ type: "roster", self: member.id, peers: roster });
    }
  };

  return {
    peerCount() {
      return members.size;
    },
    join(
      input: { id: string; name: string; token: string },
      listener: (event: CallDownlink) => void,
    ): { ok: true; leave: () => void } | { ok: false; reason: "invalid" } {
      const id = input.id.trim();
      const name = input.name.trim().slice(0, 40);
      const token = input.token.trim();
      if (!isPeerId(id) || !name || !token) return { ok: false, reason: "invalid" };
      const member: Member = { id, name, token, listener };
      members.set(id, member);
      sendRoster();
      return {
        ok: true,
        leave: () => {
          if (members.get(id) !== member) return;
          members.delete(id);
          if (members.size > 0) sendRoster();
        },
      };
    },
    post(input: { token: string; from: string; to: string; signal: unknown }):
      | { ok: true }
      | { ok: false; reason: "closed" | "invalid" } {
      const from = members.get(input.from);
      const to = members.get(input.to);
      if (!from || from.token !== input.token || !to || input.from === input.to) {
        return { ok: false, reason: "closed" };
      }
      const signal = parseCallSignal(input.signal);
      if (!signal) return { ok: false, reason: "invalid" };
      to.listener({ type: "signal", from: from.id, signal });
      return { ok: true };
    },
  };
}
