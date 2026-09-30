import assert from "node:assert/strict";
import test from "node:test";

import type { AgentEvent } from "./agent-event";
import { STATUS_LABELS } from "./agent-event";
import {
  CLAUDE_CLOUD_FAILURES,
  ClaudeStatusHttpError,
  applyClaudeCloudLabels,
  claudeCloudFailureForHttp,
  isClaudeCloudLabel,
  observeClaudeCloudSessions,
  parseClaudeCloudReport,
  placedStatusText,
  readClaudeNextPage,
  readClaudeSessionList,
  type ClaudeCloudReport,
} from "./claude-cloud-status";
import type { DispatchRecord } from "./dispatch";
import { readSharedScene } from "./office-share";
import type { PlacedAgent } from "./placement";

const observedAt = "2026-09-30T12:00:00.000Z";

function event(partial: Partial<AgentEvent> & Pick<AgentEvent, "provider" | "origin">): AgentEvent {
  return {
    owner: "Ada",
    machineId: partial.origin === "local" ? "machine-1" : null,
    projectId: null,
    status: "idle",
    observedAt,
    ...partial,
  };
}

function desk(partial: Partial<PlacedAgent> & Pick<PlacedAgent, "id">): PlacedAgent {
  return {
    x: 0,
    z: 0,
    form: { role: "Engenheiro", provider: "anthropic" },
    event: event({ provider: "anthropic", origin: "cloud" }),
    ...partial,
  };
}

function dispatch(partial: Partial<DispatchRecord> & Pick<DispatchRecord, "deskId" | "createdAt">): DispatchRecord {
  return {
    issueId: "iss-1",
    projectId: "proj-1",
    provider: "anthropic",
    cursorAgentId: null,
    cursorAgentUrl: null,
    claudeSessionId: "sesn_011CZkZAtmR3yMPDzynEDxu7",
    claudeSessionUrl: null,
    ...partial,
  };
}

test("the session list keeps id and running, idle, or terminated", () => {
  const sessions = readClaudeSessionList({
    data: [
      {
        id: "sesn_running",
        status: "running",
        title: "prompt secreto",
        usage: { input_tokens: 12 },
        metadata: { key: "sk-ant-secret" },
      },
      { id: "sesn_idle", status: "idle", title: "outro" },
      { id: "sesn_done", status: "terminated" },
      { id: "sesn_move", status: "rescheduling", title: "não mostrar" },
      { id: "sesn_other", status: "paused" },
      { id: "  ", status: "running" },
      { id: "sesn_bad", status: "idle", extra: "segredo" },
    ],
    next_page: "page_ok",
  });
  assert.deepEqual(sessions, [
    { id: "sesn_running", status: "running" },
    { id: "sesn_idle", status: "idle" },
    { id: "sesn_done", status: "terminated" },
    { id: "sesn_bad", status: "idle" },
  ]);
  assert.equal(JSON.stringify(sessions).includes("prompt secreto"), false);
  assert.equal(JSON.stringify(sessions).includes("sk-ant-secret"), false);
  assert.equal(JSON.stringify(sessions).includes("rescheduling"), false);
  assert.equal(readClaudeSessionList({ sessions: [] }), null);
  assert.equal(readClaudeSessionList(null), null);
  assert.equal(readClaudeNextPage({ next_page: "  page_ok  " }), "page_ok");
  assert.equal(readClaudeNextPage({ next_page: null }), null);
  assert.equal(readClaudeNextPage({ next_page: "x".repeat(501) }), null);
});

