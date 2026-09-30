"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { isAgentEvent, STATUS_LABELS, type AgentEvent } from "@/domain/agent-event";
import {
  decideDrop,
  preferredCursorDeskId,
  refusalCopy,
  serverDispatchCopy,
} from "@/domain/dispatch";
import { issuesForProject, mergeRoomIssues, type RoomIssue } from "@/domain/issues";
import type { JobForm } from "@/domain/job-form";
import { bindAgents } from "@/domain/placement";
import { isProviderId, PROVIDER_LABELS, type ProviderId } from "@/domain/providers";
import { layoutRooms, type LinearProject } from "@/domain/rooms";
import { JobFormCard } from "@/components/hiring/job-form-card";
import {
  JobFormDialog,
  type HiringProvider,
} from "@/components/hiring/job-form-dialog";
import { Button } from "@/components/ui/button";
import { BoardPanel, type BoardState } from "./board-panel";
import { deskStore } from "./desk-store";
import { dispatchStore } from "./dispatch-store";
import type { DeskHit } from "./office-canvas";

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

const ISSUE_COPY: Record<string, string> = {
  missing_key: "Defina LINEAR_API_KEY nesta máquina para ver o quadro.",
  unauthorized: "A chave do Linear foi recusada. Ela fica só nesta máquina.",
  not_found: "Esse projeto não está no Linear.",
  unavailable: "Não foi possível ler as issues deste projeto.",
  without_team: "Esse projeto não tem um time no Linear, então o card não foi criado.",
  wrong_project: "O card não ficou neste projeto e não entrou no quadro.",
  title_required: "Escreva o card antes de criar.",
  missing_project: "A sala não tem um projeto.",
};

const PROJECT_COPY: Record<Exclude<ProjectsState["status"], "ready" | "loading">, string> = {
  missing_key:
    "Defina LINEAR_API_KEY nesta máquina para abrir uma sala por projeto. A recepção e o canto do CEO já estão no andar.",
  error: "Não foi possível ler os projetos do Linear. O lobby continua no lugar.",
};

