"use client";

import type { CameraMode } from "@/domain/camera";

import { RoundedBox } from "@react-three/drei/core/RoundedBox";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { BackSide, Box3, Mesh, Raycaster, Vector3, type Group } from "three";

import { STATUS_LABELS, type AgentStatus } from "@/domain/agent-event";
import { commonAreas, ELEVATOR_DOOR_ROTATION } from "@/domain/office-layout";
import { ELEVATOR, type FloorId } from "@/domain/floors";
import { PROVIDER_LABELS } from "@/domain/providers";
import { localWingPlate, type PlacedAgent } from "@/domain/placement";
import { CEO_CORNER, LOBBY, RECEPTION, roomColor, type PlacedRoom } from "@/domain/rooms";
import { interactTargets, type InteractTarget, type Pose } from "@/domain/walker";
import type { Appearance, Gesture } from "@/domain/character";
import type { Obstacle } from "@/domain/walker";
import { Avatar } from "./avatar";
import { DEFAULT_APPEARANCE } from "@/domain/character";
import { OfficePlayer } from "./player";

const STATUS_COLOR: Record<AgentStatus, string> = {
  idle: "#8d8276",
  working: "#e0a106",
  blocked: "#b42318",
  done: "#1f7a4d",
};

export function OfficeScene({
  appearance,
  cameraMode,
  zoom,
  gesture,
  rooms,
  agents,
  nearId,
  dropArmed,
  floor,
  localOffline,
  agentTimeZone,
  enabled,
  onNearby,
  onPose,
}: {
  appearance: Appearance;
  cameraMode: CameraMode;
  zoom: number;
  gesture: { kind: Gesture; stamp: number } | null;
  rooms: PlacedRoom[];
  agents: PlacedAgent[];
  nearId: string | null;
  dropArmed: boolean;
  floor: FloorId;
  localOffline: boolean;
  agentTimeZone?: string;
  enabled: boolean;
  onNearby: (target: InteractTarget | null) => void;
  onPose: (pose: Pose) => void;
}) {
  const targets = useMemo(
    () => interactTargets({ floor, rooms, agents }),
    [floor, rooms, agents],
  );

  const environment = useRef<Group>(null);
  const obstacles = useRef<Obstacle[]>([]);
  const cameraWalls = useRef<Mesh[]>([]);
  useLayoutEffect(() => {
    obstacles.current.length = 0;
    cameraWalls.current.length = 0;
    environment.current?.updateWorldMatrix(true, true);
    environment.current?.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      if (object.userData.cameraWall) cameraWalls.current.push(object);
      for (let ancestor = object.parent; ancestor; ancestor = ancestor.parent) {
        if (ancestor.userData.noCollision) return;
      }
      if (object.userData.noCollision) return;
      const box = new Box3().setFromObject(object);
      // Solid geometry at body height; floors, rugs and ceiling stay walkable.
      if (box.max.y <= 0.12 || box.min.y >= 1.7) return;
      obstacles.current.push({ minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z });
    });
  }, [floor, rooms, agents, cameraMode]);

  return (
    <>
      <color attach="background" args={["#c5dce4"]} />
      <fog attach="fog" args={["#c5dce4", 16, 38]} />
      <ambientLight intensity={0.62} />
      <hemisphereLight args={["#f7f1e8", "#416277", 0.45]} />
      <directionalLight
        castShadow
        position={[12, 18, 10]}
        intensity={1.25}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={1}
        shadow-camera-far={50}
        shadow-camera-left={-22}
        shadow-camera-right={22}
        shadow-camera-top={22}
        shadow-camera-bottom={-22}
        shadow-bias={-0.0008}
      />
      <group ref={environment}>
      {cameraMode !== "isometric" && <Ceiling floor={floor} />}
      <WallClock />
      {floor === "ground" && <Lounge />}
      <Table />
      {floor === "ground" ? (
        <>
          <OfficeEnvelope cameraMode={cameraMode} />
          <LobbyShell cameraMode={cameraMode} />
          <LobbyFloor />
          <MeetingNook />
          <LocalWing offline={localOffline} cameraMode={cameraMode} />
          <Reception />
          <CeoCorner />
          {commonAreas(rooms).map(zone => <CommonArea key={zone.name} {...zone} />)}
          <CommonArea name="Café da equipe" x={12} z={-6.8} style={1} />
          <CommonArea name="Laboratório" x={12} z={-12.8} style={0} />
          {rooms.map((room) => (
            <ProjectRoom key={room.id} room={room} open={room.id === nearId} cameraMode={cameraMode} />
          ))}
          {agents.map((agent) => (
            <DeskAgent
              key={agent.id}
              agent={agent}
              selected={agent.id === nearId}
              dropArmed={dropArmed}
              localOffline={localOffline}
              timeZone={agentTimeZone}
            />
          ))}
        </>
      ) : (
        <HrFloor cameraMode={cameraMode} />
      )}
      <Elevator />
      </group>
      <OfficePlayer
        appearance={appearance}
        cameraMode={cameraMode}
        zoom={zoom}
        gesture={gesture}
        obstacles={obstacles}
        cameraWalls={cameraWalls}
        floor={floor}
        targets={targets}
        enabled={enabled}
        onNearby={onNearby}
        onPose={onPose}
      />
    </>
  );
}

