import assert from "node:assert/strict";
import test from "node:test";

import { isAgentEvent, type AgentEvent } from "./agent-event";
import {
  CLAUDE_LOCAL_HOOKS,
  CURSOR_LOCAL_HOOKS,
  HOOK_MARK,
  localAgentEvent,
  mergeClaudeSettings,
  mergeCursorHooks,
  ownerFromHook,
  presentLocalEvent,
  statusFromLocalHook,
  stripClaudeSettings,
  stripCursorHooks,
  takeHookLines,
} from "./local-hooks";
import { observeLocalMachine } from "./observe-local";
import { bindAgents, bindLocalWing, deskSlot, localWingSlot } from "./placement";

const observedAt = "2026-09-30T12:00:00.000Z";

function cursorCommands(): Record<(typeof CURSOR_LOCAL_HOOKS)[number], string> {
  return {
    sessionStart: `node '/home/ada/.escritorio-de-ia/${HOOK_MARK}.mjs' cursor sessionStart '/tmp/spool.jsonl'`,
    postToolUse: `node '/home/ada/.escritorio-de-ia/${HOOK_MARK}.mjs' cursor postToolUse '/tmp/spool.jsonl'`,
    stop: `node '/home/ada/.escritorio-de-ia/${HOOK_MARK}.mjs' cursor stop '/tmp/spool.jsonl'`,
    sessionEnd: `node '/home/ada/.escritorio-de-ia/${HOOK_MARK}.mjs' cursor sessionEnd '/tmp/spool.jsonl'`,
  };
}

function claudeCommands(): Record<(typeof CLAUDE_LOCAL_HOOKS)[number], string> {
  return {
    SessionStart: `node '/home/ada/.escritorio-de-ia/${HOOK_MARK}.mjs' anthropic SessionStart '/tmp/spool.jsonl'`,
    PreToolUse: `node '/home/ada/.escritorio-de-ia/${HOOK_MARK}.mjs' anthropic PreToolUse '/tmp/spool.jsonl'`,
    Stop: `node '/home/ada/.escritorio-de-ia/${HOOK_MARK}.mjs' anthropic Stop '/tmp/spool.jsonl'`,
    SessionEnd: `node '/home/ada/.escritorio-de-ia/${HOOK_MARK}.mjs' anthropic SessionEnd '/tmp/spool.jsonl'`,
  };
}

test("cursor and claude hooks map onto the shared status", () => {
  assert.equal(statusFromLocalHook("sessionStart", {}), "working");
  assert.equal(statusFromLocalHook("SessionStart", { source: "startup" }), "working");
  assert.equal(statusFromLocalHook("postToolUse", { tool_name: "Shell" }), "working");
  assert.equal(statusFromLocalHook("PreToolUse", {}), "working");
  assert.equal(statusFromLocalHook("PostToolUse", {}), "working");
  assert.equal(statusFromLocalHook("stop", { status: "completed" }), "done");
  assert.equal(statusFromLocalHook("stop", {}), "done");
  assert.equal(statusFromLocalHook("Stop", { status: "aborted" }), "idle");
  assert.equal(statusFromLocalHook("stop", { status: "error" }), "idle");
  assert.equal(statusFromLocalHook("sessionEnd", { reason: "window_close" }), "idle");
  assert.equal(statusFromLocalHook("SessionEnd", {}), "idle");
  assert.equal(statusFromLocalHook("beforeSubmitPrompt", {}), null);
  assert.equal(ownerFromHook({ user_email: "ada@example.com", tool_input: "secret" }, "osuser"), "ada@example.com");
  assert.equal(ownerFromHook({ tool_input: "secret" }, "osuser"), "osuser");
});

test("a local event requires a machine id and a cloud event rejects one", () => {
  const local = localAgentEvent({
    provider: "cursor",
    owner: "ada",
    machineId: "machine-1",
    status: "working",
    observedAt,
  });
  assert.equal(isAgentEvent(local), true);
  assert.equal(local.origin, "local");
  assert.equal(local.projectId, null);
  assert.equal(isAgentEvent({ ...local, machineId: null }), false);
  assert.equal(isAgentEvent({ ...local, machineId: "   " }), false);
  assert.equal(isAgentEvent({ ...local, origin: "cloud" }), false);
  assert.equal(isAgentEvent({ ...local, origin: "cloud", machineId: null }), true);
});

