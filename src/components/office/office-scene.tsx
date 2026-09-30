"use client";

import { Html, OrbitControls } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, type ComponentRef } from "react";
import { OrthographicCamera, type Group } from "three";

import { STATUS_LABELS, type AgentStatus } from "@/domain/agent-event";
import { PROVIDER_LABELS } from "@/domain/providers";
import type { PlacedAgent } from "@/domain/placement";
import { CEO_CORNER, RECEPTION, roomColor, type PlacedRoom } from "@/domain/rooms";

const STATUS_COLOR: Record<AgentStatus, string> = {
  idle: "#8d8276",
  working: "#e0a106",
  blocked: "#b42318",
  done: "#1f7a4d",
};

const POLAR = Math.atan2(Math.hypot(20, 20), 22);

export function OfficeScene({
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
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  useEffect(() => {
    if (resetSignal === 0) return;
    const orbit = controls.current;
    const camera = orbit?.object;
    if (camera instanceof OrthographicCamera) {
      camera.position.set(20, 22, 20);
      camera.zoom = Math.max(28, Math.min(window.innerWidth, window.innerHeight) / 16);
      camera.lookAt(0, 0, -1);
      camera.updateProjectionMatrix();
    }
    orbit?.target.set(0, 0, -1);
    orbit?.update();
  }, [resetSignal]);

  return (
    <>
      <color attach="background" args={["#241c16"]} />
      <ambientLight intensity={0.72} />
      <hemisphereLight args={["#f7f1e8", "#8d6a45", 0.38]} />
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
      <Table />
      <LobbyFloor />
      <Reception />
      <CeoCorner />
      {rooms.map((room) => (
        <ProjectRoom key={room.id} room={room} />
      ))}
      {agents.map((agent) => (
        <DeskAgent
          key={agent.id}
          agent={agent}
          selected={agent.id === selectedId}
          onSelect={() => onSelectAgent(agent.id)}
        />
      ))}
      <OrbitControls
        ref={controls}
        makeDefault
        target={[0, 0, -1]}
        enableRotate={false}
        minPolarAngle={POLAR}
        maxPolarAngle={POLAR}
        minAzimuthAngle={Math.PI / 4}
        maxAzimuthAngle={Math.PI / 4}
        minZoom={20}
        maxZoom={80}
        enableDamping
        dampingFactor={0.12}
      />
    </>
  );
}

function Table() {
  return (
    <mesh position={[0, -0.46, -2]} receiveShadow>
      <boxGeometry args={[42, 0.4, 36]} />
      <meshStandardMaterial color="#2a211b" roughness={0.92} />
    </mesh>
  );
}

function LobbyFloor() {
  return (
    <group>
      <mesh position={[0, -0.08, 0]} receiveShadow>
        <boxGeometry args={[18.4, 0.16, 12.4]} />
        <meshStandardMaterial color="#b08968" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.01, 0]} receiveShadow>
        <boxGeometry args={[17.6, 0.08, 11.6]} />
        <meshStandardMaterial color="#f3e7d6" roughness={0.86} />
      </mesh>
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
      <mesh position={[0, 0.42, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.1, 0.84, 0.9]} />
        <meshStandardMaterial color="#7c3a2d" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.88, 0]} castShadow>
        <boxGeometry args={[3.3, 0.08, 1.05]} />
        <meshStandardMaterial color="#f7f1e8" roughness={0.45} />
      </mesh>
      <Plant position={[1.35, 0, 0.85]} />
      <PlaceLabel title="Recepção" y={1.7} />
    </group>
  );
}

function CeoCorner() {
  return (
    <group position={[CEO_CORNER.x, 0, CEO_CORNER.z]}>
      <mesh position={[0, 0.04, 0]} receiveShadow>
        <boxGeometry args={[4.4, 0.04, 3.6]} />
        <meshStandardMaterial color="#16382f" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.46, -0.85]} castShadow receiveShadow>
        <boxGeometry args={[2.3, 0.84, 1.05]} />
        <meshStandardMaterial color="#1e3d34" roughness={0.62} />
      </mesh>
      <mesh position={[0, 0.9, -0.85]}>
        <boxGeometry args={[2.45, 0.08, 1.18]} />
        <meshStandardMaterial color="#d4b483" metalness={0.35} roughness={0.4} />
      </mesh>
      <Chair position={[0, 0, -0.15]} color="#102820" />
      <mesh position={[1.55, 0.7, -1.35]} castShadow>
        <boxGeometry args={[0.08, 1.4, 2.2]} />
        <meshStandardMaterial color="#f6f0e6" />
      </mesh>
      <PlaceLabel title="CEO" y={2.05} brass />
    </group>
  );
}

function ProjectRoom({ room }: { room: PlacedRoom }) {
  const width = 4.05;
  const depth = 4.4;
  return (
    <group position={[room.x, 0, room.z]}>
      <mesh position={[0, 0.02, 0]} receiveShadow>
        <boxGeometry args={[width, 0.06, depth]} />
        <meshStandardMaterial color={roomColor(room.id)} roughness={0.88} />
      </mesh>
      <Wall position={[0, 0.62, -depth / 2]} size={[width, 1.2, 0.08]} />
      <Wall position={[-width / 2, 0.62, 0]} size={[0.08, 1.2, depth]} />
      <Wall position={[width / 2, 0.62, 0]} size={[0.08, 1.2, depth]} />
      <Wall position={[-1.15, 0.62, depth / 2]} size={[1.5, 1.2, 0.08]} />
      <Wall position={[1.15, 0.62, depth / 2]} size={[1.5, 1.2, 0.08]} />
      <mesh position={[0, 0.42, 0.4]} castShadow>
        <boxGeometry args={[1.15, 0.7, 0.62]} />
        <meshStandardMaterial color="#f7f1e8" />
      </mesh>
      <PlaceLabel title={room.name} y={1.85} />
    </group>
  );
}