test("a hired Claude cloud desk shows the status of the session it started", () => {
  const claude = desk({ id: "desk-claude" });
  const cursor = desk({
    id: "desk-cursor",
    form: { role: "Pesquisador", provider: "cursor" },
    event: event({ provider: "cursor", origin: "cloud", status: "working" }),
  });
  const local = desk({
    id: "local:claude",
    form: { role: "Engenheiro", provider: "anthropic" },
    event: event({ provider: "anthropic", origin: "local", status: "working" }),
  });
  const report: ClaudeCloudReport = {
    ok: true,
    sessions: [
      { id: "sesn_011CZkZAtmR3yMPDzynEDxu7", status: "running" },
      { id: "sesn_other", status: "idle" },
    ],
  };
  const labeled = applyClaudeCloudLabels(
    [claude, cursor, local],
    [
      dispatch({
        deskId: "desk-claude",
        createdAt: "2026-09-30T11:00:00.000Z",
        claudeSessionId: "sesn_older",
      }),
      dispatch({ deskId: "desk-claude", createdAt: "2026-09-30T12:00:00.000Z" }),
    ],
    report,
  );
  assert.equal(labeled[0]?.claudeCloudLabel, "running");
  assert.equal(labeled[0]?.event.status, "idle");
  assert.equal(placedStatusText(labeled[0]!), "running");
  assert.equal(placedStatusText(labeled[0]!).includes(STATUS_LABELS.idle), false);
  assert.equal(labeled[1]?.claudeCloudLabel, null);
  assert.equal(labeled[1]?.event.status, "working");
  assert.equal(placedStatusText(labeled[1]!), STATUS_LABELS.working);
  assert.equal(labeled[2]?.claudeCloudLabel, null);

  const idle = applyClaudeCloudLabels(
    [claude],
    [dispatch({ deskId: "desk-claude", createdAt: observedAt, claudeSessionId: "sesn_idle" })],
    { ok: true, sessions: [{ id: "sesn_idle", status: "idle" }] },
  );
  assert.equal(idle[0]?.claudeCloudLabel, "idle");
  assert.equal(placedStatusText(idle[0]!), "idle");

  const terminated = applyClaudeCloudLabels(
    [claude],
    [dispatch({ deskId: "desk-claude", createdAt: observedAt, claudeSessionId: "sesn_done" })],
    { ok: true, sessions: [{ id: "sesn_done", status: "terminated" }] },
  );
  assert.equal(terminated[0]?.claudeCloudLabel, "terminated");
});

test("a missing session or a failed call is unknown or the error, never a fake idle", () => {
  const claude = desk({ id: "desk-claude" });
  const started = [dispatch({ deskId: "desk-claude", createdAt: observedAt, claudeSessionId: "session_01DiUkqY2kzbUbDmW1w96rfi" })];
  const absent = applyClaudeCloudLabels(
    [claude],
    started,
    { ok: true, sessions: [{ id: "sesn_other", status: "running" }] },
  );
  assert.equal(absent[0]?.claudeCloudLabel, "unknown");
  assert.equal(absent[0]?.event.status, "idle");
  assert.equal(placedStatusText(absent[0]!), "unknown");

  const noReport = applyClaudeCloudLabels([claude], started, null);
  assert.equal(noReport[0]?.claudeCloudLabel, "unknown");

  const noDispatch = applyClaudeCloudLabels(
    [claude],
    [],
    { ok: true, sessions: [{ id: "sesn_other", status: "idle" }] },
  );
  assert.equal(noDispatch[0]?.claudeCloudLabel, "unknown");
  assert.equal(placedStatusText(noDispatch[0]!), "unknown");

  const missing = applyClaudeCloudLabels(
    [claude],
    started,
    { ok: false, error: CLAUDE_CLOUD_FAILURES.missingKey },
  );
  assert.equal(missing[0]?.claudeCloudLabel, CLAUDE_CLOUD_FAILURES.missingKey);
  assert.equal(placedStatusText(missing[0]!), "falha: ANTHROPIC_API_KEY ausente");
  assert.notEqual(placedStatusText(missing[0]!), STATUS_LABELS.idle);
  assert.equal(missing[0]?.event.status, "idle");
});

test("http failures stay in the closed set", () => {
  assert.equal(claudeCloudFailureForHttp(401), CLAUDE_CLOUD_FAILURES.rejected);
  assert.equal(claudeCloudFailureForHttp(403), CLAUDE_CLOUD_FAILURES.rejected);
  assert.equal(claudeCloudFailureForHttp(500), CLAUDE_CLOUD_FAILURES.unavailable);
  assert.equal(parseClaudeCloudReport({ ok: false, error: CLAUDE_CLOUD_FAILURES.missingKey })?.ok, false);
  assert.equal(parseClaudeCloudReport({ ok: false, error: "idle" }), null);
  assert.equal(parseClaudeCloudReport({ ok: false, error: "sk-ant-secret" }), null);
  const parsed = parseClaudeCloudReport({
    ok: true,
    sessions: [{ id: "sesn_1", status: "terminated", title: "segredo" }],
  });
  assert.deepEqual(parsed, { ok: true, sessions: [{ id: "sesn_1", status: "terminated" }] });
  assert.equal(isClaudeCloudLabel("running"), true);
  assert.equal(isClaudeCloudLabel("rescheduling"), false);
  assert.equal(isClaudeCloudLabel("Ocioso"), false);
});

