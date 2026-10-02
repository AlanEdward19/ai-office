import assert from 'node:assert/strict';
import test from 'node:test';
import { cameraView, firstPersonLook } from './camera';
const pose = { x: 2, z: 3, yaw: Math.PI / 2, pitch: 0 };
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
