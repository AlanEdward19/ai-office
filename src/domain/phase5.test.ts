import assert from "node:assert/strict";
import test from "node:test";

import type { AgentEvent } from "./agent-event";
import {
  canPerform,
  createOfficeHub,
  decideSignIn,
  readSharedScene,
  sceneWithoutHost,
  type OfficeAction,
  type SharedScene,
} from "./office-share";

const observedAt = "2026-09-30T12:00:00.000Z";

const cloud: AgentEvent = {
  provider: "cursor",
  origin: "cloud",
  owner: "Ada",
  machineId: null,
  projectId: "proj-sala",
  status: "idle",
  observedAt,
};

const local: AgentEvent = {
  provider: "cursor",
  origin: "local",
  owner: "Ada",
  machineId: "machine-1",
  projectId: null,
  status: "working",
  observedAt,
};

const scene: SharedScene = {
  hostName: "Ada",
  localOffline: false,
  rooms: [{ id: "proj-sala", name: "Sala Norte", x: -6.8, z: -9 }],
  agents: [
    { id: "desk-1", x: -2.2, z: 0.35, form: { role: "Pesquisador", provider: "cursor" }, event: cloud },
    { id: "local:desk-1", x: 11, z: 0.2, form: { role: "Pesquisador", provider: "cursor" }, event: local },
  ],
};

test("the host publishes, an interact person can hire and start work, and an observer cannot", () => {
  const actions: OfficeAction[] = ["publish", "hire", "drop", "dispatch", "create_card", "open_room"];
  for (const action of actions) {
    assert.equal(canPerform("host", action), true);
    assert.equal(canPerform("observer", action), false);
    assert.equal(canPerform("interact", action), action !== "publish");
  }
});

test("someone else enters as interact or observer, never as the person on this machine", () => {
  assert.deepEqual(
    decideSignIn({
      intent: "host",
      name: "",
      machineName: "Ada",
      hostName: null,
      hostTaken: false,
    }),
    { ok: true, role: "host", name: "Ada" },
  );
  assert.equal(
    decideSignIn({
      intent: "host",
      name: "Outra",
      machineName: "Ada",
      hostName: "Ada",
      hostTaken: true,
    }).ok,
    false,
  );
  assert.deepEqual(
    decideSignIn({
      intent: "observer",
      name: "ada",
      machineName: "Ada",
      hostName: "Ada",
      hostTaken: true,
    }),
    { ok: false, reason: "same_person" },
  );
  assert.deepEqual(
    decideSignIn({
      intent: "interact",
      name: "Bianca",
      machineName: "Ada",
      hostName: "Ada",
      hostTaken: true,
    }),
    { ok: true, role: "interact", name: "Bianca" },
  );
  assert.deepEqual(
    decideSignIn({
      intent: "observer",
      name: "   ",
      machineName: "Ada",
      hostName: null,
      hostTaken: false,
    }),
    { ok: false, reason: "name_required" },
  );
});

test("the shared event keeps status and drops transcripts, paths, and secrets", () => {
  const parsed = readSharedScene({
    hostName: "Ada",
    localOffline: false,
    rooms: [
      { id: "proj-sala", name: "Sala Norte", x: -6.8, z: -9, secret: "nope" },
      { id: "", name: "Vazia", x: 0, z: 0 },
    ],
    agents: [
      {
        id: "desk-1",
        x: -2.2,
        z: 0.35,
        form: { role: "Pesquisador", provider: "cursor", note: "internal" },
        event: {
          ...cloud,
          transcript: "não enviar",
          tool_input: { command: "cat ~/.ssh/id_rsa" },
          cwd: "/home/ada/secret",
          path: "/tmp/notes.md",
          secret: "sk-test",
        },
      },
      {
        id: "broken",
        x: 1,
        z: 1,
        form: null,
        event: { ...cloud, machineId: "should-not-pass", origin: "cloud" },
      },
    ],
  });
  assert.ok(parsed);
  assert.equal(parsed.rooms.length, 1);
  assert.equal("secret" in parsed.rooms[0], false);
  assert.equal(parsed.agents.length, 1);
  assert.deepEqual(Object.keys(parsed.agents[0].event).sort(), [
    "machineId",
    "observedAt",
    "origin",
    "owner",
    "projectId",
    "provider",
    "status",
  ]);
  assert.equal(parsed.agents[0].event.status, "idle");
  assert.deepEqual(parsed.agents[0].form, { role: "Pesquisador", provider: "cursor" });
});

test("the channel lives only while someone is looking", () => {
  let emptied = 0;
  const hub = createOfficeHub({ graceMs: 0, onEmpty: () => { emptied += 1; } });
  assert.deepEqual(hub.publish("host", scene), { ok: false, reason: "closed" });
  const seen: unknown[] = [];
  const leaveColleague = hub.join("observer", (next) => seen.push(next));
  assert.deepEqual(hub.publish("observer", scene), { ok: false, reason: "read_only" });

  let hostView: unknown = "missing";
  const leaveHost = hub.join("host", (next) => {
    hostView = next;
  });
  assert.equal(hub.publish("host", { ...scene, agents: scene.agents.map((agent) => ({
    ...agent,
    event: { ...agent.event, transcript: "oculto" },
  })) }).ok, true);
  assert.equal(hub.viewerCount(), 2);
  const shared = hub.snapshot();
  assert.ok(shared);
  assert.equal("transcript" in shared.agents[0].event, false);
  assert.equal(hostView && typeof hostView === "object" && "hostName" in hostView, true);

  leaveHost();
  const afterHost = seen.at(-1) as { localOffline: boolean; agents: { id: string; event: AgentEvent }[] };
  assert.equal(afterHost.localOffline, true);
  assert.equal(afterHost.agents.find((agent) => agent.id === "local:desk-1")?.event.status, "idle");
  assert.equal(afterHost.agents.find((agent) => agent.id === "desk-1")?.event.status, "idle");
  assert.equal(hub.viewerCount(), 1);
  assert.equal(emptied, 0);

  leaveColleague();
  assert.equal(hub.viewerCount(), 0);
  assert.equal(hub.snapshot(), null);
  assert.equal(emptied, 1);
  assert.deepEqual(hub.publish("host", scene), { ok: false, reason: "closed" });
});

test("a host who leaves does not keep a local agent working", () => {
  const released = sceneWithoutHost({
    hostName: "Ada",
    localOffline: false,
    rooms: scene.rooms,
    agents: scene.agents,
  });
  assert.equal(released.localOffline, true);
  assert.equal(released.agents[1].event.status, "idle");
  assert.equal(released.agents[0].event.status, "idle");
  assert.equal(released.agents[0].event.origin, "cloud");
});
