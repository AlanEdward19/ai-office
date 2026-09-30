"use client";

import { Canvas } from "@react-three/fiber";

import type { FloorId } from "@/domain/floors";
import type { PlacedAgent } from "@/domain/placement";
import type { PlacedRoom } from "@/domain/rooms";
import type { InteractTarget, Pose } from "@/domain/walker";
import { OfficeScene } from "./office-scene";

export default function OfficeCanvas({
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
      shadows="basic"
      dpr={[1, 1.75]}
      camera={{ fov: 68, position: [0.38, 1.7, 5.15], near: 0.08, far: 80 }}
      gl={{ antialias: true }}
      onCreated={({ camera }) => {
        camera.lookAt(0, 1.2, -1);
      }}
      style={{ touchAction: "none" }}
    >
      <OfficeScene
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