function OfficeEnvelope({ cameraMode }: { cameraMode: CameraMode }) {
  return <group>
    <mesh position={[3.3, -0.17, -4.9]} receiveShadow><boxGeometry args={[25.2, 0.12, 22.4]} /><meshStandardMaterial color="#d7e3df" roughness={0.9} /></mesh>
    <Wall position={[3.3, 1.6, -16.1]} size={[25.2, 3.2, 0.18]} />
    <Wall position={[-9.3, 1.6, -4.9]} size={[0.18, 3.2, 22.4]} />
    <Wall cutaway={cameraMode === "isometric"} position={[15.9, 1.6, -4.9]} size={[0.18, 3.2, 22.4]} />
    <Wall cutaway={cameraMode === "isometric"} position={[3.3, 1.6, 6.3]} size={[25.2, 3.2, 0.18]} />
  </group>;
}

function Ceiling({ floor }: { floor: FloorId }) {
  return (
    <group position={floor === "ground" ? [3.3, 0, -4.9] : [0, 0, 0]} userData={{ noCollision: true }}>
      <mesh position={[0, 3.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={floor === "ground" ? [25.2, 22.4] : [18.4, 12.4]} />
        <meshStandardMaterial color="#edf3f4" side={BackSide} roughness={0.92} />
      </mesh>
      {(floor === "ground" ? [-8, 0, 8] : [-6, 0, 6]).map((x) => (
        <group key={x} position={[x, 3.08, 0]}>
          <RoundedBox args={[0.14, 0.2, floor === "ground" ? 22.4 : 12.4]} radius={0.02} smoothness={2}>
            <meshStandardMaterial color="#8badaf" roughness={0.8} />
          </RoundedBox>
          {(floor === "ground" ? [-8, 0, 8] : [-4, 0, 4]).map((z) => (
            <RoundedBox key={z} position={[0, -0.15, z]} args={[1.8, 0.06, 0.18]} radius={0.02} smoothness={2}>
              <meshStandardMaterial color="#ffefc9" emissive="#ffe5aa" emissiveIntensity={0.8} />
            </RoundedBox>
          ))}
        </group>
      ))}
    </group>
  );
}

function WallClock() {
  const hour = useRef<Group>(null);
  const minute = useRef<Group>(null);
  const second = useRef<Group>(null);
  useFrame(() => {
    const now = new Date();
    const seconds = now.getSeconds() + now.getMilliseconds() / 1000;
    const minutes = now.getMinutes() + seconds / 60;
    const hours = now.getHours() % 12 + minutes / 60;
    if (hour.current) hour.current.rotation.z = -hours * Math.PI / 6;
    if (minute.current) minute.current.rotation.z = -minutes * Math.PI / 30;
    if (second.current) second.current.rotation.z = -seconds * Math.PI / 30;
  });
  return (
    <group position={[-5.4, 2.12, 5.94]} rotation={[0, Math.PI, 0]} userData={{ noCollision: true }}>
      <RoundedBox position={[0, -0.72, -0.11]} args={[1.2, 2.75, 0.12]} radius={0.04} smoothness={2}><meshStandardMaterial color="#91b9c1" transparent opacity={0.45} /></RoundedBox>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[0.44, 0.44, 0.07, 40]} /><meshStandardMaterial color="#25495c" /></mesh>
      <mesh position={[0, 0, 0.04]}><circleGeometry args={[0.39, 40]} /><meshStandardMaterial color="#f8f4e9" /></mesh>
      {Array.from({ length: 12 }, (_, index) => (
        <group key={index} rotation={[0, 0, -index * Math.PI / 6]}>
          <mesh position={[0, 0.335, 0.046]}><boxGeometry args={[0.018, 0.045, 0.006]} /><meshStandardMaterial color="#25495c" /></mesh>
        </group>
      ))}
      <group ref={hour}><mesh position={[0, 0.105, 0.055]}><boxGeometry args={[0.035, 0.21, 0.015]} /><meshStandardMaterial color="#25495c" /></mesh></group>
      <group ref={minute}><mesh position={[0, 0.15, 0.075]}><boxGeometry args={[0.023, 0.3, 0.015]} /><meshStandardMaterial color="#25495c" /></mesh></group>
      <group ref={second}><mesh position={[0, 0.16, 0.09]}><boxGeometry args={[0.008, 0.32, 0.01]} /><meshStandardMaterial color="#e78963" /></mesh></group>
      <mesh position={[0, 0, 0.105]}><sphereGeometry args={[0.025, 12, 8]} /><meshStandardMaterial color="#e78963" /></mesh>
    </group>
  );
}

type LabelLine = { text: string; kind: "kicker" | "title" | "meta" | "pill" | "brass" };

function LocalTimeLabel({ timeZone, lines }: { timeZone: string; lines: LabelLine[] }) {
  const [now, setNow] = useState(() => new Date());
  const formats = useMemo(() => {
    try {
      const viewerZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const options = { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false } as const;
      return {
        owner: new Intl.DateTimeFormat("pt-BR", { ...options, timeZone }),
        viewer: new Intl.DateTimeFormat("pt-BR", { ...options, timeZone: viewerZone }),
        viewerZone,
      };
    } catch {
      return null;
    }
  }, [timeZone]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  if (!formats) return <ProjectedLabel position={[0, 1.85, 0]} lines={lines} />;
  return <ProjectedLabel position={[0, 2.1, 0]} lines={[
    ...lines,
    { text: timeZone, kind: "meta" },
    { text: `Local ${formats.owner.format(now)}`, kind: "meta" },
    { text: `Você ${formats.viewer.format(now)} · ${formats.viewerZone}`, kind: "meta" },
  ]} />;
}

function Elevator() {
  return (
    <group position={[ELEVATOR.x, 0, ELEVATOR.z]} rotation={[0, ELEVATOR_DOOR_ROTATION, 0]}>
      <RoundedBox position={[0, 1.25, 0]} castShadow receiveShadow args={[1.7, 2.5, 1.7]} radius={0.025} smoothness={2}>
        <meshStandardMaterial color="#4a4038" roughness={0.7} />
      </RoundedBox>
      <RoundedBox position={[0, 1.15, 0.86]} args={[0.95, 2.05, 0.06]} radius={0.025} smoothness={2}>
        <meshStandardMaterial color="#d4b483" metalness={0.45} roughness={0.35} />
      </RoundedBox>
      <PlaceLabel title="Elevador" y={2.7} brass />
    </group>
  );
}

function CommonArea({ name, x, z, style }: { name: string; x: number; z: number; style: number }) {
  return <group position={[x, 0, z]}>
    <mesh position={[0, 0.065, 0]} receiveShadow><boxGeometry args={[3.6, 0.03, 3.4]} /><meshStandardMaterial color={style === 1 ? "#bfd8d0" : "#d7d1bf"} roughness={1} /></mesh>
    {style === 1 ? <>
      <RoundedBox position={[0, 0.55, -0.85]} args={[2.6, 0.7, 0.7]} radius={0.12}><meshStandardMaterial color="#678d83" /></RoundedBox>
      <RoundedBox position={[0, 0.85, -1.1]} args={[2.6, 0.65, 0.18]} radius={0.07}><meshStandardMaterial color="#678d83" /></RoundedBox>
      <mesh position={[0, 0.36, 0.4]} castShadow><cylinderGeometry args={[0.6, 0.6, 0.1, 24]} /><meshStandardMaterial color="#c7a17a" /></mesh>
      <mesh position={[0, 0.19, 0.4]}><cylinderGeometry args={[0.08, 0.2, 0.32, 12]} /><meshStandardMaterial color="#526d71" /></mesh>
    </> : style === 2 ? <>
      <mesh position={[0, 0.9, -1.2]} castShadow><boxGeometry args={[2.5, 1.8, 0.4]} /><meshStandardMaterial color="#ad8766" /></mesh>
      {[0, 1, 2].map(row => <group key={row} position={[0, 0.3 + row * 0.5, -0.95]}>{[-0.95, -0.6, -0.25, 0.1, 0.45, 0.8].map((bx, i) => <mesh key={bx} position={[bx, 0.1, 0]}><boxGeometry args={[0.2, 0.3 + i % 2 * 0.08, 0.13]} /><meshStandardMaterial color={["#4f8690", "#d98c68", "#c3b17d"][i % 3]} /></mesh>)}</group>)}
      <Chair position={[0, 0, 0.7]} color="#678d83" />
    </> : <>
      <mesh position={[0, 0.76, -0.45]} castShadow receiveShadow><boxGeometry args={[2.4, 0.1, 0.9]} /><meshStandardMaterial color="#c7a17a" /></mesh>
      {[-1, 1].map(side => <mesh key={side} position={[side, 0.36, -0.45]}><boxGeometry args={[0.1, 0.72, 0.65]} /><meshStandardMaterial color="#526d71" /></mesh>)}
      <DeskDetails position={[0, 0.81, -0.45]} />
      <Chair position={[-0.65, 0, 0.45]} color="#678d83" /><Chair position={[0.65, 0, 0.45]} color="#678d83" />
    </>}
    <Plant position={[1.35, 0, -1.1]} />
    <PlaceLabel title={name} y={2.1} />
  </group>;
}

function HrFloor({ cameraMode }: { cameraMode: CameraMode }) {
  return (
    <group>
      <CommonArea name="Espera & boas-vindas" x={-5.5} z={2.8} style={1} />
      <CommonArea name="Biblioteca de habilidades" x={-5.5} z={-3.4} style={2} />
      <CommonArea name="Formação" x={4.6} z={-3.3} style={0} />
      <CommonArea name="Entrevistas" x={4.6} z={0.4} style={0} />
      <Wall position={[0, 1.6, -6.15]} size={[18.2, 3.2, 0.18]} />
      <Wall position={[-9.05, 1.6, 0]} size={[0.18, 3.2, 12.2]} />
      <Wall cutaway={cameraMode === "isometric"} position={[0, 1.6, 6.15]} size={[18.2, 3.2, 0.18]} />
      <Wall cutaway={cameraMode === "isometric"} position={[9.05, 1.6, 0]} size={[0.18, 3.2, 12.2]} />
      <mesh position={[0, -0.08, 0]} receiveShadow>
        <boxGeometry args={[18.4, 0.16, 12.4]} />
        <meshStandardMaterial color="#6e7c74" roughness={0.85} />
      </mesh>
      <RoundedBox position={[0, 0.01, 0]} receiveShadow args={[17.6, 0.08, 11.6]} radius={0.025} smoothness={2}>
        <meshStandardMaterial color="#e7f0ea" roughness={0.9} />
      </RoundedBox>
      <group position={[-1.4, 0, -0.2]}>
        <RoundedBox position={[0, 0.04, 0]} receiveShadow args={[6.2, 0.05, 4.4]} radius={0.025} smoothness={2}>
          <meshStandardMaterial color="#1d3b34" roughness={0.9} />
      </RoundedBox>
        <RoundedBox position={[0, 0.46, 0.35]} castShadow receiveShadow args={[2.4, 0.84, 1.05]} radius={0.025} smoothness={2}>
          <meshStandardMaterial color="#f7f1e8" roughness={0.62} />
      </RoundedBox>
        <Chair position={[0, 0, -0.55]} color="#1a3330" />
        <Plant position={[2.3, 0, 1.2]} />
        <PlaceLabel title="Ficha de vaga" y={1.9} />
      </group>
    </group>
  );
}

function LobbyShell({ cameraMode }: { cameraMode: CameraMode }) {
  const halfW = LOBBY.width / 2 + 0.2;
  const halfD = LOBBY.depth / 2 + 0.2;
  const height = 3.2;
  const y = height / 2;
  return (
    <group>
      <Wall cutaway={cameraMode === "isometric"} position={[0, y, halfD]} size={[LOBBY.width + 0.4, height, 0.12]} />
      <Wall position={[-halfW, y, 0]} size={[0.12, height, LOBBY.depth + 0.4]} />
      <Wall position={[-5.4, y, -halfD]} size={[7.2, height, 0.12]} />
      <Wall position={[5.6, y, -halfD]} size={[7.2, height, 0.12]} />
      <Wall cutaway={cameraMode === "isometric"} position={[halfW, y, -3.3]} size={[0.12, height, 5.6]} />
      <Wall cutaway={cameraMode === "isometric"} position={[halfW, y, 4.3]} size={[0.12, height, 3.6]} />
    </group>
  );
}

function Table() {
  return (
    <mesh position={[0, -0.46, -2]} receiveShadow>
      <boxGeometry args={[42, 0.4, 36]} />
      <meshStandardMaterial color="#34495c" roughness={0.92} />
    </mesh>
  );
}

function LocalWing({ offline, cameraMode }: { offline: boolean; cameraMode: CameraMode }) {
  const plate = localWingPlate();
  return (
    <group position={[plate.x, 0, plate.z]}>
      <Wall position={[0, 1.6, -plate.depth / 2]} size={[plate.width, 3.2, 0.18]} />
      <Wall cutaway={cameraMode === "isometric"} position={[0, 1.6, plate.depth / 2]} size={[plate.width, 3.2, 0.18]} />
      <Wall cutaway={cameraMode === "isometric"} position={[plate.width / 2, 1.6, 0]} size={[0.18, 3.2, plate.depth]} />
      {[-1, 1].map(side => <Wall key={side} position={[-plate.width / 2, 1.6, side * (plate.depth / 4 + 0.5)]} size={[0.18, 3.2, plate.depth / 2 - 1]} />)}

      <RoundedBox position={[0, -0.02, 0]} receiveShadow args={[plate.width, 0.12, plate.depth]} radius={0.025} smoothness={2}>
        <meshStandardMaterial color="#243038" roughness={0.86} />
      </RoundedBox>
      <RoundedBox position={[0, 0.05, 0]} receiveShadow args={[plate.width - 0.28, 0.06, plate.depth - 0.28]} radius={0.025} smoothness={2}>
        <meshStandardMaterial color="#d5e0e8" roughness={0.9} />
      </RoundedBox>
      <ProjectedLabel
        position={[0, 1.35, -plate.depth / 2 + 0.2]}
        lines={
          offline
            ? [
                { text: "Ala local", kind: "brass" },
                { text: "Máquina offline", kind: "meta" },
              ]
            : [{ text: "Ala local", kind: "brass" }]
        }
      />
    </group>
  );
}

function LobbyFloor() {
  return (
    <group>
      <mesh position={[0, -0.08, 0]} receiveShadow>
        <boxGeometry args={[18.4, 0.16, 12.4]} />
        <meshStandardMaterial color="#b08968" roughness={0.8} />
      </mesh>
      <RoundedBox position={[0, 0.01, 0]} receiveShadow args={[17.6, 0.08, 11.6]} radius={0.025} smoothness={2}>
        <meshStandardMaterial color="#f3e7d6" roughness={0.86} />
      </RoundedBox>
      {[-6, -2, 2, 6].map((x) => (
        <mesh key={x} position={[x, 0.06, 0]} receiveShadow>
          <boxGeometry args={[0.04, 0.01, 11.2]} />
          <meshStandardMaterial color="#e4d3be" />
        </mesh>
      ))}
    </group>
  );
}

function Reception() {
  return (
    <group position={[RECEPTION.x, 0, RECEPTION.z]}>
      <RoundedBox position={[0, 0.42, 0]} castShadow receiveShadow args={[3.1, 0.84, 0.9]} radius={0.025} smoothness={2}>
        <meshStandardMaterial color="#286e80" roughness={0.7} />
      </RoundedBox>
      <RoundedBox position={[0, 0.88, 0]} castShadow args={[3.3, 0.08, 1.05]} radius={0.025} smoothness={2}>
        <meshStandardMaterial color="#f7f1e8" roughness={0.45} />
      </RoundedBox>
      <DeskDetails position={[0, 0.94, 0]} />
      <Plant position={[1.35, 0, 0.85]} />
      <PlaceLabel title="Recepção" y={1.7} />
    </group>
  );
}

function CeoCorner() {
  return (
    <group position={[CEO_CORNER.x, 0, CEO_CORNER.z]}>
      <RoundedBox position={[0, 0.04, 0]} receiveShadow args={[4.4, 0.04, 3.6]} radius={0.025} smoothness={2}>
        <meshStandardMaterial color="#287080" roughness={0.9} />
      </RoundedBox>
      <RoundedBox position={[0, 0.46, -0.85]} castShadow receiveShadow args={[2.3, 0.84, 1.05]} radius={0.025} smoothness={2}>
        <meshStandardMaterial color="#286477" roughness={0.62} />
      </RoundedBox>
      <RoundedBox position={[0, 0.9, -0.85]} args={[2.45, 0.08, 1.18]} radius={0.025} smoothness={2}>
        <meshStandardMaterial color="#d4b483" metalness={0.35} roughness={0.4} />
      </RoundedBox>
      <DeskDetails position={[0, 0.95, -0.85]} />
      <Chair position={[0, 0, -0.15]} color="#102820" />
      <RoundedBox position={[1.55, 0.7, -1.35]} castShadow args={[0.08, 1.4, 2.2]} radius={0.025} smoothness={2}>
        <meshStandardMaterial color="#f6f0e6" />
      </RoundedBox>
      <PlaceLabel title="CEO" y={2.05} brass />
    </group>
  );
}

function ProjectRoom({ room, open, cameraMode }: { room: PlacedRoom; open: boolean; cameraMode: CameraMode }) {
  const width = 4.05;
  const depth = 4.4;
  const wallY = 1.6;
  return (
    <group position={[room.x, 0, room.z]}>
      <RoundedBox position={[0, 0.02, 0]} receiveShadow args={[width, 0.06, depth]} radius={0.025} smoothness={2}>
        <meshStandardMaterial color={roomColor(room.id)} roughness={0.88} />
      </RoundedBox>
      <Wall position={[0, wallY, -depth / 2]} size={[width, 3.2, 0.08]} />
      <Wall position={[-width / 2, wallY, 0]} size={[0.08, 3.2, depth]} />
      <Wall cutaway={cameraMode === "isometric"} position={[width / 2, wallY, 0]} size={[0.08, 3.2, depth]} />
      <Wall cutaway={cameraMode === "isometric"} position={[-1.15, wallY, depth / 2]} size={[1.5, 3.2, 0.08]} />
      <Wall cutaway={cameraMode === "isometric"} position={[1.15, wallY, depth / 2]} size={[1.5, 3.2, 0.08]} />
      <RoundedBox position={[0, 1.15, -depth / 2 + 0.12]} castShadow userData={{ noCollision: true }} args={[2.2, 0.65, 0.06]} radius={0.025} smoothness={2}>
        <meshStandardMaterial color={open ? "#f3d48a" : "#f7f1e8"} roughness={0.55} />
      </RoundedBox>
      <PlaceLabel title={room.name} y={2.35} />
    </group>
  );
}

function DeskAgent({
  agent,
  selected,
  dropArmed,
  localOffline,
  timeZone,
}: {
  agent: PlacedAgent;
  selected: boolean;
  dropArmed: boolean;
  localOffline: boolean;
  timeZone?: string;
}) {
  const local = agent.event.origin === "local";
  const company = agent.form
    ? PROVIDER_LABELS[agent.form.provider]
    : PROVIDER_LABELS[agent.event.provider];
  const role = agent.form?.role;
  const lines = local
    ? [
        { text: "Local", kind: "kicker" as const },
        { text: agent.displayName ?? company, kind: "title" as const },
        {
          text: localOffline
            ? `${agent.event.owner} · máquina offline`
            : `${agent.event.owner} · ${STATUS_LABELS[agent.event.status]}`,
          kind: "meta" as const,
        },
      ]
    : [
        { text: company, kind: "kicker" as const },
        { text: agent.displayName ?? role ?? "Nuvem", kind: "title" as const },
        { text: STATUS_LABELS[agent.event.status], kind: "meta" as const },
      ];
  return (
    <group position={[agent.x, 0, agent.z]}>
      <RoundedBox position={[0, 0.4, 0.15]} castShadow receiveShadow args={[1.35, 0.72, 0.7]} radius={0.025} smoothness={2}>
        <meshStandardMaterial
          color={local ? (selected ? "#5c6b78" : "#3e4c59") : selected ? "#f7f1e8" : "#efe2d2"}
          roughness={0.7}
        />
      </RoundedBox>
      <RoundedBox position={[0, 0.78, 0.15]} args={[1.42, 0.06, 0.78]} radius={0.025} smoothness={2}>
        <meshStandardMaterial color={local ? "#d4b483" : "#d8c3a5"} metalness={local ? 0.35 : 0} />
      </RoundedBox>
      <DeskDetails position={[0, 0.82, 0.15]} />
      <mesh position={[0.48, 0.86, 0.15]} userData={{ noCollision: true }}>
        <sphereGeometry args={[0.07, 16, 16]} />
        <meshStandardMaterial
          color={STATUS_COLOR[agent.event.status]}
          emissive={STATUS_COLOR[agent.event.status]}
          emissiveIntensity={agent.event.status === "working" ? 0.6 : 0.15}
        />
      </mesh>
      <Chair position={[0, 0, -0.55]} color={local ? "#2c3842" : "#5c4636"} />
      <AgentFigure status={agent.event.status} local={local} />
      {selected ? (
        <mesh position={[0, 0.03, 0.1]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.85, 0.96, 40]} />
          <meshStandardMaterial color="#d4b483" />
        </mesh>
      ) : null}
      {dropArmed ? (
        <mesh position={[0, 0.05, 0.15]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.95, 1.08, 40]} />
          <meshStandardMaterial
            color={agent.form ? (agent.form.provider === "cursor" ? "#1f7a4d" : "#b7791f") : "#b42318"}
          />
        </mesh>
      ) : null}
      {(local || (agent.form && agent.form.provider !== "cursor")) && timeZone ? <LocalTimeLabel timeZone={timeZone} lines={lines} /> : <ProjectedLabel position={[0, 1.85, 0]} lines={lines} />}
    </group>
  );
}

