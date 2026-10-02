import assert from "node:assert/strict";
import test from "node:test";

import { callAudioConstraints, preferLanVoice } from "./call-audio";
import { createCallHub, readCallPeer } from "./call";
import {
  freshLanPeers,
  isPrivateLanAddress,
  lanPeerSyncUrl,
  lanSourceAddress,
  readLanBeacon,
  readLanPeerSync,
} from "./lan-discovery";
import { remoteIsWalking, remotePoseAt, remoteWalkDuration, remoteWalkProgress, yawDelta } from "./remote-walk";

const token = "ab".repeat(16);

test("a remote person walks between samples and stands when the step is finished", () => {
  const from = { x: 0, z: 2.6, yaw: 0 };
  const to = { x: 1.2, z: 2.6, yaw: Math.PI };
  assert.equal(remoteWalkDuration(0), 180);
  assert.equal(remoteWalkDuration(2000), 800);
  assert.equal(remoteWalkProgress(0, 0.2, 0.1), 0.5);
  const mid = remotePoseAt({ from, to, progress: 0.5 });
  assert.equal(mid.x, 0.6);
  assert.equal(mid.z, 2.6);
  assert.ok(Math.abs(mid.yaw - Math.PI / 2) < 1e-9 || Math.abs(mid.yaw + Math.PI / 2) < 1e-9);
  assert.equal(remoteIsWalking({ from, to, seated: false, progress: 0.5 }), true);
  assert.equal(remoteIsWalking({ from, to, seated: false, progress: 1 }), false);
  assert.equal(remoteIsWalking({ from, to, seated: true, progress: 0.2 }), false);
  assert.equal(remoteIsWalking({ from, to: { x: 0.02, z: 2.6 }, seated: false, progress: 0.4 }), false);
  assert.equal(yawDelta(0, 0), 0);
});

test("lan voice capture cancels echo and opus stays mono", () => {
  const audio = callAudioConstraints();
  assert.equal(audio.echoCancellation, true);
  assert.equal(audio.noiseSuppression, true);
  assert.equal(audio.autoGainControl, true);
  assert.equal(audio.channelCount, 1);
  const sdp = [
    "v=0",
    "m=audio 9 UDP/TLS/RTP/SAVPF 111",
    "a=rtpmap:111 opus/48000/2",
    "a=fmtp:111 minptime=10;useinbandfec=1;stereo=1",
    "",
  ].join("\r\n");
  const tuned = preferLanVoice(sdp);
  assert.match(tuned, /stereo=0/);
  assert.match(tuned, /maxaveragebitrate=48000/);
  assert.equal(tuned.includes("stereo=1"), false);
  assert.equal(preferLanVoice("v=0\r\n"), "v=0\r\n");
});

test("discovery stays on a private address and ignores a url to hand around", () => {
  assert.equal(isPrivateLanAddress("192.168.1.20"), true);
  assert.equal(isPrivateLanAddress("10.1.2.3"), true);
  assert.equal(isPrivateLanAddress("8.8.8.8"), false);
  assert.equal(isPrivateLanAddress("127.0.0.1"), false);
  assert.equal(lanSourceAddress("::ffff:172.16.4.2"), "172.16.4.2");
  assert.equal(lanSourceAddress("8.8.8.8"), null);
  const beacon = readLanBeacon({
    v: 1,
    machineId: "machine-ada-1",
    name: "Ada",
    port: 3847,
    token,
  });
  assert.equal(beacon?.name, "Ada");
  assert.equal(readLanBeacon({ ...beacon, port: 80 }), null);
  assert.equal(readLanBeacon({ ...beacon, v: 2 }), null);
  assert.equal(lanPeerSyncUrl("192.168.1.20", 3847), "http://192.168.1.20:3847/api/office/lan-peer");
  assert.equal(lanPeerSyncUrl("8.8.8.8", 3847), null);
  assert.equal(lanPeerSyncUrl("192.168.1.20", 443), null);
  assert.deepEqual(freshLanPeers([{ seenAt: 1_000 }], 1_000 + 5_000), [{ seenAt: 1_000 }]);
  assert.deepEqual(freshLanPeers([{ seenAt: 1_000 }], 1_000 + 5_001), []);
});

