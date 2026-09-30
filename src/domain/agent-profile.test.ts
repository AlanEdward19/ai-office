import assert from "node:assert/strict";
import { test } from "node:test";
import { loadAgentProfiles, renameAgentProfile, serializeAgentProfiles } from "./agent-profile";

test("names are trimmed, persist by any agent id and replace without mutating profiles", () => {
  const initial = renameAgentProfile([], "local-codex", "  Ana  ");
  const hired = renameAgentProfile(initial, "hired-123", "B".repeat(60));
  const renamed = renameAgentProfile(hired, "local-codex", "A");
  assert.equal(initial[0].name, "Ana");
  assert.deepEqual(renamed, [{ agentId: "local-codex", name: "A" }, { agentId: "hired-123", name: "B".repeat(60) }]);
  assert.deepEqual(loadAgentProfiles(serializeAgentProfiles(renamed)), renamed);
});

test("rename rejects blank or oversized names and invalid agent ids", () => {
  for (const name of ["", "   ", "A".repeat(61)]) {
    assert.throws(() => renameAgentProfile([], "local-codex", name), Error);
  }
  assert.throws(() => renameAgentProfile([], "  ", "Ana"), Error);
  assert.throws(() => renameAgentProfile([], "codex", null as unknown as string), Error);
});

test("loading ignores malformed, old and invalid storage payloads", () => {
  for (const raw of [null, "", "broken", "null", "[]", '{"version":0,"profiles":[]}', '{"version":1,"desks":[]}']) {
    assert.deepEqual(loadAgentProfiles(raw), []);
  }
  assert.deepEqual(loadAgentProfiles(JSON.stringify({ version: 1, profiles: [
    null, 3, { agentId: "", name: "Ana" }, { agentId: "codex", name: 3 },
    { agentId: "hired", name: "A".repeat(61) }, { agentId: "codex", name: "  Ana  " },
    { agentId: "codex", name: "duplicate" },
  ] })), [{ agentId: "codex", name: "Ana" }]);
});