function AgentFigure({ status, local }: { status: AgentStatus; local: boolean }) {
  const ref = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.position.y =
      status === "working" ? Math.sin(clock.elapsedTime * 3.2) * 0.05 : 0;
    ref.current.userData.status = status;
  });
  return (
    <group
      ref={ref}
      name={local ? "local-figure" : "cloud-figure"}
      position={[0, 0, -0.15]}
      userData={{ status }}
    >
      <group scale={0.78}>
        <Avatar appearance={{ ...DEFAULT_APPEARANCE, shirt: STATUS_COLOR[status], accessory: local ? "headphones" : "glasses", outfit: local ? "hoodie" : "jacket" }} />
      </group>
      {local ? (
        <RoundedBox position={[0.2, 1.02, 0.12]} castShadow name="local-badge" args={[0.16, 0.11, 0.04]} radius={0.025} smoothness={2}>
          <meshStandardMaterial color="#d4b483" metalness={0.45} roughness={0.32} />
      </RoundedBox>
      ) : null}
    </group>
  );
}

function Chair({ position, color }: { position: [number, number, number]; color: string }) {
  return (
    <group position={position}>
      <RoundedBox args={[0.5, 0.12, 0.5]} radius={0.05} smoothness={2} position={[0, 0.36, 0]} castShadow>
        <meshStandardMaterial color={color} roughness={0.88} />
      </RoundedBox>
      <RoundedBox args={[0.5, 0.52, 0.12]} radius={0.05} smoothness={2} position={[0, 0.66, -0.21]} castShadow>
        <meshStandardMaterial color={color} roughness={0.88} />
      </RoundedBox>
      <mesh position={[0, 0.18, 0]} castShadow><cylinderGeometry args={[0.035, 0.035, 0.3, 8]} /><meshStandardMaterial color="#304453" metalness={0.7} roughness={0.3} /></mesh>
      <mesh position={[0, 0.04, 0]}><cylinderGeometry args={[0.23, 0.23, 0.05, 5]} /><meshStandardMaterial color="#304453" /></mesh>
    </group>
  );
}

