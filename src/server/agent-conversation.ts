import 'server-only';
import {recordManagedHistory} from './agent-history';
import {spawn, type ChildProcess} from 'node:child_process';
import {accessSync,constants} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {claudeExecutableCandidates} from '@/domain/logins';
import {conversationInput, cursorConversation, parseConversationEvent, record, type ConversationSnapshot, type ConversationProvider} from '@/domain/agent-conversation';
import {officeViewerCount} from './office-channel';
type Input = {hostToken:string;deskId:string;provider:ConversationProvider;cursorAgentId?:string|null};
type Job = {snapshot:ConversationSnapshot;provider:ConversationProvider;sessionId?:string;child?:ChildProcess;cloudId?:string;runId?:string;started:number;deskId?:string;historyId?:string;historyTitle?:string;cancelling?:boolean};
const globalJobs = globalThis as typeof globalThis & {__officeConversations?:Map<string,Job>;__officeConversationTimer?:ReturnType<typeof setInterval>};
const jobs = globalJobs.__officeConversations ??= new Map<string,Job>();
export class ConversationError extends Error { constructor(public status:number,message:string){super(message);} }
function key(input:Input){return `${input.hostToken}:${input.deskId}${input.provider==='cursor'?`:${input.cursorAgentId??''}`:''}`;}
function snapshot(job?:Job):ConversationSnapshot {return job ? structuredClone(job.snapshot) : {status:'idle',messages:[],activity:[]};}
function message(job:Job,role:'user'|'assistant',text:string){job.snapshot.messages.push({role,text:text.slice(0,12000)});job.snapshot.messages=job.snapshot.messages.slice(-40);}
function keepExecution(job:Job,status:'running'|'completed'|'failed'|'stopped'){
  if(!job.deskId)return;
  const sourceId=job.provider==='cursor'&&job.cloudId&&job.runId?`${job.cloudId}:${job.runId}`:job.sessionId??job.historyId;
  if(!sourceId)return;
  void recordManagedHistory({provider:job.provider,deskId:job.deskId,sourceId,startedAt:new Date(job.started).toISOString(),status,title:job.historyTitle,summary:job.snapshot.messages.filter(m=>m.role==='assistant').map(m=>m.text).join('\n\n')||null}).catch(()=>{});
}
async function cloud(path:string,method='GET',body?:unknown) {
  const apiKey=process.env.CURSOR_API_KEY?.trim();
  if(!apiKey)throw new ConversationError(503,'Configure a chave do Cursor para conversar.');
  const response=await fetch(`https://api.cursor.com${path}`,{method,cache:'no-store',signal:AbortSignal.timeout(10000),headers:{Authorization:`Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`,'Content-Type':'application/json'},...(body ? {body:JSON.stringify(body)} : {})});
  if(!response.ok)throw new ConversationError(response.status===409?409:503,response.status===409?'O agente já está trabalhando.':'Não foi possível acessar a conversa do Cursor.');
  return record(await response.json());
}
async function cancel(job:Job){
  if(job.cancelling)throw new ConversationError(409,'A parada já está em andamento.');
  job.cancelling=true;
  try{
    if(job.cloudId && job.runId && job.snapshot.status==='running')await cloud(`/v1/agents/${encodeURIComponent(job.cloudId)}/runs/${encodeURIComponent(job.runId)}/cancel`,'POST');
    if(job.child){const child=job.child;child.kill('SIGTERM');const timer=setTimeout(()=>{if(child.exitCode===null)child.kill('SIGKILL');},2000);timer.unref();}
    job.snapshot.status='stopped';keepExecution(job,'stopped');
  }catch(error){job.snapshot.error='Não foi possível confirmar a parada do Cursor. Tente novamente.';throw error;}
  finally{job.cancelling=false;}
}
function sweep(){
  for(const [id,job] of jobs){
    if(job.cancelling)continue;
    if(officeViewerCount()===0){job.snapshot.messages=[];job.snapshot.activity=[];void cancel(job).then(()=>jobs.delete(id)).catch(()=>{});}
    else if(job.snapshot.status==='running' && Date.now()-job.started>300000){void cancel(job).catch(()=>{});job.snapshot.error='Tempo limite de cinco minutos atingido.';}
  }
}
function executable(provider:ConversationProvider){
  const name=provider==='openai'?'codex':'claude';
  const candidates=[...(process.env.PATH??'').split(':').filter(Boolean).map(dir=>join(dir,name)),...(provider==='anthropic'?claudeExecutableCandidates(homedir()).filter(p=>p!=='claude'):['/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex','/Applications/Codex.app/Contents/Resources/codex'])];
  return candidates.find(path=>{try{accessSync(path,constants.X_OK);return true;}catch{return false;}})??name;
}
if(!globalJobs.__officeConversationTimer){globalJobs.__officeConversationTimer=setInterval(sweep,2000);globalJobs.__officeConversationTimer.unref();}
function validate(input:Input){if(!conversationInput(input))throw new ConversationError(400,'Mesa ou provedor inválido.');}
export async function readAgentConversation(input:Input):Promise<ConversationSnapshot>{
  validate(input);
  const job=jobs.get(key(input));
  if(job && job.provider!==input.provider)throw new ConversationError(409,'Esta mesa tem uma conversa de outro provedor.');
  if(input.provider!=='cursor')return snapshot(job);
  const cloudId=job?.cloudId ?? input.cursorAgentId;
  if(!cloudId)return snapshot(job);
  if(job?.cloudId && input.cursorAgentId && job.cloudId!==input.cursorAgentId)throw new ConversationError(409,'A conversa pertence a outro agente.');
  let messages:ConversationSnapshot['messages']=[];
  try{messages=cursorConversation(await cloud(`/v0/agents/${encodeURIComponent(cloudId)}/conversation`));}catch{/* v1 does not guarantee a legacy history. Read only run results below. */}
  const agent=await cloud(`/v1/agents/${encodeURIComponent(cloudId)}`);
  const runId=job?.runId ?? (typeof agent.latestRunId==='string'?agent.latestRunId:undefined);
  const run=runId?await cloud(`/v1/agents/${encodeURIComponent(cloudId)}/runs/${encodeURIComponent(runId)}`):{};
  const status:ConversationSnapshot['status']=['CREATING','RUNNING'].includes(String(run.status))?'running':run.status==='ERROR'?'error':run.status==='CANCELLED'?'stopped':'idle';
  if(!messages.length){messages=job?.snapshot.messages ?? [];if(typeof run.result==='string' && messages.at(-1)?.text!==run.result.slice(0,12000))messages=[...messages,{role:'assistant' as const,text:run.result.slice(0,12000)}].slice(-40);}
  const result:ConversationSnapshot={status,messages,activity:job?.snapshot.activity ?? [],...(status==='error'?{error:'O agente terminou com erro.'}:{})};
  if(job){job.snapshot=result;keepExecution(job,status==='running'?'running':status==='error'?'failed':status==='stopped'?'stopped':'completed');}
  return structuredClone(result);
}
export async function stopAgentConversation(input:Input){
  validate(input);
  let job=jobs.get(key(input));
  if(input.provider==='cursor'&&input.cursorAgentId){
    const agent=await cloud(`/v1/agents/${encodeURIComponent(input.cursorAgentId)}`);
    if(typeof agent.latestRunId==='string'){
      const run=await cloud(`/v1/agents/${encodeURIComponent(input.cursorAgentId)}/runs/${encodeURIComponent(agent.latestRunId)}`);
      if(['CREATING','RUNNING'].includes(String(run.status))){
        job??={provider:'cursor',snapshot:{status:'running',messages:[],activity:[]},started:Date.now()};
        job.cloudId=input.cursorAgentId;job.runId=agent.latestRunId;job.snapshot.status='running';jobs.set(key(input),job);
      }else return snapshot(job);
    }
  }
  if(job)await cancel(job);
  return snapshot(job);
}
export async function startAgentConversation(input:Input & {message:string}):Promise<ConversationSnapshot>{
  validate(input);
  if(typeof input.message!=='string'||!input.message.trim()||input.message.length>12000)throw new ConversationError(400,'Escreva uma mensagem de até 12.000 caracteres.');
  if(officeViewerCount()===0)throw new ConversationError(409,'Abra o escritório antes de enviar uma mensagem.');
  const id=key(input),existing=jobs.get(id);
  if(existing?.snapshot.status==='running'||existing?.child||existing?.cancelling)throw new ConversationError(409,'Aguarde a resposta ou pare o agente.');
  if(existing && existing.provider!==input.provider)throw new ConversationError(409,'Esta mesa tem uma conversa de outro provedor.');
  if(jobs.size>=100&&!existing)throw new ConversationError(503,'Limite de conversas atingido.');
  const job:Job=existing ?? {provider:input.provider,snapshot:{status:'idle',messages:[],activity:[]},started:Date.now()};
  job.snapshot.status='running';job.snapshot.error=undefined;job.started=Date.now();job.deskId=input.deskId;job.historyId=crypto.randomUUID();job.historyTitle=input.message; jobs.set(id,job);
  if(input.provider==='cursor'){
    const cloudId=input.cursorAgentId ?? job.cloudId;
    if(!cloudId){job.snapshot.status='error';throw new ConversationError(400,'Selecione um cloud agent para continuar.');}
    if(job.cloudId&&job.cloudId!==cloudId){job.snapshot.status='error';throw new ConversationError(409,'A mesa já está ligada a outro agente.');}
    try{const run=await cloud(`/v1/agents/${encodeURIComponent(cloudId)}/runs`,'POST',{prompt:{text:input.message}});const runId=typeof run.id==='string'?run.id:record(run.run).id;if(typeof runId!=='string')throw new ConversationError(503,'O Cursor não retornou a execução.');job.cloudId=cloudId;job.runId=runId;if(jobs.get(id)!==job||officeViewerCount()===0){await cancel(job);return snapshot(job);}message(job,'user',input.message);keepExecution(job,'running');return snapshot(job);}catch(error){job.snapshot.status='error';job.snapshot.error='Não foi possível iniciar a resposta.';throw error;}
  }
  const args=input.provider==='openai'?(job.sessionId?['exec','resume','--json',job.sessionId,'-']:['exec','--json','-']):['-p','--verbose','--output-format','stream-json',...(job.sessionId?['--resume',job.sessionId]:[])];
  const child=spawn(executable(input.provider),args,{cwd:process.cwd(),shell:false,stdio:['pipe','pipe','pipe']});
  job.child=child;message(job,'user',input.message);
  let buffer='',bytes=0;
  const line=(raw:string)=>{try{const event=parseConversationEvent(input.provider,JSON.parse(raw));if(event.sessionId){job.sessionId=event.sessionId;keepExecution(job,'running');}if(event.text)message(job,'assistant',event.text);if(event.tool){job.snapshot.activity.push(event.tool);job.snapshot.activity=job.snapshot.activity.slice(-20);}}catch{/* Ignore non-JSON diagnostics; never expose raw process output. */}};
  child.stdout?.setEncoding('utf8');
  child.stdout?.on('data',(data:string)=>{if(job.child!==child)return;bytes+=Buffer.byteLength(data,'utf8');if(bytes>2000000){job.snapshot.error='Limite de saída atingido.';void cancel(job).catch(()=>{});return;}buffer+=data;const lines=buffer.split('\n');buffer=lines.pop()??'';for(const raw of lines)line(raw);});
  child.stderr?.resume();
  child.stdin?.on('error',()=>{});
  child.on('error',()=>{if(job.child!==child)return;job.snapshot.status='error';job.snapshot.error='CLI indisponível. Verifique instalação e login.';keepExecution(job,'failed');});
  child.on('close',code=>{if(job.child!==child)return;if(buffer)line(buffer);if(job.child===child)job.child=undefined;if(job.snapshot.status==='running'){job.snapshot.status=code===0?'idle':'error';if(code!==0)job.snapshot.error='A execução falhou. Verifique login e permissões do provedor.';keepExecution(job,code===0?'completed':'failed');}});
  child.stdin?.end(input.message);
  return snapshot(job);
}
