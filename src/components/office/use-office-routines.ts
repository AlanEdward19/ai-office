"use client";
import {useCallback,useEffect,useState} from 'react';
import {DEFAULT_IDLE_MS,type RoutineCommand} from '@/domain/agent-routines';
import type {FloorId} from '@/domain/floors';
export function useOfficeRoutines(host:boolean,floor:FloorId){
 const [idleMs,setIdleMs]=useState(DEFAULT_IDLE_MS),[commands,setCommands]=useState<RoutineCommand[]>([]),[error,setError]=useState<string|null>(null);
 useEffect(()=>{if(!host)return;const controller=new AbortController();const refresh=async()=>{try{const response=await fetch('/api/office/routines',{cache:'no-store',signal:controller.signal});if(!response.ok)return;const data=await response.json();if(!controller.signal.aborted){setIdleMs(data.idleMs);setCommands(data.commands);}}catch{}};const timer=setInterval(()=>void refresh(),1000);void refresh();return()=>{controller.abort();clearInterval(timer);};},[host]);
 const send=useCallback(async(body:Record<string,unknown>)=>{if(!host)return false;setError(null);try{const response=await fetch('/api/office/routines',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,floor})});const data=await response.json();if(!response.ok)throw new Error(data.error);setIdleMs(data.idleMs);setCommands(data.commands);return true;}catch(failure){setError(failure instanceof Error?failure.message:'Não foi possível atualizar a rotina.');return false;}},[host,floor]);
 return {idleMs,commands,error,configure:(value:number)=>send({type:'configure',idleMs:value}),approach:(agentId:string,targetId:string|null=null)=>send({type:'approach',agentId,target:targetId?'agent':'user',targetId}),cancel:(agentId:string)=>send({type:'cancel',agentId,target:'user'})};
}
