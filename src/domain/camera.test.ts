import assert from 'node:assert/strict';
import test from 'node:test';
import { cameraView } from './camera';
const pose = { x: 2, z: 3, yaw: Math.PI / 2, pitch: 0 };
test('first person uses eye height and looks in the walking direction', () => {
  const view = cameraView('first', pose, 1);
  assert.deepEqual(view.position, [2, 1.52, 3]);
  assert.ok(view.focus[0] > pose.x);
  assert.equal(view.focus[1], 1.52);
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
