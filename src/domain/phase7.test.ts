import assert from "node:assert/strict";
import test from "node:test";

import { isAgentEvent } from "./agent-event";
import { callInitiator, createCallHub, createPeerId, isPeerId, parseCallSignal, type CallDownlink } from "./call";

const offer = { type: "offer", sdp: "v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\n" };
const answer = { type: "answer", sdp: "v=0\r\n" };

test("a call signal is offer, answer, ice, or media, and never an agent", () => {
  assert.deepEqual(parseCallSignal({ ...offer, provider: "openai", status: "working", transcript: "SECRET" }), {
    type: "offer",
    sdp: offer.sdp,
  });
  assert.deepEqual(parseCallSignal(answer)?.type, "answer");
  assert.deepEqual(
    parseCallSignal({ type: "ice", candidate: "candidate:1 1 UDP 1 127.0.0.1 9 typ host", sdpMid: "0", sdpMLineIndex: 0 }),
    { type: "ice", candidate: "candidate:1 1 UDP 1 127.0.0.1 9 typ host", sdpMid: "0", sdpMLineIndex: 0 },
  );
  const media = parseCallSignal({ type: "media", audio: false, video: true, origin: "local" });
  assert.deepEqual(media, { type: "media", audio: false, video: true });
  assert.equal(media && "origin" in media, false);
  assert.equal(isAgentEvent(media), false);
  assert.equal(parseCallSignal({ type: "offer", sdp: "not-sdp" }), null);
  assert.equal(parseCallSignal({ type: "ice", candidate: "" }), null);
  assert.equal(parseCallSignal({ type: "media", audio: false }), null);
  assert.equal(callInitiator("peer-aaaa", "peer-bbbb"), true);
  assert.equal(callInitiator("peer-bbbb", "peer-aaaa"), false);
});

test("a plain http page still gets a call id when randomUUID is missing", () => {
  const secure = createPeerId({ randomUUID: () => "123e4567-e89b-12d3-a456-426614174000" });
  assert.equal(isPeerId(secure), true);
  const bytes = new Uint8Array(16);
  const insecure = createPeerId({
    getRandomValues(target) {
      target.set(bytes.fill(0xab));
      return target;
    },
  });
  assert.equal(insecure, "abababababababababababababababab");
  assert.equal(isPeerId(insecure), true);
  assert.equal(isPeerId(createPeerId({})), true);
  assert.equal(isPeerId(createPeerId({ randomUUID: () => "nope" })), true);
});

test("the signal reaches only a connected peer and dies with the last page", () => {
  const hub = createCallHub();
  const ada: CallDownlink[] = [];
  const bea: CallDownlink[] = [];
  const adaJoin = hub.join({ id: "peer-ada1", name: "Ada", token: "token-ada" }, (event) => ada.push(event));
  assert.equal(adaJoin.ok, true);
  if (!adaJoin.ok) return;
  const beaJoin = hub.join({ id: "peer-bea1", name: "Bea", token: "token-bea" }, (event) => bea.push(event));
  assert.equal(beaJoin.ok, true);
  if (!beaJoin.ok) return;

  for (const [from, token] of [["peer-ada1", "token-ada"], ["peer-bea1", "token-bea"]]) {
    assert.equal(hub.action({ from, token, action: { type: "presence", floor: "ground", x: 12, z: -14.5, yaw: 0, pitch: 0, timeZone: "UTC" } }).ok, true);
  }
  assert.deepEqual(hub.post({ token: "token-bea", from: "peer-ada1", to: "peer-bea1", signal: offer }), {
    ok: false,
    reason: "closed",
  });
  assert.equal(hub.post({ token: "token-ada", from: "peer-ada1", to: "peer-bea1", signal: offer }).ok, true);
  assert.equal(hub.post({ token: "token-bea", from: "peer-bea1", to: "peer-ada1", signal: answer }).ok, true);
  assert.equal(hub.post({
    token: "token-ada",
    from: "peer-ada1",
    to: "peer-bea1",
    signal: { type: "media", audio: true, video: false },
  }).ok, true);

  const adaSignals = ada.filter((event) => event.type === "signal");
  const beaSignals = bea.filter((event) => event.type === "signal");
  assert.equal(beaSignals.length, 2);
  assert.equal(adaSignals.length, 1);
  assert.equal(adaSignals[0]?.type === "signal" && adaSignals[0].signal.type, "answer");
  assert.equal(beaSignals.some((event) => event.type === "signal" && event.signal.type === "offer"), true);
  assert.equal(
    bea.some((event) => event.type === "signal" && event.signal.type === "media" && event.signal.video === false),
    true,
  );
  assert.equal(JSON.stringify(bea).includes("SECRET"), false);
  assert.equal(JSON.stringify(bea).includes("working"), false);

  adaJoin.leave();
  const latest = bea.at(-1);
  assert.equal(latest?.type, "roster");
  if (latest?.type === "roster") {
    assert.deepEqual(latest.peers.map((peer) => peer.name), ["Bea"]);
  }
  assert.equal(hub.post({ token: "token-ada", from: "peer-ada1", to: "peer-bea1", signal: offer }).ok, false);

  beaJoin.leave();
  assert.equal(hub.peerCount(), 0);
  const again: CallDownlink[] = [];
  const rejoined = hub.join({ id: "peer-ada1", name: "Ada", token: "token-ada" }, (event) => again.push(event));
  assert.equal(rejoined.ok, true);
  assert.equal(again.some((event) => event.type === "signal"), false);
  assert.equal(again[0]?.type, "roster");
  if (again[0]?.type === "roster") {
    assert.deepEqual(again[0].peers.map(p => ({id:p.id,name:p.name})), [{id:"peer-ada1",name:"Ada"}]);
    assert.equal(again[0].peers[0].areaId,"cafe");
  }
  assert.equal(hub.post({ token: "token-ada", from: "peer-ada1", to: "peer-bea1", signal: offer }).ok, false);
});
