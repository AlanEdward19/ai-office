import type {PlacedAgent} from './placement';
import {coffeeApproach,CAFE_SEATS,seatOccupied} from './seating';
import {OFFICE_ENTRY} from './office-map';
import {nearestClear,officeRoute,segmentClear,type Point} from './office-navigation';
import {entryBarriers,type Obstacle,type Pose,type WalkBounds} from './walker';
import type {FloorId} from './floors';
export const DEFAULT_IDLE_MS=300000;
export const ROUTINE_STATES=['working','coffee','sleeping','returning','packing','leaving','absent','arriving','waiting','assembling','approaching','talking','blocked'] as const;
export type RoutineState=typeof ROUTINE_STATES[number];
export type RoutineVisual={id:string;x:number;z:number;yaw:number;state:RoutineState;visible:boolean;deskReady:boolean;buildProgress:number;coffeeSeat?:number;seatBlocked?:boolean};
export type RoutineCommand={type:'approach'|'cancel';agentId:string;target:'user'|'agent';targetId:string|null;stamp:number};
export type RoutineResult={agentId:string;status:'arrived'|'cancelled'|'blocked';target:'user'|'agent';message:string};
type Actor=RoutineVisual & {idleSince:number|null;wasWorking:boolean;route:Point[];goal:string|null;goalPoint:Point|null;phaseAt:number;routeAt:number;command:RoutineCommand|null;seenCommand:number};
type Tick={occupiedSeats?:readonly {x:number;z:number}[];agents:readonly PlacedAgent[];now:number;dt:number;obstacles:readonly Obstacle[];bounds:WalkBounds;user:Pose;floor:FloorId;locks:readonly Obstacle[];idleMs:number;reducedMotion:boolean};
const entry={x:OFFICE_ENTRY.x,z:OFFICE_ENTRY.z+.7};
const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.z-b.z);
function choice(id:string){let hash=0;for(const c of id)hash=(hash*31+c.charCodeAt(0))>>>0;return hash%2;}
export function readRoutineVisual(value:unknown):RoutineVisual|null {
 if(!value||typeof value!=='object')return null;const r=value as Record<string,unknown>;
 if(typeof r.id!=='string'||!/^[A-Za-z0-9:_-]{1,100}$/.test(r.id)||!ROUTINE_STATES.includes(r.state as RoutineState))return null;
 for(const key of ['x','z','yaw','buildProgress'])if(typeof r[key]!=='number'||!Number.isFinite(r[key])||Math.abs(r[key] as number)>100)return null;
 if(typeof r.visible!=='boolean'||typeof r.deskReady!=='boolean')return null;
 return {id:r.id,x:r.x as number,z:r.z as number,yaw:r.yaw as number,state:r.state as RoutineState,visible:r.visible,deskReady:r.deskReady,buildProgress:Math.max(0,Math.min(1,r.buildProgress as number)),...(Number.isInteger(r.coffeeSeat)&&Number(r.coffeeSeat)>=0&&Number(r.coffeeSeat)<4?{coffeeSeat:Number(r.coffeeSeat)}:{}),...(r.seatBlocked===true?{seatBlocked:true}:{})};
}
export function createAgentRoutines(){
 const coffeeSlots=new Map<string,number>();
 const actors=new Map<string,Actor>(),pendingHires=new Set<string>();let hr:Actor|null=null,hireTarget:string|null=null,hrBlocked=false;
 const results:RoutineResult[]=[];
 const visual=(actor:Actor):RoutineVisual=>({id:actor.id,x:actor.x,z:actor.z,yaw:actor.yaw,state:actor.state,visible:actor.visible,deskReady:actor.deskReady,buildProgress:actor.buildProgress,...(actor.coffeeSeat!==undefined?{coffeeSeat:actor.coffeeSeat}:{}),...(actor.seatBlocked?{seatBlocked:true}:{})});
 function make(id:string,p:Point,now:number,waiting=false):Actor{return {id,...p,yaw:0,state:waiting?'waiting':'sleeping',visible:!waiting,deskReady:!waiting,buildProgress:waiting?0:1,idleSince:now,wasWorking:false,route:[],goal:null,goalPoint:null,phaseAt:now,routeAt:0,command:null,seenCommand:0};}
 function cancel(actor:Actor,message:string,status:RoutineResult['status']='cancelled'){if(actor.command)results.push({agentId:actor.id,target:actor.command.target,status,message});actor.command=null;actor.route=[];actor.goal=null;actor.goalPoint=null;actor.state=status==='blocked'?'blocked':'returning';actor.phaseAt=0;}
 function travel(actor:Actor,target:Point,key:string,input:Tick,speed=2.2){
  const blockers=[...input.obstacles,...entryBarriers(actor,input.locks)];
  const end=nearestClear(target,input.bounds,blockers,.8);if(!end){actor.state='blocked';return false;}
  if(actor.goal!==key||!actor.goalPoint||distance(actor.goalPoint,end)>.4||(!actor.route.length&&distance(actor,end)>.12)){
   if(actor.goal===key&&input.now-actor.routeAt<350){if(!actor.route.length)actor.state='blocked';return false;}
   actor.routeAt=input.now;actor.goal=key;actor.goalPoint=end;actor.route=officeRoute(actor,end,input.bounds,blockers)??[];
   if(!actor.route.length&&distance(actor,end)>.12){actor.state='blocked';return false;}
  }
  let remaining=Math.min(input.dt,.1)*speed;
  while(actor.route.length&&remaining>0){const next=actor.route[0],length=distance(actor,next);if(!segmentClear(actor,next,blockers)){actor.route=[];actor.goal=null;actor.state='blocked';return false;}const step=Math.min(remaining,length);if(length>.001){const angle=Math.atan2(-(next.x-actor.x),-(next.z-actor.z));actor.x+=(next.x-actor.x)*step/length;actor.z+=(next.z-actor.z)*step/length;const delta=Math.atan2(Math.sin(angle-actor.yaw),Math.cos(angle-actor.yaw));actor.yaw+=delta*(input.reducedMotion?1:Math.min(1,input.dt*12));}remaining-=step;if(length<=step+.001)actor.route.shift();else break;}
  return !actor.route.length&&distance(actor,end)<.12;
 }
 function atDesk(agent:PlacedAgent,input:Tick){return nearestClear({x:agent.x,z:agent.z-1.15},input.bounds,input.obstacles,1.5);}
 return {
  hire(id:string){pendingHires.add(id);},
  command(command:RoutineCommand){const actor=actors.get(command.agentId);if(!actor)return false;if(command.stamp<=actor.seenCommand)return true;actor.seenCommand=command.stamp;if(command.type==='cancel'){cancel(actor,'Encontro cancelado.');return true;}if(actor.state==='waiting'||!actor.deskReady)return false;actor.command=command;actor.visible=true;actor.state='approaching';actor.goal=null;actor.phaseAt=0;return true;},
  tick(input:Tick){
   const occupied=[...(input.occupiedSeats??[]),...(input.floor==='ground'&&input.user.seated?[input.user]:[])];
   for(const [id] of coffeeSlots)if(!actors.has(id)||actors.get(id)?.state!=='coffee'||seatOccupied(CAFE_SEATS[coffeeSlots.get(id)!],occupied)){coffeeSlots.delete(id);const actor=actors.get(id);if(actor)delete actor.coffeeSeat;}
   const ids=new Set(input.agents.map(a=>a.id));for(const [id,actor]of actors)if(!ids.has(id)){cancel(actor,'Interlocutor saiu do escritório.');actors.delete(id);}
   for(const agent of input.agents){let actor=actors.get(agent.id);if(!actor){const waiting=pendingHires.has(agent.id);const point=waiting?entry:atDesk(agent,input);if(!point)continue;actor=make(agent.id,point,input.now,waiting);actors.set(agent.id,actor);}
    delete actor.seatBlocked;
    const busy=agent.claudeCloudLabel?agent.claudeCloudLabel==='running':agent.event.status==='working'||agent.event.status==='blocked';
    if(busy){actor.idleSince=null;if(!actor.wasWorking&&actor.command)cancel(actor,'O agente voltou ao trabalho.');if(actor.state==='absent'){actor.x=entry.x;actor.z=entry.z;actor.visible=true;actor.state='arriving';actor.goal=null;}if(actor.state!=='waiting'&&actor.state!=='assembling'&&actor.state!=='arriving')actor.state='returning';}
    else if(actor.wasWorking||actor.idleSince===null)actor.idleSince=input.now;
    actor.wasWorking=busy;
    if(actor.state==='waiting')continue;
    if(actor.command){const command=actor.command;const target=command.target==='user'?input.floor==='ground'?input.user:null:actors.get(command.targetId??'');if(!target||('visible'in target&&!target.visible)){cancel(actor,'Interlocutor indisponível ou em outro andar.');continue;}
     const blockers=entryBarriers(actor,input.locks);if(blockers.some(a=>target.x>a.minX&&target.x<a.maxX&&target.z>a.minZ&&target.z<a.maxZ)){cancel(actor,'A área do interlocutor está trancada.','blocked');continue;}
     if(distance(actor,target)<=1.5&&segmentClear(actor,target,[...input.obstacles,...blockers])){if(actor.state!=='talking')results.push({agentId:actor.id,status:'arrived',target:command.target,message:'Conversa presencial disponível.'});actor.state='talking';actor.route=[];actor.goal=null;continue;}
     actor.state='approaching';const reached=travel(actor,target,'meeting',input);
     if(reached&&!segmentClear(actor,target,[...input.obstacles,...blockers])){cancel(actor,'Não há acesso livre ao interlocutor.','blocked');continue;}
     if((actor.state as RoutineState)==='blocked'){cancel(actor,'Não há caminho livre até o interlocutor.','blocked');}continue;
    }
    const desk=atDesk(agent,input);if(!desk){actor.state='blocked';continue;}
    if(busy&&seatOccupied({x:agent.x,z:agent.z-.55},occupied)){actor.seatBlocked=true;actor.state='returning';if(travel(actor,desk,'desk',input))actor.state='blocked';continue;}
    if(actor.state==='arriving'||busy){actor.state='arriving';if(travel(actor,desk,'desk',input))actor.state=busy?'working':'sleeping';continue;}
    if(actor.state==='absent'||actor.state==='assembling')continue;
    const elapsed=input.now-(actor.idleSince??input.now);
    if(elapsed>=input.idleMs){
     if(actor.state==='packing'){if(input.now-actor.phaseAt>=1800){actor.state='leaving';actor.goal=null;}}
     else if(actor.state==='leaving'){if(travel(actor,entry,'exit',input)){actor.state='absent';actor.visible=false;actor.goal=null;}}
     else {actor.state='returning';if(travel(actor,desk,'desk',input)){actor.state='packing';actor.phaseAt=input.now;}}continue;
    }
    if(actor.state==='packing'||actor.state==='leaving'){actor.state='returning';actor.goal=null;}
    const breakPhase=Math.floor(elapsed/30000),coffee=(breakPhase+choice(agent.id))%2===1;
    if(coffee){let slot=coffeeSlots.get(actor.id);if(slot===undefined)slot=[0,1,2,3].find(index=>!seatOccupied(CAFE_SEATS[index],occupied)&&![...coffeeSlots.values()].includes(index));if(slot===undefined){actor.state='returning';if(travel(actor,desk,'desk',input))actor.state='sleeping';}else{coffeeSlots.set(actor.id,slot);actor.coffeeSeat=slot;actor.state='coffee';travel(actor,coffeeApproach(slot),'coffee',input);}}else{actor.state='returning';if(travel(actor,desk,'desk',input))actor.state='sleeping';}
   }
   // One finite recruitment choreography; both logical seats, if any, wait their own turn.
   if(!hireTarget){hireTarget=input.agents.find(a=>actors.get(a.id)?.state==='waiting')?.id??null;if(hireTarget){hr=make('office:hr',entry,input.now);hrBlocked=false;}}
   if(hr&&hireTarget){const target=actors.get(hireTarget),agent=input.agents.find(a=>a.id===hireTarget);if(!target||!agent){hr=null;hireTarget=null;}else{const desk=atDesk(agent,input);if(!desk){target.state='blocked';results.push({agentId:target.id,status:'blocked',target:'agent',message:'RH não encontrou um posto acessível.'});hr=null;hireTarget=null;}
    else if(hr.state==='assembling'){target.buildProgress=Math.min(1,(input.now-hr.phaseAt)/2200);if(target.buildProgress>=1){target.deskReady=true;target.visible=true;target.state='arriving';target.goal=null;pendingHires.delete(target.id);hr.state='leaving';hr.goal=null;}}
    else if(hr.state==='leaving'){if(travel(hr,entry,'exit',input,3.8)){hr=null;hireTarget=null;}}
    else {hr.state='arriving';if(travel(hr,desk,'hire',input,3.8)){hr.state='assembling';hr.phaseAt=input.now;target.state='waiting';hrBlocked=false;}else if((hr.state as RoutineState)==='blocked'&&!hrBlocked){hrBlocked=true;results.push({agentId:target.id,status:'blocked',target:'agent',message:'RH aguarda um caminho livre para montar o posto. Abra a área trancada e tente novamente.'});}}
   }}
   return {actors:[...actors.values()].map(visual),hr:hr?visual(hr):null,results:results.splice(0)};
  },
  snapshot(){return {actors:[...actors.values()].map(visual),hr:hr?visual(hr):null};},
 };
}
export type RoutineEngine=ReturnType<typeof createAgentRoutines>;

/** Presentation consumed by the actual actor/furniture renderer. */
export function routinePresentation(current:RoutineVisual,previous:Point,reduced:boolean,dt:number,time:number,previousLean=0){
 const targetLean=current.state==='sleeping'?.32:current.state==='packing'||current.state==='assembling'?.22:0;
 return {moving:!reduced&&distance(current,previous)>.001,lean:reduced?targetLean:previousLean+(targetLean-previousLean)*Math.min(1,dt*8),bob:current.state==='packing'&&!reduced?Math.sin(time*7)*.035:0,building:current.buildProgress>0&&!current.deskReady,buildScale:reduced?1:Math.max(.05,current.buildProgress)};
}
