import assert from "node:assert/strict";
import test from "node:test";

import {
  cursorCreateBody,
  cursorDispatchPrompt,
  decideDrop,
  loadDispatches,
  nearestDeskId,
  preferredCursorDeskId,
  readCreatedCursorAgent,
  refusalCopy,
  serializeDispatches,
  serverDispatchCopy,
} from "./dispatch";
import {
  issueCreateVariables,
  issuesForProject,
  mergeRoomIssues,
  parseCardTitle,
  readCreatedIssue,
  readIssueDetail,
  readProjectIssues,
  readProjectTeam,
} from "./issues";
import { bindAgents } from "./placement";

const roomA = {
  data: {
    project: {
      id: "room-a",
      teams: { nodes: [{ id: "team-a" }] },
      issues: {
        nodes: [
          {
            id: "i1",
            identifier: "A-1",
            title: "Certa",
            url: "https://linear.app/a-1",
            createdAt: "2026-01-02T00:00:00.000Z",
            state: { name: "Backlog" },
            project: { id: "room-a" },
          },
          {
            id: "i2",
            identifier: "B-1",
            title: "Outra sala",
            url: "https://linear.app/b-1",
            createdAt: "2026-01-03T00:00:00.000Z",
            state: { name: "Todo" },
            project: { id: "room-b" },
          },
          {
            id: "i3",
            identifier: "A-2",
            title: "Sem projeto repetido",
            url: "https://linear.app/a-2",
            createdAt: "2026-01-01T00:00:00.000Z",
            state: { name: "Backlog" },
          },
        ],
        pageInfo: { hasNextPage: false, endCursor: null },
      },
    },
  },
};

test("a room board keeps only that project's issues", () => {
  const page = readProjectIssues(roomA, "room-a");
  assert.deepEqual(
    page.issues.map((issue) => issue.id),
    ["i1", "i3"],
  );
  assert.equal(page.teamId, "team-a");
  assert.equal(issuesForProject(page.issues, "room-b").length, 0);
  assert.deepEqual(
    mergeRoomIssues(page.issues).map((issue) => issue.id),
    ["i1", "i3"],
  );
  assert.equal(readProjectIssues({ data: { project: null } }, "room-a").projectFound, false);
  assert.equal(readProjectTeam(roomA, "room-b").projectFound, false);
});

test("a new card is created inside the room project", () => {
  assert.equal(parseCardTitle("  Revisar porta  "), "Revisar porta");
  assert.equal(parseCardTitle("   "), null);
  const variables = issueCreateVariables("room-a", "team-a", "Revisar porta");
  assert.deepEqual(variables.input, {
    title: "Revisar porta",
    teamId: "team-a",
    projectId: "room-a",
  });
  const foreign = readCreatedIssue(
    {
      data: {
        issueCreate: {
          success: true,
          issue: {
            id: "i9",
            identifier: "B-9",
            title: "Fora",
            url: "https://linear.app/b-9",
            createdAt: "2026-02-01T00:00:00.000Z",
            state: { name: "Backlog" },
            project: { id: "room-b" },
          },
        },
      },
    },
    "room-a",
  );
  assert.equal(foreign, null);
  const kept = readCreatedIssue(
    {
      data: {
        issueCreate: {
          success: true,
          issue: {
            id: "i8",
            identifier: "A-8",
            title: "Dentro",
            url: "https://linear.app/a-8",
            createdAt: "2026-02-01T00:00:00.000Z",
            state: { name: "Backlog" },
            project: { id: "room-a" },
          },
        },
      },
    },
    "room-a",
  );
  assert.equal(kept?.projectId, "room-a");
  assert.equal(kept?.identifier, "A-8");
  const detail = readIssueDetail({
    data: {
      issue: {
        id: "i8",
        identifier: "A-8",
        title: "Dentro",
        description: "Texto",
        url: "https://linear.app/a-8",
        createdAt: "2026-02-01T00:00:00.000Z",
        state: { name: "Backlog" },
        project: { id: "room-a" },
      },
    },
  });
  assert.equal(detail?.projectId, "room-a");
  assert.equal(detail?.description, "Texto");
});

