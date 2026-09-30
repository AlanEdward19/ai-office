import test from "node:test";
import assert from "node:assert/strict";
import { commonAreas, ELEVATOR_DOOR_ROTATION } from "./office-layout";
import { roomSlot } from "./rooms";
import { ELEVATOR } from "./floors";
import { arrivalPose, interactTargets } from "./walker";

test("common areas fill vacant slots and leave real project rooms intact", () => {
  assert.equal(commonAreas([]).length, 8);
  const point = roomSlot(0);
  const zones = commonAreas([{ id: "project", name: "Real", ...point }]);
  assert.equal(zones.length, 7);
  assert.ok(zones.every(zone => zone.x !== point.x || zone.z !== point.z));
});
test("elevator door faces the arrival and interaction corridor", () => {
  assert.equal(Math.sin(ELEVATOR_DOOR_ROTATION), -1);
  assert.ok(arrivalPose().x < ELEVATOR.x);
  assert.ok(interactTargets({ floor: "hr", rooms: [], agents: [] })[0].x < ELEVATOR.x);
});
