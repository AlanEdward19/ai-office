"use client";
import type { PresenceRoster } from "./office-call";

import type { CameraMode } from "@/domain/camera";

import { Canvas } from "@react-three/fiber";

import type { Appearance, Gesture } from "@/domain/character";
import type { FloorId } from "@/domain/floors";
import type { PlacedAgent } from "@/domain/placement";
import type { PlacedRoom } from "@/domain/rooms";
import type { InteractTarget, Pose } from "@/domain/walker";
import type {RoutineEngine,RoutineVisual,RoutineCommand,RoutineResult} from "@/domain/agent-routines";
import { OfficeScene } from "./office-scene";

export default function OfficeCanvas({
  routineEngine,routineVisuals,routineCommands,idleMs,host,userPose,newHire,onRoutines,onRoutineResult,onAgent,
  agentTimeZone,
  presence,
  correction,
  onPerson,
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
  routineEngine?:RoutineEngine;routineVisuals?:RoutineVisual[];routineCommands?:RoutineCommand[];idleMs?:number;host?:boolean;userPose?:Pose;newHire?:{id:string;stamp:number}|null;onRoutines?:(visuals:RoutineVisual[])=>void;onRoutineResult?:(result:RoutineResult)=>void;onAgent?:(id:string)=>void;
  agentTimeZone?: string;
  presence: PresenceRoster | null;
  correction: {pose:Pose;stamp:number}|null;
  onPerson:(id:string)=>void;
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
        routineEngine={routineEngine} routineVisuals={routineVisuals} routineCommands={routineCommands} idleMs={idleMs} host={host} userPose={userPose} newHire={newHire} onRoutines={onRoutines} onRoutineResult={onRoutineResult} onAgent={onAgent}
        agentTimeZone={agentTimeZone}
        presence={presence}
        correction={correction}
        onPerson={onPerson}
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
