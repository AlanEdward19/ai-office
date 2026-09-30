"use client";

import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, type ComponentRef } from "react";
import { MOUSE, OrthographicCamera, TOUCH, Vector3, type Group } from "three";

import { STATUS_LABELS, type AgentStatus } from "@/domain/agent-event";
import { ELEVATOR, type FloorId } from "@/domain/floors";
import { PROVIDER_LABELS } from "@/domain/providers";
import { localWingPlate, type PlacedAgent } from "@/domain/placement";
import { CEO_CORNER, RECEPTION, roomColor, type PlacedRoom } from "@/domain/rooms";

const STATUS_COLOR: Record<AgentStatus, string> = {
  idle: "#8d8276",
  working: "#e0a106",
  blocked: "#b42318",
  done: "#1f7a4d",
};

const POLAR = Math.atan2(Math.hypot(20, 20), 22);

export function isoZoom(width: number, height: number) {
  const shortest = Math.min(width, height);
  if (shortest < 720) return Math.max(16, shortest / 22);
  return Math.max(32, shortest / 18);
}

export function OfficeScene({
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
  localOffline,
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
  localOffline: boolean;
  resetSignal: number;
}) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  useEffect(() => {
    const fit = () => {
      const orbit = controls.current;
      const camera = orbit?.object;
      if (!(camera instanceof OrthographicCamera)) return;
      camera.position.set(20, 22, 20);
      camera.zoom = isoZoom(window.innerWidth, window.innerHeight);
      camera.lookAt(0, 0, -1);
      camera.updateProjectionMatrix();
      orbit?.target.set(0, 0, -1);
      orbit?.update();
    };
    if (resetSignal > 0) fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
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
      {floor === "ground" ? (
        <>
          <LobbyFloor />
          <LocalWing offline={localOffline} />
          <Reception />
          <CeoCorner />
          {rooms.map((room) => (
            <ProjectRoom
              key={room.id}
              room={room}
              open={room.id === openRoomId}
              onOpen={() => onSelectRoom(room.id)}
            />
          ))}
          {agents.map((agent) => (
            <DeskAgent
              key={agent.id}
              agent={agent}
              selected={agent.id === selectedId}
              dropArmed={dropArmed}
              localOffline={localOffline}
              onSelect={() => onSelectAgent(agent.id)}
            />
          ))}
        </>
      ) : (
        <HrFloor onHire={onHire} />
      )}
      <Elevator onRide={onRideElevator} />
      <OrbitControls
        ref={controls}
        makeDefault
        target={[0, 0, -1]}
        enableRotate={false}
        minPolarAngle={POLAR}
        maxPolarAngle={POLAR}
        minAzimuthAngle={Math.PI / 4}
        maxAzimuthAngle={Math.PI / 4}
        minZoom={14}
        maxZoom={80}
        enableDamping
        dampingFactor={0.12}
        mouseButtons={{
          LEFT: MOUSE.PAN,
          MIDDLE: MOUSE.DOLLY,
          RIGHT: MOUSE.PAN,
        }}
        touches={{
          ONE: TOUCH.PAN,
          TWO: TOUCH.DOLLY_PAN,
        }}
      />
    </>
  );
}

function Elevator({ onRide }: { onRide: () => void }) {
  return (
    <group position={[ELEVATOR.x, 0, ELEVATOR.z]}>
      <mesh position={[0, 0.7, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.7, 1.4, 1.7]} />
        <meshStandardMaterial color="#4a4038" roughness={0.7} />
      </mesh>
      <mesh
        position={[0, 0.72, 0.82]}
        onClick={(event) => {
          event.stopPropagation();
          onRide();
        }}
      >
        <boxGeometry args={[0.9, 1.15, 0.08]} />
        <meshStandardMaterial color="#d4b483" metalness={0.45} roughness={0.35} />
      </mesh>
      <PlaceLabel title="Elevador" y={1.85} brass />
    </group>
  );
}

function HrFloor({ onHire }: { onHire: () => void }) {
  return (
    <group>
      <mesh position={[0, -0.08, 0]} receiveShadow>
        <boxGeometry args={[18.4, 0.16, 12.4]} />
        <meshStandardMaterial color="#6e7c74" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.01, 0]} receiveShadow>
        <boxGeometry args={[17.6, 0.08, 11.6]} />
        <meshStandardMaterial color="#e7f0ea" roughness={0.9} />
      </mesh>
      <group position={[-1.4, 0, -0.2]}>
        <mesh position={[0, 0.04, 0]} receiveShadow>
          <boxGeometry args={[6.2, 0.05, 4.4]} />
          <meshStandardMaterial color="#1d3b34" roughness={0.9} />
        </mesh>
        <mesh
          position={[0, 0.46, 0.35]}
          castShadow
          receiveShadow
          onClick={(event) => {
            event.stopPropagation();
            onHire();
          }}
        >
          <boxGeometry args={[2.4, 0.84, 1.05]} />
          <meshStandardMaterial color="#f7f1e8" roughness={0.62} />
        </mesh>
        <Chair position={[0, 0, -0.55]} color="#1a3330" />
        <Plant position={[2.3, 0, 1.2]} />
        <PlaceLabel title="RH" y={1.9} />
      </group>
    </group>
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