function DeskAgent({
  agent,
  selected,
  onSelect,
}: {
  agent: PlacedAgent;
  selected: boolean;
  onSelect: () => void;
}) {
  const company = agent.form
    ? PROVIDER_LABELS[agent.form.provider]
    : PROVIDER_LABELS[agent.event.provider];
  const role = agent.form?.role;
  return (
    <group position={[agent.x, 0, agent.z]}>
      <mesh
        position={[0, 0.4, 0.15]}
        castShadow
        receiveShadow
        onClick={(event) => {
          event.stopPropagation();
          onSelect();
        }}
      >
        <boxGeometry args={[1.35, 0.72, 0.7]} />
        <meshStandardMaterial
          color={selected ? "#f7f1e8" : "#efe2d2"}
          roughness={0.7}
        />
      </mesh>
      <mesh position={[0, 0.78, 0.15]}>
        <boxGeometry args={[1.42, 0.06, 0.78]} />
        <meshStandardMaterial color="#d8c3a5" />
      </mesh>
      <mesh position={[0.48, 0.86, 0.15]}>
        <sphereGeometry args={[0.07, 16, 16]} />
        <meshStandardMaterial
          color={STATUS_COLOR[agent.event.status]}
          emissive={STATUS_COLOR[agent.event.status]}
          emissiveIntensity={agent.event.status === "working" ? 0.6 : 0.15}
        />
      </mesh>
      <Chair position={[0, 0, -0.55]} color="#5c4636" />
      <AgentFigure status={agent.event.status} />
      {selected ? (
        <mesh position={[0, 0.03, 0.1]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.85, 0.96, 40]} />
          <meshStandardMaterial color="#d4b483" />
        </mesh>
      ) : null}
      <Html position={[0, 1.85, 0]} center distanceFactor={11} zIndexRange={[20, 0]}>
        <div className="pointer-events-none w-36 rounded-xl border border-[#e4d5c4] bg-[#fffaf4]/95 px-2.5 py-1.5 text-center shadow-lg">
          <p className="text-[10px] tracking-[0.14em] text-[#8c7b6b] uppercase">
            {company}
          </p>
          {role ? (
            <p className="truncate text-xs font-medium text-[#241c16]">{role}</p>
          ) : (
            <p className="text-xs text-[#241c16]">Nuvem</p>
          )}
          <p className="text-[10px] text-[#8c7b6b]">
            {STATUS_LABELS[agent.event.status]}
          </p>
        </div>
      </Html>
    </group>
  );
}

function AgentFigure({ status }: { status: AgentStatus }) {
  const ref = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.position.y =
      status === "working" ? Math.sin(clock.elapsedTime * 3.2) * 0.05 : 0;
  });
  return (
    <group ref={ref} position={[0, 0, -0.15]}>
      <mesh position={[0, 0.72, 0]} castShadow>
        <capsuleGeometry args={[0.16, 0.42, 6, 12]} />
        <meshStandardMaterial color={STATUS_COLOR[status]} roughness={0.55} />
      </mesh>
      <mesh position={[0, 1.18, 0]} castShadow>
        <sphereGeometry args={[0.16, 20, 20]} />
        <meshStandardMaterial color="#f3d5bf" roughness={0.6} />
      </mesh>
    </group>
  );
}

function Chair({ position, color }: { position: [number, number, number]; color: string }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.28, 0]} castShadow>
        <boxGeometry args={[0.42, 0.08, 0.42]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 0.58, -0.17]} castShadow>
        <boxGeometry args={[0.42, 0.52, 0.08]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}

function Plant({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.16, 0]} castShadow>
        <cylinderGeometry args={[0.14, 0.12, 0.22, 16]} />
        <meshStandardMaterial color="#f4efe6" />
      </mesh>
      <mesh position={[0, 0.42, 0]} castShadow>
        <sphereGeometry args={[0.24, 16, 16]} />
        <meshStandardMaterial color="#2f6b45" roughness={0.8} />
      </mesh>
    </group>
  );
}

function Wall({
  position,
  size,
}: {
  position: [number, number, number];
  size: [number, number, number];
}) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color="#f7f1e8" roughness={0.9} />
    </mesh>
  );
}

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
    <Html position={[0, y, 0]} center distanceFactor={12} zIndexRange={[10, 0]}>
      <div
        className={
          brass
            ? "pointer-events-none rounded-full bg-[#1e3d34] px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-[#f3e0b8] uppercase shadow-md"
            : "pointer-events-none max-w-40 truncate rounded-full bg-[#fffaf4]/95 px-3 py-1 text-[11px] font-medium text-[#241c16] shadow-md"
        }
      >
        {title}
      </div>
    </Html>
  );
}
