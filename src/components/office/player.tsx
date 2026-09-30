"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { Plane, Raycaster, Vector2, Vector3, type Group } from "three";

import type { FloorId } from "@/domain/floors";
import {
  LOBBY_SPAWN,
  arrivalPose,
  integrateWalk,
  nearestTarget,
  walkBounds,
  type InteractTarget,
  type Pose,
} from "@/domain/walker";

const raycaster = new Raycaster();
const pointer = new Vector2();
const floorPlane = new Plane(new Vector3(0, 1, 0), 0);
const hitPoint = new Vector3();

function typingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

export function OfficePlayer({
  floor,
  targets,
  enabled,
  onNearby,
  onPose,
}: {
  floor: FloorId;
  targets: readonly InteractTarget[];
  enabled: boolean;
  onNearby: (target: InteractTarget | null) => void;
  onPose: (pose: Pose) => void;
}) {
  const camera = useThree((state) => state.camera);
  const gl = useThree((state) => state.gl);
  const body = useRef<Group>(null);
  const pose = useRef<Pose>(LOBBY_SPAWN);
  const target = useRef<{ x: number; z: number } | null>(null);
  const keys = useRef(new Set<string>());
  const look = useRef({ yaw: 0, pitch: 0 });
  const targetsRef = useRef(targets);
  const enabledRef = useRef(enabled);
  const floorRef = useRef(floor);
  const nearKey = useRef("");
  const poseStamp = useRef(0);

  useEffect(() => {
    targetsRef.current = targets;
  }, [targets]);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    if (floorRef.current === floor) return;
    floorRef.current = floor;
    pose.current = arrivalPose();
    target.current = null;
  }, [floor]);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (typingTarget(event.target)) return;
      if (event.key.startsWith("Arrow")) event.preventDefault();
      keys.current.add(event.code);
    };
    const up = (event: KeyboardEvent) => {
      keys.current.delete(event.code);
    };
    const blur = () => keys.current.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);

  useEffect(() => {
    const element = gl.domElement;
    let pointerId: number | null = null;
    let lastX = 0;
    let lastY = 0;
    let moved = 0;

    const onDown = (event: PointerEvent) => {
      if (event.button !== 0 || !enabledRef.current) return;
      pointerId = event.pointerId;
      lastX = event.clientX;
      lastY = event.clientY;
      moved = 0;
    };
    const onMove = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
      moved += Math.abs(dx) + Math.abs(dy);
      if (moved < 5) return;
      look.current.yaw += dx * 0.0045;
      look.current.pitch += dy * 0.003;
    };
    const onUp = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      pointerId = null;
      if (!enabledRef.current || moved > 8) return;
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      camera.updateMatrixWorld();
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.ray.intersectPlane(floorPlane, hitPoint);
      if (!hit) return;
      const bounds = walkBounds(floorRef.current);
      target.current = {
        x: Math.min(bounds.maxX, Math.max(bounds.minX, hit.x)),
        z: Math.min(bounds.maxZ, Math.max(bounds.minZ, hit.z)),
      };
    };

    element.addEventListener("pointerdown", onDown);
    element.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      element.removeEventListener("pointerdown", onDown);
      element.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [camera, gl]);

  useFrame((_, dt) => {
    const held = keys.current;
    const moving = enabledRef.current;
    const walk = integrateWalk(
      pose.current,
      {
        forward: moving && (held.has("KeyW") || held.has("ArrowUp")) ? 1 : moving && (held.has("KeyS") || held.has("ArrowDown")) ? -1 : 0,
        strafe: moving && held.has("KeyD") ? 1 : moving && held.has("KeyA") ? -1 : 0,
        turn: moving && held.has("ArrowRight") ? 1 : moving && held.has("ArrowLeft") ? -1 : 0,
        yawDelta: moving ? look.current.yaw : 0,
        pitchDelta: moving ? look.current.pitch : 0,
      },
      moving ? target.current : null,
      dt,
      walkBounds(floorRef.current),
    );
    look.current.yaw = 0;
    look.current.pitch = 0;
    pose.current = walk.pose;
    target.current = walk.target;

    const yaw = walk.pose.yaw;
    const pitch = walk.pose.pitch;
    const distance = 2.55;
    const shoulder = 0.38;
    camera.position.set(
      walk.pose.x - Math.sin(yaw) * distance + Math.cos(yaw) * shoulder,
      1.72 + pitch * 0.2,
      walk.pose.z + Math.cos(yaw) * distance + Math.sin(yaw) * shoulder,
    );
    camera.lookAt(
      walk.pose.x + Math.sin(yaw) * 4,
      1.22 - pitch * 1.35,
      walk.pose.z - Math.cos(yaw) * 4,
    );

    if (body.current) {
      body.current.position.set(walk.pose.x, 0, walk.pose.z);
      body.current.rotation.y = yaw;
    }

    const near = nearestTarget(walk.pose.x, walk.pose.z, targetsRef.current);
    const key = near ? `${near.kind}:${near.id}` : "";
    if (key !== nearKey.current) {
      nearKey.current = key;
      onNearby(near);
    }
    poseStamp.current += dt;
    if (poseStamp.current > 0.08) {
      poseStamp.current = 0;
      onPose(walk.pose);
    }
  });

  return (
    <group ref={body} name="player" position={[LOBBY_SPAWN.x, 0, LOBBY_SPAWN.z]}>
      <mesh position={[0, 0.92, 0]} castShadow name="player-body">
        <capsuleGeometry args={[0.22, 0.62, 6, 12]} />
        <meshStandardMaterial color="#9c4221" roughness={0.55} />
      </mesh>
      <mesh position={[0, 1.52, 0]} castShadow>
        <sphereGeometry args={[0.18, 20, 20]} />
        <meshStandardMaterial color="#f3d5bf" roughness={0.6} />
      </mesh>
    </group>
  );
}