test("the local wing is not a cloud desk", () => {
  const local = localAgentEvent({
    provider: "cursor",
    owner: "ada",
    machineId: "machine-1",
    status: "working",
    observedAt,
  });
  const desks = [
    {
      id: "desk-cursor",
      createdAt: "2026-09-30T11:00:00.000Z",
      form: { role: "Pesquisador", provider: "cursor" as const },
    },
    {
      id: "desk-cursor-2",
      createdAt: "2026-09-30T11:02:00.000Z",
      form: { role: "Revisor", provider: "cursor" as const },
    },
    {
      id: "desk-openai",
      createdAt: "2026-09-30T11:05:00.000Z",
      form: { role: "Codex", provider: "openai" as const },
    },
  ];
  const cloud = bindAgents({ desks, observed: local, owner: "Ada" });
  assert.equal(cloud.length, 3);
  assert.equal(cloud.every((agent) => agent.event.origin === "cloud" && agent.event.machineId === null), true);
  assert.equal(cloud[0]?.id, "desk-cursor");
  assert.equal(cloud[0]?.event.status, "idle");
  assert.equal(cloud.some((agent) => agent.id.startsWith("local:")), false);

  const wing = bindLocalWing({
    desks,
    observed: { cursor: local, anthropic: null, openai: null },
    owner: "ada",
    machineId: "machine-1",
    machineOnline: true,
  });
  assert.equal(wing.length, 3);
  assert.equal(wing[0]?.id, "local:desk-cursor");
  assert.equal(wing[0]?.event.origin, "local");
  assert.equal(wing[0]?.event.status, "working");
  assert.equal(wing[0]?.event.machineId, "machine-1");
  assert.equal(wing[0]?.form?.role, "Pesquisador");
  assert.equal(wing[1]?.id, "local:desk-cursor-2");
  assert.equal(wing[1]?.event.status, "idle");
  assert.ok(wing[0] && cloud[0] && wing[0].x !== cloud[0].x);
  assert.ok(localWingSlot(0).x > deskSlot(0).x + 8);
  const openaiSeat = wing.find((agent) => agent.form?.provider === "openai");
  assert.equal(openaiSeat?.id, "local:desk-openai");
  assert.equal(openaiSeat?.event.origin, "local");
  assert.equal(openaiSeat?.event.status, "idle");
  assert.ok(openaiSeat && openaiSeat.x !== cloud.find((agent) => agent.id === "desk-openai")?.x);

  const offline = bindLocalWing({
    desks,
    observed: { cursor: local, anthropic: null, openai: null },
    owner: "ada",
    machineId: "machine-1",
    machineOnline: false,
  });
  assert.equal(offline[0]?.event.status, "idle");
  assert.equal(presentLocalEvent(local, false).status, "idle");
  assert.equal(presentLocalEvent({ ...local, origin: "cloud", machineId: null }, false).status, "working");
});

test("hook config keeps user commands and drops only our mark", () => {
  const userCursor = JSON.stringify({
    version: 1,
    hooks: {
      sessionStart: [{ command: "echo user-start" }],
      beforeShellExecution: [{ command: "echo keep-me" }],
    },
  });
  const mergedCursor = mergeCursorHooks(userCursor, cursorCommands());
  assert.equal(mergedCursor.ok, true);
  if (!mergedCursor.ok) return;
  const cursorHooks = mergedCursor.config.hooks as Record<string, { command: string }[]>;
  assert.deepEqual(
    cursorHooks.sessionStart?.map((entry) => entry.command),
    ["echo user-start", cursorCommands().sessionStart],
  );
  assert.equal(cursorHooks.beforeShellExecution?.[0]?.command, "echo keep-me");
  assert.equal(cursorHooks.stop?.some((entry) => entry.command.includes(HOOK_MARK)), true);

  const again = mergeCursorHooks(JSON.stringify(mergedCursor.config), cursorCommands());
  assert.equal(again.ok, true);
  if (!again.ok) return;
  const twice = (again.config.hooks as Record<string, { command: string }[]>).sessionStart;
  assert.equal(twice?.filter((entry) => entry.command.includes(HOOK_MARK)).length, 1);
  assert.equal(twice?.some((entry) => entry.command === "echo user-start"), true);

  const strippedCursor = stripCursorHooks(JSON.stringify(mergedCursor.config));
  assert.equal(strippedCursor.ok, true);
  if (!strippedCursor.ok) return;
  const left = strippedCursor.config.hooks as Record<string, { command: string }[]>;
  assert.deepEqual(left.sessionStart, [{ command: "echo user-start" }]);
  assert.equal(left.beforeShellExecution?.[0]?.command, "echo keep-me");
  assert.equal(JSON.stringify(strippedCursor.config).includes(HOOK_MARK), false);
  assert.equal(mergeCursorHooks("{", cursorCommands()).ok, false);
  assert.equal(stripCursorHooks("{").ok, false);

  const userClaude = JSON.stringify({
    model: "claude",
    hooks: {
      PreToolUse: [
        {
          matcher: "Bash",
          hooks: [
            { type: "command", command: "echo user-tool" },
            { type: "command", command: claudeCommands().PreToolUse },
          ],
        },
      ],
      Notification: [{ matcher: "", hooks: [{ type: "command", command: "echo ping" }] }],
    },
  });
  const mergedClaude = mergeClaudeSettings(userClaude, claudeCommands());
  assert.equal(mergedClaude.ok, true);
  if (!mergedClaude.ok) return;
  assert.equal(mergedClaude.config.model, "claude");
  const claudeHooks = mergedClaude.config.hooks as Record<
    string,
    { matcher: string; hooks: { command: string }[] }[]
  >;
  assert.equal(claudeHooks.PreToolUse?.[0]?.hooks[0]?.command, "echo user-tool");
  assert.equal(claudeHooks.PreToolUse?.[0]?.matcher, "Bash");
  assert.equal(
    claudeHooks.PreToolUse?.some((group) => group.hooks.some((hook) => hook.command.includes(HOOK_MARK))),
    true,
  );
  assert.equal(claudeHooks.Notification?.[0]?.hooks[0]?.command, "echo ping");
  assert.equal(claudeHooks.PreToolUse?.some((group) => group.matcher === "*"), true);

  const strippedClaude = stripClaudeSettings(JSON.stringify(mergedClaude.config));
  assert.equal(strippedClaude.ok, true);
  if (!strippedClaude.ok) return;
  const claudeLeft = strippedClaude.config.hooks as Record<string, { matcher: string; hooks: { command: string }[] }[]>;
  assert.equal(claudeLeft.PreToolUse?.length, 1);
  assert.equal(claudeLeft.PreToolUse?.[0]?.hooks[0]?.command, "echo user-tool");
  assert.equal(claudeLeft.Notification?.[0]?.hooks[0]?.command, "echo ping");
  assert.equal(strippedClaude.config.model, "claude");
  assert.equal(JSON.stringify(strippedClaude.config).includes(HOOK_MARK), false);
  assert.equal(mergeClaudeSettings("not-json", claudeCommands()).ok, false);
});

