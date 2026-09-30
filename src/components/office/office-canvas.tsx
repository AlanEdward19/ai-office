"use client";

import { Canvas } from "@react-three/fiber";
import { OrthographicCamera } from "three";

import type { PlacedAgent } from "@/domain/placement";
import type { PlacedRoom } from "@/domain/rooms";
import { isoZoom, OfficeScene } from "./office-scene";

export default function OfficeCanvas({
  rooms,
  agents,
  selectedId,
  onSelectAgent,
  resetSignal,
}: {
  rooms: PlacedRoom[];
  agents: PlacedAgent[];
  selectedId: string | null;
  onSelectAgent: (id: string) => void;
  resetSignal: number;
}) {
  return (
    <Canvas
      orthographic
      shadows="basic"
      dpr={[1, 1.75]}
      camera={{ position: [20, 22, 20], zoom: 46, near: -80, far: 220 }}
      gl={{ antialias: true }}
      onCreated={({ camera }) => {
        if (!(camera instanceof OrthographicCamera)) return;
        camera.zoom = isoZoom(window.innerWidth, window.innerHeight);
        camera.lookAt(0, 0, -1);
        camera.updateProjectionMatrix();
      }}
    >
      <OfficeScene
        rooms={rooms}
        agents={agents}
        selectedId={selectedId}
        onSelectAgent={onSelectAgent}
        resetSignal={resetSignal}
      />
    </Canvas>
  );
}
