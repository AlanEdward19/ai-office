"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { isAgentEvent, STATUS_LABELS, type AgentEvent } from "@/domain/agent-event";
import type { JobForm } from "@/domain/job-form";
import { bindAgents } from "@/domain/placement";
import { PROVIDER_LABELS, type ProviderId } from "@/domain/providers";
import { layoutRooms, type LinearProject } from "@/domain/rooms";
import { JobFormCard } from "@/components/hiring/job-form-card";
import {
  JobFormDialog,
  type HiringProvider,
} from "@/components/hiring/job-form-dialog";
import { Button } from "@/components/ui/button";
import { deskStore } from "./desk-store";

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
      }),
    [desks, observed, viewerName],
  );
  const selected = agents.find((agent) => agent.id === selectedId) ?? null;

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

  return (
    <main className="relative h-dvh overflow-hidden bg-[#241c16] text-[#f6efe6]">
      <div className="absolute inset-0">
        <OfficeCanvas
          rooms={rooms}
          agents={agents}
          selectedId={selectedId}
          onSelectAgent={setSelectedId}
          resetSignal={resetSignal}
        />
      </div>
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3 sm:p-5">
        <header className="pointer-events-auto flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-xl rounded-3xl bg-[#f7f1e8] px-4 py-3 text-[#241c16] shadow-xl">
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
          <div className="flex gap-2">
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

          <section className="pointer-events-auto w-full max-w-sm rounded-3xl bg-[#f7f1e8]/95 p-3 text-[#241c16] shadow-xl">
            {selected?.form ? (
              <JobFormCard form={selected.form} status={selected.event.status} />
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
