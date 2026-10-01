import { ELEVATOR, type FloorId } from "./floors";
import { RECEPTION } from "./rooms";

export type Pose = {
  seated?:boolean;
  x: number;
  z: number;
  yaw: number;
  pitch: number;
};

export type Obstacle = { minX: number; maxX: number; minZ: number; maxZ: number;seatId?:string };
export const PLAYER_RADIUS = 0.24;

export type WalkBounds = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

/** Lobby, facing into the floor. yaw 0 looks toward -Z. */
export const LOBBY_SPAWN: Pose = { x: 0, z: 2.6, yaw: 0, pitch: -0.08 };

export const WALK_SPEED = 4.2;
export const TURN_SPEED = 2.2;

/** Our yaw turns toward +X; Three.js rotates the avatar's -Z front toward -X. */
export function avatarRotation(yaw: number): number {
  return -yaw;
}
export const INTERACT_REACH = 1.9;

export type InteractKind = "desk" | "room" | "elevator" | "hire" | "reception";

export type InteractTarget = {
  kind: InteractKind;
  id: string;
  x: number;
  z: number;
};

export function walkBounds(floor: FloorId): WalkBounds {
  if (floor === "hr") return { minX: -8.2, maxX: 8.6, minZ: -5.4, maxZ: 5.5 };
  return { minX: -8.6, maxX: 15.4, minZ: -23.5, maxZ: 7.2 };
}

/** Step out of the elevator onto the floor you just entered. */
export function arrivalPose(): Pose {
  return { x: ELEVATOR.x - 2.1, z: ELEVATOR.z - 0.15, yaw: -Math.PI / 2, pitch: -0.06 };
}

export function interactTargets(input: {
  floor: FloorId;
  rooms: readonly { id: string; x: number; z: number }[];
  agents: readonly { id: string; x: number; z: number }[];
}): InteractTarget[] {
  const targets: InteractTarget[] = [
    { kind: "elevator", id: "elevator", x: ELEVATOR.x - 1.15, z: ELEVATOR.z },
  ];
  if (input.floor === "hr") {
    targets.push({ kind: "hire", id: "hire", x: -1.4, z: 0.35 });
    return targets;
  }
  targets.push({ kind: "reception", id: "reception", x: RECEPTION.x, z: RECEPTION.z - 1.2 });
  for (const room of input.rooms) {
    targets.push({ kind: "room", id: room.id, x: room.x, z: room.z + 2.6 });
  }
  for (const agent of input.agents) {
    targets.push({ kind: "desk", id: agent.id, x: agent.x, z: agent.z + 1.05 });
  }
  return targets;
}

export function nearestTarget(
  x: number,
  z: number,
  targets: readonly InteractTarget[],
  reach = INTERACT_REACH,
): InteractTarget | null {
  let best: InteractTarget | null = null;
  let bestDist = reach;
  for (const target of targets) {
    const dist = Math.hypot(target.x - x, target.z - z);
    if (dist <= bestDist) {
      best = target;
      bestDist = dist;
    }
  }
  return best;
}

export type WalkKeys = {
  forward: number;
  strafe: number;
  turn: number;
  yawDelta: number;
  pitchDelta: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Keyboard walks in the direction you face. A floor target is used only while
 * no movement key is held. yaw 0 faces -Z.
 */
export function integrateWalk(
  pose: Pose,
  keys: WalkKeys,
  target: { x: number; z: number } | null,
  dt: number,
  bounds: WalkBounds,
  obstacles: readonly Obstacle[] = [],
): { pose: Pose; target: { x: number; z: number } | null } {
  let remaining = clamp(dt, 0, 1);
  let { x, z } = pose;
  let yaw = pose.yaw + keys.yawDelta;
  const pitch = clamp(pose.pitch + keys.pitchDelta, -0.55, 0.4);
  const keyboard = keys.forward !== 0 || keys.strafe !== 0;
  let nextTarget = keyboard ? null : target;

  if (remaining === 0) {
    yaw += keys.turn * 0;
    return {
      pose: {
        x: clamp(x, bounds.minX, bounds.maxX),
        z: clamp(z, bounds.minZ, bounds.maxZ),
        yaw,
        pitch,
      },
      target: nextTarget,
    };
  }

  while (remaining > 0) {
    const step = Math.min(remaining, 0.02);
    const previousX = x;
    const previousZ = z;
    remaining -= step;
    yaw += keys.turn * TURN_SPEED * step;
    if (keyboard) {
      const fx = Math.sin(yaw);
      const fz = -Math.cos(yaw);
      const rx = Math.cos(yaw);
      const rz = Math.sin(yaw);
      x += (fx * keys.forward + rx * keys.strafe) * WALK_SPEED * step;
      z += (fz * keys.forward + rz * keys.strafe) * WALK_SPEED * step;
    } else if (nextTarget) {
      const dx = nextTarget.x - x;
      const dz = nextTarget.z - z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.18) {
        nextTarget = null;
      } else {
        yaw = Math.atan2(dx, -dz);
        const move = Math.min(WALK_SPEED * step, dist);
        x += (dx / dist) * move;
        z += (dz / dist) * move;
      }
    }
    const blocked = (px: number, pz: number) => obstacles.some((solid) =>
      px > solid.minX - PLAYER_RADIUS && px < solid.maxX + PLAYER_RADIUS &&
      pz > solid.minZ - PLAYER_RADIUS && pz < solid.maxZ + PLAYER_RADIUS,
    );
    x = clamp(x, bounds.minX, bounds.maxX);
    z = clamp(z, bounds.minZ, bounds.maxZ);
    if (blocked(x, previousZ)) x = previousX;
    if (blocked(x, z)) z = previousZ;
    if (nextTarget && Math.hypot(x - previousX, z - previousZ) < 0.00001) nextTarget = null;
  }

  return {
    pose: {
      x: clamp(x, bounds.minX, bounds.maxX),
      z: clamp(z, bounds.minZ, bounds.maxZ),
      yaw,
      pitch,
    },
    target: nextTarget,
  };
}

/** Entry barriers never trap someone already overlapping the boundary on their way out. */
export function entryBarriers(pose: Pick<Pose, 'x' | 'z'>, areas: readonly Obstacle[]): Obstacle[] {
  return areas.filter(a => !(pose.x > a.minX - PLAYER_RADIUS && pose.x < a.maxX + PLAYER_RADIUS && pose.z > a.minZ - PLAYER_RADIUS && pose.z < a.maxZ + PLAYER_RADIUS));
}
