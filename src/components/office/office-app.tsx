"use client";

import type { CameraMode } from "@/domain/camera";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { isAgentEvent, STATUS_LABELS, type AgentEvent } from "@/domain/agent-event";
import { isMachinePresence, presentLocalEvent, type MachinePresence } from "@/domain/local-hooks";
import { claudeCloudStartedCopy } from "@/domain/claude-cloud";
import {
  applyClaudeCloudLabels,
  parseClaudeCloudReport,
  placedStatusText,
  type ClaudeCloudReport,
} from "@/domain/claude-cloud-status";
import {
  decideDrop,
  preferredCursorDeskId,
  refusalCopy,
  serverDispatchCopy,
} from "@/domain/dispatch";
import { FLOOR_LABELS, rideElevator, type FloorId } from "@/domain/floors";
import { issuesForProject, mergeRoomIssues, type RoomIssue } from "@/domain/issues";
import type { JobForm } from "@/domain/job-form";
import { agentPlaceLabel, localAgentOffline } from "@/domain/office-machines";
import { readSharedScene, type OfficeRole, type SharedScene } from "@/domain/office-share";
import { projectsWithoutRooms, roomsFromBindings } from "@/domain/opened-rooms";
import { admitHire } from "@/domain/hire-admission";
import { bindAgents, bindLocalWing, localWingOverflow, cloudDeskOverflow, type PlacedAgent } from "@/domain/placement";
import { isProviderId, PROVIDER_LABELS, type ProviderId } from "@/domain/providers";
import { layoutRooms, type LinearProject, type PlacedRoom } from "@/domain/rooms";
import { LOBBY_SPAWN, type InteractTarget, type Pose } from "@/domain/walker";
import { JobFormCard } from "@/components/hiring/job-form-card";
import {
  JobFormDialog,
  type HiringProvider,
} from "@/components/hiring/job-form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BoardPanel, type BoardState } from "./board-panel";
import { type PresenceRoster, OfficeCall } from "./office-call";
import { deskStore } from "./desk-store";
import { dispatchStore } from "./dispatch-store";
import { DEFAULT_APPEARANCE, type Gesture } from "@/domain/character";
import { SceneBoundary } from "./scene-boundary";
import {useOfficeRoutines} from "./use-office-routines";
import {createAgentRoutines,type RoutineVisual,type RoutineResult} from "@/domain/agent-routines";
import { AgentPanel } from "./agent-panel";
import { agentProfileStore } from "./agent-profile-store";
import { LocalDeskLink } from "./local-desk-link";
import { OfficeHud } from "./office-hud";
import { CharacterCreator } from "./character-creator";
import { OpenRoomDialog } from "./open-room-dialog";
import { roomStore } from "./room-store";

const OfficeCanvas = dynamic(() => new Promise<typeof import("./office-canvas")>((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("Tempo limite ao carregar a cena.")), 20000);
  import("./office-canvas").then(resolve, reject).finally(() => clearTimeout(timer));
}), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center text-sm text-[#d9cbb8]">
      Abrindo o andar…
    </div>
  ),
});

type ProjectsState =
  | { status: "loading" }
  | { status: "ready"; projects: LinearProject[]; viewerName: string | null }
  | { status: "missing_key" }
  | { status: "error" };

type SessionState = { role: OfficeRole; name: string };

const ISSUE_COPY: Record<string, string> = {
  missing_key: "Defina LINEAR_API_KEY nesta máquina para ver o quadro.",
  unauthorized: "A chave do Linear foi recusada. Ela fica só nesta máquina.",
  not_found: "Esse projeto não está no Linear.",
  unavailable: "Não foi possível ler as issues deste projeto.",
  without_team: "Esse projeto não tem um time no Linear, então o card não foi criado.",
  wrong_project: "O card não ficou neste projeto e não entrou no quadro.",
  title_required: "Escreva o card antes de criar.",
  missing_project: "A sala não tem um projeto.",
  read_only: "Quem só olha não cria card.",
};

const SIGN_IN_COPY: Record<string, string> = {
  same_person: "Esse nome é de quem está nesta máquina. Quem olha entra com outro nome.",
  host_taken: "Já tem alguém publicando nesta máquina.",
  name_required: "Escreva seu nome.",
};

const NO_PROJECTS: LinearProject[] = [];

const PROJECT_COPY: Record<Exclude<ProjectsState["status"], "ready" | "loading">, string> = {
  missing_key:
    "Defina LINEAR_API_KEY nesta máquina para escolher um projeto e abrir a sala. A recepção e o canto do CEO já estão no térreo.",
  error: "Não foi possível ler os projetos do Linear. O lobby continua no lugar.",
};