function LocalWing({ offline }: { offline: boolean }) {
  const plate = localWingPlate();
  return (
    <group position={[plate.x, 0, plate.z]}>
      <mesh position={[0, -0.02, 0]} receiveShadow>
        <boxGeometry args={[plate.width, 0.12, plate.depth]} />
        <meshStandardMaterial color="#243038" roughness={0.86} />
      </mesh>
      <mesh position={[0, 0.05, 0]} receiveShadow>
        <boxGeometry args={[plate.width - 0.28, 0.06, plate.depth - 0.28]} />
        <meshStandardMaterial color="#d5e0e8" roughness={0.9} />
      </mesh>
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

function ProjectRoom({
  room,
  open,
  onOpen,
}: {
  room: PlacedRoom;
  open: boolean;
  onOpen: () => void;
}) {
  const width = 4.05;
  const depth = 4.4;
  return (
    <group position={[room.x, 0, room.z]}>
      <mesh
        position={[0, 0.02, 0]}
        receiveShadow
        onClick={(event) => {
          event.stopPropagation();
          onOpen();
        }}
      >
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
      <mesh
        position={[0, 0.95, -depth / 2 + 0.1]}
        castShadow
        onClick={(event) => {
          event.stopPropagation();
          onOpen();
        }}
      >
        <boxGeometry args={[2.35, 1.2, 0.08]} />
        <meshStandardMaterial color={open ? "#f3d48a" : "#f7f1e8"} roughness={0.55} />
      </mesh>
      <PlaceLabel title={room.name} y={2.15} />
    </group>
  );
}

function DeskAgent({
  agent,
  selected,
  dropArmed,
  localOffline,
  onSelect,
}: {
  agent: PlacedAgent;
  selected: boolean;
  dropArmed: boolean;
  localOffline: boolean;
  onSelect: () => void;
}) {
  const local = agent.event.origin === "local";
  const company = agent.form
    ? PROVIDER_LABELS[agent.form.provider]
    : PROVIDER_LABELS[agent.event.provider];
  const role = agent.form?.role;
  const lines = local
    ? [
        { text: "Local", kind: "kicker" as const },
        { text: company, kind: "title" as const },
        {
          text: localOffline
            ? `${agent.event.owner} · máquina offline`
            : `${agent.event.owner} · ${STATUS_LABELS[agent.event.status]}`,
          kind: "meta" as const,
        },
      ]
    : [
        { text: company, kind: "kicker" as const },
        { text: role ?? "Nuvem", kind: "title" as const },
        { text: STATUS_LABELS[agent.event.status], kind: "meta" as const },
      ];
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
          color={local ? (selected ? "#5c6b78" : "#3e4c59") : selected ? "#f7f1e8" : "#efe2d2"}
          roughness={0.7}
        />
      </mesh>
      <mesh position={[0, 0.78, 0.15]}>
        <boxGeometry args={[1.42, 0.06, 0.78]} />
        <meshStandardMaterial color={local ? "#d4b483" : "#d8c3a5"} metalness={local ? 0.35 : 0} />
      </mesh>
      <mesh position={[0.48, 0.86, 0.15]}>
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
      <ProjectedLabel position={[0, 1.85, 0]} lines={lines} />
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
      <mesh position={[0, 0.72, 0]} castShadow>
        <capsuleGeometry args={[0.16, 0.42, 6, 12]} />
        <meshStandardMaterial color={STATUS_COLOR[status]} roughness={0.55} />
      </mesh>
      <mesh position={[0, 1.18, 0]} castShadow>
        <sphereGeometry args={[0.16, 20, 20]} />
        <meshStandardMaterial color="#f3d5bf" roughness={0.6} />
      </mesh>
      {local ? (
        <mesh position={[0.2, 1.02, 0.12]} castShadow name="local-badge">
          <boxGeometry args={[0.16, 0.11, 0.04]} />
          <meshStandardMaterial color="#d4b483" metalness={0.45} roughness={0.32} />
        </mesh>
      ) : null}
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
  const { camera, size, gl } = useThree();
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
      node.style.width = "9rem";
      node.style.border = "1px solid #e4d5c4";
      node.style.borderRadius = "12px";
      node.style.background = "rgba(255, 250, 244, 0.95)";
      node.style.padding = "6px 8px";
      node.style.textAlign = "center";
      node.style.boxShadow = "0 8px 20px rgba(36, 28, 22, 0.16)";
    }
    for (const line of content) {
      const row = document.createElement("div");
      row.textContent = line.text;
      if (line.kind === "kicker" || line.kind === "meta") {
        row.style.fontSize = "10px";
        row.style.letterSpacing = "0.14em";
        row.style.textTransform = "uppercase";
        row.style.color = "#8c7b6b";
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
    anchorGroup.getWorldPosition(projected);
    projected.project(camera);
    const x = (projected.x * 0.5 + 0.5) * size.width;
    const y = (-projected.y * 0.5 + 0.5) * size.height;
    const visible =
      projected.z < 1 && x > -80 && x < size.width + 80 && y > -40 && y < size.height + 40;
    node.style.display = visible ? "block" : "none";
    node.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
  });

  return <group ref={anchor} position={position} />;
}
