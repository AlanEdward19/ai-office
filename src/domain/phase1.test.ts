import assert from "node:assert/strict";
import test from "node:test";

import { isAgentEvent } from "./agent-event";
import {
  isCloudAgent,
  mapCursorToAgentStatus,
  mapStreamStatus,
  selectCloudAgent,
} from "./cursor-status";
import { loadDesks, serializeDesks } from "./desks";
import { parseJobForm } from "./job-form";
import {
  authenticatedProviderIds,
  claudeCredentialsIndicateLogin,
  claudeExecutableCandidates,
  codexAuthIndicatesLogin,
  cursorAuthIndicatesLogin,
} from "./logins";
import { ObserveHttpError, observeCursorCloudAgent } from "./observe-cursor";
import { bindAgents } from "./placement";
import { layoutRooms, readLinearPage, RECEPTION, CEO_CORNER } from "./rooms";
import { parseSseBlock, readStreamStatus, takeSseBlocks } from "./sse";

test("cursor status mapping follows the phase-1 rules", () => {
  assert.equal(mapCursorToAgentStatus({ agentStatus: "ACTIVE" }), "working");
  assert.equal(mapCursorToAgentStatus({ runStatus: "RUNNING" }), "working");
  assert.equal(
    mapCursorToAgentStatus({ agentStatus: "ACTIVE", runStatus: "FINISHED" }),
    "working",
  );
  assert.equal(mapCursorToAgentStatus({ agentStatus: "IDLE", runStatus: "FINISHED" }), "done");
  assert.equal(mapCursorToAgentStatus({ agentStatus: "IDLE" }), "idle");
  assert.equal(mapCursorToAgentStatus({ runStatus: "ERROR" }), null);
  assert.equal(mapCursorToAgentStatus({ runStatus: "CREATING" }), null);
  assert.equal(mapStreamStatus("RUNNING"), "working");
  assert.equal(mapStreamStatus("FINISHED"), "done");
  assert.equal(mapStreamStatus("CANCELLED"), null);
});

test("one cloud agent is chosen, and pool or archived agents are not", () => {
  const agents = [
    { id: "bc-new", status: "IDLE", env: { type: "cloud" }, latestRunId: "run-a" },
    { id: "bc-pool", status: "ACTIVE", env: { type: "pool" }, latestRunId: "run-b" },
    { id: "bc-old", status: "ARCHIVED", env: { type: "cloud" }, latestRunId: "run-c" },
    { id: "bc-active", status: "ACTIVE", env: { type: "cloud" }, latestRunId: "run-d" },
  ];
  assert.equal(isCloudAgent(agents[1]), false);
  assert.equal(selectCloudAgent(agents, null)?.id, "bc-active");
  assert.equal(selectCloudAgent(agents.slice(0, 3), "bc-new")?.id, "bc-new");
  assert.equal(selectCloudAgent(agents.slice(0, 3), null)?.id, "bc-new");
});

test("rooms are keyed by project id and the name is only a label", () => {
  const rooms = layoutRooms([
    { id: "b", name: "Mesmo nome" },
    { id: "a", name: "Mesmo nome" },
  ]);
  assert.deepEqual(rooms.map((room) => room.id), ["a", "b"]);
  assert.notEqual(rooms[0].x, rooms[1].x);
  const renamed = layoutRooms([
    { id: "a", name: "Outro rótulo" },
    { id: "b", name: "Mesmo nome" },
  ]);
  assert.equal(rooms[0].x, renamed[0].x);
  assert.equal(rooms[0].z, renamed[0].z);
  assert.equal(renamed[0].name, "Outro rótulo");
  assert.notEqual(CEO_CORNER.x, RECEPTION.x);
  assert.equal(layoutRooms([{ id: "ceo", name: "CEO" }])[0].id, "ceo");
});

test("linear page keeps ids and skips nameless nodes without an id", () => {
  const page = readLinearPage({
    data: {
      viewer: { name: "Ada" },
      projects: {
        nodes: [
          { id: "proj-1", name: "  Escritório  " },
          { name: "sem id" },
          { id: "proj-2", name: "" },
        ],
        pageInfo: { hasNextPage: false, endCursor: null },
      },
    },
  });
  assert.equal(page.viewerName, "Ada");
  assert.deepEqual(page.projects, [
    { id: "proj-1", name: "Escritório" },
    { id: "proj-2", name: "Sem nome" },
  ]);
});

test("the job form accepts only an authenticated company", () => {
  const allowed = ["cursor"] as const;
  assert.equal(parseJobForm({ role: "  Pesquisador ", provider: "cursor" }, allowed).ok, true);
  const saved = parseJobForm({ role: "  Pesquisador ", provider: "cursor" }, allowed);
  assert.equal(saved.ok && saved.form.role, "Pesquisador");
  assert.equal(parseJobForm({ role: "", provider: "cursor" }, allowed).ok, false);
  assert.equal(parseJobForm({ role: "Cargo", provider: "anthropic" }, allowed).ok, false);
  assert.equal(parseJobForm({ role: "Cargo", provider: "grok" }, allowed).ok, false);
  assert.equal(parseJobForm({ role: "Cargo", provider: "xai" }, ["cursor", "openai"]).ok, false);
});