test("a drop uses the ficha and dispatches every authenticated provider", () => {
  const cursorDesk = { id: "desk-cursor", form: { role: "Pesquisador", provider: "cursor" as const } };
  const claudeDesk = { id: "desk-claude", form: { role: "Editor", provider: "anthropic" as const } };
  const codexDesk = { id: "desk-codex", form: { role: "Revisor", provider: "openai" as const } };
  assert.equal(decideDrop({ desk: null, loggedIn: ["cursor"] }).ok, false);
  assert.equal(decideDrop({ desk: { id: "bare", form: null }, loggedIn: ["cursor"] }).ok, false);
  const loggedOut = decideDrop({ desk: cursorDesk, loggedIn: [] });
  assert.equal(loggedOut.ok, false);
  if (!loggedOut.ok) assert.equal(loggedOut.reason, "provider_not_logged_in");
  const claude = decideDrop({ desk: claudeDesk, loggedIn: ["anthropic"] });
  assert.deepEqual(claude, { ok: true, deskId: "desk-claude", provider: "anthropic" });
  assert.match(refusalCopy("provider_not_logged_in", "anthropic"), /Anthropic/);
  assert.match(serverDispatchCopy("provider_not_logged_in", "openai"), /OpenAI/);
  const codex = decideDrop({ desk: codexDesk, loggedIn: ["openai"] });
  assert.deepEqual(codex, { ok: true, deskId: "desk-codex", provider: "openai" });
  for (const desk of [cursorDesk, claudeDesk, codexDesk]) {
    assert.deepEqual(decideDrop({ desk, loggedIn: [] }), {
      ok: false, reason: "provider_not_logged_in", provider: desk.form.provider,
    });
  }
  const cursor = decideDrop({ desk: cursorDesk, loggedIn: ["cursor"] });
  assert.deepEqual(cursor, { ok: true, deskId: "desk-cursor", provider: "cursor" });
});

test("cursor dispatch names the linear issue and does not carry secrets", () => {
  const body = cursorCreateBody({
    identifier: "A-8",
    title: "Dentro",
    url: "https://linear.app/a-8",
    description: "Sem chave",
  });
  assert.deepEqual(Object.keys(body).sort(), ["name", "prompt"]);
  assert.equal(body.prompt.text, cursorDispatchPrompt({
    identifier: "A-8",
    title: "Dentro",
    url: "https://linear.app/a-8",
    description: "Sem chave",
  }));
  assert.match(body.prompt.text, /A-8/);
  assert.match(body.prompt.text, /https:\/\/linear\.app\/a-8/);
  assert.equal(body.prompt.text.includes("LINEAR_API_KEY"), false);
  assert.equal(body.prompt.text.includes("CURSOR_API_KEY"), false);
  assert.equal(body.prompt.text.includes("Bearer"), false);
  const created = readCreatedCursorAgent({
    agent: {
      id: "bc-1",
      url: "https://cursor.com/agents/bc-1",
      status: "ACTIVE",
    },
    run: { id: "run-1" },
  });
  assert.equal(created?.id, "bc-1");
  assert.equal(created?.status, "ACTIVE");
  assert.equal(created?.url, "https://cursor.com/agents/bc-1");
});

test("the dispatched cursor desk receives the working event", () => {
  const observed = {
    provider: "cursor" as const,
    origin: "cloud" as const,
    owner: "Ada",
    machineId: null,
    projectId: null,
    status: "working" as const,
    observedAt: "2026-09-30T12:00:00.000Z",
  };
  const desks = [
    {
      id: "desk-first",
      createdAt: "2026-09-30T11:00:00.000Z",
      form: { role: "Primeiro", provider: "cursor" as const },
    },
    {
      id: "desk-drop",
      createdAt: "2026-09-30T11:05:00.000Z",
      form: { role: "Escolhido", provider: "cursor" as const },
    },
  ];
  const placed = bindAgents({
    desks,
    observed,
    owner: "Ada",
    preferredDeskId: "desk-drop",
  });
  assert.equal(placed.find((agent) => agent.id === "desk-drop")?.event.status, "working");
  assert.equal(placed.find((agent) => agent.id === "desk-first")?.event.status, "idle");
  const raw = serializeDispatches([
    {
      issueId: "i8",
      projectId: "room-a",
      deskId: "desk-drop",
      provider: "cursor",
      cursorAgentId: "bc-1",
      cursorAgentUrl: "https://cursor.com/agents/bc-1",
      createdAt: "2026-09-30T12:00:00.000Z",
    },
    {
      issueId: "i9",
      projectId: "room-a",
      deskId: "desk-grok",
      provider: "grok" as never,
      cursorAgentId: null,
      cursorAgentUrl: null,
      createdAt: "2026-09-30T12:01:00.000Z",
    },
  ]);
  const loaded = loadDispatches(raw);
  assert.equal(loaded.length, 1);
  assert.equal(preferredCursorDeskId(loaded), "desk-drop");
  assert.equal(nearestDeskId([{ id: "a", x: 0, y: 0 }, { id: "b", x: 40, y: 0 }], 10, 0, 96), "a");
  assert.equal(nearestDeskId([{ id: "a", x: 0, y: 0 }], 200, 0, 96), null);
});
