import assert from "node:assert/strict";
import test from "node:test";

import { isAgentEvent } from "./agent-event";
import {
  combineCodexThreadStatuses,
  onCodexMessage,
  openCodexWatch,
  parseCodexLine,
  statusFromCodexThread,
  statusFromGrokPresence,
} from "./codex-app-server";
import { parseJobForm } from "./job-form";
import { localAgentEvent, presentLocalEvent } from "./local-hooks";
import { bindAgents, bindLocalWing } from "./placement";

const observedAt = "2026-09-30T12:00:00.000Z";

test("codex thread status maps idle, active, and waitingOnApproval", () => {
  assert.equal(statusFromCodexThread({ type: "idle" }), "idle");
  assert.equal(statusFromCodexThread({ type: "active", activeFlags: [] }), "working");
  assert.equal(
    statusFromCodexThread({ type: "active", activeFlags: ["waitingOnApproval"] }),
    "blocked",
  );
  assert.equal(statusFromCodexThread({ type: "notLoaded" }), "idle");
  assert.equal(statusFromCodexThread({ type: "systemError" }), "idle");
  assert.equal(statusFromCodexThread({ type: "active", activeFlags: ["waitingOnUserInput"] }), "working");
  assert.equal(combineCodexThreadStatuses(["idle", "working", "blocked"]), "blocked");
  assert.equal(combineCodexThreadStatuses(["idle", "working"]), "working");
  assert.equal(combineCodexThreadStatuses([]), "idle");
});

test("the app-server client lists threads and does not start one", () => {
  const opened = openCodexWatch();
  assert.deepEqual(
    opened.send.map((message) => (message as { method: string }).method),
    ["initialize", "initialized"],
  );

  const listed = onCodexMessage(opened.state, { id: 0, result: { userAgent: "codex" } });
  assert.deepEqual(
    listed.send.map((message) => (message as { method: string }).method),
    ["thread/list", "thread/loaded/list"],
  );
  assert.equal(listed.send.some((message) => JSON.stringify(message).includes("thread/start")), false);
  assert.equal(listed.send.some((message) => JSON.stringify(message).includes("turn/start")), false);

  const page = onCodexMessage(opened.state, {
    id: 1,
    result: {
      data: [
        {
          id: "thr_local",
          preview: "SECRET transcript",
          cwd: "/home/ada/secret",
          status: { type: "active", activeFlags: [] },
        },
      ],
      nextCursor: null,
    },
  });
  assert.equal(page.status, "working");
  assert.equal(JSON.stringify(page).includes("SECRET"), false);
  assert.equal(JSON.stringify(page).includes("/home/ada"), false);

  const approval = onCodexMessage(opened.state, {
    method: "thread/status/changed",
    params: {
      threadId: "thr_local",
      status: { type: "active", activeFlags: ["waitingOnApproval"] },
      transcript: "do not forward",
    },
  });
  assert.equal(approval.status, "blocked");
  assert.equal(JSON.stringify(approval).includes("transcript"), false);

  const event = localAgentEvent({
    provider: "openai",
    owner: "ada",
    machineId: "machine-1",
    status: approval.status ?? "idle",
    observedAt,
  });
  assert.equal(isAgentEvent(event), true);
  assert.equal(event.origin, "local");
  assert.equal(event.provider, "openai");
  assert.deepEqual(Object.keys(event).sort(), [
    "machineId",
    "observedAt",
    "origin",
    "owner",
    "projectId",
    "provider",
    "status",
  ]);
  assert.equal(parseCodexLine("not-json"), null);
});

test("a codex session moves the openai desk in the local wing and not the cloud desk", () => {
  const desks = [
    {
      id: "desk-openai",
      createdAt: observedAt,
      form: { role: "Revisor", provider: "openai" as const },
    },
  ];
  const session = localAgentEvent({
    provider: "openai",
    owner: "ada",
    machineId: "machine-1",
    status: "working",
    observedAt,
  });
  const cloud = bindAgents({ desks, observed: session, owner: "ada" });
  assert.equal(cloud[0]?.event.origin, "cloud");
  assert.equal(cloud[0]?.event.status, "idle");
  assert.equal(cloud[0]?.event.machineId, null);

  const wing = bindLocalWing({
    desks,
    observed: { cursor: null, anthropic: null, openai: session },
    owner: "ada",
    machineId: "machine-1",
    machineOnline: true,
  });
  assert.equal(wing[0]?.id, "local:desk-openai");
  assert.equal(wing[0]?.event.status, "working");
  assert.equal(wing[0]?.form?.provider, "openai");
  assert.ok(wing[0] && cloud[0] && wing[0].x !== cloud[0].x);

  const offline = bindLocalWing({
    desks,
    observed: { cursor: null, anthropic: null, openai: { ...session, status: "blocked" } },
    owner: "ada",
    machineId: "machine-1",
    machineOnline: false,
  });
  assert.equal(offline[0]?.event.status, "idle");
  assert.equal(presentLocalEvent({ ...session, status: "blocked" }, false).status, "idle");
});

test("without a presence API, grok is not offered and does not work", () => {
  assert.equal(parseJobForm({ role: "Editor", provider: "grok" }, ["cursor", "openai"]).ok, false);
  assert.equal(statusFromGrokPresence({ status: "working", selected: true, hiring: true }), null);
  assert.equal(statusFromGrokPresence({ type: "active", activeFlags: [] }), null);
  assert.equal(
    isAgentEvent({
      provider: "grok",
      origin: "local",
      owner: "ada",
      machineId: "machine-1",
      projectId: null,
      status: "working",
      observedAt,
    }),
    false,
  );
});