test("company list is the authenticated subset and never includes anyone else", () => {
  assert.deepEqual(authenticatedProviderIds({ cursor: true, anthropic: false, openai: false }), [
    "cursor",
  ]);
  assert.deepEqual(authenticatedProviderIds({ cursor: false, anthropic: false, openai: false }), []);
  assert.deepEqual(
    authenticatedProviderIds({ cursor: true, anthropic: true, openai: true }),
    ["cursor", "anthropic", "openai"],
  );
  assert.equal(cursorAuthIndicatesLogin({ accessToken: "present" }), true);
  assert.equal(cursorAuthIndicatesLogin({ accessToken: "  " }), false);
  assert.equal(claudeCredentialsIndicateLogin({ claudeAiOauth: { accessToken: "x" } }), true);
  assert.equal(claudeCredentialsIndicateLogin({}), false);
  assert.deepEqual(claudeExecutableCandidates("/home/ada"), [
    "claude",
    "/home/ada/.local/bin/claude",
    "/home/ada/.claude/local/claude",
    "/usr/local/bin/claude",
  ]);
  assert.equal(codexAuthIndicatesLogin({ tokens: { access_token: "x" } }), true);
  assert.equal(codexAuthIndicatesLogin({ auth_mode: "chatgpt" }), false);
});

test("a desk keeps the same ficha", () => {
  const raw = serializeDesks([
    {
      id: "desk-1",
      createdAt: "2026-09-30T12:00:00.000Z",
      form: { role: "Revisor", provider: "cursor" },
    },
  ]);
  const loaded = loadDesks(raw);
  assert.equal(loaded[0]?.form.role, "Revisor");
  assert.equal(loaded[0]?.form.provider, "cursor");
  assert.equal(loadDesks(JSON.stringify({ version: 1, desks: [{ id: "x", form: { role: "A", provider: "grok" } }] })).length, 0);
});

test("observation updates the cursor desk and cloud events keep machineId null", () => {
  const observed = {
    provider: "cursor" as const,
    origin: "cloud" as const,
    owner: "Ada",
    machineId: null,
    projectId: null,
    status: "working" as const,
    observedAt: "2026-09-30T12:00:00.000Z",
  };
  assert.equal(isAgentEvent(observed), true);
  assert.equal(isAgentEvent({ ...observed, machineId: "laptop", origin: "cloud" }), false);
  const placed = bindAgents({
    owner: "Ada",
    observed,
    desks: [
      {
        id: "desk-cursor",
        createdAt: "2026-09-30T11:00:00.000Z",
        form: { role: "Pesquisador", provider: "cursor" },
      },
      {
        id: "desk-openai",
        createdAt: "2026-09-30T11:05:00.000Z",
        form: { role: "Revisor", provider: "openai" },
      },
    ],
  });
  assert.equal(placed[0]?.event.status, "working");
  assert.equal(placed[0]?.form?.provider, "cursor");
  assert.equal(placed[0]?.event.machineId, null);
  assert.equal(placed[1]?.event.status, "idle");
  assert.equal(placed[1]?.form?.role, "Revisor");
});

test("the run stream moves one cloud agent from working to done, then stops on abort", async () => {
  const events: { status: string; machineId: string | null; origin: string; projectId: string | null }[] = [];
  let streams = 0;
  const controller = new AbortController();
  await observeCursorCloudAgent({
    signal: controller.signal,
    now: () => "2026-09-30T12:00:00.000Z",
    emit: (event) => {
      events.push({
        status: event.status,
        machineId: event.machineId,
        origin: event.origin,
        projectId: event.projectId,
      });
      if (event.status === "done") controller.abort();
    },
    notify: () => undefined,
    sleep: async (_ms, signal) => {
      if (signal.aborted) {
        throw Object.assign(new Error("aborted"), { name: "AbortError" });
      }
    },
    client: {
      async me() {
        return { userFirstName: "Ada", userLastName: "Lovelace", userEmail: "ada@example.com" };
      },
      async listAgents() {
        return [
          {
            id: "bc-1",
            name: "Docs",
            status: "ACTIVE",
            env: { type: "cloud" },
            latestRunId: "run-1",
          },
        ];
      },
      async getRun() {
        return { status: "RUNNING" };
      },
      async *streamRun() {
        streams += 1;
        yield { event: "status", data: JSON.stringify({ status: "RUNNING" }) };
        yield { event: "assistant", data: JSON.stringify({ text: "ignore me" }) };
        yield { event: "result", data: JSON.stringify({ status: "FINISHED" }) };
        yield { event: "done", data: "{}" };
      },
    },
  });
  assert.deepEqual(events.map((event) => event.status), ["working", "done"]);
  assert.equal(events.every((event) => event.machineId === null && event.origin === "cloud"), true);
  assert.equal(events.every((event) => event.projectId === null), true);
  assert.equal(streams, 1);
});

test("a refused cursor key does not keep calling the api after abort", async () => {
  let calls = 0;
  const controller = new AbortController();
  const done = observeCursorCloudAgent({
    signal: controller.signal,
    emit: () => undefined,
    notify: () => {
      calls += 1;
      controller.abort();
    },
    sleep: async (_ms, signal) => {
      if (signal.aborted) throw Object.assign(new Error("aborted"), { name: "AbortError" });
    },
    client: {
      async me() {
        throw new ObserveHttpError(401);
      },
      async listAgents() {
        throw new Error("should not list");
      },
      async getRun() {
        return { status: null };
      },
      streamRun() {
        return emptyStream();
      },
    },
  });
  await done;
  assert.equal(calls, 1);
});

test("sse blocks keep status and result payloads", () => {
  const raw = [
    "event: status",
    'data: {"status":"RUNNING"}',
    "",
    "id: 1",
    "event: result",
    'data: {"status":"FINISHED"}',
    "",
    "event: heartbeat",
  ].join("\n");
  const taken = takeSseBlocks(raw);
  assert.equal(taken.messages.length, 2);
  assert.equal(readStreamStatus(taken.messages[0]?.data ?? ""), "RUNNING");
  assert.equal(parseSseBlock("event: done\ndata: {}")?.event, "done");
  assert.equal(taken.rest.includes("heartbeat"), true);
});

async function* emptyStream() {
  return;
}
