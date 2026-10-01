import 'server-only';
import {open,readFile,readdir,stat} from 'node:fs/promises';
import {historyFileIO} from './history-file';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {historyExecution,historyPage,historyRepository, type HistoryExecution, type HistoryAvailability} from '@/domain/agent-history';
import {localHistoryLog,providerHistoryRows} from '@/domain/agent-history-import';
import type {ProviderId} from '@/domain/providers';
const directory=join(process.cwd(),'.office-data');
function secrets(){return Object.entries(process.env).filter(([key,value])=>/KEY|TOKEN|SECRET|PASSWORD/.test(key)&&value&&value.length>=8).map(([,value])=>value!);}
const globalHistory=globalThis as typeof globalThis & {__officeHistory?:ReturnType<typeof historyRepository>;__officeHistoryRefresh?:Map<string,{at:number;availability:HistoryAvailability;pending?:Promise<HistoryAvailability>}>};
const repository=globalHistory.__officeHistory??=historyRepository(historyFileIO(directory));
const refreshes=globalHistory.__officeHistoryRefresh??=new Map();
export async function retainHistory(rows:HistoryExecution[]){if(rows.length)await repository.append(rows);}
export async function recordProviderHistory(provider:'openai'|'anthropic'|'cursor',payload:unknown){await retainHistory(providerHistoryRows(provider,payload,new Date().toISOString(),secrets()));}
/** Only source folders already owned by a provider; bounded read of recent JSONL files. */
async function localFiles(root:string):Promise<{files:string[];available:boolean}> {
 const files:string[]=[];let visited=0,available=false;
 async function scan(path:string,depth:number){if(depth>4||visited>=2000||files.length>=500)return;let entries;try{entries=await readdir(path,{withFileTypes:true});available=true;}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return;throw error;}
  for(const entry of entries.sort((a,b)=>b.name.localeCompare(a.name))){if(visited++>=2000||files.length>=500)break;if(entry.isSymbolicLink())continue;const child=join(path,entry.name);if(entry.isDirectory())await scan(child,depth+1);else if(entry.isFile()&&entry.name.endsWith('.jsonl')){const info=await stat(child);if(info.mtimeMs>=Date.now()-30*86400000)files.push(child);}}
 }
 await scan(root,0);return {files,available};
}
async function boundedLog(path:string,size:number){
 if(size<=1000000)return {raw:await readFile(path,'utf8'),partial:false};
 const handle=await open(path,'r');try{const first=Buffer.alloc(256000),last=Buffer.alloc(256000);const begin=await handle.read(first,0,first.length,0),finish=await handle.read(last,0,last.length,Math.max(0,size-last.length));const head=first.subarray(0,begin.bytesRead).toString('utf8'),tail=last.subarray(0,finish.bytesRead).toString('utf8');return {raw:head.slice(0,head.lastIndexOf('\n'))+'\n'+tail.slice(tail.indexOf('\n')+1),partial:true};}finally{await handle.close();}
}
async function importLocal(provider:'openai'|'anthropic'):Promise<HistoryAvailability>{
 const root=provider==='openai'?join(process.env.CODEX_HOME||join(homedir(),'.codex'),'sessions'):join(homedir(),'.claude','projects');const source=await localFiles(root);const rows:HistoryExecution[]=[];
 for(const path of source.files){const info=await stat(path);const log=await boundedLog(path,info.size);const row=localHistoryLog(provider,log.raw,info.mtime.toISOString(),secrets());if(row)rows.push({...row,truncated:row.truncated||log.partial});}
 await retainHistory(rows);return {state:source.available?'partial':'unavailable',message:source.available?'Até 500 registros locais recentes por leitura do provedor; arquivos grandes oferecem resumo parcial. Conteúdo e tempos ausentes aparecem como desconhecidos; registros antigos não disponíveis não são inventados.':'O provedor não disponibilizou registros anteriores nesta máquina. Novas execuções desta mesa serão preservadas.'};
}
async function importCloud():Promise<HistoryAvailability>{
 const key=process.env.CURSOR_API_KEY?.trim();if(!key)return {state:'unavailable',message:'Configure o Cursor para consultar execuções cloud anteriores.'};
 const response=await fetch('https://api.cursor.com/v1/agents?limit=100&includeArchived=true',{cache:'no-store',signal:AbortSignal.timeout(10000),headers:{Authorization:`Bearer ${key}`,Accept:'application/json'}});
 if(!response.ok)return {state:'unavailable',message:'O Cursor não disponibilizou o histórico cloud. Execuções já observadas permanecem abaixo.'};
 const payload=await response.json();const rows=providerHistoryRows('cursor',payload,new Date().toISOString(),secrets());await retainHistory(rows);
 const budget=AbortSignal.timeout(20000);
 for(let offset=0;offset<rows.length&&!budget.aborted;offset+=3){await Promise.allSettled(rows.slice(offset,offset+3).map(async row=>{
  const runId=row.sourceId.slice((row.cloudId?.length??0)+1);if(!row.cloudId||!runId)return;
  const runResponse=await fetch(`https://api.cursor.com/v1/agents/${encodeURIComponent(row.cloudId)}/runs/${encodeURIComponent(runId)}`,{cache:'no-store',signal:budget,headers:{Authorization:`Bearer ${key}`,Accept:'application/json'}});if(!runResponse.ok)return;
  const run=await runResponse.json() as Record<string,unknown>;const status=String(run.status).toUpperCase();const update=historyExecution({...row,status:['RUNNING','CREATING'].includes(status)?'running':status==='FINISHED'?'completed':status==='ERROR'?'failed':status==='CANCELLED'?'stopped':'unknown',startedAt:run.startedAt??run.createdAt??row.startedAt,endedAt:run.endedAt??run.completedAt??null,summary:typeof run.result==='string'?run.result:null},secrets());if(update)await retainHistory([update]);
 }));}
 return {state:'partial',message:'Agentes e últimas execuções que o Cursor expõe. Versões anteriores não expostas pela API ficam indisponíveis; resumos são preenchidos quando retornados pelo provedor.'};
}
async function refresh(provider:ProviderId,origin:'local'|'cloud'):Promise<HistoryAvailability>{
 const id=`${provider}:${origin}`,prior=refreshes.get(id);if(prior?.pending)return prior.pending;if(prior&&Date.now()-prior.at<60000)return prior.availability;
 const pending=(origin==='cloud'&&provider==='cursor'?importCloud():origin==='local'&&(provider==='openai'||provider==='anthropic')?importLocal(provider):Promise.resolve<HistoryAvailability>({state:'unavailable',message:'Esta integração não expõe sessões anteriores.'})).catch(()=>({state:'unavailable' as const,message:'Não foi possível ler a fonte histórica do provedor. Tente novamente; o histórico preservado permanece disponível.'}));
 refreshes.set(id,{at:Date.now(),availability:prior?.availability??{state:'unavailable',message:'Consultando provedor.'},pending});const availability=await pending;refreshes.set(id,{at:Date.now(),availability});return availability;
}
export async function readAgentHistory(query:{provider:ProviderId;origin:'local'|'cloud';agentId:string;cursor:number;cloudId?:string|null}) {
 await repository.read(); // A corrupt store cannot be overwritten by an import.
 const availability=await refresh(query.provider,query.origin);return historyPage(await repository.read(),query,availability);
}
export async function recordManagedHistory(input:{provider:'openai'|'anthropic'|'cursor';deskId:string;sourceId:string;startedAt:string;status:'running'|'completed'|'failed'|'stopped';summary?:string|null;title?:string|null}){
 const row=historyExecution({...input,origin:input.provider==='cursor'?'cloud':'local',cloudId:input.provider==='cursor'?input.sourceId.split(':')[0]:null,agentId:input.deskId,observedAt:new Date().toISOString(),endedAt:input.status==='running'?null:new Date().toISOString()},secrets());if(row)await retainHistory([row]);
}