function DeskDetails({ position }: { position: [number, number, number] }) {
  return (
    <group position={position} userData={{ noCollision: true }}>
      <RoundedBox args={[0.62, 0.04, 0.35]} radius={0.012} smoothness={2} position={[-0.13, 0.02, -0.05]} castShadow><meshStandardMaterial color="#283e50" metalness={0.35} roughness={0.4} /></RoundedBox>
      <group position={[-0.13, 0.23, 0.11]} rotation={[-0.18, 0, 0]}>
        <RoundedBox args={[0.62, 0.4, 0.035]} radius={0.015} smoothness={2} castShadow><meshStandardMaterial color="#283e50" /></RoundedBox>
        <mesh position={[0, 0, -0.021]}><planeGeometry args={[0.55, 0.32]} /><meshStandardMaterial color="#55bdcf" emissive="#55bdcf" emissiveIntensity={0.3} side={2} /></mesh>
        {[-0.07, 0.01, 0.09].map((y) => <mesh key={y} position={[-0.06, y, -0.023]}><planeGeometry args={[0.34, 0.015]} /><meshBasicMaterial color="#caedf0" side={2} /></mesh>)}
      </group>
      <RoundedBox args={[0.42, 0.015, 0.15]} radius={0.008} smoothness={2} position={[-0.13, 0.047, -0.1]}><meshStandardMaterial color="#b7c8d0" /></RoundedBox>
      <mesh position={[0.47, 0.095, -0.06]} castShadow><cylinderGeometry args={[0.055, 0.05, 0.16, 12]} /><meshStandardMaterial color="#fff4df" roughness={0.45} /></mesh>
      <mesh position={[0.53, 0.095, -0.06]} rotation={[0, Math.PI / 2, 0]}><torusGeometry args={[0.042, 0.011, 6, 12]} /><meshStandardMaterial color="#fff4df" /></mesh>
    </group>
  );
}

