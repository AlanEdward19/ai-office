"use client";
import {useCallback,useEffect,useState} from 'react';
import type {HistoryPage} from '@/domain/agent-history';
import type {ProviderId} from '@/domain/providers';
import {Button} from '@/components/ui/button';
const labels={running:'Em andamento',completed:'Concluída',failed:'Falhou',stopped:'Interrompida',unknown:'Estado desconhecido'};
export function AgentHistoryPanel({agentId,provider,origin,cloudId}:{agentId:string;provider:ProviderId;origin:'local'|'cloud';cloudId:string|null}){
 const [selectedOrigin,setSelectedOrigin]=useState(origin);
 const [page,setPage]=useState<HistoryPage|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState<string|null>(null),[revision,setRevision]=useState(0);
 const load=useCallback(async(cursor:string|null,signal?:AbortSignal)=>{
  setLoading(true);setError(null);
  try{const query=new URLSearchParams({agentId,provider,origin:selectedOrigin});if(cursor)query.set('cursor',cursor);if(cloudId&&selectedOrigin==='cloud')query.set('cloudId',cloudId);const response=await fetch(`/api/agents/history?${query}`,{cache:'no-store',signal});const body=await response.json();if(!response.ok)throw new Error(body.error??'Não foi possível acessar o histórico.');if(signal?.aborted)return;setPage(previous=>cursor&&previous?{...body,executions:[...previous.executions,...body.executions]}:body);}
  catch(failure){if(!signal?.aborted)setError(failure instanceof Error?failure.message:'Falha ao carregar histórico.');}
  finally{if(!signal?.aborted)setLoading(false);}
 },[agentId,provider,selectedOrigin,cloudId]);
 useEffect(()=>{const controller=new AbortController();const timer=setTimeout(()=>void load(null,controller.signal),0);return()=>{clearTimeout(timer);controller.abort();};},[load,revision]);
 return <section className="space-y-4" aria-label="Histórico de tarefas">
  <div className="flex items-start justify-between gap-4"><div><h3 className="font-semibold">Tarefas reais</h3><p className="mt-1 text-xs text-slate-500">Últimos 30 dias · até 500 execuções nesta máquina</p></div><Button variant="outline" disabled={loading} onClick={()=>setRevision(value=>value+1)}>Atualizar</Button></div>
  {provider==='anthropic'&&<label className="flex items-center gap-3 text-sm">Origem das execuções<select aria-label="Origem do histórico" className="rounded-xl border border-slate-200 p-2" value={selectedOrigin} onChange={event=>{setPage(null);setSelectedOrigin(event.target.value as 'local'|'cloud');}}><option value="local">Local / gerenciada</option><option value="cloud">Claude cloud</option></select></label>}
  {page&&<p className={`rounded-xl p-3 text-sm ${page.availability.state==='available'?'bg-slate-50 text-slate-600':'bg-amber-50 text-amber-800'}`}>{page.availability.message}</p>}
  {error&&<div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700"><p>{error}</p><button className="mt-2 underline" onClick={()=>setRevision(value=>value+1)}>Tentar novamente</button></div>}
  {loading&&!page&&<p role="status" className="py-8 text-center text-sm text-slate-500">Consultando registros do provedor…</p>}
  {page&&!page.executions.length&&!loading&&<p className="py-8 text-center text-sm text-slate-500">Nenhuma execução real disponível para esta origem. Não há tarefas anteriores recuperadas.</p>}
  <div className="space-y-3">{page?.executions.map(row=><article key={row.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">{row.title??'Título desconhecido'}</p><span className="rounded-full bg-slate-100 px-3 py-1 text-xs">{labels[row.status]}</span></div><p className="mt-2 text-xs text-slate-500">{row.provider} · {row.origin==='cloud'?'Cloud':'Local'} · {row.agentId===null?'Arquivo do provedor — vínculo com esta mesa desconhecido':'Sessão desta mesa'}</p><dl className="mt-3 grid grid-cols-1 gap-2 text-xs text-slate-500 sm:grid-cols-2"><div><dt>Início</dt><dd>{row.startedAt?new Date(row.startedAt).toLocaleString('pt-BR'):'Desconhecido'}</dd></div><div><dt>Fim</dt><dd>{row.endedAt?new Date(row.endedAt).toLocaleString('pt-BR'):'Desconhecido'}</dd></div></dl>{row.summary?<details className="mt-3"><summary className="cursor-pointer text-sm text-slate-700">Ver resumo disponível{row.truncated?' (resumo parcial, até 12.000 caracteres)':''}</summary><p className="mt-3 whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{row.summary}</p></details>:<p className="mt-3 text-xs text-slate-400">Resumo não fornecido pelo provedor.</p>}</article>)}</div>
  {page?.nextCursor&&<Button className="w-full" variant="outline" disabled={loading} onClick={()=>void load(page.nextCursor)}>{loading?'Carregando…':'Carregar mais tarefas'}</Button>}
 </section>;
}
