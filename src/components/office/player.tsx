"use client";

import {sitAt,seatedPose,type Sitting,type Seat} from "@/domain/seating";
import { cameraView, followCamera, firstPersonLook, type CameraMode } from "@/domain/camera";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, type RefObject } from "react";
import { Plane, Raycaster, Vector2, Vector3, type Group, Mesh } from "three";

import { type Appearance, type AvatarMotion, type Gesture } from "@/domain/character";
import type { FloorId } from "@/domain/floors";
import {
  LOBBY_SPAWN,
  arrivalPose,
  avatarRotation,
  integrateWalk,
  entryBarriers,
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
  restrictedAreas,
  correction,
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
  restrictedAreas: readonly Obstacle[];
  correction:{pose:Pose;stamp:number}|null;
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
  const scene = useThree((state) => state.scene);
  const gl = useThree((state) => state.gl);
  const body = useRef<Group>(null);
  const motion = useRef<AvatarMotion>({ moving: false, gesture: null, gestureStarted: 0 });
  const gestureStamp = useRef(-1);
  const cameraPosition = useRef(new Vector3());
  const cameraFocus = useRef(new Vector3(0, 0.7, 0));
  const desiredFocus = useRef(new Vector3());
  const cameraPlaced = useRef(false);
  const pose = useRef<Pose>(LOBBY_SPAWN);
  const sitting=useRef<Sitting|null>(null);
  const target = useRef<{ x: number; z: number } | null>(null);
  const keys = useRef(new Set<string>());
  const look = useRef({ yaw: 0, pitch: 0 });
  const cameraModeRef = useRef(cameraMode);
  const targetsRef = useRef(targets);
  const enabledRef = useRef(enabled);
  const floorRef = useRef(floor);
  const nearKey = useRef("");
  const poseStamp = useRef(0);

  useEffect(()=>{const sit=(event:Event)=>{if(!enabledRef.current)return;const seat=(event as CustomEvent<Seat>).detail;if(!seat||![seat.x,seat.z,seat.yaw].every(Number.isFinite))return;sitting.current=sitting.current?null:sitAt(pose.current,seat,[...obstacles.current,...entryBarriers(pose.current,restrictedAreas)]);target.current=null;};window.addEventListener("office:seat",sit);return()=>window.removeEventListener("office:seat",sit);},[obstacles,restrictedAreas]);
  useEffect(() => {
    if (correction) { sitting.current=null;pose.current = correction.pose; target.current = null; }
  }, [correction]);

  useEffect(() => {
    targetsRef.current = targets;
  }, [targets]);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    cameraModeRef.current = cameraMode;
    cameraPlaced.current = false;
    if (cameraMode !== "first" && typeof document !== "undefined" && document.pointerLockElement === gl.domElement) document.exitPointerLock();
  }, [cameraMode, gl]);

  useEffect(() => {
    if (floorRef.current === floor) return;
    sitting.current=null;
    floorRef.current = floor;
    pose.current = arrivalPose();
    target.current = null;
    cameraPlaced.current = false;
  }, [floor]);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (typingTarget(event.target)) return;
      if(event.code==="Space"&&sitting.current)event.preventDefault();
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
    let freeX = 0;
    let freeY = 0;
    let free = false;

    const addLook = (dx: number, dy: number, first: boolean) => {
      if (first) {
        const delta = firstPersonLook(dx, dy);
        look.current.yaw += delta.yaw;
        look.current.pitch += delta.pitch;
        return;
      }
      look.current.yaw += dx * 0.0045;
      look.current.pitch += dy * 0.003;
    };
    const onDown = (event: PointerEvent) => {
      if (event.button !== 0 || !enabledRef.current) return;
      pointerId = event.pointerId;
      lastX = event.clientX;
      lastY = event.clientY;
      moved = 0;
    };
    const onMove = (event: PointerEvent) => {
      const first = cameraModeRef.current === "first";
      const locked = document.pointerLockElement === element;
      if (first && locked) {
        addLook(event.movementX, event.movementY, true);
        return;
      }
      if (event.pointerId === pointerId) {
        const dx = event.clientX - lastX;
        const dy = event.clientY - lastY;
        lastX = event.clientX;
        lastY = event.clientY;
        moved += Math.abs(dx) + Math.abs(dy);
        if (moved < 5) return;
        addLook(dx, dy, first);
        return;
      }
      if (!first || event.pointerType !== "mouse" || event.target !== element) {
        free = false;
        return;
      }
      if (free) addLook(event.clientX - freeX, event.clientY - freeY, true);
      freeX = event.clientX;
      freeY = event.clientY;
      free = true;
    };
    const onUp = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      const dragged = moved > 8;
      const locked = document.pointerLockElement === element;
      pointerId = null;
      if (cameraModeRef.current === "first" && dragged && !locked) {
        const pending = element.requestPointerLock?.();
        if (pending && typeof pending.catch === "function") void pending.catch(() => undefined);
      }
      if (!enabledRef.current || dragged || locked) return;
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      camera.updateMatrixWorld();
      raycaster.setFromCamera(pointer, camera);
      const intersections = raycaster.intersectObjects(scene.children, true);
      for (const hit of intersections) {
        for (let object = hit.object; object; object = object.parent!) {
          if (object.userData.personId||object.userData.seat) return;
        }
        if (hit.object instanceof Mesh && hit.object.userData.cameraWall) break;
      }
      const hit = raycaster.ray.intersectPlane(floorPlane, hitPoint);
      if (!hit) return;
      const bounds = walkBounds(floorRef.current);
      target.current = {
        x: Math.min(bounds.maxX, Math.max(bounds.minX, hit.x)),
        z: Math.min(bounds.maxZ, Math.max(bounds.minZ, hit.z)),
      };
    };

    const onLeave = () => {
      free = false;
    };
    element.addEventListener("pointerdown", onDown);
    element.addEventListener("pointermove", onMove);
    element.addEventListener("pointerleave", onLeave);
    window.addEventListener("pointerup", onUp);
    return () => {
      element.removeEventListener("pointerdown", onDown);
      element.removeEventListener("pointermove", onMove);
      element.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("pointerup", onUp);
      if (typeof document !== "undefined" && document.pointerLockElement === element) document.exitPointerLock();
    };
  }, [camera, gl, scene]);

  useFrame(({ clock }, dt) => {
    const held = keys.current;
    const moving = enabledRef.current;
    const keyboardForward = moving && (held.has("KeyW") || held.has("ArrowUp")) ? 1 : moving && (held.has("KeyS") || held.has("ArrowDown")) ? -1 : 0;
    const keyboardStrafe = moving && (held.has("KeyD") || (cameraMode === "isometric" && held.has("ArrowRight"))) ? 1 : moving && (held.has("KeyA") || (cameraMode === "isometric" && held.has("ArrowLeft"))) ? -1 : 0;
    if(keyboardForward||keyboardStrafe||held.has("Space")||target.current)sitting.current=null;
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
      [...obstacles.current, ...entryBarriers(pose.current, restrictedAreas)],
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

    const visiblePose=sitting.current?seatedPose(sitting.current):{...walk.pose,seated:false};motion.current.seated=Boolean(sitting.current);
    const yaw = visiblePose.yaw;
    const view = cameraView(cameraMode, visiblePose, zoom);
    cameraPosition.current.set(view.position[0], view.position[1]-(sitting.current ? .36 : 0), view.position[2]);
    desiredFocus.current.set(view.focus[0], view.focus[1], view.focus[2]);
    cameraOrigin.current.set(visiblePose.x, 1.45, visiblePose.z);
    let wallDistance: number | null = null;
    if (cameraMode === "third") {
      for (const wall of cameraWalls.current) wall.updateWorldMatrix(true, false);
      cameraDirection.current.copy(cameraPosition.current).sub(cameraOrigin.current);
      const span = cameraDirection.current.length();
      if (span > 1e-4) {
        cameraDirection.current.multiplyScalar(1 / span);
        cameraRay.current.set(cameraOrigin.current, cameraDirection.current);
        cameraRay.current.far = span;
        const hit = cameraRay.current.intersectObjects(cameraWalls.current, false)[0];
        if (hit) wallDistance = hit.distance;
      }
    }
    const followed = followCamera({
      mode: cameraMode,
      origin: [cameraOrigin.current.x, cameraOrigin.current.y, cameraOrigin.current.z],
      currentPosition: [camera.position.x, camera.position.y, camera.position.z],
      currentFocus: [cameraFocus.current.x, cameraFocus.current.y, cameraFocus.current.z],
      desiredPosition: [cameraPosition.current.x, cameraPosition.current.y, cameraPosition.current.z],
      desiredFocus: [desiredFocus.current.x, desiredFocus.current.y, desiredFocus.current.z],
      dt,
      wallDistance,
      placed: cameraPlaced.current,
    });
    cameraPlaced.current = followed.placed;
    camera.position.set(followed.position[0], followed.position[1], followed.position[2]);
    cameraFocus.current.set(followed.focus[0], followed.focus[1], followed.focus[2]);
    camera.lookAt(cameraFocus.current);

    if (body.current) {
      body.current.position.set(visiblePose.x, 0, visiblePose.z);
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
      onPose(visiblePose);
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
