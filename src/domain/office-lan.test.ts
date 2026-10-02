import assert from "node:assert/strict";
import test from "node:test";

import type { AgentEvent } from "./agent-event";
import {
  LOCAL_REPORT_DROP_MS,
  LOCAL_REPORT_STALE_MS,
  agentPlaceLabel,
  localAgentOffline,
  mergeFloor,
  officeLanUrls,
  readLocalMachineReport,
} from "./office-machines";
import { createOfficeHub, sceneWithoutHost, type SharedScene } from "./office-share";

const observedAt = "2026-10-02T12:00:00.000Z";

const cloud: AgentEvent = {
  provider: "cursor",
  origin: "cloud",
  owner: "Ada",
  machineId: null,
  projectId: "proj-sala",
  status: "idle",
  observedAt,
};

const hostLocal: AgentEvent = {
  provider: "cursor",
  origin: "local",
  owner: "Ada",
  machineId: "machine-host",
  projectId: null,
  status: "idle",
  observedAt,
};

const guestLocal: AgentEvent = {
  provider: "anthropic",
  origin: "local",
  owner: "Bianca",
  machineId: "machine-guest",
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
    { id: "local:desk-1", x: 11, z: 0.2, form: { role: "Pesquisador", provider: "cursor" }, event: hostLocal },
  ],
};

test("a cloud agent is labeled as cloud for the account or desk, and a local agent names its machine", () => {
  const cloudLabel = agentPlaceLabel({
    event: cloud,
    form: { role: "Pesquisador" },
  });
  assert.equal(cloudLabel, "Nuvem · Ada · Pesquisador");
  assert.equal(cloudLabel.includes("machine"), false);
  assert.equal(cloud.machineId, null);
  assert.equal(agentPlaceLabel({ event: guestLocal }), "Local · Bianca");
  assert.equal(localAgentOffline("local", true, true), false);
  assert.equal(localAgentOffline("local", false, false), true);
  assert.equal(localAgentOffline("cloud", false, true), false);
});

test("a second machine's working local agent stays on the floor when the host publishes again", () => {
  const hub = createOfficeHub({ graceMs: 0 });
  hub.join("host", () => {});
  hub.join("interact", () => {});
  assert.equal(hub.publish("host", scene).ok, true);
  assert.equal(
    hub.reportLocal({
      machineId: "machine-guest",
      owner: "Bianca",
      online: true,
      agents: [{ ...guestLocal, transcript: "não enviar", cwd: "/secret" }],
    }).ok,
    true,
  );
  const guest = hub.snapshot()?.agents.find((agent) => agent.event.machineId === "machine-guest");
  assert.ok(guest);
  assert.equal(guest.event.status, "working");
  assert.equal(guest.machineOnline, true);
  assert.equal(guest.event.origin, "local");
  assert.equal("transcript" in guest.event, false);
  assert.equal(agentPlaceLabel(guest), "Local · Bianca");

  assert.equal(hub.publish("host", scene).ok, true);
  const again = hub.snapshot()?.agents.find((agent) => agent.event.machineId === "machine-guest");
  assert.equal(again?.event.status, "working");
  assert.equal(again?.machineOnline, true);
  const cloudAgent = hub.snapshot()?.agents.find((agent) => agent.id === "desk-1");
  assert.equal(cloudAgent?.event.machineId, null);
  assert.equal(agentPlaceLabel(cloudAgent!), "Nuvem · Ada · Pesquisador");
});

test("a local report that is offline or not from that machine is not shown as working", () => {
  const parsed = readLocalMachineReport({
    machineId: "machine-guest",
    owner: "Bianca",
    online: true,
    agents: [
      guestLocal,
      { ...guestLocal, provider: "cursor", origin: "cloud", machineId: null, status: "working" },
      { ...guestLocal, provider: "openai", machineId: "other-machine", status: "working" },
    ],
  });
  assert.ok(parsed);
  assert.deepEqual(
    parsed.agents.map((agent) => agent.provider),
    ["anthropic"],
  );

  const hub = createOfficeHub({ graceMs: 0 });
  hub.join("observer", () => {});
  assert.equal(hub.reportLocal({ ...parsed, online: false }).ok, true);
  const agent = hub.snapshot()?.agents.find((item) => item.event.machineId === "machine-guest");
  assert.equal(agent?.event.status, "idle");
  assert.equal(agent?.machineOnline, false);
  assert.equal(hub.reportLocal({ machineId: "", owner: "Bianca", online: true, agents: [] }).ok, false);
});

