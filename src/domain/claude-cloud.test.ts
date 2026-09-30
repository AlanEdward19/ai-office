import assert from "node:assert/strict";
import test from "node:test";

import {
  claudeCloudArgs,
  claudeCloudAttachment,
  claudeCloudComment,
  claudeCloudFailure,
  claudeCloudPrompt,
  claudeCloudStartedCopy,
  parseClaudeAuthStatusOutput,
  parseClaudeCloudStart,
  readClaudeAuthStatus,
} from "./claude-cloud";
import { dispatchSessionLink, loadDispatches } from "./dispatch";

const issue = {
  identifier: "A-8",
  title: "Dentro",
  url: "https://linear.app/a-8",
  description: "Sem chave",
};

const sessionId = "session_01DiUkqY2kzbUbDmW1w96rfi";
const sessionUrl = `https://claude.ai/code/${sessionId}`;

test("claude cloud start is the logged-in CLI and keeps only the session url", () => {
  const prompt = claudeCloudPrompt(issue);
  assert.deepEqual(claudeCloudArgs(prompt), ["--cloud", prompt]);
  assert.match(prompt, /A-8/);
  assert.match(prompt, /https:\/\/linear\.app\/a-8/);
  assert.equal(prompt.includes("ANTHROPIC_API_KEY"), false);
  assert.equal(prompt.includes("CURSOR_API_KEY"), false);
  assert.equal(prompt.includes("LINEAR_API_KEY"), false);
  assert.equal(prompt.includes("Bearer"), false);
  assert.equal(claudeCloudArgs(prompt).includes("--print"), false);
  assert.equal(claudeCloudArgs(prompt).some((arg) => arg.startsWith("--")), true);
  assert.deepEqual(
    claudeCloudArgs(prompt).filter((arg) => arg.startsWith("--")),
    ["--cloud"],
  );

  const created = [
    "Created cloud session: A-8 Dentro",
    `View: ${sessionUrl}?from=cli&m=0`,
    `Resume with: claude --teleport ${sessionId}`,
  ].join("\n");
  assert.deepEqual(parseClaudeCloudStart(created), { id: sessionId, url: sessionUrl });
  assert.equal(JSON.stringify(parseClaudeCloudStart(created)).includes("Dentro"), false);

  const remote = [
    "Created remote session: Fix DNS rebinding comment in external services",
    "View: https://claude.ai/code/session_01AcfWgP3FwpMU8JMn2cj1zD?m=0",
  ].join("\n");
  assert.deepEqual(parseClaudeCloudStart(remote), {
    id: "session_01AcfWgP3FwpMU8JMn2cj1zD",
    url: "https://claude.ai/code/session_01AcfWgP3FwpMU8JMn2cj1zD",
  });

  const colored = `\u001b[32mCreated cloud session: title\u001b[0m\nView: ${sessionUrl}?from=cli&m=0\n`;
  assert.equal(parseClaudeCloudStart(colored)?.id, sessionId);
  assert.equal(parseClaudeCloudStart(`View: ${sessionUrl}`), null);
  assert.equal(parseClaudeCloudStart("Created cloud session: title\nno link"), null);
  assert.equal(
    parseClaudeCloudStart(`Created cloud session: title\nSee https://evil.example/${sessionId}`),
    null,
  );
  assert.equal(parseClaudeCloudStart(""), null);
});

test("claude cloud auth is the claude.ai login and not an API key", () => {
  assert.deepEqual(
    readClaudeAuthStatus({ loggedIn: true, authMethod: "claude.ai", email: "ada@example.com" }),
    { parsed: true, cloud: true },
  );
  assert.deepEqual(
    readClaudeAuthStatus({ loggedIn: true, authMethod: "api_key", apiKeySource: "ANTHROPIC_API_KEY" }),
    { parsed: true, cloud: false },
  );
  assert.deepEqual(readClaudeAuthStatus({ loggedIn: false, authMethod: "claude.ai" }), {
    parsed: true,
    cloud: false,
  });
  assert.deepEqual(readClaudeAuthStatus({ token: "sk-ant-oat01-secret" }), { parsed: false });
  const parsed = parseClaudeAuthStatusOutput(
    'banner\n{"loggedIn":true,"authMethod":"claude.ai","email":"ada@example.com"}\n',
  );
  const auth = readClaudeAuthStatus(parsed);
  assert.equal(auth.parsed, true);
  if (auth.parsed) assert.equal(auth.cloud, true);
  assert.equal(JSON.stringify(auth).includes("ada@example.com"), false);
  assert.equal(claudeCloudFailure("Unable to get organization UUID"), "auth");
  assert.equal(claudeCloudFailure("API key authentication is not sufficient"), "auth");
  assert.equal(claudeCloudFailure("Cloud sessions aren't available with this provider"), "auth");
  assert.equal(claudeCloudFailure("Session creation failed"), "rejected");
});

