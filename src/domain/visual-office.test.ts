import test from 'node:test';
import assert from 'node:assert/strict';
import { gait } from './character';
import { integrateWalk, PLAYER_RADIUS } from './walker';
const bounds = { minX: -10, maxX: 10, minZ: -10, maxZ: 10 };
const obstacle = { minX: -1, maxX: 1, minZ: -1, maxZ: 1 };
const pose = { x: 0, z: 2, yaw: 0, pitch: 0 };
const keys = { forward: 1, strafe: 0, turn: 0, yawDelta: 0, pitchDelta: 0 };

test('solid obstacles stop walking without tunneling', () => {
  const result = integrateWalk(pose, keys, null, 1, bounds, [obstacle]);
  assert.ok(result.pose.z >= obstacle.maxZ + PLAYER_RADIUS);
  assert.ok(result.pose.z < 2);
});
test('walking slides along a solid edge', () => {
  const result = integrateWalk({ ...pose, z: 1.25 }, { ...keys, strafe: 1 }, null, 0.2, bounds, [obstacle]);
  assert.ok(result.pose.x > 0.7);
  assert.ok(result.pose.z >= 1.24);
});
test('blocked click target is cancelled', () => {
  const result = integrateWalk(pose, { ...keys, forward: 0 }, { x: 0, z: 0 }, 1, bounds, [obstacle]);
  assert.equal(result.target, null);
  assert.ok(result.pose.z >= 1.24);
});
test('gait stops limbs at rest and alternates them while moving', () => {
  const idle = gait(0.5, false);
  assert.equal(idle.left, 0);
  assert.ok(Math.abs(idle.bob) <= 0.008);
  const walking = gait(0.1, true);
  assert.ok(walking.left > 0);
  assert.equal(walking.right, -walking.left);
});

test('social gestures expire after three seconds', async () => {
  const { activeGesture } = await import('./character');
  for (const gesture of ['wave', 'dance'] as const) {
    assert.equal(activeGesture(gesture, 0), gesture);
    assert.equal(activeGesture(gesture, 2.99), gesture);
    assert.equal(activeGesture(gesture, 3), null);
  }
});

test('a wave or a dance keeps the hand outside the face', async () => {
  const { gestureArmPose, gestureBodyPose } = await import('./character');
  const rotateX = (y: number, z: number, angle: number) => ({
    y: y * Math.cos(angle) - z * Math.sin(angle),
    z: y * Math.sin(angle) + z * Math.cos(angle),
  });
  const rotateZ = (x: number, y: number, angle: number) => ({
    x: x * Math.cos(angle) - y * Math.sin(angle),
    y: x * Math.sin(angle) + y * Math.cos(angle),
  });
  // Matches the avatar: shoulders at x=±0.3 y=1.2, hand center y=-0.34, fingertips y=-0.44, head at y=1.48.
  const outsideFace = (gesture: 'wave' | 'dance', time: number) => {
    const headZ = gestureBodyPose(gesture, time).headZ;
    for (const side of [0, 1] as const) {
      const pose = gestureArmPose(gesture, time, side);
      for (const along of [-0.34, -0.44]) {
        const pitched = rotateX(along, 0, pose.x);
        const turned = rotateZ(0, pitched.y, pose.z);
        const dx = (side === 0 ? -0.3 : 0.3) + turned.x;
        const dy = 1.2 + turned.y - 1.48;
        const dz = pitched.z;
        const upright = rotateZ(dx, dy, -headZ);
        const clear = (upright.x / 0.34) ** 2 + (upright.y / 0.36) ** 2 + (dz / 0.36) ** 2;
        assert.ok(clear > 1, `${gesture} hand enters the face at ${time}`);
      }
    }
  };
  for (let step = 0; step <= 36; step += 1) {
    const time = (step / 36) * 3;
    outsideFace('wave', time);
    outsideFace('dance', time);
  }
  const raised = gestureArmPose('wave', 0, 1);
  assert.ok(raised.z > 1.8);
  assert.ok(gestureArmPose('dance', 0, 0).z < -1.8);
  assert.ok(gestureArmPose('dance', 0, 1).z > 1.8);
});
test('animation blend is bounded and frame-rate independent', async () => {
  const { blendMotion } = await import('./character');
  const one = blendMotion(0, true, 0.1);
  const two = blendMotion(blendMotion(0, true, 0.05), true, 0.05);
  assert.ok(one > 0 && one < 1);
  assert.ok(Math.abs(one - two) < 1e-10);
  assert.ok(blendMotion(one, false, 0.1) < one);
});