function Plant({ position }: { position: [number, number, number] }) {
  return (
    <group position={position} userData={{ noCollision: true }}>
      <mesh position={[0, 0.19, 0]} castShadow><cylinderGeometry args={[0.19, 0.14, 0.34, 16]} /><meshStandardMaterial color="#ecb38c" roughness={0.9} /></mesh>
      <mesh position={[0, 0.37, 0]}><cylinderGeometry args={[0.17, 0.17, 0.015, 16]} /><meshStandardMaterial color="#4a3930" /></mesh>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <group key={i} rotation={[0, i * Math.PI / 3, 0]}>
          <mesh position={[0.08, 0.62 + (i % 2) * 0.12, 0]} rotation={[0, 0, -0.45]} castShadow><cylinderGeometry args={[0.012, 0.015, 0.5, 6]} /><meshStandardMaterial color="#39775e" /></mesh>
          <mesh position={[0.19, 0.79 + (i % 2) * 0.12, 0]} rotation={[0, 0, -0.8]} scale={[0.12, 0.28, 0.055]} castShadow><sphereGeometry args={[1, 10, 8]} /><meshStandardMaterial color={i % 2 ? "#499f72" : "#267d69"} roughness={0.8} /></mesh>
        </group>
      ))}
    </group>
  );
}

