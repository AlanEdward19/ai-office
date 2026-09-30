"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { useEffect, useRef, type RefObject } from "react";
import { OrthographicCamera, Vector3 } from "three";

import { nearestDeskId } from "@/domain/dispatch";
import type { FloorId } from "@/domain/floors";
import type { PlacedAgent } from "@/domain/placement";
import type { PlacedRoom } from "@/domain/rooms";
import { isoZoom, OfficeScene } from "./office-scene";

export type DeskHit = (clientX: number, clientY: number) => string | null;

function DeskDropBridge({
  agents,
  hitRef,
}: {
  agents: PlacedAgent[];
  hitRef: RefObject<DeskHit | null>;
}) {
  const camera = useThree((state) => state.camera);
  const gl = useThree((state) => state.gl);
  const agentsRef = useRef(agents);
  useEffect(() => {
    agentsRef.current = agents;
  }, [agents]);
  useEffect(() => {
    const point = new Vector3();
    hitRef.current = (clientX, clientY) => {
      const rect = gl.domElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      const points = agentsRef.current.map((agent) => {
        point.set(agent.x, 0.85, agent.z);
        point.project(camera);
        return {
          id: agent.id,
          x: rect.left + (point.x * 0.5 + 0.5) * rect.width,
          y: rect.top + (-point.y * 0.5 + 0.5) * rect.height,
        };
      });
      return nearestDeskId(points, clientX, clientY, 96);
    };
    return () => {
      hitRef.current = null;
    };
  }, [camera, gl, hitRef]);
  return null;
}

export default function OfficeCanvas({
  rooms,
  agents,
  selectedId,
  onSelectAgent,
  openRoomId,
  onSelectRoom,
  dropArmed,
  floor,
  onRideElevator,
  onHire,
  hitRef,
  resetSignal,
}: {
  rooms: PlacedRoom[];
  agents: PlacedAgent[];
  selectedId: string | null;
  onSelectAgent: (id: string) => void;
  openRoomId: string | null;
  onSelectRoom: (id: string) => void;
  dropArmed: boolean;
  floor: FloorId;
  onRideElevator: () => void;
  onHire: () => void;
  hitRef: RefObject<DeskHit | null>;
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
      <DeskDropBridge agents={agents} hitRef={hitRef} />
      <OfficeScene
        rooms={rooms}
        agents={agents}
        selectedId={selectedId}
        onSelectAgent={onSelectAgent}
        openRoomId={openRoomId}
        onSelectRoom={onSelectRoom}
        dropArmed={dropArmed}
        floor={floor}
        onRideElevator={onRideElevator}
        onHire={onHire}
        resetSignal={resetSignal}
      />
    </Canvas>
  );
}