export function OfficeApp() {
  const [projectsState, setProjectsState] = useState<ProjectsState>({ status: "loading" });
  const [reloadToken, setReloadToken] = useState(0);
  const deskSnapshot = useSyncExternalStore(
    deskStore.subscribe,
    deskStore.getSnapshot,
    deskStore.getServerSnapshot,
  );
  const desks = useMemo(() => deskStore.desksFrom(deskSnapshot), [deskSnapshot]);
  const [observed, setObserved] = useState<AgentEvent | null>(null);
  const [notice, setNotice] = useState("Conectando o observador…");
  const [formOpen, setFormOpen] = useState(false);
  const [formSession, setFormSession] = useState(0);
  const [providers, setProviders] = useState<HiringProvider[]>([]);
  const [providersLoading, setProvidersLoading] = useState(false);
  const [providersError, setProvidersError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [resetSignal, setResetSignal] = useState(0);
  const [openRoomId, setOpenRoomId] = useState<string | null>(null);
  const [boardToken, setBoardToken] = useState(0);
  const [board, setBoard] = useState<BoardState>({ status: "loading" });
  const [creatingCard, setCreatingCard] = useState(false);
  const [boardMessage, setBoardMessage] = useState<string | null>(null);
  const [dropArmed, setDropArmed] = useState(false);
  const draggingRef = useRef<RoomIssue | null>(null);
  const hitRef = useRef<DeskHit | null>(null);
  const dispatchSnapshot = useSyncExternalStore(
    dispatchStore.subscribe,
    dispatchStore.getSnapshot,
    dispatchStore.getServerSnapshot,
  );
  const dispatches = useMemo(
    () => dispatchStore.recordsFrom(dispatchSnapshot),
    [dispatchSnapshot],
  );

  useEffect(() => {
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
  }, []);

  useEffect(() => {
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
  }, [reloadToken]);

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
    if (!openRoomId) return;
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
  }, [openRoomId, boardToken]);

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

  const viewerName =
    projectsState.status === "ready" ? projectsState.viewerName : null;
  const rooms = useMemo(
    () => layoutRooms(projectsState.status === "ready" ? projectsState.projects : []),
    [projectsState],
  );
  const agents = useMemo(
    () =>
      bindAgents({
        desks,
        observed,
        owner: viewerName || "esta máquina",
        preferredDeskId: preferredCursorDeskId(dispatches),
      }),
    [desks, observed, viewerName, dispatches],
  );
  const selected = agents.find((agent) => agent.id === selectedId) ?? null;
  const currentRoom = rooms.find((room) => room.id === openRoomId) ?? null;

  function openForm() {
    setProvidersLoading(true);
    setProvidersError(null);
    setFormSession((value) => value + 1);
    setFormOpen(true);
  }

  function saveDesk(form: JobForm) {
    const desk = deskStore.add(form);
    setSelectedId(desk.id);
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
    if (!openRoomId) return false;
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
    setDropArmed(false);
    if (!issue || !openRoomId || issue.projectId !== openRoomId) {
      setBoardMessage("Esse card não é do quadro desta sala.");
      return;
    }
    const desk = desks.find((item) => item.id === deskId) ?? null;
    const placed = agents.find((item) => item.id === deskId) ?? null;
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
      setSelectedId(decision.deskId);
      setBoardMessage(
        dispatched.linked === false
          ? "O cloud agent iniciou, mas o Linear não gravou o vínculo. O avatar ainda acompanha o observador."
          : "Card na mesa do Cursor. A issue ficou ligada a esse cloud agent. O avatar passa a trabalhando pelo observador.",
      );
    } catch {
      setBoardMessage(serverDispatchCopy("unavailable", "cursor"));
    }
  }

  return (
    <main className="relative h-dvh overflow-hidden bg-[#241c16] text-[#f6efe6]">
      <div
        className="absolute inset-0"
        onDragOver={(event) => {
          if (!draggingRef.current) return;
          event.preventDefault();
        }}
        onDrop={(event) => {
          const issue = draggingRef.current;
          if (!issue) return;
          event.preventDefault();
          const deskId = hitRef.current?.(event.clientX, event.clientY) ?? null;
          void finishDrop(issue, deskId);
        }}
      >
        <OfficeCanvas
          rooms={rooms}
          agents={agents}
          selectedId={selectedId}
          onSelectAgent={setSelectedId}
          openRoomId={openRoomId}
          onSelectRoom={openRoom}
          dropArmed={dropArmed}
          hitRef={hitRef}
          resetSignal={resetSignal}
        />
      </div>
      {currentRoom ? (
        <div className="pointer-events-none absolute top-24 left-3 z-10 sm:top-28">
          <BoardPanel
            roomName={currentRoom.name}
            projectId={currentRoom.id}
            state={board}
            dispatches={dispatches.filter((record) => record.projectId === currentRoom.id)}
            creating={creatingCard}
            message={boardMessage}
            onCreate={createCard}
            onRefresh={refreshBoard}
            onClose={() => {
              setOpenRoomId(null);
              setBoardMessage(null);
            }}
            onDragIssue={(issue) => {
              draggingRef.current = issue;
              setDropArmed(Boolean(issue));
            }}
          />
        </div>
      ) : null}
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3 sm:p-5">
        <header className="pointer-events-none flex flex-wrap items-start justify-between gap-3">
          <div className="pointer-events-auto max-w-xl rounded-3xl bg-[#f7f1e8] px-4 py-3 text-[#241c16] shadow-xl">
            <p className="text-[0.65rem] tracking-[0.2em] text-[#8c7b6b] uppercase">
              Andar local
            </p>
            <h1 className="font-display text-3xl leading-none sm:text-4xl">
              Escritório de IA
            </h1>
            <p className="mt-2 hidden max-w-md text-sm leading-5 text-[#5c5148] sm:block">
              A cena existe enquanto esta página está aberta. O canto do CEO não
              é um projeto.
            </p>
          </div>
          <div className="pointer-events-auto flex gap-2">
            <Button variant="outline" onClick={() => setResetSignal((value) => value + 1)}>
              Recentrar
            </Button>
            <Button onClick={openForm}>Ficha de vaga</Button>
          </div>
        </header>

        <div className="flex max-h-[42dvh] flex-col gap-2 overflow-auto sm:max-h-none sm:flex-row sm:items-end sm:justify-between sm:overflow-visible">
          <section className="pointer-events-auto max-w-md rounded-3xl bg-[#f7f1e8]/95 px-4 py-3 text-sm text-[#241c16] shadow-xl">
            <p className="text-[0.65rem] tracking-[0.16em] text-[#8c7b6b] uppercase">
              Salas
            </p>
            {projectsState.status === "loading" ? (
              <p className="mt-1">Lendo os projetos do Linear…</p>
            ) : projectsState.status === "ready" ? (
              <p className="mt-1">
                {rooms.length === 0
                  ? "Nenhum projeto ainda. Um projeto novo aparece como sala ao recarregar."
                  : `${rooms.length} ${rooms.length === 1 ? "sala" : "salas"}, uma por id de projeto.`}
                {viewerName ? ` Chave de ${viewerName}.` : ""}
              </p>
            ) : (
              <p className="mt-1 leading-5">{PROJECT_COPY[projectsState.status]}</p>
            )}
            {projectsState.status === "ready" && rooms.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {rooms.map((room) => (
                  <Button
                    key={room.id}
                    variant={room.id === openRoomId ? "default" : "outline"}
                    size="sm"
                    onClick={() => openRoom(room.id)}
                  >
                    Quadro · {room.name}
                  </Button>
                ))}
              </div>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 px-0"
              onClick={() => {
                setProjectsState({ status: "loading" });
                setReloadToken((value) => value + 1);
              }}
            >
              Recarregar salas
            </Button>
          </section>

          <section
            className="pointer-events-auto w-full max-w-sm rounded-3xl bg-[#f7f1e8]/95 p-3 text-[#241c16] shadow-xl"
            onDragOver={(event) => {
              if (!draggingRef.current || !selected?.form) return;
              event.preventDefault();
              event.stopPropagation();
            }}
            onDrop={(event) => {
              if (!selected?.form) return;
              event.preventDefault();
              event.stopPropagation();
              void finishDrop(draggingRef.current, selected.id);
            }}
          >
            {selected?.form ? (
              <div>
                <JobFormCard form={selected.form} status={selected.event.status} />
                {dropArmed ? (
                  <p className="mt-2 text-xs text-[#5c5148]">Solte o card nesta ficha.</p>
                ) : null}
              </div>
            ) : selected ? (
              <div className="rounded-2xl border border-border bg-white/80 p-3">
                <p className="text-[0.65rem] tracking-[0.16em] text-muted uppercase">
                  Cloud agent
                </p>
                <h3 className="font-display mt-1 text-lg">
                  {PROVIDER_LABELS[selected.event.provider]}
                </h3>
                <p className="mt-1 text-sm">{STATUS_LABELS[selected.event.status]}</p>
                <p className="mt-1 text-xs text-muted">
                  {selected.event.origin === "cloud" ? "Nuvem" : "Máquina local"} ·{" "}
                  {selected.event.owner}
                </p>
              </div>
            ) : (
              <div>
                <p className="text-[0.65rem] tracking-[0.16em] text-[#8c7b6b] uppercase">
                  Observador
                </p>
                <p className="mt-1 text-sm leading-5">{notice}</p>
                <p className="mt-1 text-xs text-[#8c7b6b]">
                  Lendo só enquanto esta aba está aberta.
                </p>
              </div>
            )}
            <StatusLegend observed={observed} />
          </section>
        </div>
      </div>
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

function StatusLegend({ observed }: { observed: AgentEvent | null }) {
  const items: { id: ProviderId | AgentEvent["status"]; label: string; color: string }[] = [
    { id: "idle", label: "Ocioso", color: "#8d8276" },
    { id: "working", label: "Trabalhando", color: "#e0a106" },
    { id: "done", label: "Concluído", color: "#1f7a4d" },
  ];
  return (
    <div className="mt-3 flex flex-wrap gap-3 text-xs text-[#5c5148]">
      {items.map((item) => (
        <span key={item.id} className="inline-flex items-center gap-1.5">
          <span
            className="size-2.5 rounded-full"
            style={{ background: item.color, boxShadow: observed?.status === item.id ? `0 0 0 3px ${item.color}33` : undefined }}
          />
          {item.label}
        </span>
      ))}
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