test("a started claude session is a link, and the desk is not marked working", () => {
  const copy = claudeCloudStartedCopy(true);
  assert.match(copy, /unknown/);
  assert.match(copy, /running, idle ou terminated/);
  assert.equal(copy.includes("continua ocioso"), false);
  assert.equal(claudeCloudAttachment(sessionUrl).url, sessionUrl);
  assert.match(claudeCloudComment(sessionUrl), new RegExp(sessionId));
  assert.equal(claudeCloudComment(sessionUrl).includes("ANTHROPIC_API_KEY"), false);
  assert.deepEqual(
    dispatchSessionLink({
      provider: "anthropic",
      cursorAgentUrl: null,
      claudeSessionUrl: sessionUrl,
    }),
    { href: sessionUrl, label: "sessão na nuvem" },
  );
  assert.equal(
    dispatchSessionLink({
      provider: "anthropic",
      cursorAgentUrl: "https://cursor.com/agents/bc-1",
      claudeSessionUrl: null,
    }),
    null,
  );

  const loaded = loadDispatches(
    JSON.stringify({
      version: 1,
      dispatches: [
        {
          issueId: "i1",
          projectId: "p1",
          deskId: "desk-claude",
          provider: "anthropic",
          cursorAgentId: null,
          cursorAgentUrl: null,
          claudeSessionId: sessionId,
          claudeSessionUrl: sessionUrl,
          createdAt: "2026-09-30T12:00:00.000Z",
          prompt: "do not keep",
          token: "sk-ant-oat01-secret",
        },
        {
          issueId: "i2",
          projectId: "p1",
          deskId: "desk-old",
          provider: "cursor",
          cursorAgentId: "bc-1",
          cursorAgentUrl: "https://cursor.com/agents/bc-1",
          createdAt: "2026-09-30T11:00:00.000Z",
        },
      ],
    }),
  );
  assert.equal(loaded[0]?.claudeSessionUrl, sessionUrl);
  assert.equal(loaded[1]?.claudeSessionId, null);
  assert.equal(loaded[1]?.cursorAgentId, "bc-1");
  const stored = JSON.stringify(loaded);
  assert.equal(stored.includes("sk-ant"), false);
  assert.equal(stored.includes("do not keep"), false);
  assert.equal(
    loadDispatches(
      JSON.stringify({
        version: 1,
        dispatches: [
          {
            issueId: "i3",
            projectId: "p1",
            deskId: "desk-claude",
            provider: "anthropic",
            cursorAgentId: null,
            cursorAgentUrl: null,
            claudeSessionId: sessionId,
            claudeSessionUrl: "https://evil.example/code/" + sessionId,
            createdAt: "2026-09-30T12:00:00.000Z",
          },
        ],
      }),
    )[0]?.claudeSessionUrl,
    null,
  );
  const mismatched = loadDispatches(
    JSON.stringify({
      version: 1,
      dispatches: [
        {
          issueId: "i4",
          projectId: "p1",
          deskId: "desk-claude",
          provider: "anthropic",
          claudeSessionId: "session_01AcfWgP3FwpMU8JMn2cj1zD",
          claudeSessionUrl: sessionUrl,
          createdAt: "2026-09-30T12:00:00.000Z",
        },
      ],
    }),
  );
  assert.equal(mismatched[0]?.claudeSessionId, null);
  assert.equal(mismatched[0]?.claudeSessionUrl, null);
});