test("the poll emits the list, then the error, and does not fill a gap with idle", async () => {
  const reports: ClaudeCloudReport[] = [];
  let calls = 0;
  const controller = new AbortController();
  await observeClaudeCloudSessions({
    signal: controller.signal,
    emit: (report) => {
      reports.push(report);
      if (reports.length === 2) controller.abort();
    },
    sleep: async (_ms, signal) => {
      if (signal.aborted) {
        const error = new Error("aborted");
        error.name = "AbortError";
        throw error;
      }
    },
    client: {
      async listSessions() {
        calls += 1;
        if (calls === 1) {
          return {
            data: [{ id: "sesn_1", status: "running", title: "segredo", usage: { tokens: 3 } }],
          };
        }
        throw new ClaudeStatusHttpError(401);
      },
    },
  });
  assert.deepEqual(reports, [
    { ok: true, sessions: [{ id: "sesn_1", status: "running" }] },
    { ok: false, error: CLAUDE_CLOUD_FAILURES.rejected },
  ]);
  assert.equal(JSON.stringify(reports).includes("idle"), false);
  assert.equal(JSON.stringify(reports).includes("segredo"), false);
  assert.equal(calls, 2);
});

test("an unreadable list and a dropped connection are failures, and abort stops the poll", async () => {
  const invalid: ClaudeCloudReport[] = [];
  const invalidController = new AbortController();
  await observeClaudeCloudSessions({
    signal: invalidController.signal,
    emit: (report) => {
      invalid.push(report);
      invalidController.abort();
    },
    sleep: async (_ms, signal) => {
      if (signal.aborted) {
        const error = new Error("aborted");
        error.name = "AbortError";
        throw error;
      }
    },
    client: {
      async listSessions() {
        return { title: "não é uma lista" };
      },
    },
  });
  assert.deepEqual(invalid, [{ ok: false, error: CLAUDE_CLOUD_FAILURES.invalid }]);

  const down: ClaudeCloudReport[] = [];
  const downController = new AbortController();
  await observeClaudeCloudSessions({
    signal: downController.signal,
    emit: (report) => {
      down.push(report);
      downController.abort();
    },
    sleep: async (_ms, signal) => {
      if (signal.aborted) {
        const error = new Error("aborted");
        error.name = "AbortError";
        throw error;
      }
      throw new Error("should have stopped");
    },
    client: {
      async listSessions() {
        throw new Error("network");
      },
    },
  });
  assert.deepEqual(down, [{ ok: false, error: CLAUDE_CLOUD_FAILURES.unavailable }]);

  const stopped = new AbortController();
  stopped.abort();
  let calls = 0;
  await observeClaudeCloudSessions({
    signal: stopped.signal,
    emit: () => {
      throw new Error("should not emit");
    },
    sleep: async () => {
      throw new Error("should not sleep");
    },
    client: {
      async listSessions() {
        calls += 1;
        return { data: [{ id: "sesn_1", status: "idle" }] };
      },
    },
  });
  assert.equal(calls, 0);
});

test("the shared scene keeps a Claude cloud label and drops a secret written into that field", () => {
  const parsed = readSharedScene({
    hostName: "Ada",
    localOffline: false,
    rooms: [],
    agents: [
      {
        id: "desk-claude",
        x: 0,
        z: 0,
        form: { role: "Engenheiro", provider: "anthropic", prompt: "não enviar" },
        event: event({ provider: "anthropic", origin: "cloud" }),
        claudeCloudLabel: "running",
        title: "segredo",
      },
      {
        id: "desk-bad",
        x: 1,
        z: 1,
        form: { role: "Engenheiro", provider: "anthropic" },
        event: event({ provider: "anthropic", origin: "cloud" }),
        claudeCloudLabel: "sk-ant-secret",
      },
    ],
  });
  assert.ok(parsed);
  assert.equal(parsed.agents[0]?.claudeCloudLabel, "running");
  assert.equal(parsed.agents[0]?.event.status, "idle");
  assert.equal(JSON.stringify(parsed).includes("não enviar"), false);
  assert.equal(JSON.stringify(parsed).includes("segredo"), false);
  assert.equal(parsed.agents[1]?.claudeCloudLabel, null);
  assert.equal(JSON.stringify(parsed).includes("sk-ant-secret"), false);
});