test("a partial spool line waits, and a lost machine does not emit working", async () => {
  const taken = takeHookLines(
    `${JSON.stringify({ provider: "cursor", hook: "sessionStart", body: {}, at: observedAt })}\n{"provider":"cursor"`,
  );
  assert.equal(taken.lines.length, 1);
  assert.equal(taken.lines[0]?.hook, "sessionStart");
  assert.equal(taken.rest.includes("provider"), true);

  const events: AgentEvent[] = [];
  const presence: boolean[] = [];
  const controller = new AbortController();
  await observeLocalMachine({
    machineId: "machine-1",
    owner: "ada",
    signal: controller.signal,
    accept: { cursor: true, anthropic: true },
    now: () => observedAt,
    presence: (next) => presence.push(next.online),
    notify: () => undefined,
    emit: (event) => events.push(event),
    sleep: async () => {
      controller.abort();
      throw Object.assign(new Error("aborted"), { name: "AbortError" });
    },
    spool: {
      async size() {
        return 4;
      },
      async read() {
        return { ok: false };
      },
    },
  });
  assert.deepEqual(events, []);
  assert.deepEqual(presence, [true, false]);
});

test("the local observe loop stops on abort and does not emit after abort", async () => {
  const events: AgentEvent[] = [];
  const controller = new AbortController();
  let reads = 0;
  const second = JSON.stringify({
    provider: "cursor",
    hook: "postToolUse",
    body: { tool_input: "secret" },
    at: "2026-09-30T12:00:02.000Z",
  });
  await observeLocalMachine({
    machineId: "machine-1",
    owner: "osuser",
    signal: controller.signal,
    accept: { cursor: true, anthropic: false },
    now: () => observedAt,
    presence: () => undefined,
    notify: () => undefined,
    sleep: async (_ms, signal) => {
      if (signal.aborted) throw Object.assign(new Error("aborted"), { name: "AbortError" });
    },
    spool: {
      async size() {
        return 0;
      },
      async read() {
        reads += 1;
        const first = JSON.stringify({
          provider: "cursor",
          hook: "sessionStart",
          body: { user_email: "ada@example.com" },
          at: "2026-09-30T12:00:01.000Z",
        });
        const ignored = JSON.stringify({
          provider: "anthropic",
          hook: "SessionStart",
          body: {},
          at: "2026-09-30T12:00:01.000Z",
        });
        return { ok: true, chunk: `${first}\n${ignored}\n${second}\n`, offset: 300 };
      },
    },
    emit: (event) => {
      events.push(event);
      controller.abort();
    },
  });
  assert.equal(events.length, 1);
  assert.equal(events[0]?.provider, "cursor");
  assert.equal(events[0]?.origin, "local");
  assert.equal(events[0]?.status, "working");
  assert.equal(events[0]?.machineId, "machine-1");
  assert.equal(events[0]?.owner, "ada@example.com");
  assert.equal(events[0]?.projectId, null);
  assert.equal(JSON.stringify(events[0]).includes("secret"), false);
  assert.equal(reads, 1);
});
