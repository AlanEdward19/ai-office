import {isProviderId, type ProviderId} from './providers';
export type HistoryExecution = {id:string;provider:ProviderId;origin:'local'|'cloud';agentId:string|null;cloudId:string|null;sourceId:string;title:string|null;startedAt:string|null;endedAt:string|null;observedAt:string;status:'running'|'completed'|'failed'|'stopped'|'unknown';summary:string|null;truncated:boolean};
export type HistoryAvailability = {state:'available'|'partial'|'unavailable';message:string};
export type HistoryPage = {executions:HistoryExecution[];nextCursor:string|null;availability:HistoryAvailability};
export const HISTORY_LIMIT=500, HISTORY_DAYS=30, SUMMARY_LIMIT=12000;
export function historyText(value:unknown,secrets:readonly string[]=[]):string|null {
 if(typeof value!=='string'||!value.trim())return null;
 let text=value.replace(/\b(?:Bearer|Basic)\s+[A-Za-z0-9+/_=.:-]+/gi,'[credencial removida]').replace(/\b(?:sk|ghp|github_pat)[-_][A-Za-z0-9_-]{12,}/g,'[credencial removida]').replace(/\b(?:api[_ -]?key|token|password|secret)\s*[:=]\s*["']?[^\s,"';]+/gi,'[credencial removida]').replace(/(?:\/(?:Users|home|private|tmp|var|root)\/[^\s"'<>]+|[A-Z]:\\[^\s"'<>]+)/g,'[caminho privado]');
 for(const secret of secrets)if(secret.length>=8)text=text.split(secret).join('[credencial removida]');
 return text.trim();
}
function date(value:unknown):string|null {if(typeof value==='number'&&Number.isFinite(value)){const instant=new Date(value<1e12?value*1000:value);return Number.isFinite(instant.getTime())?instant.toISOString():null;}if(typeof value==='string'&&Number.isFinite(Date.parse(value)))return new Date(value).toISOString();return null;}
export function historyExecution(value:unknown,secrets:readonly string[]=[]):HistoryExecution|null {
 if(!value||typeof value!=='object')return null;const v=value as Record<string,unknown>;
 if(!isProviderId(v.provider)||!['local','cloud'].includes(String(v.origin))||typeof v.sourceId!=='string'||!/^[A-Za-z0-9:_-]{1,200}$/.test(v.sourceId))return null;
 const summary=historyText(v.summary,secrets),observedAt=date(v.observedAt);if(!observedAt)return null;
 return {id:`${v.provider}:${v.origin}:${v.sourceId}`,provider:v.provider,origin:v.origin as 'local'|'cloud',agentId:typeof v.agentId==='string'?v.agentId.slice(0,100):null,cloudId:typeof v.cloudId==='string'?v.cloudId.slice(0,200):null,sourceId:v.sourceId,title:historyText(v.title,secrets)?.slice(0,200)??null,startedAt:date(v.startedAt),endedAt:date(v.endedAt),observedAt,status:['running','completed','failed','stopped'].includes(String(v.status))?v.status as HistoryExecution['status']:'unknown',summary:summary?.slice(0,SUMMARY_LIMIT)??null,truncated:v.truncated===true||(summary?.length??0)>SUMMARY_LIMIT};
}
export function mergeHistory(existing:readonly HistoryExecution[],incoming:readonly HistoryExecution[],now:number):HistoryExecution[] {
 const rows=new Map(existing.map(row=>[row.id,row]));for(const row of incoming){const previous=rows.get(row.id);rows.set(row.id,previous?{...row,agentId:row.agentId??previous.agentId,title:row.title??previous.title,startedAt:[row.startedAt,previous.startedAt].filter((time):time is string=>time!==null).sort()[0]??null,endedAt:row.status==='running'?null:row.endedAt??previous.endedAt,status:row.status==='unknown'?previous.status:row.status,summary:row.summary??previous.summary,truncated:row.summary===null?previous.truncated:row.truncated}:row);}
 return [...rows.values()].filter(row=>Date.parse(row.endedAt??(row.status==='running'?row.observedAt:row.startedAt??row.observedAt))>=now-HISTORY_DAYS*86400000).sort((a,b)=>(b.startedAt??b.observedAt).localeCompare(a.startedAt??a.observedAt)||a.id.localeCompare(b.id)).slice(0,HISTORY_LIMIT);
}
export function historyPage(rows:readonly HistoryExecution[],input:{provider:ProviderId;origin:'local'|'cloud';agentId:string;cursor:number;cloudId?:string|null},availability:HistoryAvailability):HistoryPage {
 const selected=rows.filter(r=>r.provider===input.provider&&r.origin===input.origin&&(r.agentId===null||r.agentId===input.agentId)&&(!input.cloudId||r.cloudId===input.cloudId));const end=input.cursor+20;
 return {executions:selected.slice(input.cursor,end),nextCursor:end<selected.length?String(end):null,availability};
}
export function parseHistoryFile(raw:string):HistoryExecution[] {
 if(raw.length>8000000)throw new Error('history_corrupt');
 const parsed=JSON.parse(raw) as {version?:unknown;executions?:unknown};if(parsed.version!==1||!Array.isArray(parsed.executions))throw new Error('history_corrupt');
 const result=parsed.executions.map(row=>historyExecution(row));if(result.some(row=>!row))throw new Error('history_corrupt');return result as HistoryExecution[];
}
export type HistoryIO={read:()=>Promise<string|null>;writeAtomic:(raw:string)=>Promise<void>};
export function historyRepository(io:HistoryIO,now:()=>number=Date.now){
 let queue:Promise<unknown>=Promise.resolve();
 return {async read(){const raw=await io.read();return raw===null?[]:mergeHistory(parseHistoryFile(raw),[],now());},append(incoming:HistoryExecution[]){const update=queue.then(async()=>{const raw=await io.read();const rows=mergeHistory(raw===null?[]:parseHistoryFile(raw),incoming,now());await io.writeAtomic(JSON.stringify({version:1,executions:rows}));return rows;});queue=update.catch(()=>{});return update;}};
}
export async function historyResponse(request:Request,session:{role:string}|null,read:(query:{provider:ProviderId;origin:'local'|'cloud';agentId:string;cursor:number;cloudId?:string|null})=>Promise<HistoryPage>):Promise<Response>{
 if(!session)return Response.json({error:'Entre no escritório para ver histórico.'},{status:401});if(session.role!=='host')return Response.json({error:'Histórico privado disponível somente ao anfitrião.'},{status:403});
 const query=new URL(request.url).searchParams,provider=query.get('provider'),origin=query.get('origin'),agentId=query.get('agentId')??'',cursor=query.get('cursor')??'0',cloudId=query.get('cloudId');
 if(!isProviderId(provider)||!['local','cloud'].includes(origin??'')||!/^[A-Za-z0-9:_-]{1,100}$/.test(agentId)||!/^\d{1,5}$/.test(cursor)||(cloudId!==null&&!/^[A-Za-z0-9_-]{1,200}$/.test(cloudId)))return Response.json({error:'Agente, origem ou página inválida.'},{status:400});
 try{return Response.json(await read({provider,origin:origin as 'local'|'cloud',agentId,cursor:Number(cursor),cloudId}),{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'Histórico indisponível. O arquivo foi preservado; corrija a origem e tente novamente.'},{status:503});}
}
