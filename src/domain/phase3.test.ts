import assert from "node:assert/strict";
import test from "node:test";

import { ELEVATOR, rideElevator } from "./floors";
import { parseJobForm } from "./job-form";
import {
  bindRoom,
  loadOpenedRooms,
  projectsWithoutRooms,
  roomsFromBindings,
  serializeOpenedRooms,
} from "./opened-rooms";
import { bindAgents } from "./placement";
import { CEO_CORNER, layoutRooms, RECEPTION } from "./rooms";

test("the elevator swaps the visible floor and leaves the lobby where it is", () => {
  assert.equal(rideElevator("ground"), "hr");
  assert.equal(rideElevator("hr"), "ground");
  assert.equal(rideElevator(rideElevator("ground")), "ground");
  assert.notEqual(ELEVATOR.x, CEO_CORNER.x);
  assert.notEqual(ELEVATOR.z, RECEPTION.z);
});

test("a room is bound by project id, never by name, and never without a project", () => {
  const projects = [
    { id: "proj-b", name: "Mesmo nome" },
    { id: "proj-a", name: "Mesmo nome" },
  ];
  assert.equal(bindRoom([], projects, "  ").ok, false);
  assert.equal(bindRoom([], projects, "Mesmo nome").ok, false);
  const first = bindRoom([], projects, "proj-a");
  assert.equal(first.ok, true);
  if (!first.ok) return;
  assert.deepEqual(first.projectIds, ["proj-a"]);
  const again = bindRoom(first.projectIds, projects, "proj-a");
  assert.equal(again.ok, false);
  const second = bindRoom(first.projectIds, projects, "proj-b");
  assert.equal(second.ok, true);
  if (!second.ok) return;
  const unbound = projectsWithoutRooms(projects, second.projectIds);
  assert.equal(unbound.length, 0);
  const renamed = [
    { id: "proj-b", name: "Outro rótulo" },
    { id: "proj-a", name: "Mesmo nome" },
  ];
  const rooms = layoutRooms(roomsFromBindings(renamed, second.projectIds));
  assert.deepEqual(
    rooms.map((room) => room.id),
    ["proj-a", "proj-b"],
  );
  assert.equal(rooms[0]?.name, "Mesmo nome");
  assert.equal(rooms[1]?.name, "Outro rótulo");
  assert.equal(roomsFromBindings(renamed, ["não-é-id"]).length, 0);
  const stored = loadOpenedRooms(serializeOpenedRooms(second.projectIds));
  assert.deepEqual(stored, ["proj-a", "proj-b"]);
  assert.deepEqual(loadOpenedRooms(JSON.stringify({ version: 1, projectIds: ["proj-a", "proj-a", ""] })), [
    "proj-a",
  ]);
});

test("HR hires with the same ficha and the desk shows that company", () => {
  const parsed = parseJobForm({ role: "Pesquisador", provider: "cursor" }, ["cursor"]);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  const placed = bindAgents({
    owner: "Ada",
    observed: null,
    desks: [
      {
        id: "desk-hr",
        createdAt: "2026-09-30T12:00:00.000Z",
        form: parsed.form,
      },
    ],
  });
  assert.equal(placed[0]?.form?.provider, "cursor");
  assert.equal(placed[0]?.form?.role, "Pesquisador");
  assert.equal(parseJobForm({ role: "Editor", provider: "grok" }, ["cursor"]).ok, false);
});
