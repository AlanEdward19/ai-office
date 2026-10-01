import {historyExecution, type HistoryExecution} from './agent-history';
function object(value:unknown):Record<string,unknown>{return value&&typeof value==='object'?value as Record<string,unknown>:{};}
function textContent(value:unknown):string|null {if(typeof value==='string')return value;if(!Array.isArray(value))return null;const texts=value.flatMap(item=>{const r=object(item);return ['text','output_text'].includes(String(r.type))&&typeof r.text==='string'?[r.text]:[];});return texts.length?texts.join('\n'):null;}
/** Whitelist assistant prose; tool payloads, cwd and credentials never become history. */
export function localHistoryLog(provider:'openai'|'anthropic',raw:string,observedAt:string,secrets:readonly string[]=[]):HistoryExecution|null {
 let sourceId:string|null=null,title:string|null=null,startedAt:unknown=null,endedAt:unknown=null,status='unknown';const texts:string[]=[];
 for(const line of raw.split('\n')){let r:Record<string,unknown>;try{r=object(JSON.parse(line));}catch{continue;}const payload=object(r.payload),message=object(r.message);
  if(provider==='openai'&&r.type==='session_meta'){if(typeof payload.id==='string')sourceId=payload.id;startedAt=payload.timestamp??r.timestamp;}
  if(provider==='anthropic'&&typeof r.sessionId==='string'){sourceId??=r.sessionId;startedAt??=r.timestamp;}
  if(r.type==='user'&&title===null)title=textContent(message.content)?.slice(0,200)??null;
  if(r.type==='assistant'&&message.role==='assistant'){const text=textContent(message.content);if(text)texts.push(text);}
  if(r.type==='response_item'&&payload.role==='assistant'){const text=textContent(payload.content);if(text)texts.push(text);}
  if(r.type==='event_msg'&&payload.type==='task_complete'){endedAt=r.timestamp;status='completed';}
  if(r.type==='event_msg'&&payload.type==='task_started'){status='running';}
  if(r.type==='result'){status=r.is_error===true?'failed':r.is_error===false||r.subtype==='success'?'completed':'unknown';endedAt=r.timestamp??null;if(typeof r.result==='string')texts.push(r.result);}
 }
 if(!sourceId)return null;return historyExecution({provider,origin:'local',sourceId,title,startedAt,endedAt,observedAt,status,summary:texts.join('\n\n')||null},secrets);
}
export function providerHistoryRows(provider:'openai'|'anthropic'|'cursor',payload:unknown,observedAt:string,secrets:readonly string[]=[]):HistoryExecution[] {
 const root=object(payload),result=object(root.result);const rows=Array.isArray(payload)?payload:Array.isArray(root.items)?root.items:Array.isArray(result.data)?result.data:Array.isArray(root.data)?root.data:result.thread?[result.thread]:[];
 return rows.flatMap(value=>{const r=object(value),id=r.id??r.sessionId;if(typeof id!=='string'||(provider==='cursor'&&typeof r.latestRunId!=='string'))return [];const state=object(r.status);const upper=String(state.type??r.status??r.state).toUpperCase();
  const execution=historyExecution({provider,origin:provider==='cursor'?'cloud':'local',cloudId:provider==='cursor'?id:null,sourceId:provider==='cursor'&&typeof r.latestRunId==='string'?`${id}:${r.latestRunId}`:id,title:r.name??r.title??r.preview,startedAt:r.createdAt??r.created_at,endedAt:r.endedAt??r.completedAt,observedAt,status:['RUNNING','ACTIVE','BUSY','WORKING'].includes(upper)?'running':['FINISHED','COMPLETED','DONE'].includes(upper)?'completed':['ERROR','FAILED'].includes(upper)?'failed':['CANCELLED','STOPPED'].includes(upper)?'stopped':'unknown',summary:typeof r.result==='string'?r.result:null},secrets);return execution?[execution]:[];
 });
}