test("a lan sync keeps a reported local agent and drops anything that machine did not send", () => {
  const sync = readLanPeerSync({
    machineId: "machine-ada-1",
    token,
    owner: "Ada",
    online: true,
    agents: [
      {
        provider: "cursor",
        origin: "local",
        owner: "Ada",
        machineId: "machine-ada-1",
        projectId: null,
        status: "working",
        observedAt: "2026-10-02T12:00:00.000Z",
        transcript: "secret",
      },
      {
        provider: "openai",
        origin: "local",
        owner: "Ada",
        machineId: "other-machine",
        projectId: null,
        status: "working",
        observedAt: "2026-10-02T12:00:00.000Z",
      },
    ],
    rooms: [{ id: "proj-1", name: "Sala", x: 1, z: 2 }],
    cloud: [
      {
        id: "cloud-1",
        x: 0,
        z: 0,
        form: { role: "Editor", provider: "cursor" },
        event: {
          provider: "cursor",
          origin: "cloud",
          owner: "Ada",
          machineId: null,
          projectId: null,
          status: "idle",
          observedAt: "2026-10-02T12:00:00.000Z",
        },
      },
    ],
    people: [{ id: "person-ada", name: "Ada", x: 0, z: 2.6, yaw: 0, pitch: 0, floor: "ground", timeZone: "UTC", seated: false, areaId: null, meetingId: null }],
    signals: [{ from: "person-ada", to: "person-bea", signal: { type: "media", audio: true, video: false } }],
  });
  assert.equal(sync?.agents.length, 1);
  assert.equal(sync?.agents[0]?.status, "working");
  assert.equal(sync?.agents[0]?.provider, "cursor");
  assert.equal(JSON.stringify(sync).includes("secret"), false);
  assert.equal(JSON.stringify(sync).includes("other-machine"), false);
  assert.equal(sync?.cloud.length, 1);
  assert.equal(sync?.cloud[0]?.event.machineId, null);
  assert.equal(sync?.people.length, 1);
  assert.equal(sync?.signals.length, 1);
  assert.equal(readCallPeer({ id: "short", name: "A", x: 0, z: 0, yaw: 0, pitch: 0, floor: "ground", timeZone: "UTC" }), null);
});

test("the office call works in the corridor and a private talk stays isolated", () => {
  const hub = createCallHub();
  const ada: { type: string; meetingId?: string }[] = [];
  const bea: { type: string; meetingId?: string }[] = [];
  const adaJoin = hub.join({ id: "person-ada", name: "Ada", token: "token-ada" }, (event) => ada.push(event));
  const beaJoin = hub.join({ id: "person-bea", name: "Bea", token: "token-bea" }, (event) => bea.push(event));
  assert.equal(adaJoin.ok && beaJoin.ok, true);
  const offer = { type: "offer", sdp: "v=0\r\n" };
  assert.equal(hub.post({ token: "token-ada", from: "person-ada", to: "person-bea", signal: offer }).ok, false);
  assert.equal(
    hub.post({ token: "token-ada", from: "person-ada", to: "person-bea", signal: offer, channel: "office" }).ok,
    true,
  );
  assert.equal(bea.some((event) => event.type === "signal" && event.meetingId === "office"), true);

  hub.setRemotePeers([
    {
      id: "person-bia1",
      name: "Bia",
      x: 1,
      z: 2.6,
      yaw: 0.4,
      pitch: 0,
      floor: "ground",
      timeZone: "UTC",
      seated: false,
      areaId: null,
      meetingId: null,
    },
  ]);
  assert.equal(
    hub.post({ token: "token-ada", from: "person-ada", to: "person-bia1", signal: offer, channel: "office" }).ok,
    true,
  );
  const queued = hub.pullRemoteSignals();
  assert.equal(queued.length, 1);
  assert.equal(queued[0]?.to, "person-bia1");
  assert.equal(hub.deliverOfficeSignal({ to: "person-bea", from: "person-bia1", signal: { type: "media", audio: true, video: false } }), true);

  hub.action({
    from: "person-ada",
    token: "token-ada",
    action: { type: "presence", floor: "ground", x: 12, z: -14.5, yaw: 0, pitch: 0, timeZone: "UTC" },
  });
  hub.action({
    from: "person-bea",
    token: "token-bea",
    action: { type: "presence", floor: "ground", x: 12, z: -14.5, yaw: 0, pitch: 0, timeZone: "UTC" },
  });
  hub.action({ from: "person-ada", token: "token-ada", action: { type: "invite", to: "person-bea" } });
  const roster = ada.findLast((event) => event.type === "roster") as { invites?: { id: string }[] } | undefined;
  const inviteId = roster?.invites?.[0]?.id;
  assert.equal(typeof inviteId, "string");
  hub.action({ from: "person-bea", token: "token-bea", action: { type: "accept", inviteId } });
  assert.equal(
    hub.post({ token: "token-ada", from: "person-ada", to: "person-bea", signal: offer, channel: "office" }).ok,
    false,
  );
  assert.equal(hub.post({ token: "token-ada", from: "person-ada", to: "person-bea", signal: offer }).ok, true);
});
