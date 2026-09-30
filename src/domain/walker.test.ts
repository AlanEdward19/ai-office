import assert from "node:assert/strict";
import test from "node:test";

import {
  LOBBY_SPAWN,
  TURN_SPEED,
  WALK_SPEED,
  arrivalPose,
  avatarRotation,
  integrateWalk,
  interactTargets,
  nearestTarget,
  walkBounds,
} from "./walker";

const still = { forward: 0, strafe: 0, turn: 0, yawDelta: 0, pitchDelta: 0 };

test("walking forward from the lobby faces into the floor", () => {
  const bounds = walkBounds("ground");
  const next = integrateWalk(LOBBY_SPAWN, { ...still, forward: 1 }, null, 0.5, bounds);
  assert.ok(next.pose.z < LOBBY_SPAWN.z - 1);
  assert.equal(next.pose.x, LOBBY_SPAWN.x);
  assert.ok(Math.abs(next.pose.z - (LOBBY_SPAWN.z - WALK_SPEED * 0.5)) < 0.02);
});

test("turning right then walking moves toward +X", () => {
  const bounds = walkBounds("ground");
  const turned = integrateWalk(LOBBY_SPAWN, { ...still, turn: 1 }, null, Math.PI / 2 / TURN_SPEED, bounds);
  assert.ok(Math.abs(turned.pose.yaw - Math.PI / 2) < 0.08);
  const next = integrateWalk(turned.pose, { ...still, forward: 1 }, null, 0.5, bounds);
  assert.ok(next.pose.x > LOBBY_SPAWN.x + 1);
});

test("a click target is walked, and a key cancels it", () => {
  const bounds = walkBounds("ground");
  const walked = integrateWalk(LOBBY_SPAWN, still, { x: 0, z: 0 }, 0.4, bounds);
  assert.ok(walked.pose.z < LOBBY_SPAWN.z);
  assert.ok(walked.target);
  const keyed = integrateWalk(walked.pose, { ...still, forward: 1 }, walked.target, 0.1, bounds);
  assert.equal(keyed.target, null);
});

test("the player stays on the floor", () => {
  const bounds = walkBounds("ground");
  const next = integrateWalk(
    { ...LOBBY_SPAWN, z: bounds.maxZ },
    { ...still, forward: -1 },
    null,
    2,
    bounds,
  );
  assert.equal(next.pose.z, bounds.maxZ);
});

test("interaction is the thing you are standing next to", () => {
  const targets = interactTargets({
    floor: "ground",
    rooms: [{ id: "proj-sala", x: -6.8, z: -9 }],
    agents: [{ id: "desk-1", x: -2.2, z: 0.35 }],
  });
  const desk = targets.find((target) => target.kind === "desk");
  assert.ok(desk);
  assert.equal(nearestTarget(desk.x, desk.z, targets)?.id, "desk-1");
  assert.equal(nearestTarget(0, 2.6, targets), null);
  const board = targets.find((target) => target.id === "proj-sala");
  assert.ok(board);
  assert.ok(board.z > -9);
  assert.equal(arrivalPose().yaw < 0, true);
});


test("after mouse turns, W travels toward the avatar front in every direction", () => {
  for (const yawDelta of [Math.PI / 4, Math.PI / 2, Math.PI, -Math.PI / 2, -Math.PI * 1.5]) {
    const turned = integrateWalk(LOBBY_SPAWN, { ...still, yawDelta }, null, 0, walkBounds("ground"));
    const walked = integrateWalk(turned.pose, { ...still, forward: 1 }, null, 0.1, walkBounds("ground"));
    const rotation = avatarRotation(walked.pose.yaw);
    // Rotating the model's local front (0, 0, -1) around Three's Y axis.
    const frontX = -Math.sin(rotation);
    const frontZ = -Math.cos(rotation);
    const dx = walked.pose.x - turned.pose.x;
    const dz = walked.pose.z - turned.pose.z;
    assert.ok(dx * frontX + dz * frontZ > 0, `W must face forward after yaw ${yawDelta}`);
    assert.ok(Math.abs(dx * frontZ - dz * frontX) < 1e-10);
  }
});


test("room interaction is reachable from outside the entrance with collision enabled", () => {
  const targets = interactTargets({ floor: "ground", rooms: [{ id: "room", x: 0, z: -9 }], agents: [] });
  const entrance = { x: 0, z: -9 + 2.2 + 0.24 + 0.1 };
  assert.equal(nearestTarget(entrance.x, entrance.z, targets)?.id, "room");
});