export function OfficeApp() {
  const profileSnapshot = useSyncExternalStore(agentProfileStore.subscribe, agentProfileStore.getSnapshot, agentProfileStore.getServerSnapshot);
  const profiles = useMemo(() => agentProfileStore.profilesFrom(profileSnapshot), [profileSnapshot]);
  const [session, setSession] = useState<SessionState | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [machineName, setMachineName] = useState("");
  const [signInError, setSignInError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [colleagueName, setColleagueName] = useState("");
  const [lanUrls, setLanUrls] = useState<string[]>([]);
  const [shared, setShared] = useState<SharedScene | null>(null);
  const [linked, setLinked] = useState(false);
  const [shareBump, setShareBump] = useState(0);
  const shareSeq = useRef(0);
  const shareRetries = useRef(0);
  const [projectsState, setProjectsState] = useState<ProjectsState>({ status: "loading" });
  const [reloadToken, setReloadToken] = useState(0);
  const deskSnapshot = useSyncExternalStore(
    deskStore.subscribe,
    deskStore.getSnapshot,
    deskStore.getServerSnapshot,
  );
  const desks = useMemo(() => deskStore.desksFrom(deskSnapshot), [deskSnapshot]);
  const [observed, setObserved] = useState<AgentEvent | null>(null);
  const [claudeReport, setClaudeReport] = useState<ClaudeCloudReport | null>(null);
  const [notice, setNotice] = useState("A página ainda não está observando.");
  const [localEvents, setLocalEvents] = useState<{
    cursor: AgentEvent | null;
    anthropic: AgentEvent | null;
    openai: AgentEvent | null;
  }>({ cursor: null, anthropic: null, openai: null });
  const [presence, setPresence] = useState<MachinePresence | null>(null);
  const [localLink, setLocalLink] = useState<"connecting" | "online" | "offline">("offline");
  const [localNotice, setLocalNotice] = useState("");
  const localOnlineRef = useRef(false);
  const [cameraMode, setCameraMode] = useState<CameraMode>("third");
  const [zoom, setZoom] = useState(1.25);
  const [gesture, setGesture] = useState<{kind: Gesture; stamp: number} | null>(null);
  const [appearance, setAppearance] = useState(DEFAULT_APPEARANCE);
  const [characterOpen, setCharacterOpen] = useState(false);
  const [floor, setFloor] = useState<FloorId>("ground");
  const [roomDialogOpen, setRoomDialogOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formSession, setFormSession] = useState(0);
  const confirmedHire=useRef(-1);
  const [providers, setProviders] = useState<HiringProvider[]>([]);
  const [providersLoading, setProvidersLoading] = useState(false);
  const [providersError, setProvidersError] = useState<string | null>(null);
  const [openRoomId, setOpenRoomId] = useState<string | null>(null);
  const [boardToken, setBoardToken] = useState(0);
  const [board, setBoard] = useState<BoardState>({ status: "loading" });
  const [creatingCard, setCreatingCard] = useState(false);
  const [boardMessage, setBoardMessage] = useState<string | null>(null);
  const [carried, setCarried] = useState<RoomIssue | null>(null);
  const [selectedTab,setSelectedTab]=useState<"activity"|"messages"|"history">("activity");
  const [routineVisuals,setRoutineVisuals]=useState<RoutineVisual[]>([]);
  const [routineNotice,setRoutineNotice]=useState<string|null>(null);
  const [newHire,setNewHire]=useState<{id:string;stamp:number}|null>(null);
  const routineEngine=useMemo(()=>createAgentRoutines(),[]);
  const [selectedDeskId, setSelectedDeskId] = useState<string | null>(null);
  const [nearby, setNearby] = useState<InteractTarget | null>(null);
  const [pose, setPose] = useState<Pose>(LOBBY_SPAWN);
  const [humanPresence, setHumanPresence] = useState<PresenceRoster | null>(null);
  const [inviteTarget, setInviteTarget] = useState<{id:string;stamp:number}|null>(null);
  const [correction, setCorrection] = useState<{pose:Pose;stamp:number}|null>(null);
  const clearInvite = useCallback(() => setInviteTarget(null), []);
  const correctPose = useCallback((next:Pose) => { setPose(next); setCorrection({pose:next,stamp:Date.now()}); }, []);
  const invitePerson = useCallback((id:string) => setInviteTarget({id,stamp:Date.now()}), []);
  const dispatchSnapshot = useSyncExternalStore(
    dispatchStore.subscribe,
    dispatchStore.getSnapshot,
    dispatchStore.getServerSnapshot,
  );
  const dispatches = useMemo(
    () => dispatchStore.recordsFrom(dispatchSnapshot),
    [dispatchSnapshot],
  );
  const roomSnapshot = useSyncExternalStore(
    roomStore.subscribe,
    roomStore.getSnapshot,
    roomStore.getServerSnapshot,
  );
  const openedRoomIds = useMemo(() => roomStore.idsFrom(roomSnapshot), [roomSnapshot]);
  const host = session?.role === "host";
  const canAct = session?.role === "host" || session?.role === "interact";
  const routineControl=useOfficeRoutines(host,floor);
  const onRoutines=useCallback((visuals:RoutineVisual[])=>setRoutineVisuals(visuals),[]);
  const onRoutineResult=useCallback((result:RoutineResult)=>{setRoutineNotice(result.message);if(result.status==='arrived'&&result.target==='user'){setSelectedTab('messages');setSelectedDeskId(result.agentId);}},[]);
  const approachAgent=async(id:string,targetId:string|null=null)=>{if(await routineControl.approach(id,targetId)){setSelectedDeskId(null);setRoutineNotice(targetId?'Agente a caminho do interlocutor…':'Agente a caminho. Você pode continuar caminhando.');}};

  const onNearby = useCallback((target: InteractTarget | null) => {
    setNearby(target);
  }, []);
  const roomsForPose = useRef<PlacedRoom[]>([]);
  const onPose = useCallback((next: Pose) => {
    setPose((current) => {
      if (
        Math.abs(current.x - next.x) < 0.05 &&
        Math.abs(current.z - next.z) < 0.05 &&
        Math.abs(current.yaw - next.yaw) < 0.04
      ) {
        return current;
      }
      return next;
    });
    setOpenRoomId((openId) => {
      if (!openId) return openId;
      const room = roomsForPose.current.find((item) => item.id === openId);
      if (!room) return openId;
      const dist = Math.hypot(next.x - room.x, next.z - (room.z - 1.35));
      return dist > 3.4 ? null : openId;
    });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/office/session", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return;
        const body = (await response.json()) as { role?: unknown; name?: unknown };
        const role = body.role === "colleague" ? "observer" : body.role;
        if ((role === "host" || role === "interact" || role === "observer") && typeof body.name === "string") {
          setSession({ role, name: body.name });
        }
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
      })
      .finally(() => {
        if (!controller.signal.aborted) setSessionReady(true);
      });
    void fetch("/api/office/lan", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = (await response.json()) as { urls?: unknown };
        if (Array.isArray(body.urls)) {
          setLanUrls(body.urls.filter((url): url is string => typeof url === "string"));
        }
      })
      .catch(() => undefined);
    void fetch("/api/whoami", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = (await response.json()) as { name?: unknown };
        if (typeof body.name === "string" && body.name.trim()) setMachineName(body.name.trim());
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);



  const onOfficeEvent = useCallback((channel:string, parsed:unknown) => {
    if(channel==="claude-status"){const report=parseClaudeCloudReport(parsed);if(report)setClaudeReport(report);}
    else if (channel === "snapshot") {
      setShared(readSharedScene(parsed));
      setLinked(true);
    } else if (channel === "cloud-agent" && isAgentEvent(parsed)) {
      setObserved(parsed);
    } else if (channel === "local-agent" && isAgentEvent(parsed) && parsed.origin === "local") {
      const provider = parsed.provider;
      if (provider === "cursor" || provider === "anthropic" || provider === "openai") setLocalEvents(current => {
        const previous = current[provider];
        if (previous?.status === parsed.status && previous.owner === parsed.owner && previous.machineId === parsed.machineId) return current;
        return { ...current, [provider]: parsed };
      });
    } else if (channel === "local-presence" && isMachinePresence(parsed)) {
      localOnlineRef.current = parsed.online;
      setPresence(parsed);
      setLocalLink(parsed.online ? "online" : "offline");
      if (!parsed.online) setLocalEvents(current => ({cursor:current.cursor ? presentLocalEvent(current.cursor,false):null, anthropic:current.anthropic ? presentLocalEvent(current.anthropic,false):null,openai:current.openai ? presentLocalEvent(current.openai,false):null}));
    } else if (parsed && typeof parsed === "object" && "message" in parsed && typeof parsed.message === "string") {
      if (channel === "local-notice") setLocalNotice(parsed.message);
      if (channel === "cloud-notice") setNotice(parsed.message);
    }
  }, []);
  const onOfficeConnected = useCallback((connected:boolean) => {
    setLinked(connected);
    if (!connected) {
      localOnlineRef.current=false;
      setLocalLink("offline");
      setLocalEvents(current => ({cursor:current.cursor ? presentLocalEvent(current.cursor,false):null, anthropic:current.anthropic ? presentLocalEvent(current.anthropic,false):null,openai:current.openai ? presentLocalEvent(current.openai,false):null}));
    }
  }, []);

  useEffect(() => {
    if (!canAct) return;
    const controller = new AbortController();
    void fetch("/api/projects", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = (await response.json()) as {
          projects?: LinearProject[];
          viewerName?: string | null;
          error?: string | null;
        };
        if (body.error === "missing_key") {
          setProjectsState({ status: "missing_key" });
          return;
        }
        if (body.error) {
          setProjectsState({ status: "error" });
          return;
        }
        setProjectsState({
          status: "ready",
          projects: Array.isArray(body.projects) ? body.projects : [],
          viewerName: body.viewerName ?? null,
        });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setProjectsState({ status: "error" });
      });
    return () => controller.abort();
  }, [reloadToken, canAct]);

  useEffect(() => {
    if (!formOpen) return;
    const controller = new AbortController();
    void fetch("/api/providers", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("providers");
        const body = (await response.json()) as { providers?: HiringProvider[] };
        setProviders(Array.isArray(body.providers) ? body.providers : []);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setProviders([]);
        setProvidersError("Não foi possível ver os logins desta máquina.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setProvidersLoading(false);
      });
    return () => controller.abort();
  }, [formOpen]);

  useEffect(() => {
    if (!openRoomId || !session) return;
    const controller = new AbortController();
    const projectId = openRoomId;
    void fetch(`/api/issues?projectId=${encodeURIComponent(projectId)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = (await response.json()) as {
          projectId?: string;
          issues?: RoomIssue[];
          error?: string | null;
        };
        if (body.projectId && body.projectId !== projectId) {
          setBoard({ status: "error", message: "O quadro recebeu issues de outro projeto." });
          return;
        }
        if (body.error === "missing_key") {
          setBoard({ status: "missing_key" });
          return;
        }
        if (body.error) {
          setBoard({ status: "error", message: ISSUE_COPY[body.error] ?? ISSUE_COPY.unavailable });
          return;
        }
        setBoard({
          status: "ready",
          issues: mergeRoomIssues(issuesForProject(body.issues ?? [], projectId)),
        });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setBoard({ status: "error", message: ISSUE_COPY.unavailable });
      });
    return () => controller.abort();
  }, [openRoomId, boardToken, session]);

  useEffect(() => {
    if (!openRoomId) return;
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      setBoard({ status: "loading" });
      setBoardToken((value) => value + 1);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [openRoomId]);

  const viewerName = projectsState.status === "ready" ? projectsState.viewerName : null;
  const projects = projectsState.status === "ready" ? projectsState.projects : NO_PROJECTS;
  const unboundProjects = useMemo(
    () => projectsWithoutRooms(projects, openedRoomIds),
    [projects, openedRoomIds],
  );
  const rooms = useMemo(
    () => layoutRooms(roomsFromBindings(projects, openedRoomIds)),
    [projects, openedRoomIds],
  );
  const cloudAgents = useMemo(
    () =>
      applyClaudeCloudLabels(
        bindAgents({
          desks,
          observed,
          owner: viewerName || session?.name || "esta máquina",
          preferredDeskId: preferredCursorDeskId(dispatches),
        }),
        dispatches,
        claudeReport,
      ),
    [desks, observed, viewerName, session?.name, dispatches, claudeReport],
  );
  const localAgents = useMemo(
    () =>
      bindLocalWing({
        desks,
        observed: localEvents,
        owner: presence?.owner ?? "esta máquina",
        machineId: presence?.machineId ?? null,
        machineOnline: localLink === "online",
      }),
    [desks, localEvents, presence, localLink],
  );
  const overflow=localWingOverflow(desks,localEvents)+cloudDeskOverflow(desks,observed);
  const agents = useMemo(() => [...cloudAgents, ...localAgents].map(a => ({ ...a, displayName: profiles.find(p => p.agentId === a.id)?.name })), [cloudAgents, localAgents, profiles]);
  const viewRooms: PlacedRoom[] = useMemo(
    () => (shared ? shared.rooms : rooms),
    [rooms, shared],
  );
  const viewAgents = shared ? shared.agents : agents;
  const viewOffline = shared ? shared.localOffline : localLink !== "online";
  const currentRoom = viewRooms.find((room) => room.id === openRoomId) ?? null;
  const selectedDesk = viewAgents.find(agent => agent.id === selectedDeskId) ?? null;
  const nearAgent =
    nearby?.kind === "desk" ? (viewAgents.find((agent) => agent.id === nearby.id) ?? null) : null;

  useEffect(() => {
    if (!host || !linked || !session) return;
    const attempt = ++shareSeq.current;
    void fetch("/api/office", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hostName: session.name,
        hostTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        localOffline: localLink !== "online",
        rooms: rooms.map((room) => ({ id: room.id, name: room.name, x: room.x, z: room.z })),
        agents,
        routines:routineVisuals,
      }),
    })
      .then(async (response) => {
        if (attempt !== shareSeq.current) return;
        if (response.ok) {
          shareRetries.current = 0;
          return;
        }
        if (response.status === 409 && shareRetries.current < 5) {
          shareRetries.current += 1;
          window.setTimeout(() => setShareBump((value) => value + 1), 250);
        }
      })
      .catch(() => undefined);
  }, [host, linked, session, localLink, rooms, agents, routineVisuals, shareBump]);

  useEffect(() => {
    roomsForPose.current = viewRooms;
  }, [viewRooms]);

  useEffect(() => {
    if (!host || !shared) return;
    if (projectsState.status === "ready") {
      for (const room of shared.rooms) {
        if (!openedRoomIds.includes(room.id)) roomStore.bind(room.id, projects);
      }
    }
    for (const agent of shared.agents) {
      if (agent.event.origin !== "cloud" || !agent.form) continue;
      if (desks.some((desk) => desk.id === agent.id)) continue;
      deskStore.adopt({ id: agent.id, form: agent.form, createdAt: agent.event.observedAt });
    }
  }, [host, shared, projectsState.status, openedRoomIds, projects, desks]);

  function openForm() {
    if (!canAct) return;
    setProvidersLoading(true);
    setProvidersError(null);
    setFormSession((value) => value + 1);
    setFormOpen(true);
  }

  function saveDesk(form: JobForm) {
    if (session?.role === "interact") {
      void fetch("/api/office/desks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      }).then(async (response) => {
        if (response.ok) {
          setRoutineNotice("RH está trazendo a mesa e a cadeira para o novo posto.");
          setFloor("ground");
          setOpenRoomId(null);
          return;
        }
        const body = (await response.json()) as { error?: string };
        setRoutineNotice(body.error === "capacity" ? "Capacidade atingida: nove postos." : "Não foi possível contratar nesta máquina.");
      }).catch(() => setRoutineNotice("Não foi possível contratar nesta máquina."));
      return;
    }
    const desk=admitHire({form,session:formSession,confirmed:confirmedHire.current,desks,localEvents,observed},deskStore.add);
    confirmedHire.current=formSession;
    setNewHire({id:desk.id,stamp:Date.now()});
    setRoutineNotice("RH está trazendo a mesa e a cadeira para o novo posto.");
    setFloor("ground");
    setOpenRoomId(null);
  }

  function bindProjectRoom(projectId: string) {
    if (!canAct) return;
    if (session?.role === "interact") {
      void fetch("/api/office/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      }).then((response) => {
        if (!response.ok) return;
        setRoomDialogOpen(false);
        setFloor("ground");
      }).catch(() => undefined);
      return;
    }
    const result = roomStore.bind(projectId, projects);
    if (!result.ok) return;
    setRoomDialogOpen(false);
    setFloor("ground");
  }

  function openRoom(projectId: string) {
    setOpenRoomId(projectId);
    setBoard({ status: "loading" });
    setBoardMessage(null);
    setBoardToken((value) => value + 1);
  }

  function refreshBoard() {
    if (!openRoomId) return;
    setBoard({ status: "loading" });
    setBoardToken((value) => value + 1);
  }

  async function createCard(title: string) {
    if (!openRoomId || !canAct) return false;
    setCreatingCard(true);
    setBoardMessage(null);
    try {
      const response = await fetch("/api/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: openRoomId, title }),
      });
      const body = (await response.json()) as { issue?: RoomIssue | null; error?: string | null };
      const issue = body.issue;
      if (!issue || issue.projectId !== openRoomId) {
        setBoardMessage(ISSUE_COPY[body.error ?? "wrong_project"] ?? ISSUE_COPY.wrong_project);
        return false;
      }
      setBoard((current) => {
        const existing = current.status === "ready" ? current.issues : [];
        return {
          status: "ready",
          issues: mergeRoomIssues(issuesForProject([issue, ...existing], openRoomId)),
        };
      });
      setBoardMessage(`${issue.identifier} abriu no Linear neste projeto.`);
      return true;
    } catch {
      setBoardMessage(ISSUE_COPY.unavailable);
      return false;
    } finally {
      setCreatingCard(false);
    }
  }

  async function finishDrop(issue: RoomIssue | null, deskId: string | null) {
    if (!canAct) {
      setBoardMessage("Quem só olha não solta card nem inicia agente.");
      return;
    }
    if (!issue || !openRoomId || issue.projectId !== openRoomId) {
      setBoardMessage("Esse card não é do quadro desta sala.");
      return;
    }
    const desk = desks.find((item) => item.id === deskId) ?? null;
    const placed = viewAgents.find((item) => item.id === deskId) ?? null;
    if (!desk && placed?.event.origin === "local") {
      setBoardMessage("A ala local não recebe card. Solte na mesa da nuvem.");
      return;
    }
    const target = desk
      ? { id: desk.id, form: desk.form }
      : placed
        ? { id: placed.id, form: placed.form }
        : null;
    let loggedIn: ProviderId[] = [];
    try {
      const response = await fetch("/api/providers", { cache: "no-store" });
      if (!response.ok) throw new Error("providers");
      const body = (await response.json()) as { providers?: { id?: unknown }[] };
      loggedIn = Array.isArray(body.providers)
        ? body.providers.flatMap((item) => (isProviderId(item?.id) ? [item.id] : []))
        : [];
    } catch {
      setBoardMessage("Não foi possível ver os logins desta máquina.");
      return;
    }
    const decision = decideDrop({ desk: target, loggedIn });
    if (!decision.ok) {
      setBoardMessage(refusalCopy(decision.reason, decision.provider));
      return;
    }
    setBoardMessage(decision.provider === "anthropic" ? "Abrindo a sessão Claude na nuvem com o CLI desta máquina…" : `Iniciando ${PROVIDER_LABELS[decision.provider]} para esta issue…`);
    try {
      const response = await fetch("/api/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: issue.projectId,
          issueId: issue.id,
          provider: decision.provider,
          deskId: decision.deskId,
        }),
      });
      const body = (await response.json()) as {
        error?: string | null;
        dispatch?: {
          issueId: string;
          projectId: string;
          provider?: string;
          cursorAgentId: string | null;
          cursorAgentUrl: string | null;
          claudeSessionId: string | null;
          claudeSessionUrl: string | null;
          linked?: boolean;
        } | null;
      };
      const dispatched = body.dispatch;
      const started =
        dispatched?.provider === decision.provider &&
        dispatched.projectId === issue.projectId &&
        dispatched.issueId === issue.id &&
        (decision.provider === "cursor"
          ? Boolean(dispatched.cursorAgentId)
          : decision.provider === "anthropic" ? Boolean(dispatched.claudeSessionId && dispatched.claudeSessionUrl) : true);
      if (!dispatched || !started) {
        setBoardMessage(serverDispatchCopy(body.error ?? "unavailable", decision.provider));
        return;
      }
      dispatchStore.save({
        issueId: dispatched.issueId,
        projectId: dispatched.projectId,
        deskId: decision.deskId,
        provider: decision.provider,
        cursorAgentId: dispatched.cursorAgentId,
        cursorAgentUrl: dispatched.cursorAgentUrl,
        claudeSessionId: dispatched.claudeSessionId,
        claudeSessionUrl: dispatched.claudeSessionUrl,
        createdAt: new Date().toISOString(),
      });
      setCarried(null);
      setBoardMessage(
        decision.provider === "anthropic"
          ? claudeCloudStartedCopy(dispatched.linked !== false)
          : decision.provider !== "cursor" ? `Card atribuído a ${PROVIDER_LABELS[decision.provider]}. Abra o agente para acompanhar.` : dispatched.linked === false
            ? "O cloud agent iniciou, mas o Linear não gravou o vínculo. O avatar ainda acompanha o observador."
            : "Card na mesa do Cursor. A issue ficou ligada a esse cloud agent. O avatar passa a trabalhando pelo observador.",
      );
    } catch {
      setBoardMessage(serverDispatchCopy("unavailable", "cursor"));
    }
  }

  const interactRef = useRef<() => void>(() => {});

  function interact() {
    if (!session || !nearby || formOpen || roomDialogOpen || characterOpen || selectedDesk) return;
    if (nearby.kind === "elevator") {
      setFloor((current) => rideElevator(current));
      setOpenRoomId(null);
      return;
    }
    if (nearby.kind === "room") {
      openRoom(nearby.id);
      return;
    }
    if (nearby.kind === "desk") {
      if (canAct && carried) void finishDrop(carried, nearby.id);
      else {setSelectedTab(viewAgents.find(a=>a.id===nearby.id)?.event.origin==="local"?"history":"activity");setSelectedDeskId(nearby.id);}
      return;
    }
    if (!canAct) return;
    if (nearby.kind === "reception") setRoomDialogOpen(true);
    if (nearby.kind === "hire") openForm();
  }

  useEffect(() => {
    interactRef.current = interact;
  });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (event.key !== "e" && event.key !== "E") return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      interactRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function signIn(intent: OfficeRole, name: string) {
    setSigningIn(true);
    setSignInError(null);
    try {
      const response = await fetch("/api/office/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent, name }),
      });
      const body = (await response.json()) as { role?: string; name?: string; error?: string };
      const role = body.role === "colleague" ? "observer" : body.role;
      if (!response.ok || (role !== "host" && role !== "interact" && role !== "observer") || !body.name) {
        setSignInError(SIGN_IN_COPY[body.error ?? ""] ?? "Não foi possível entrar.");
        return;
      }
      setSession({ role, name: body.name });
      setFloor("ground");
    } catch {
      setSignInError("Não foi possível entrar.");
    } finally {
      setSigningIn(false);
    }
  }

  const prompt = promptFor(nearby, canAct, floor, Boolean(carried), viewRooms);
  const walking = Boolean(session) && !formOpen && !roomDialogOpen && !characterOpen && !selectedDesk;

  return (
    <main className="office-shell relative h-dvh overflow-hidden bg-[#dce7e4] text-slate-700" data-role={session?.role ?? "signed-out"}>
      <div className="absolute inset-0">
        <SceneBoundary><OfficeCanvas
          routineEngine={host?routineEngine:undefined} routineVisuals={host?routineVisuals:shared?.routines} routineCommands={routineControl.commands} idleMs={routineControl.idleMs} host={host} userPose={pose} newHire={newHire} onRoutines={onRoutines} onRoutineResult={onRoutineResult} onAgent={id=>{setSelectedTab("history");setSelectedDeskId(id);}}
          agentTimeZone={host ? Intl.DateTimeFormat().resolvedOptions().timeZone : shared?.hostTimeZone}
          presence={humanPresence}
          correction={correction}
          onPerson={invitePerson}
          appearance={appearance}
          cameraMode={cameraMode}
          zoom={zoom}
          gesture={gesture}
          rooms={viewRooms}
          agents={viewAgents}
          nearId={nearby && (nearby.kind === "desk" || nearby.kind === "room") ? nearby.id : null}
          dropArmed={canAct && carried !== null}
          floor={floor}
          onNearby={onNearby}
          onPose={onPose}
          enabled={walking}
          localOffline={viewOffline}
        /></SceneBoundary>
      </div>
      <p
        className="office-brand pointer-events-none absolute top-4 left-4 max-w-sm rounded-2xl border border-white/70 bg-white/85 px-5 py-3 text-sm text-slate-700 shadow-sm backdrop-blur"
        data-testid="floor"
      >
        <span className="text-lg font-semibold tracking-tight">Escritório de IA</span>
        <span className="mt-1 block text-[10px] tracking-[0.14em] text-teal-700 uppercase">
          {FLOOR_LABELS[floor]}
          {session?.role === "interact" ? " · interagindo" : session?.role === "observer" ? " · só olhando" : ""}
        </span>
      </p>
      <p
        className="pointer-events-none absolute h-px w-px overflow-hidden"
        data-testid="pose"
        data-x={pose.x.toFixed(2)}
        data-z={pose.z.toFixed(2)}
        data-yaw={pose.yaw.toFixed(3)}
      >
        posição
      </p>
      {session && !host ? (
        <p className="office-status pointer-events-none absolute top-4 right-4 max-w-xs text-right text-xs leading-5 text-[#f6efe6]">
          {session.role === "observer"
            ? "Você está só olhando. Quem só olha não contrata, não abre sala, não solta card e não inicia trabalho."
            : "Você pode contratar, abrir sala e soltar card por esta máquina."}
          {" "}Os agentes locais de cada computador aparecem quando essa máquina envia o status real.
        </p>
      ) : host ? (
        <p className="office-status pointer-events-none absolute top-4 right-4 max-w-xs rounded-xl bg-white/80 p-3 text-right text-[10px] leading-5 text-slate-500 shadow-sm backdrop-blur">
          {localNotice || notice}
        </p>
      ) : null}
      {currentRoom && floor === "ground" ? (
        <div className="office-board absolute top-24 inset-x-3 z-30 sm:inset-x-auto sm:top-24 sm:right-4">
          <BoardPanel
            roomName={currentRoom.name}
            projectId={currentRoom.id}
            state={board}
            dispatches={dispatches.filter((record) => record.projectId === currentRoom.id)}
            creating={creatingCard}
            message={boardMessage}
            readOnly={!canAct}
            carriedId={carried?.id ?? null}
            onCreate={createCard}
            onRefresh={refreshBoard}
            onClose={() => {
              setOpenRoomId(null);
              setBoardMessage(null);
            }}
            onCarry={(issue) => {
              if (!canAct) return;
              setCarried(issue);
              setBoardMessage("Leve o card até uma mesa com ficha e solte lá.");
            }}
          />
        </div>
      ) : null}
      {session && prompt ? (
        <div className="office-interact absolute bottom-36 left-1/2 z-10 w-[min(100%,28rem)] -translate-x-1/2 px-3">
          <div className="rounded-3xl bg-[#f7f1e8]/95 p-3 text-[#241c16] shadow-xl">
            {nearAgent ? <NearbyDesk agent={nearAgent} offline={viewOffline} /> : null}
            {nearby?.kind === "reception" && canAct ? (
              <ReceptionNote
                projectsState={projectsState}
                roomCount={rooms.length}
                onReload={() => {
                  setProjectsState({ status: "loading" });
                  setReloadToken((value) => value + 1);
                }}
              />
            ) : null}
            <Button
              className="mt-2 w-full"
              data-testid="interact"
              disabled={!prompt.enabled || signingIn}
              onClick={interact}
            >
              E · {prompt.label}
            </Button>
            {carried ? (
              <p className="mt-2 text-xs text-[#5c5148]">Na mão: {carried.identifier}. {carried.title}</p>
            ) : null}
          </div>
        </div>
      ) : session ? (
        <p className="office-hint pointer-events-none absolute bottom-36 left-1/2 w-[min(100%,36rem)] -translate-x-1/2 px-4 text-center text-xs leading-5 text-slate-600">
          {cameraMode === "first" ? "O mouse olha em volta · " : ""}WASD para andar · setas giram · clique no chão para ir · E para interagir
        </p>
      ) : null}
      {session ? <LocalDeskLink /> : null}
      {session ? <OfficeCall onEvent={onOfficeEvent} onConnected={onOfficeConnected} pose={pose} floor={floor} host={host} onRoster={setHumanPresence} onCorrection={correctPose} inviteTarget={inviteTarget} onClearInvite={clearInvite} /> : null}
      {sessionReady && !session ? (
        <SignInCard
          machineName={machineName}
          colleagueName={colleagueName}
          error={signInError}
          pending={signingIn}
          onColleagueName={setColleagueName}
          lanUrls={lanUrls}
          onHost={() => void signIn("host", "")}
          onInteract={() => void signIn("interact", colleagueName)}
          onObserve={() => void signIn("observer", colleagueName)}
        />
      ) : null}
      {session && <OfficeHud onCharacter={() => setCharacterOpen(true)} onGesture={kind => setGesture({kind, stamp: Date.now()})} cameraMode={cameraMode} onCamera={setCameraMode} zoom={zoom} onZoom={setZoom} presence={humanPresence} pose={pose} floor={floor} rooms={viewRooms} agents={viewAgents} />}

      {host && overflow>0&&<p role="alert" className="absolute top-28 left-4 z-20 max-w-sm rounded-xl bg-amber-50 p-3 text-xs text-amber-900">{overflow} postos excedem a capacidade visual. O trabalho real continua observado; a circulação permanece livre.</p>}
      {host && <div className="absolute bottom-24 left-4 z-20 max-w-sm rounded-2xl border border-white/80 bg-white/90 p-3 text-sm shadow-sm backdrop-blur"><label className="flex flex-wrap items-center gap-2">Saída após ociosidade<select aria-label="Prazo de saída dos agentes" className="rounded-lg border border-slate-200 bg-white p-2 text-xs" value={routineControl.idleMs} onChange={event=>void routineControl.configure(Number(event.target.value))}>{[60000,300000,600000,900000].map(ms=><option key={ms} value={ms}>{ms/60000} min</option>)}</select></label>{(routineNotice||routineControl.error)&&<p role={routineControl.error?'alert':'status'} className="mt-2 text-xs text-slate-600">{routineControl.error??routineNotice}</p>}{routineControl.commands.filter(c=>c.type==='approach').map(c=><button key={c.agentId} className="mt-2 mr-3 text-xs underline" onClick={()=>void routineControl.cancel(c.agentId)}>Cancelar encontro</button>)}</div>}
      {session&&<p className="pointer-events-none absolute bottom-3 left-4 z-10 rounded-lg bg-white/85 px-3 py-2 text-xs text-slate-600">Clique em uma cadeira próxima para sentar · WASD/Espaço para levantar · Clique no agente para ver o histórico</p>}
      {selectedDesk && <AgentPanel key={`${selectedDesk.id}:${selectedTab}`} initialTab={selectedTab} onApproach={()=>void approachAgent(selectedDesk.id)} onMeeting={id=>void approachAgent(selectedDesk.id,id)} colleagues={viewAgents.filter(a=>a.id!==selectedDesk.id)} agent={selectedDesk} name={selectedDesk.displayName} host={host} canAct={canAct} offline={viewOffline} dispatches={dispatches.filter(d => d.deskId === selectedDesk.id)} rooms={viewRooms} onClose={() => {void routineControl.cancel(selectedDesk.id);setSelectedDeskId(null);}} onBoard={id => { setSelectedDeskId(null); openRoom(id); }} onAssign={carried && currentRoom ? async () => { await finishDrop(carried, selectedDesk.id); } : undefined} onHire={() => { setSelectedDeskId(null); openForm(); }} />}
      <CharacterCreator open={characterOpen} onOpenChange={setCharacterOpen} appearance={appearance} onChange={setAppearance} />
      <OpenRoomDialog
        open={roomDialogOpen}
        onOpenChange={setRoomDialogOpen}
        projects={unboundProjects}
        emptyMessage={
          rooms.length >= 8 ? "Capacidade atingida: oito salas. Os corredores devem permanecer livres." :
          projectsState.status === "ready" && unboundProjects.length === 0
            ? projects.length === 0
              ? "Nenhum projeto no Linear. Uma sala não abre sem projeto."
              : "Todo projeto visível já tem sala."
            : projectsState.status === "missing_key"
              ? PROJECT_COPY.missing_key
              : projectsState.status === "error"
                ? PROJECT_COPY.error
                : null
        }
        onSubmit={bindProjectRoom}
      />
      <JobFormDialog
        key={formSession}
        open={formOpen}
        onOpenChange={setFormOpen}
        providers={providers}
        loading={providersLoading}
        loadError={providersError}
        onSubmit={saveDesk}
      />
    </main>
  );
}

function promptFor(
  nearby: InteractTarget | null,
  canAct: boolean,
  floor: FloorId,
  carrying: boolean,
  rooms: readonly PlacedRoom[],
): { label: string; enabled: boolean } | null {
  if (!nearby) return null;
  if (nearby.kind === "elevator") {
    return { label: floor === "ground" ? "Subir ao RH" : "Descer ao térreo", enabled: true };
  }
  if (nearby.kind === "room") {
    const room = rooms.find((item) => item.id === nearby.id);
    return { label: room ? `Ver quadro · ${room.name}` : "Ver quadro", enabled: true };
  }
  if (nearby.kind === "desk") {
    if (carrying && canAct) return { label: "Soltar card nesta mesa", enabled: true };
    return { label: canAct ? "Ver agente" : "Ver agente · só olhar", enabled: !carrying };
  }
  if (nearby.kind === "reception") {
    return canAct
      ? { label: "Abrir sala", enabled: true }
      : { label: "Quem só olha não abre sala", enabled: false };
  }
  return canAct
    ? { label: "Ficha de vaga", enabled: true }
    : { label: "Quem só olha não contrata", enabled: false };
}

function NearbyDesk({ agent, offline }: { agent: PlacedAgent; offline: boolean }) {
  const machineOffline = localAgentOffline(agent.event.origin, agent.machineOnline, offline);
  if (agent.event.origin === "local") {
    return (
      <div className="rounded-2xl border border-[#d4b483] bg-[#243038] p-3 text-[#f6efe6]">
        <p className="text-[0.65rem] tracking-[0.16em] text-[#d4b483] uppercase">
          {agentPlaceLabel(agent)}
        </p>
        <h3 className="font-display mt-1 text-lg">{PROVIDER_LABELS[agent.event.provider]}</h3>
        {agent.form ? <p className="mt-1 text-sm text-[#d9cbb8]">{agent.form.role}</p> : null}
        <p className="mt-2 text-sm">{machineOffline ? "máquina offline" : STATUS_LABELS[agent.event.status]}</p>
      </div>
    );
  }
  if (agent.form) {
    return (
      <JobFormCard
        form={agent.form}
        status={agent.event.status}
        statusText={placedStatusText(agent)}
      />
    );
  }
  return (
    <div className="rounded-2xl border border-border bg-white/80 p-3">
      <p className="text-[0.65rem] tracking-[0.16em] text-muted uppercase">{agentPlaceLabel(agent)}</p>
      <h3 className="font-display mt-1 text-lg">{PROVIDER_LABELS[agent.event.provider]}</h3>
      <p className="mt-1 text-sm">{placedStatusText(agent)}</p>
    </div>
  );
}

function ReceptionNote({
  projectsState,
  roomCount,
  onReload,
}: {
  projectsState: ProjectsState;
  roomCount: number;
  onReload: () => void;
}) {
  return (
    <div className="text-sm leading-5">
      {projectsState.status === "loading" ? <p>Lendo os projetos do Linear…</p> : null}
      {projectsState.status === "ready" ? (
        <p>
          {roomCount === 0
            ? "Nenhuma sala aberta. Escolha um projeto que ainda não tem sala."
            : `${roomCount} ${roomCount === 1 ? "sala aberta" : "salas abertas"}.`}
        </p>
      ) : null}
      {projectsState.status === "missing_key" || projectsState.status === "error" ? (
        <p>{PROJECT_COPY[projectsState.status]}</p>
      ) : null}
      <Button className="mt-2" variant="ghost" size="sm" onClick={onReload}>
        Recarregar projetos
      </Button>
    </div>
  );
}

function SignInCard({
  machineName,
  colleagueName,
  lanUrls,
  error,
  pending,
  onColleagueName,
  onHost,
  onInteract,
  onObserve,
}: {
  machineName: string;
  colleagueName: string;
  lanUrls: string[];
  error: string | null;
  pending: boolean;
  onColleagueName: (value: string) => void;
  onHost: () => void;
  onInteract: () => void;
  onObserve: () => void;
}) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-20 flex justify-center p-4 sm:inset-0 sm:items-center">
      <section className="w-full max-w-md rounded-3xl bg-[#f7f1e8] p-5 text-[#241c16] shadow-2xl">
        <p className="text-[0.65rem] tracking-[0.16em] text-[#8c7b6b] uppercase">Entrar</p>
        <h2 className="font-display mt-1 text-3xl">Quem está neste chão</h2>
        <p className="mt-2 text-sm leading-5 text-[#5c5148]">
          Nesta máquina: {machineName || "…"}. Quem publica os agentes desta máquina entra nela. Outra pessoa, no mesmo Wi-Fi, escolhe interagir ou só olhar.
        </p>
        {lanUrls.length > 0 ? (
          <p className="mt-2 text-sm leading-5 text-[#5c5148]">
            No outro computador, abra {lanUrls.join(" ou ")}.
          </p>
        ) : null}
        <Button className="mt-4 w-full" disabled={pending || !machineName} onClick={onHost}>
          Entrar nesta máquina
        </Button>
        <form
          className="mt-4 space-y-2 border-t border-border pt-4"
          onSubmit={(event) => {
            event.preventDefault();
            onObserve();
          }}
        >
          <Label htmlFor="colega">Seu nome</Label>
          <Input
            id="colega"
            value={colleagueName}
            maxLength={40}
            placeholder="Outro nome"
            onChange={(event) => onColleagueName(event.target.value)}
          />
          <Button className="w-full" type="button" disabled={pending} onClick={onInteract}>
            Entrar para interagir
          </Button>
          <Button className="w-full" type="submit" variant="outline" disabled={pending}>
            Entrar só para olhar
          </Button>
        </form>
        {error ? <p className="mt-3 text-sm text-[#9c4221]">{error}</p> : null}
      </section>
    </div>
  );
}
