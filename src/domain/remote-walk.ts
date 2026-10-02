/** How a person on another page is shown between presence samples. */

export const REMOTE_WALK_MIN_METERS = 0.05;

export function remoteWalkDuration(elapsedMs: number): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 180;
  return Math.min(800, Math.max(80, elapsedMs));
}

export function remoteWalkProgress(startedSec: number, durationSec: number, nowSec: number): number {
  if (!(durationSec > 0) || !Number.isFinite(startedSec) || !Number.isFinite(nowSec)) return 1;
  return Math.min(1, Math.max(0, (nowSec - startedSec) / durationSec));
}

/** Shortest signed turn from `from` to `to`, in radians. */
export function yawDelta(from: number, to: number): number {
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
  const turns = (to - from) / (Math.PI * 2);
  return (turns - Math.round(turns)) * Math.PI * 2;
}

export function remotePoseAt(input: {
  from: { x: number; z: number; yaw: number };
  to: { x: number; z: number; yaw: number };
  progress: number;
}): { x: number; z: number; yaw: number } {
  const t = Number.isFinite(input.progress) ? Math.min(1, Math.max(0, input.progress)) : 1;
  return {
    x: input.from.x + (input.to.x - input.from.x) * t,
    z: input.from.z + (input.to.z - input.from.z) * t,
    yaw: input.from.yaw + yawDelta(input.from.yaw, input.to.yaw) * t,
  };
}

/** Walking is real displacement still in progress. A seated person, and a finished step, stand. */
export function remoteIsWalking(input: {
  from: { x: number; z: number };
  to: { x: number; z: number };
  seated: boolean;
  progress: number;
}): boolean {
  if (input.seated || input.progress >= 1) return false;
  return Math.hypot(input.to.x - input.from.x, input.to.z - input.from.z) >= REMOTE_WALK_MIN_METERS;
}