test("the host leaving idles only that machine's local agents", () => {
  const released = sceneWithoutHost(
    {
      ...scene,
      agents: [
        ...scene.agents,
        {
          id: "local:machine-guest:anthropic",
          x: 13.9,
          z: 0.2,
          form: null,
          machineOnline: true,
          event: guestLocal,
        },
      ],
    },
    "machine-host",
  );
  assert.equal(released.agents.find((agent) => agent.event.machineId === "machine-host")?.event.status, "idle");
  assert.equal(released.agents.find((agent) => agent.event.machineId === "machine-host")?.machineOnline, false);
  assert.equal(released.agents.find((agent) => agent.event.machineId === "machine-guest")?.event.status, "working");
  assert.equal(released.agents.find((agent) => agent.event.machineId === "machine-guest")?.machineOnline, true);
});

test("an interact person can hire into the shared office and an observer cannot", () => {
  const hub = createOfficeHub({ graceMs: 0 });
  hub.join("interact", () => {});
  assert.equal(hub.publish("interact", scene).ok, false);
  assert.equal(
    hub.hire("observer", {
      id: "desk-new",
      form: { role: "Editor", provider: "cursor" },
      owner: "Ada",
      observedAt,
    }).ok,
    false,
  );
  assert.equal(
    hub.hire("interact", {
      id: "desk-new",
      form: { role: "Editor", provider: "cursor" },
      owner: "Ada",
      observedAt,
    }).ok,
    true,
  );
  const hired = hub.snapshot()?.agents.find((agent) => agent.id === "desk-new");
  assert.equal(hired?.event.origin, "cloud");
  assert.equal(hired?.event.machineId, null);
  assert.equal(agentPlaceLabel(hired!), "Nuvem · Ada · Editor");
  assert.equal(hub.openRoom("observer", [{ id: "proj-2", name: "Sala Sul", x: 1, z: 2 }]).ok, false);
  assert.equal(hub.openRoom("interact", [{ id: "proj-2", name: "Sala Sul", x: 1, z: 2 }]).ok, true);
  assert.equal(hub.snapshot()?.rooms.some((room) => room.id === "proj-2"), true);
});

test("a quiet local report stops looking like work and then leaves the floor", () => {
  const now = 1_700_000_000_000;
  const report = {
    machineId: "machine-guest",
    owner: "Bianca",
    online: true,
    agents: [guestLocal],
  };
  const quiet = mergeFloor({
    previous: null,
    incoming: scene,
    reports: [{ report, seenAt: now - LOCAL_REPORT_STALE_MS - 1 }],
    now,
    hostMachineId: "machine-host",
    hostPresent: true,
    hostLocalsFrom: "incoming",
  });
  const agent = quiet?.agents.find((item) => item.event.machineId === "machine-guest");
  assert.equal(agent?.event.status, "idle");
  assert.equal(agent?.machineOnline, false);
  assert.equal(quiet?.agents.some((item) => item.event.machineId === "machine-host"), true);

  const gone = mergeFloor({
    previous: null,
    incoming: scene,
    reports: [{ report, seenAt: now - LOCAL_REPORT_DROP_MS - 1 }],
    now,
    hostMachineId: "machine-host",
    hostPresent: true,
    hostLocalsFrom: "incoming",
  });
  assert.equal(gone?.agents.some((item) => item.event.machineId === "machine-guest"), false);
  assert.equal(gone?.agents.find((item) => item.event.machineId === "machine-host")?.event.status, "idle");
});

