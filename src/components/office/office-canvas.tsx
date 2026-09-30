"use client";

import type { CameraMode } from "@/domain/camera";

import { Canvas } from "@react-three/fiber";

import type { Appearance, Gesture } from "@/domain/character";
import type { FloorId } from "@/domain/floors";
import type { PlacedAgent } from "@/domain/placement";
import type { PlacedRoom } from "@/domain/rooms";
import type { InteractTarget, Pose } from "@/domain/walker";
import { OfficeScene } from "./office-scene";

export default function OfficeCanvas({
  agentTimeZone,
  appearance,
  cameraMode,
  zoom,
  gesture,
  rooms,
  agents,
  nearId,
  dropArmed,
  floor,
  onNearby,
  onPose,
  enabled,
  localOffline,
}: {
  agentTimeZone?: string;
  appearance: Appearance;
  cameraMode: CameraMode;
  zoom: number;
  gesture: { kind: Gesture; stamp: number } | null;
  rooms: PlacedRoom[];
  agents: PlacedAgent[];
  nearId: string | null;
  dropArmed: boolean;
  floor: FloorId;
  onNearby: (target: InteractTarget | null) => void;
  onPose: (pose: Pose) => void;
  enabled: boolean;
  localOffline: boolean;
}) {
  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      camera={{ fov: 42, position: [7, 9.5, 9.6], near: 0.08, far: 80 }}
      gl={{ antialias: true }}
      onCreated={({ camera }) => {
        camera.lookAt(0, 1.2, -1);
      }}
      style={{ touchAction: "none" }}
    >
      <OfficeScene
        agentTimeZone={agentTimeZone}
        appearance={appearance}
        cameraMode={cameraMode}
        zoom={zoom}
        gesture={gesture}
        rooms={rooms}
        agents={agents}
        nearId={nearId}
        dropArmed={dropArmed}
        floor={floor}
        onNearby={onNearby}
        onPose={onPose}
        enabled={enabled}
        localOffline={localOffline}
      />
    </Canvas>
  );
}
