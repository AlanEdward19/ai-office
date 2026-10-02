import type { Pose } from './walker';
export type CameraMode = 'first' | 'third' | 'isometric';

const FIRST_LOOK_YAW = 0.0022;
const FIRST_LOOK_PITCH = 0.0016;

/** Mouse movement in first person. Positive x looks right. Positive y looks down. */
export function firstPersonLook(dx: number, dy: number): { yaw: number; pitch: number } {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return { yaw: 0, pitch: 0 };
  return { yaw: dx * FIRST_LOOK_YAW, pitch: dy * FIRST_LOOK_PITCH };
}
type Vec3 = [number, number, number];

export function cameraView(mode: CameraMode, pose: Pose, zoom: number): { position: Vec3; focus: Vec3 } {
  const { x, z, yaw, pitch } = pose;
  if (mode === 'isometric') return { position: [x + 7 * zoom, 9.5 * zoom, z + 7 * zoom], focus: [x, 0.65, z] };
  if (mode === 'first') return {
    position: [x, 1.52, z],
    focus: [x + Math.sin(yaw) * 4, 1.52 - pitch * 4, z - Math.cos(yaw) * 4],
  };
  const distance = 3.8 * zoom;
  return {
    position: [x - Math.sin(yaw) * distance, 2.7 + pitch * 0.2, z + Math.cos(yaw) * distance],
    focus: [x + Math.sin(yaw) * 2, 1.1 - pitch, z - Math.cos(yaw) * 2],
  };
}

const CAMERA_FOLLOW = 7;
const CAMERA_FOCUS_FOLLOW = 8;
/** A stalled opening frame must not sling the view. */
const CAMERA_FRAME = 1 / 30;
const CAMERA_REST = 0.0015;

function moveToward(current: Vec3, target: Vec3, lambda: number, dt: number): Vec3 {
  const alpha = 1 - Math.exp(-lambda * dt);
  return [
    current[0] + (target[0] - current[0]) * alpha,
    current[1] + (target[1] - current[1]) * alpha,
    current[2] + (target[2] - current[2]) * alpha,
  ];
}

function apart(a: Vec3, b: Vec3) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/** Pull the desired camera forward along the eye ray when a wall blocks it. */
export function clearCamera(origin: Vec3, desired: Vec3, wallDistance: number | null): Vec3 {
  const offset: Vec3 = [desired[0] - origin[0], desired[1] - origin[1], desired[2] - origin[2]];
  const length = Math.hypot(offset[0], offset[1], offset[2]);
  if (wallDistance === null || !Number.isFinite(wallDistance) || length < 1e-6) return desired;
  const allowed = Math.max(0.15, wallDistance - 0.2);
  if (allowed >= length - 0.01) return desired;
  const scale = allowed / length;
  return [origin[0] + offset[0] * scale, origin[1] + offset[1] * scale, origin[2] + offset[2] * scale];
}

/**
 * Place the view on the first frame, then ease toward the wall-cleared pose.
 * Easing toward the blocked pose and snapping back is what shakes the picture.
 */
export function followCamera(input: {
  mode: CameraMode;
  origin: Vec3;
  currentPosition: Vec3;
  currentFocus: Vec3;
  desiredPosition: Vec3;
  desiredFocus: Vec3;
  dt: number;
  wallDistance: number | null;
  placed: boolean;
}): { position: Vec3; focus: Vec3; placed: true } {
  const position = clearCamera(input.origin, input.desiredPosition, input.wallDistance);
  const focus = input.desiredFocus;
  if (input.mode === 'first' || !input.placed) return { position, focus, placed: true };
  const dt = Math.min(CAMERA_FRAME, Math.max(0, Number.isFinite(input.dt) ? input.dt : 0));
  const nextPosition = moveToward(input.currentPosition, position, CAMERA_FOLLOW, dt);
  const nextFocus = moveToward(input.currentFocus, focus, CAMERA_FOCUS_FOLLOW, dt);
  if (apart(nextPosition, position) < CAMERA_REST && apart(nextFocus, focus) < CAMERA_REST) {
    return { position, focus, placed: true };
  }
  return { position: nextPosition, focus: nextFocus, placed: true };
}