function MeetingNook() {
  return <group position={[-4.7, 0, -2.4]}>
    <mesh position={[0, 0.065, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><circleGeometry args={[1.65, 48]} /><meshStandardMaterial color="#cddccd" roughness={1} /></mesh>
    <mesh position={[0, 0.79, 0]} castShadow receiveShadow><cylinderGeometry args={[0.9, 0.9, 0.09, 48]} /><meshStandardMaterial color="#d9b18b" roughness={0.6} /></mesh>
    <mesh position={[0, 0.41, 0]} castShadow><cylinderGeometry args={[0.14, 0.35, 0.7, 20]} /><meshStandardMaterial color="#6c8b87" /></mesh>
    {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map(angle => <group key={angle} position={[Math.sin(angle) * 1.3, 0, Math.cos(angle) * 1.3]} rotation={[0, angle, 0]}><Chair position={[0, 0, 0]} color="#718e7e" /></group>)}
    <group userData={{noCollision:true}}>
      <RoundedBox args={[0.45, 0.035, 0.3]} radius={0.012} position={[0.3, 0.86, 0.2]} rotation={[0, 0.3, 0]}><meshStandardMaterial color="#de8e6f" /></RoundedBox>
      <mesh position={[-0.25, 0.92, -0.2]}><cylinderGeometry args={[0.055, 0.05, 0.15, 16]} /><meshStandardMaterial color="#f7f0df" /></mesh>
    </group>
    <Plant position={[-1.4, 0, -1.4]} />
    <PlaceLabel title="Café & ideias" y={1.55} />
  </group>;
}

function Lounge() {
  return (
    <group position={[4.8, 0, 3.8]}>
      <RoundedBox position={[0, 0.06, 0]} args={[4, 0.04, 2.8]} radius={0.02} smoothness={2} receiveShadow><meshStandardMaterial color="#badbdc" roughness={1} /></RoundedBox>
      <group position={[0, 0, 0.72]}>
        <RoundedBox args={[2.8, 0.36, 0.85]} radius={0.15} smoothness={3} position={[0, 0.32, 0]} castShadow><meshStandardMaterial color="#287888" roughness={0.93} /></RoundedBox>
        <RoundedBox args={[2.8, 0.62, 0.26]} radius={0.1} smoothness={3} position={[0, 0.63, 0.35]} castShadow><meshStandardMaterial color="#287888" roughness={0.93} /></RoundedBox>
        {[-1.3, 1.3].map((x) => <RoundedBox key={x} args={[0.24, 0.55, 0.85]} radius={0.08} smoothness={2} position={[x, 0.52, 0]} castShadow><meshStandardMaterial color="#327f8d" /></RoundedBox>)}
        {[-0.8, 0, 0.8].map((x) => <RoundedBox key={x} args={[0.73, 0.15, 0.65]} radius={0.06} smoothness={2} position={[x, 0.56, -0.03]} castShadow><meshStandardMaterial color="#4594a0" roughness={1} /></RoundedBox>)}
      </group>
      <mesh position={[0, 0.38, -0.65]} castShadow><cylinderGeometry args={[0.55, 0.55, 0.08, 32]} /><meshStandardMaterial color="#d5a376" roughness={0.72} /></mesh>
      <mesh position={[0, 0.2, -0.65]}><cylinderGeometry args={[0.1, 0.22, 0.36, 16]} /><meshStandardMaterial color="#304859" /></mesh>
      <Plant position={[1.7, 0, -0.55]} />
      <group position={[-1.7, 0, 0.65]} userData={{ noCollision: true }}>
        <mesh position={[0, 0.85, 0]}><cylinderGeometry args={[0.022, 0.022, 1.6, 8]} /><meshStandardMaterial color="#bd915b" metalness={0.65} /></mesh>
        <mesh position={[0, 1.65, 0]} castShadow><coneGeometry args={[0.32, 0.4, 20, 1, true]} /><meshStandardMaterial color="#fff0ca" emissive="#ffd18a" emissiveIntensity={0.4} side={2} /></mesh>
      </group>
    </group>
  );
}

function Wall({
  position,
  size,
  cutaway = false,
}: {
  position: [number, number, number];
  size: [number, number, number];
  cutaway?: boolean;
}) {
  const height = cutaway ? 1.1 : size[1];
  const wallPosition: [number, number, number] = [position[0], position[1] - size[1] / 2 + height / 2, position[2]];
  return (
    <group>
    <mesh position={wallPosition} name="office-wall" userData={{ cameraWall: true }} castShadow receiveShadow>
      <boxGeometry args={[size[0], height, size[2]]} />
      <meshStandardMaterial color="#dce8e5" roughness={0.85} />
    </mesh>
    <mesh position={[position[0], 0.1, position[2]]} receiveShadow>
      <boxGeometry args={[size[0] + 0.015, 0.2, size[2] + 0.015]} />
      <meshStandardMaterial color="#607d7d" roughness={0.8} />
    </mesh>
    </group>
  );
}

const projected = new Vector3();

function PlaceLabel({
  title,
  y,
  brass = false,
}: {
  title: string;
  y: number;
  brass?: boolean;
}) {
  return (
    <ProjectedLabel
      position={[0, y, 0]}
      lines={[{ text: title, kind: brass ? "brass" : "pill" }]}
    />
  );
}

function ProjectedLabel({
  position,
  lines,
}: {
  position: [number, number, number];
  lines: { text: string; kind: "kicker" | "title" | "meta" | "pill" | "brass" }[];
}) {
  const anchor = useRef<Group>(null);
  const card = useRef<HTMLDivElement | null>(null);
  const { camera, size, gl, scene } = useThree();
  const labelWorld = useRef(new Vector3());
  const labelDirection = useRef(new Vector3());
  const labelRay = useRef(new Raycaster());
  const linesKey = lines.map((line) => `${line.kind}:${line.text}`).join("|");

  useEffect(() => {
    const parent = gl.domElement.parentElement;
    const content = lines;
    if (!parent) return;
    const node = document.createElement("div");
    node.style.position = "absolute";
    node.style.top = "0";
    node.style.left = "0";
    node.style.pointerEvents = "none";
    if (content.length > 1) {
      node.style.width = content.length > 3 ? "12rem" : "10rem";
      node.style.lineHeight = "1.5";
      node.style.display = "grid";
      node.style.gap = "3px";
      node.style.border = "1px solid #e4d5c4";
      node.style.borderRadius = "12px";
      node.style.background = "rgba(255, 250, 244, 0.95)";
      node.style.padding = "9px 12px";
      node.style.textAlign = "center";
      node.style.boxShadow = "0 8px 20px rgba(36, 28, 22, 0.16)";
    }
    for (const line of content) {
      const row = document.createElement("div");
      row.textContent = line.text;
      if (line.kind === "kicker" || line.kind === "meta") {
        row.style.fontSize = "10px";
        row.style.letterSpacing = line.kind === "kicker" ? "0.1em" : "normal";
        row.style.overflowWrap = "anywhere";
        row.style.textTransform = line.kind === "kicker" ? "uppercase" : "none";
        row.style.color = "#657575";
      } else if (line.kind === "title") {
        row.style.fontSize = "12px";
        row.style.fontWeight = "600";
        row.style.color = "#241c16";
        row.style.overflow = "hidden";
        row.style.textOverflow = "ellipsis";
        row.style.whiteSpace = "nowrap";
      } else if (line.kind === "brass") {
        row.style.borderRadius = "999px";
        row.style.background = "#1e3d34";
        row.style.color = "#f3e0b8";
        row.style.fontSize = "11px";
        row.style.fontWeight = "700";
        row.style.letterSpacing = "0.18em";
        row.style.textTransform = "uppercase";
        row.style.padding = "4px 12px";
      } else {
        row.style.maxWidth = "10rem";
        row.style.overflow = "hidden";
        row.style.textOverflow = "ellipsis";
        row.style.whiteSpace = "nowrap";
        row.style.borderRadius = "999px";
        row.style.background = "rgba(255, 250, 244, 0.95)";
        row.style.color = "#241c16";
        row.style.fontSize = "11px";
        row.style.fontWeight = "600";
        row.style.padding = "4px 12px";
        row.style.boxShadow = "0 6px 16px rgba(36, 28, 22, 0.12)";
      }
      node.appendChild(row);
    }
    parent.appendChild(node);
    card.current = node;
    return () => {
      card.current = null;
      node.remove();
    };
  }, [gl, lines, linesKey]);

  useFrame(() => {
    const node = card.current;
    const anchorGroup = anchor.current;
    if (!node || !anchorGroup) return;
    anchorGroup.getWorldPosition(labelWorld.current);
    projected.copy(labelWorld.current).project(camera);
    const x = (projected.x * 0.5 + 0.5) * size.width;
    const y = (-projected.y * 0.5 + 0.5) * size.height;
    let visible =
      projected.z > -1 && projected.z < 1 && x > -80 && x < size.width + 80 && y > -40 && y < size.height + 40;
    if (visible) {
      labelDirection.current.copy(labelWorld.current).sub(camera.position);
      labelRay.current.far = Math.max(0, labelDirection.current.length() - 0.1);
      labelRay.current.set(camera.position, labelDirection.current.normalize());
      visible = labelRay.current.intersectObjects(scene.getObjectsByProperty("name", "office-wall"), false).length === 0;
    }
    node.style.display = visible ? "grid" : "none";
    node.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
  });

  return <group ref={anchor} position={position} />;
}
