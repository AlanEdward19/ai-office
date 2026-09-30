"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { isAgentEvent, STATUS_LABELS, type AgentEvent } from "@/domain/agent-event";
import { isMachinePresence, presentLocalEvent, type MachinePresence } from "@/domain/local-hooks";
import {
  decideDrop,
  preferredCursorDeskId,
  refusalCopy,
  serverDispatchCopy,
} from "@/domain/dispatch";
import { FLOOR_LABELS, rideElevator, type FloorId } from "@/domain/floors";
import { issuesForProject, mergeRoomIssues, type RoomIssue } from "@/domain/issues";
import type { JobForm } from "@/domain/job-form";
import { readSharedScene, type OfficeRole, type SharedScene } from "@/domain/office-share";
import { projectsWithoutRooms, roomsFromBindings } from "@/domain/opened-rooms";
import { bindAgents, bindLocalWing, type PlacedAgent } from "@/domain/placement";
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
import { deskStore } from "./desk-store";
import { dispatchStore } from "./dispatch-store";
import { OpenRoomDialog } from "./open-room-dialog";
import { roomStore } from "./room-store";

const OfficeCanvas = dynamic(() => import("./office-canvas"), {
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
  const [session, setSession] = useState<SessionState | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [machineName, setMachineName] = useState("");
  const [signInError, setSignInError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [colleagueName, setColleagueName] = useState("");
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
  const [floor, setFloor] = useState<FloorId>("ground");
  const [roomDialogOpen, setRoomDialogOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formSession, setFormSession] = useState(0);
  const [providers, setProviders] = useState<HiringProvider[]>([]);
  const [providersLoading, setProvidersLoading] = useState(false);
  const [providersError, setProvidersError] = useState<string | null>(null);
  const [openRoomId, setOpenRoomId] = useState<string | null>(null);
  const [boardToken, setBoardToken] = useState(0);
  const [board, setBoard] = useState<BoardState>({ status: "loading" });
  const [creatingCard, setCreatingCard] = useState(false);
  const [boardMessage, setBoardMessage] = useState<string | null>(null);
  const [carried, setCarried] = useState<RoomIssue | null>(null);
  const [nearby, setNearby] = useState<InteractTarget | null>(null);
  const [pose, setPose] = useState<Pose>(LOBBY_SPAWN);
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
        if ((body.role === "host" || body.role === "colleague") && typeof body.name === "string") {
          setSession({ role: body.role, name: body.name });
        }
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
      })
      .finally(() => {
        if (!controller.signal.aborted) setSessionReady(true);
      });
    void fetch("/api/whoami", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = (await response.json()) as { name?: unknown };
        if (typeof body.name === "string" && body.name.trim()) setMachineName(body.name.trim());
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!session) return;
    const source = new EventSource("/api/office");
    const onSnapshot = (event: Event) => {
      if (session.role === "colleague") {
        setShared(readSharedScene(parsePayload((event as MessageEvent).data)));
      }
      setLinked(true);
    };
    source.addEventListener("snapshot", onSnapshot);
    source.onerror = () => setLinked(false);
    return () => {
      source.removeEventListener("snapshot", onSnapshot);
      source.close();
    };
  }, [session]);

  useEffect(() => {
    if (!host) return;
    const source = new EventSource("/api/observe");
    const onAgent = (event: Event) => {
      const parsed = parsePayload((event as MessageEvent).data);
      if (isAgentEvent(parsed)) setObserved(parsed);
    };
    const onNotice = (event: Event) => {
      const parsed = parsePayload((event as MessageEvent).data);
      if (
        parsed &&
        typeof parsed === "object" &&
        "message" in parsed &&
        typeof parsed.message === "string"
      ) {
        setNotice(parsed.message);
      }
    };
    source.addEventListener("agent", onAgent);
    source.addEventListener("notice", onNotice);
    source.onerror = () => setNotice("A ligação com o observador caiu. A página tenta de novo.");
    return () => {
      source.removeEventListener("agent", onAgent);
      source.removeEventListener("notice", onNotice);
      source.close();
    };
  }, [host]);

  useEffect(() => {
    if (!host) return;
    const source = new EventSource("/api/local");
    let closed = false;
    const dropWorking = () => {
      localOnlineRef.current = false;
      setLocalLink("offline");
      setLocalEvents((current) => ({
        cursor: current.cursor ? presentLocalEvent(current.cursor, false) : null,
        anthropic: current.anthropic ? presentLocalEvent(current.anthropic, false) : null,
        openai: current.openai ? presentLocalEvent(current.openai, false) : null,
      }));
    };
    const onAgent = (event: Event) => {
      const parsed = parsePayload((event as MessageEvent).data);
      if (!isAgentEvent(parsed) || parsed.origin !== "local") return;
      const provider = parsed.provider;
      if (provider !== "cursor" && provider !== "anthropic" && provider !== "openai") return;
      setLocalEvents((current) => ({ ...current, [provider]: parsed }));
    };
    const onPresence = (event: Event) => {
      const parsed = parsePayload((event as MessageEvent).data);
      if (!isMachinePresence(parsed)) return;
      localOnlineRef.current = parsed.online;
      setPresence(parsed);
      setLocalLink(parsed.online ? "online" : "offline");
      if (!parsed.online) {
        setLocalEvents((current) => ({
          cursor: current.cursor ? presentLocalEvent(current.cursor, false) : null,
          anthropic: current.anthropic ? presentLocalEvent(current.anthropic, false) : null,
          openai: current.openai ? presentLocalEvent(current.openai, false) : null,
        }));
      }
    };
    const onNotice = (event: Event) => {
      const parsed = parsePayload((event as MessageEvent).data);
      if (
        parsed &&
        typeof parsed === "object" &&
        "message" in parsed &&
        typeof parsed.message === "string"
      ) {
        setLocalNotice(parsed.message);
      }
    };
    source.addEventListener("agent", onAgent);
    source.addEventListener("presence", onPresence);
    source.addEventListener("notice", onNotice);
    source.onerror = () => {
      if (closed) return;
      dropWorking();
      setLocalNotice("A ligação com a máquina local caiu. O avatar não fica trabalhando.");
    };
    return () => {
      closed = true;
      localOnlineRef.current = false;
      source.removeEventListener("agent", onAgent);
      source.removeEventListener("presence", onPresence);
      source.removeEventListener("notice", onNotice);
      source.close();
    };
  }, [host]);

  useEffect(() => {
    if (!host) return;
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
  }, [reloadToken, host]);

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
      bindAgents({
        desks,
        observed,
        owner: viewerName || session?.name || "esta máquina",
        preferredDeskId: preferredCursorDeskId(dispatches),
      }),
    [desks, observed, viewerName, session?.name, dispatches],
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
  const agents = useMemo(() => [...cloudAgents, ...localAgents], [cloudAgents, localAgents]);
  const viewRooms: PlacedRoom[] = useMemo(
    () => (host ? rooms : (shared?.rooms ?? [])),
    [host, rooms, shared],
  );
  const viewAgents = host ? agents : (shared?.agents ?? []);
  const viewOffline = host ? localLink === "offline" : Boolean(shared?.localOffline);
  const currentRoom = viewRooms.find((room) => room.id === openRoomId) ?? null;
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
        localOffline: localLink !== "online",
        rooms: rooms.map((room) => ({ id: room.id, name: room.name, x: room.x, z: room.z })),
        agents,
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
  }, [host, linked, session, localLink, rooms, agents, shareBump]);

  useEffect(() => {
    roomsForPose.current = viewRooms;
  }, [viewRooms]);

  function openForm() {
    if (!host) return;
    setProvidersLoading(true);
    setProvidersError(null);
    setFormSession((value) => value + 1);
    setFormOpen(true);
  }

  function saveDesk(form: JobForm) {
    deskStore.add(form);
    setFloor("ground");
    setOpenRoomId(null);
  }

  function bindProjectRoom(projectId: string) {
    if (!host) return;
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
    if (!openRoomId || !host) return false;
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
    if (!host) {
      setBoardMessage("Quem só olha não solta card nem inicia agente.");
      return;
    }
    if (!issue || !openRoomId || issue.projectId !== openRoomId) {
      setBoardMessage("Esse card não é do quadro desta sala.");
      return;
    }
    const desk = desks.find((item) => item.id === deskId) ?? null;
    const placed = agents.find((item) => item.id === deskId) ?? null;
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
    setBoardMessage("Iniciando o cloud agent do Cursor para esta issue…");
    try {
      const response = await fetch("/api/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: issue.projectId,
          issueId: issue.id,
          provider: decision.provider,
        }),
      });
      const body = (await response.json()) as {
        error?: string | null;
        dispatch?: {
          issueId: string;
          projectId: string;
          cursorAgentId: string | null;
          cursorAgentUrl: string | null;
          linked?: boolean;
        } | null;
      };
      const dispatched = body.dispatch;
      if (
        !dispatched ||
        dispatched.projectId !== issue.projectId ||
        dispatched.issueId !== issue.id ||
        !dispatched.cursorAgentId
      ) {
        setBoardMessage(serverDispatchCopy(body.error ?? "unavailable", decision.provider));
        return;
      }
      dispatchStore.save({
        issueId: dispatched.issueId,
        projectId: dispatched.projectId,
        deskId: decision.deskId,
        provider: "cursor",
        cursorAgentId: dispatched.cursorAgentId,
        cursorAgentUrl: dispatched.cursorAgentUrl,
        createdAt: new Date().toISOString(),
      });
      setCarried(null);
      setBoardMessage(
        dispatched.linked === false
          ? "O cloud agent iniciou, mas o Linear não gravou o vínculo. O avatar ainda acompanha o observador."
          : "Card na mesa do Cursor. A issue ficou ligada a esse cloud agent. O avatar passa a trabalhando pelo observador.",
      );
    } catch {
      setBoardMessage(serverDispatchCopy("unavailable", "cursor"));
    }
  }

  const interactRef = useRef<() => void>(() => {});

  function interact() {
    if (!session || !nearby || formOpen || roomDialogOpen) return;
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
      if (host && carried) void finishDrop(carried, nearby.id);
      return;
    }
    if (!host) return;
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
      const body = (await response.json()) as { role?: OfficeRole; name?: string; error?: string };
      if (!response.ok || (body.role !== "host" && body.role !== "colleague") || !body.name) {
        setSignInError(SIGN_IN_COPY[body.error ?? ""] ?? "Não foi possível entrar.");
        return;
      }
      setSession({ role: body.role, name: body.name });
      setFloor("ground");
    } catch {
      setSignInError("Não foi possível entrar.");
    } finally {
      setSigningIn(false);
    }
  }

  const prompt = promptFor(nearby, host, floor, Boolean(carried), viewRooms);
  const walking = Boolean(session) && !formOpen && !roomDialogOpen;

  return (
    <main className="relative h-dvh overflow-hidden bg-[#241c16] text-[#f6efe6]" data-role={session?.role ?? "signed-out"}>
      <div className="absolute inset-0">
        <OfficeCanvas
          rooms={viewRooms}
          agents={viewAgents}
          nearId={nearby && (nearby.kind === "desk" || nearby.kind === "room") ? nearby.id : null}
          dropArmed={host && carried !== null}
          floor={floor}
          onNearby={onNearby}
          onPose={onPose}
          enabled={walking}
          localOffline={viewOffline}
        />
      </div>
      <p
        className="pointer-events-none absolute top-4 left-4 max-w-sm text-sm text-[#f6efe6] drop-shadow"
        data-testid="floor"
      >
        <span className="font-display text-2xl">Escritório de IA</span>
        <span className="mt-1 block text-xs tracking-[0.14em] uppercase">
          {FLOOR_LABELS[floor]}
          {session?.role === "colleague" ? " · só olhando" : ""}
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
      {session?.role === "colleague" ? (
        <p className="pointer-events-none absolute top-4 right-4 max-w-xs text-right text-xs leading-5 text-[#f6efe6]">
          {shared
            ? "Você está só olhando. Quem só olha não solta card nem inicia agente."
            : "Esperando a pessoa desta máquina publicar o escritório."}
        </p>
      ) : host ? (
        <p className="pointer-events-none absolute top-4 right-4 max-w-xs text-right text-xs leading-5 text-[#f6efe6]/80">
          {localNotice || notice}
        </p>
      ) : null}
      {currentRoom && floor === "ground" ? (
        <div className="absolute top-20 right-3 z-10 sm:top-16">
          <BoardPanel
            roomName={currentRoom.name}
            projectId={currentRoom.id}
            state={board}
            dispatches={dispatches.filter((record) => record.projectId === currentRoom.id)}
            creating={creatingCard}
            message={boardMessage}
            readOnly={!host}
            carriedId={carried?.id ?? null}
            onCreate={createCard}
            onRefresh={refreshBoard}
            onClose={() => {
              setOpenRoomId(null);
              setBoardMessage(null);
            }}
            onCarry={(issue) => {
              if (!host) return;
              setCarried(issue);
              setBoardMessage("Leve o card até uma mesa com ficha e solte lá.");
            }}
          />
        </div>
      ) : null}
      {session && prompt ? (
        <div className="absolute bottom-6 left-1/2 z-10 w-[min(100%,28rem)] -translate-x-1/2 px-3">
          <div className="rounded-3xl bg-[#f7f1e8]/95 p-3 text-[#241c16] shadow-xl">
            {nearAgent ? <NearbyDesk agent={nearAgent} offline={viewOffline} /> : null}
            {nearby?.kind === "reception" && host ? (
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
        <p className="pointer-events-none absolute bottom-6 left-1/2 w-[min(100%,36rem)] -translate-x-1/2 px-4 text-center text-xs leading-5 text-[#f6efe6]">
          WASD anda · setas giram · arraste o mouse para olhar · clique no chão · E interage
        </p>
      ) : null}
      {sessionReady && !session ? (
        <SignInCard
          machineName={machineName}
          colleagueName={colleagueName}
          error={signInError}
          pending={signingIn}
          onColleagueName={setColleagueName}
          onHost={() => void signIn("host", "")}
          onColleague={() => void signIn("colleague", colleagueName)}
        />
      ) : null}
      <OpenRoomDialog
        open={roomDialogOpen}
        onOpenChange={setRoomDialogOpen}
        projects={unboundProjects}
        emptyMessage={
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
  host: boolean,
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
    if (carrying && host) return { label: "Soltar card nesta mesa", enabled: true };
    return { label: host ? "Mesa" : "Mesa · só olhando", enabled: !carrying };
  }
  if (nearby.kind === "reception") {
    return host
      ? { label: "Abrir sala", enabled: true }
      : { label: "Só quem está na máquina abre sala", enabled: false };
  }
  return host
    ? { label: "Ficha de vaga", enabled: true }
    : { label: "Quem só olha não contrata", enabled: false };
}

function NearbyDesk({ agent, offline }: { agent: PlacedAgent; offline: boolean }) {
  if (agent.event.origin === "local") {
    return (
      <div className="rounded-2xl border border-[#d4b483] bg-[#243038] p-3 text-[#f6efe6]">
        <p className="text-[0.65rem] tracking-[0.16em] text-[#d4b483] uppercase">
          Selo local · {agent.event.owner}
        </p>
        <h3 className="font-display mt-1 text-lg">{PROVIDER_LABELS[agent.event.provider]}</h3>
        {agent.form ? <p className="mt-1 text-sm text-[#d9cbb8]">{agent.form.role}</p> : null}
        <p className="mt-2 text-sm">{offline ? "máquina offline" : STATUS_LABELS[agent.event.status]}</p>
      </div>
    );
  }
  if (agent.form) return <JobFormCard form={agent.form} status={agent.event.status} />;
  return (
    <div className="rounded-2xl border border-border bg-white/80 p-3">
      <p className="text-[0.65rem] tracking-[0.16em] text-muted uppercase">Cloud agent</p>
      <h3 className="font-display mt-1 text-lg">{PROVIDER_LABELS[agent.event.provider]}</h3>
      <p className="mt-1 text-sm">{STATUS_LABELS[agent.event.status]}</p>
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
  error,
  pending,
  onColleagueName,
  onHost,
  onColleague,
}: {
  machineName: string;
  colleagueName: string;
  error: string | null;
  pending: boolean;
  onColleagueName: (value: string) => void;
  onHost: () => void;
  onColleague: () => void;
}) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-20 flex justify-center p-4 sm:inset-0 sm:items-center">
      <section className="w-full max-w-md rounded-3xl bg-[#f7f1e8] p-5 text-[#241c16] shadow-2xl">
        <p className="text-[0.65rem] tracking-[0.16em] text-[#8c7b6b] uppercase">Entrar</p>
        <h2 className="font-display mt-1 text-3xl">Quem está neste chão</h2>
        <p className="mt-2 text-sm leading-5 text-[#5c5148]">
          Nesta máquina: {machineName || "…"}. Quem publica anda, contrata e solta card. Outra pessoa só olha.
        </p>
        <Button className="mt-4 w-full" disabled={pending || !machineName} onClick={onHost}>
          Entrar nesta máquina
        </Button>
        <form
          className="mt-4 space-y-2 border-t border-border pt-4"
          onSubmit={(event) => {
            event.preventDefault();
            onColleague();
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
          <Button className="w-full" type="submit" variant="outline" disabled={pending}>
            Entrar só para olhar
          </Button>
        </form>
        {error ? <p className="mt-3 text-sm text-[#9c4221]">{error}</p> : null}
      </section>
    </div>
  );
}

function parsePayload(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}
