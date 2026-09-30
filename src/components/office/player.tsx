"use client";

import { cameraView, type CameraMode } from "@/domain/camera";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, type RefObject } from "react";
import { Plane, Raycaster, Vector2, Vector3, type Group, type Mesh } from "three";

import { type Appearance, type AvatarMotion, type Gesture } from "@/domain/character";
import type { FloorId } from "@/domain/floors";
import {
  LOBBY_SPAWN,
  arrivalPose,
  avatarRotation,
  integrateWalk,
  nearestTarget,
  walkBounds,
  type InteractTarget,
  type Pose,
  type Obstacle,
} from "@/domain/walker";

import { Avatar } from "./avatar";

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
  appearance,
  cameraMode,
  zoom,
  gesture,
  obstacles,
  cameraWalls,
  floor,
  targets,
  enabled,
  onNearby,
  onPose,
}: {
  appearance: Appearance;
  cameraMode: CameraMode;
  zoom: number;
  gesture: { kind: Gesture; stamp: number } | null;
  obstacles: RefObject<Obstacle[]>;
  cameraWalls: RefObject<Mesh[]>;
  floor: FloorId;
  targets: readonly InteractTarget[];
  enabled: boolean;
  onNearby: (target: InteractTarget | null) => void;
  onPose: (pose: Pose) => void;
}) {
  const cameraRay = useRef(new Raycaster());
  const cameraOrigin = useRef(new Vector3());
  const cameraDirection = useRef(new Vector3());
  const camera = useThree((state) => state.camera);
  const gl = useThree((state) => state.gl);
  const body = useRef<Group>(null);
  const motion = useRef<AvatarMotion>({ moving: false, gesture: null, gestureStarted: 0 });
  const gestureStamp = useRef(-1);
  const cameraPosition = useRef(new Vector3());
  const cameraFocus = useRef(new Vector3(0, 0.7, 0));
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

  useFrame(({ clock }, dt) => {
    const held = keys.current;
    const moving = enabledRef.current;
    const keyboardForward = moving && (held.has("KeyW") || held.has("ArrowUp")) ? 1 : moving && (held.has("KeyS") || held.has("ArrowDown")) ? -1 : 0;
    const keyboardStrafe = moving && (held.has("KeyD") || (cameraMode === "isometric" && held.has("ArrowRight"))) ? 1 : moving && (held.has("KeyA") || (cameraMode === "isometric" && held.has("ArrowLeft"))) ? -1 : 0;
    const walk = integrateWalk(
      pose.current,
      {
        forward: keyboardForward,
        strafe: keyboardStrafe,
        turn: cameraMode === "isometric" ? 0 : moving && held.has("ArrowRight") ? 1 : moving && held.has("ArrowLeft") ? -1 : 0,
        yawDelta: cameraMode === "isometric" && (keyboardForward || keyboardStrafe) ? -Math.PI / 4 - pose.current.yaw : moving && cameraMode !== "isometric" ? look.current.yaw : 0,
        pitchDelta: moving ? look.current.pitch : 0,
      },
      moving ? target.current : null,
      dt,
      walkBounds(floorRef.current),
      obstacles.current,
    );
    look.current.yaw = 0;
    look.current.pitch = 0;
    const displaced = Math.hypot(walk.pose.x - pose.current.x, walk.pose.z - pose.current.z) > 0.0001;
    motion.current.moving = displaced;
    if (gesture && gesture.stamp !== gestureStamp.current) {
      gestureStamp.current = gesture.stamp;
      motion.current.gesture = gesture.kind;
      motion.current.gestureStarted = clock.elapsedTime;
    }
    if (displaced) motion.current.gesture = null;
    if (cameraMode === "isometric" && displaced) walk.pose.yaw = Math.atan2(walk.pose.x - pose.current.x, -(walk.pose.z - pose.current.z));
    pose.current = walk.pose;
    target.current = walk.target;

    const yaw = walk.pose.yaw;
    const view = cameraView(cameraMode, walk.pose, zoom);
    cameraPosition.current.set(view.position[0], view.position[1], view.position[2]);
    const focus = new Vector3(view.focus[0], view.focus[1], view.focus[2]);
    if (cameraMode === "first") {
      // Eye position must follow the body exactly so movement and looking stay aligned.
      camera.position.copy(cameraPosition.current);
      cameraFocus.current.copy(focus);
    } else {
      cameraFocus.current.lerp(focus, 1 - Math.exp(-8 * dt));
    }
    camera.position.lerp(cameraPosition.current, 1 - Math.exp(-7 * Math.min(dt, 0.1)));
    if (cameraMode === "third") {
      cameraOrigin.current.set(walk.pose.x, 1.45, walk.pose.z);
      cameraDirection.current.copy(camera.position).sub(cameraOrigin.current);
      const distance = cameraDirection.current.length();
      cameraDirection.current.normalize();
      cameraRay.current.set(cameraOrigin.current, cameraDirection.current);
      cameraRay.current.far = distance;
      const obstruction = cameraRay.current.intersectObjects(cameraWalls.current, false)[0];
      if (obstruction) camera.position.copy(cameraOrigin.current).addScaledVector(cameraDirection.current, Math.max(0.15, obstruction.distance - 0.2));
    }
    camera.lookAt(cameraFocus.current);

    if (body.current) {
      body.current.position.set(walk.pose.x, 0, walk.pose.z);
      body.current.rotation.y = avatarRotation(yaw);
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
      <group visible={cameraMode !== "first"}><Avatar appearance={appearance} motion={motion} /></group>
      <mesh visible={cameraMode !== "first"} position={[0, 0.075, 0]} rotation={[-Math.PI / 2, 0, 0]} userData={{ noCollision: true }}>
        <ringGeometry args={[0.37, 0.41, 48]} /><meshBasicMaterial color="#78d9ba" transparent opacity={0.65} />
      </mesh>
    </group>
  );
}
