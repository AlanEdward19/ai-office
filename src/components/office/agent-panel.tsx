"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { STATUS_LABELS } from "@/domain/agent-event";
import { dispatchSessionLink, dispatchHistoryIdentity, type DispatchRecord } from "@/domain/dispatch";
import type { PlacedAgent } from "@/domain/placement";
import type { PlacedRoom } from "@/domain/rooms";
import { PROVIDER_LABELS } from "@/domain/providers";
import { AgentHistoryPanel } from "./agent-history-panel";
import { agentProfileStore } from "./agent-profile-store";

type Snapshot = { status: string; messages: { role: string; text: string }[]; activity: string[]; error?: string | null };
const empty: Snapshot = { status: "idle", messages: [], activity: [] };

export function AgentPanel({ agent, name, host, offline, dispatches, rooms, onClose, onBoard, onAssign, onHire, initialTab="activity", onApproach, onMeeting, colleagues=[] }: {
  agent: PlacedAgent; name?: string; host: boolean; offline: boolean; dispatches: DispatchRecord[]; rooms: PlacedRoom[];
  initialTab?:"activity"|"messages"|"history";onApproach?:()=>void;onMeeting?:(id:string)=>void;colleagues?:PlacedAgent[];
  onClose: () => void; onBoard: (id: string) => void; onAssign?: () => Promise<void>; onHire: () => void;
}) {
  const provider = agent.form?.provider ?? agent.event.provider;
  const [tab, setTab] = useState<"activity" | "messages" | "cards" | "history">(initialTab);
  const [meetingTarget,setMeetingTarget]=useState("");
  const [draftName, setDraftName] = useState(name ?? agent.form?.role ?? PROVIDER_LABELS[provider]);
  const [message, setMessage] = useState("");
  const [snapshot, setSnapshot] = useState<Snapshot>(empty);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const cursorAgentId = [...dispatches].sort((a,b) => b.createdAt.localeCompare(a.createdAt)).find(d => d.cursorAgentId)?.cursorAgentId ?? null;
  const historyIdentity = dispatchHistoryIdentity(provider, agent.event.origin, dispatches, ["running","idle","terminated"].includes(agent.claudeCloudLabel??""));
  const identity = { deskId: agent.id, provider, cursorAgentId };

  useEffect(() => {
    if (!host) return;
    const controller = new AbortController();
    let busy = false;
    const refresh = async () => {
      if (busy) return;
      busy = true;
      try {
        const query = new URLSearchParams({ deskId: agent.id, provider });
        if (cursorAgentId) query.set("cursorAgentId", cursorAgentId);
        const response = await fetch(`/api/agents/conversation?${query}`, { cache: "no-store", signal: controller.signal });
        const body = await response.json();
        if (!controller.signal.aborted) { if (response.ok) setSnapshot(body); else setError(body.error ?? "Não foi possível atualizar o agente."); }
      } catch { /* Retry on the next refresh; mutations show explicit errors. */ }
      finally { busy = false; }
    };
    void refresh();
    const interval = setInterval(() => void refresh(), 2000);
    return () => { controller.abort(); clearInterval(interval); };
  }, [agent.id, provider, cursorAgentId, host]);

  async function send(action: "message" | "stop") {
    setSending(true); setError(null);
    try {
      const response = await fetch("/api/agents/conversation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...identity, action, message }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível enviar.");
      setSnapshot(body); if (action === "message") setMessage("");
    } catch (e) { setError(e instanceof Error ? e.message : "Falha na conexão."); }
    finally { setSending(false); }
  }
  const running = snapshot.status === "working" || snapshot.status === "running";
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="w-[min(100%-1.5rem,52rem)] max-h-[90dvh] overflow-y-auto bg-white">
      <DialogHeader>
        <DialogTitle>{name ?? agent.form?.role ?? PROVIDER_LABELS[provider]}</DialogTitle>
        <DialogDescription>{PROVIDER_LABELS[provider]} · {agent.event.owner} · {offline && agent.event.origin === "local" ? "Máquina offline" : STATUS_LABELS[agent.event.status]}</DialogDescription>
      </DialogHeader>
      {host && <form className="mb-5 flex gap-2" onSubmit={e => { e.preventDefault(); try { agentProfileStore.rename(agent.id, draftName); setError(null); } catch (e) { setError(e instanceof Error ? e.message : "Nome inválido."); } }}><Input aria-label="Nome do agente" maxLength={60} value={draftName} onChange={e => setDraftName(e.target.value)} /><Button type="submit" variant="outline">Renomear</Button></form>}
      <div className="mb-5 flex flex-wrap gap-2 border-b border-slate-200 pb-3" role="tablist" aria-label="Detalhes do agente">{(["activity", "messages", "history", "cards"] as const).map(key => <button key={key} role="tab" aria-selected={tab === key} onClick={() => {if(key==="messages"&&initialTab!=="messages"&&host&&onApproach)onApproach();else setTab(key);}} className={`rounded-xl px-4 py-2 text-sm transition ${tab === key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{key === "activity" ? "Atividade" : key === "messages" ? "Conversa" : key === "history" ? "Histórico" : `Cards (${dispatches.length})`}</button>)}</div>
      {tab === "activity" && <div className="space-y-4">
        {host&&onApproach&&<Button className="w-full" onClick={onApproach}>Chamar para conversar comigo</Button>}
        {host&&onMeeting&&colleagues.length>0&&<div className="flex flex-wrap gap-2"><select aria-label="Interlocutor do agente" className="min-w-0 flex-1 rounded-xl border border-slate-200 p-2 text-sm" value={meetingTarget} onChange={event=>setMeetingTarget(event.target.value)}><option value="">Encontrar outro agente…</option>{colleagues.map(person=><option key={person.id} value={person.id}>{person.displayName??person.form?.role??PROVIDER_LABELS[person.event.provider]}</option>)}</select><Button variant="outline" disabled={!meetingTarget} onClick={()=>onMeeting(meetingTarget)}>Marcar encontro</Button></div>}

        <div className="rounded-2xl bg-slate-50 p-4"><p className="font-semibold">{running ? "Executando trabalho" : STATUS_LABELS[agent.event.status]}</p><p className="mt-1 text-sm text-slate-500">Última observação: {new Date(agent.event.observedAt).toLocaleString("pt-BR")}</p></div>
        {agent.event.origin === "local" && <p className="text-sm text-slate-600">O avatar observa as sessões locais. A conversa abaixo abre uma sessão própria desta mesa; ela não envia comandos para outras sessões abertas no terminal.</p>}
        {snapshot.activity.length ? <ul className="space-y-2 text-sm">{snapshot.activity.map((line,i) => <li key={i} className="rounded-xl border border-slate-100 p-3">{line}</li>)}</ul> : <p className="py-5 text-sm text-slate-500">As ações da sessão desta mesa aparecem aqui quando você iniciar trabalho.</p>}
        {host && running && <Button variant="outline" disabled={sending} onClick={() => void send("stop")}>Interromper trabalho</Button>}
      </div>}
      {tab === "messages" && <div>
        {!host ? <p className="text-sm text-slate-500">Conversas privadas ficam disponíveis para quem administra esta máquina.</p> : <>
          <div className="mb-4 max-h-72 min-h-32 space-y-3 overflow-y-auto rounded-2xl bg-slate-50 p-4" aria-live="polite">{snapshot.messages.length ? snapshot.messages.map((m,i) => <div key={i} className={`rounded-xl p-3 text-sm ${m.role === "user" ? "ml-8 bg-slate-900 text-white" : "mr-8 border border-slate-200 bg-white"}`}><p className="mb-1 text-xs opacity-60">{m.role === "user" ? "Você" : "Agente"}</p><p className="whitespace-pre-wrap break-words">{m.text}</p></div>) : <p className="text-sm text-slate-500">Envie uma instrução para iniciar uma conversa com {PROVIDER_LABELS[provider]}.</p>}</div>
          {provider === "cursor" && !cursorAgentId && <p className="mb-3 text-sm text-amber-700">Atribua um card para criar o cloud agent do Cursor antes de conversar.</p>}
          <form onSubmit={e => { e.preventDefault(); void send("message"); }}><textarea aria-label="Mensagem para o agente" maxLength={12000} className="min-h-24 w-full resize-y rounded-xl border border-slate-200 bg-white p-3 text-sm" placeholder="Explique o que você precisa…" value={message} onChange={e => setMessage(e.target.value)} /><Button className="mt-2 w-full" disabled={sending || running || !message.trim() || (provider === "cursor" && !cursorAgentId)}>{sending ? "Enviando…" : running ? "Agente trabalhando…" : "Enviar mensagem"}</Button></form>
        </>}
      </div>}
      {tab === "history" && (host ? <AgentHistoryPanel agentId={agent.id} provider={provider} origin={historyIdentity.origin} cloudId={historyIdentity.cloudId} /> : <p className="py-5 text-sm text-slate-500">Histórico privado disponível somente ao anfitrião.</p>)}
      {tab === "cards" && <div className="space-y-3">
        {dispatches.map((d,i) => <div key={`${d.issueId}-${i}`} className="rounded-xl border border-slate-200 p-4"><p className="text-sm font-semibold">{rooms.find(r => r.id === d.projectId)?.name ?? "Projeto"}</p><p className="mt-1 text-xs text-slate-500">Atribuído em {new Date(d.createdAt).toLocaleString("pt-BR")}</p>{dispatchSessionLink(d) && <a className="mt-2 block text-sm underline" href={dispatchSessionLink(d)!.href} target="_blank" rel="noreferrer">Abrir {dispatchSessionLink(d)!.label}</a>}<button className="mt-2 text-sm underline" onClick={() => onBoard(d.projectId)}>Ver card no quadro</button></div>)}
        {!dispatches.length && <p className="py-4 text-sm text-slate-500">Nenhum card atribuído a esta mesa.</p>}
        {host && onAssign && <Button onClick={() => void onAssign()}>Atribuir card carregado</Button>}
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Puxar do quadro</p>{rooms.map(r => <Button key={r.id} variant="outline" className="mr-2 mb-2" onClick={() => onBoard(r.id)}>{r.name}</Button>)}
        {!rooms.length && <p className="text-sm text-slate-500">Abra uma sala vinculada ao Linear para puxar cards.</p>}
        {host && <Button variant="outline" className="w-full" onClick={onHire}>Contratar outro agente</Button>}
      </div>}
      {(error || snapshot.error) && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error ?? snapshot.error}</p>}
    </DialogContent>
  </Dialog>;
}