test("a session this machine reports shows on its own floor when the page says the wing is offline", () => {
  const hub = createOfficeHub({ graceMs: 0 });
  const leave = hub.join("host", () => undefined);
  assert.equal(
    hub.publish("host", { hostName: "Ada", localOffline: true, rooms: [], agents: [] }).ok,
    true,
  );
  assert.equal(hub.snapshot()?.agents.some((agent) => agent.event.origin === "local"), false);
  assert.equal(
    hub.noteHostLocal({
      machineId: "machine-host",
      owner: "Ada",
      online: true,
      agents: [{ ...hostLocal, status: "working" }],
    }).ok,
    true,
  );
  const cursor = hub.snapshot()?.agents.find((agent) => agent.event.origin === "local");
  assert.equal(cursor?.event.provider, "cursor");
  assert.equal(cursor?.event.status, "working");
  assert.equal(cursor?.machineOnline, true);
  assert.equal(agentPlaceLabel(cursor!), "Local · Ada");
  assert.equal(hub.snapshot()?.localOffline, false);
  assert.equal(
    hub.publish("host", { hostName: "Ada", localOffline: true, rooms: [], agents: [] }).ok,
    true,
  );
  assert.equal(hub.snapshot()?.agents.find((agent) => agent.event.provider === "cursor")?.event.status, "working");
  assert.equal(hub.snapshot()?.localOffline, false);
  assert.equal(hub.snapshot()?.agents.some((agent) => agent.event.provider === "openai"), false);
  assert.equal(
    hub.noteHostLocal({
      machineId: "machine-host",
      owner: "Ada",
      online: false,
      agents: [{ ...hostLocal, status: "working" }],
    }).ok,
    true,
  );
  assert.equal(hub.snapshot()?.localOffline, true);
  assert.equal(hub.snapshot()?.agents.find((agent) => agent.event.provider === "cursor")?.event.status, "idle");
  leave();
});

test("a session this machine reports stays on the floor and is working only while that report says so", () => {
  const hub = createOfficeHub({ graceMs: 0 });
  const leave = hub.join("host", () => undefined);
  assert.equal(hub.publish("host", scene).ok, true);
  assert.equal(
    hub.noteHostLocal({
      machineId: "machine-host",
      owner: "Ada",
      online: true,
      agents: [{ ...hostLocal, provider: "anthropic", status: "working" }],
    }).ok,
    true,
  );
  const claude = hub.snapshot()?.agents.find((agent) => agent.event.provider === "anthropic");
  const cursor = hub.snapshot()?.agents.find((agent) => agent.event.origin === "local" && agent.event.provider === "cursor");
  assert.equal(claude?.event.status, "working");
  assert.equal(claude?.event.machineId, "machine-host");
  assert.equal(agentPlaceLabel(claude!), "Local · Ada");
  assert.equal(cursor?.event.status, "idle");
  assert.equal(hub.publish("host", { ...scene, agents: scene.agents.filter((agent) => agent.event.origin !== "local") }).ok, true);
  assert.equal(
    hub.snapshot()?.agents.some((agent) => agent.event.provider === "anthropic" && agent.event.status === "working"),
    true,
  );
  assert.equal(
    hub.noteHostLocal({ machineId: "machine-host", owner: "Ada", online: true, agents: [] }).ok,
    true,
  );
  assert.equal(hub.snapshot()?.agents.some((agent) => agent.event.provider === "anthropic"), false);
  assert.equal(hub.snapshot()?.agents.some((agent) => agent.event.provider === "openai"), false);
  leave();
});

test("lan urls are the other computers on this network", () => {
  assert.deepEqual(
    officeLanUrls(
      [
        { address: "127.0.0.1", family: "IPv4", internal: true },
        { address: "192.168.1.20", family: "IPv4", internal: false },
        { address: "fe80::1", family: "IPv6", internal: false },
        { address: "10.0.0.4", family: 4, internal: false },
      ],
      3847,
    ),
    ["http://192.168.1.20:3847", "http://10.0.0.4:3847"],
  );
});
