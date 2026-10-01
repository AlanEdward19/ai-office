import {DEFAULT_IDLE_MS,type RoutineCommand} from './agent-routines';
export type RoutineControl={idleMs:number;commands:RoutineCommand[]};
export function createRoutineControl(){let idleMs=DEFAULT_IDLE_MS;const commands=new Map<string,RoutineCommand>();return {read:():RoutineControl=>({idleMs,commands:[...commands.values()]}),configure(value:number){idleMs=value;},send(command:RoutineCommand){commands.set(command.agentId,{...command,stamp:Math.max(command.stamp,(commands.get(command.agentId)?.stamp??0)+1)});}};}
export async function routinesResponse(request:Request,session:{role:string}|null,control:ReturnType<typeof createRoutineControl>,agents:readonly {id:string}[]):Promise<Response>{
 if(!session)return Response.json({error:'Entre no escritório.'},{status:401});if(session.role!=='host')return Response.json({error:'Somente o anfitrião configura rotinas e conversas.'},{status:403});
 if(request.method==='GET')return Response.json(control.read(),{headers:{'Cache-Control':'no-store'}});
 let body:Record<string,unknown>;try{const raw=await request.text();if(raw.length>2000)throw new Error();const parsed=JSON.parse(raw);if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error();body=parsed;}catch{return Response.json({error:'Ação inválida.'},{status:400});}
 if(body.type==='configure'){if(typeof body.idleMs!=='number'||!Number.isInteger(body.idleMs)||body.idleMs<30000||body.idleMs>3600000)return Response.json({error:'Escolha um prazo de 30 segundos a uma hora.'},{status:400});control.configure(body.idleMs);return Response.json(control.read());}
 if(!['approach','cancel'].includes(String(body.type))||typeof body.agentId!=='string'||!['user','agent'].includes(String(body.target)))return Response.json({error:'Ação ou interlocutor inválido.'},{status:400});
 const targetId=typeof body.targetId==='string'?body.targetId:null;
 if(!agents.some(a=>a.id===body.agentId)||body.target==='agent'&&(!targetId||targetId===body.agentId||!agents.some(a=>a.id===targetId))||body.type==='approach'&&body.target==='user'&&body.floor!=='ground')return Response.json({error:'Interlocutor indisponível. Encontros acontecem no térreo.'},{status:409});
 control.send({type:body.type as 'approach'|'cancel',agentId:body.agentId,target:body.target as 'user'|'agent',targetId,stamp:Date.now()});return Response.json(control.read());
}
