import assert from 'node:assert/strict';
import test from 'node:test';
import { cameraView, clearCamera, firstPersonLook, followCamera } from './camera';
import { LOBBY_SPAWN } from './walker';
const pose = { x: 2, z: 3, yaw: Math.PI / 2, pitch: 0 };

function gap(a: readonly number[], b: readonly number[]) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}
test('first person uses eye height and looks in the walking direction', () => {
  const view = cameraView('first', pose, 1);
  assert.deepEqual(view.position, [2, 1.52, 3]);
  assert.ok(view.focus[0] > pose.x);
  assert.equal(view.focus[1], 1.52);
});
test('first person mouse movement looks right and down without a button drag', () => {
  const look = firstPersonLook(100, 40);
  assert.ok(look.yaw > 0);
  assert.ok(look.pitch > 0);
  assert.deepEqual(firstPersonLook(Number.NaN, 1), { yaw: 0, pitch: 0 });
  const down = cameraView('first', { ...pose, pitch: look.pitch }, 1);
  assert.ok(down.focus[1] < 1.52);
  const right = cameraView('first', { ...pose, yaw: pose.yaw + look.yaw, pitch: 0 }, 1);
  assert.ok(right.focus[0] > pose.x);
});
test('third person stays behind the avatar', () => {
  const view = cameraView('third', pose, 1);
  assert.ok(view.position[0] < pose.x);
  assert.ok(view.position[1] > 1.52);
});
test('isometric looks diagonally down toward the avatar', () => {
  const view = cameraView('isometric', pose, 1);
  assert.deepEqual(view.position, [9, 9.5, 10]);
  assert.deepEqual(view.focus, [2, 0.65, 3]);
});

test('the opening view is placed in front of a wall and does not shake back', () => {
  const desired = cameraView('third', LOBBY_SPAWN, 1.25);
  const origin: [number, number, number] = [LOBBY_SPAWN.x, 1.45, LOBBY_SPAWN.z];
  const wallDistance = 3.7;
  const opened = followCamera({
    mode: 'third',
    origin,
    currentPosition: [7, 9.5, 9.6],
    currentFocus: [0, 0.7, 0],
    desiredPosition: desired.position,
    desiredFocus: desired.focus,
    dt: 0.8,
    wallDistance,
    placed: false,
  });
  const cleared = clearCamera(origin, desired.position, wallDistance);
  assert.deepEqual(opened.position, cleared);
  assert.ok(gap(opened.position, desired.position) > 0.5);
  assert.ok(gap(opened.position, [7, 9.5, 9.6]) > 5);
  const held = followCamera({
    mode: 'third',
    origin,
    currentPosition: opened.position,
    currentFocus: opened.focus,
    desiredPosition: desired.position,
    desiredFocus: desired.focus,
    dt: 1 / 60,
    wallDistance,
    placed: opened.placed,
  });
  assert.deepEqual(held.position, opened.position);
  assert.deepEqual(held.focus, opened.focus);
});

test('a placed camera eases a short step and a stalled frame does not fling it', () => {
  const start = cameraView('third', pose, 1);
  const next = cameraView('third', { ...pose, x: pose.x + 0.04 }, 1);
  const origin: [number, number, number] = [pose.x + 0.04, 1.45, pose.z];
  const step = {
    mode: 'third' as const,
    origin,
    currentPosition: start.position,
    currentFocus: start.focus,
    desiredPosition: next.position,
    desiredFocus: next.focus,
    wallDistance: null,
    placed: true,
  };
  const eased = followCamera({ ...step, dt: 1 / 60 });
  const stalled = followCamera({ ...step, dt: 1 });
  const capped = followCamera({ ...step, dt: 1 / 30 });
  const full = gap(start.position, next.position);
  const moved = gap(start.position, eased.position);
  assert.ok(moved > 0.0001);
  assert.ok(moved < full * 0.5);
  assert.ok(gap(stalled.position, capped.position) < 1e-9);
  assert.ok(gap(start.position, stalled.position) < full);
});
