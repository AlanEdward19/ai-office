"use client";
import {useEffect,useRef,useState,type RefObject} from 'react';
import {useFrame} from '@react-three/fiber';
import type {Group} from 'three';
import {agentSeatPose,occupiedHumanSeats} from '@/domain/seating';
import {LocalTimeLabel} from './local-time-label';
import {ProjectedLabel} from './projected-label';
import {Avatar} from './avatar';
import {DEFAULT_APPEARANCE,type AvatarMotion} from '@/domain/character';
import type {PlacedAgent} from '@/domain/placement';
import {routinePresentation,type RoutineEngine,type RoutineCommand,type RoutineVisual,type RoutineResult} from '@/domain/agent-routines';
import {walkBounds,type Obstacle,type Pose} from '@/domain/walker';
import type {FloorId} from '@/domain/floors';
import type {PresenceRoster} from './office-call';
const captions={working:'Trabalhando',coffee:'Pausa no café',sleeping:'Descansando',returning:'Voltando à mesa',packing:'Guardando as coisas',leaving:'Saindo do escritório',absent:'Fora do escritório',arriving:'Chegando',waiting:'Aguardando RH',assembling:'Montando posto',approaching:'Indo conversar',talking:'Conversando',blocked:'Caminho indisponível'};
export function AgentActors({agents,floor,host,engine,shared,commands,idleMs,user,obstacles,presence,newHire,onSnapshot,onResult,onAgent,timeZone}:{timeZone?:string;agents:PlacedAgent[];floor:FloorId;host:boolean;engine?:RoutineEngine;shared:RoutineVisual[];commands:RoutineCommand[];idleMs:number;user:Pose;obstacles:RefObject<Obstacle[]>;presence:PresenceRoster|null;newHire:{id:string;stamp:number}|null;onSnapshot?:(visuals:RoutineVisual[])=>void;onResult?:(result:RoutineResult)=>void;onAgent?:(id:string)=>void}){
 const [visuals,setVisuals]=useState<RoutineVisual[]>([]),[reduced,setReduced]=useState(false),cache=useRef<Obstacle[]>([]),last=useRef(0),hireStamp=useRef(0);
 useEffect(()=>{const preference=window.matchMedia?.('(prefers-reduced-motion: reduce)');if(!preference)return;const update=()=>setReduced(preference.matches);preference.addEventListener('change',update);const timer=setTimeout(update,0);return()=>{clearTimeout(timer);preference.removeEventListener('change',update);};},[]);
 useFrame((_state,dt)=>{
  if(!host||!engine)return;if(floor==='ground'&&obstacles.current.length)cache.current=obstacles.current;if(!cache.current.length)return;
  if(newHire&&hireStamp.current!==newHire.stamp){engine.hire(newHire.id);engine.hire(`local:${newHire.id}`);hireStamp.current=newHire.stamp;}
  const blockers=presence?.areas.filter(a=>a.floor==='ground'&&presence.locks.some(l=>l.areaId===a.id))??[];
  const result=engine.tick({agents,now:Date.now(),dt,obstacles:cache.current,bounds:walkBounds('ground'),user,floor,locks:blockers,idleMs,reducedMotion:reduced,occupiedSeats:occupiedHumanSeats(presence?.peers??[],presence?.self,user,floor)});
  for(const command of commands)engine.command(command);
  for(const outcome of result.results)onResult?.(outcome);
  if(Date.now()-last.current>150){last.current=Date.now();const next=[...result.actors,...(result.hr?[result.hr]:[])];setVisuals(next);onSnapshot?.(next);}
 });
 const occupiedSeats=occupiedHumanSeats(presence?.peers??[],presence?.self,user,floor);
 const snapshot=host?visuals:shared;
 return floor==='ground'?<group userData={{noCollision:true}}>{snapshot.map(routine=>{const agent=agents.find(a=>a.id===routine.id);return <RoutineActor key={routine.id} routine={routine} agent={agent} occupiedSeats={occupiedSeats} engine={host?engine:undefined} name={routine.id==='office:hr'?'RH':agent?.displayName??agent?.form?.role??agent?.event.provider??'Agente'} timeZone={agent?.event.origin==='local'?timeZone:undefined} local={agent?.event.origin==='local'} reduced={reduced} onClick={()=>{if(agent)onAgent?.(agent.id);}} />;})}
  {snapshot.filter(r=>routinePresentation(r,r,reduced,0,0).building).map(r=>{const agent=agents.find(a=>a.id===r.id);return agent?<group key={`build:${r.id}`} position={[agent.x,0,agent.z]} scale={[1,routinePresentation(r,r,reduced,0,0).buildScale,1]}><mesh position={[0,.76,.15]}><boxGeometry args={[1.42,.08,.78]} /><meshStandardMaterial color="#d8c3a5" /></mesh><mesh position={[0,.4,.15]}><boxGeometry args={[1.2,.72,.6]} /><meshStandardMaterial color="#efe2d2" /></mesh><mesh position={[0,.35,-.55]}><boxGeometry args={[.5,.12,.5]} /><meshStandardMaterial color="#507b7f" /></mesh><mesh position={[0,.6,-.78]}><boxGeometry args={[.5,.5,.1]} /><meshStandardMaterial color="#507b7f" /></mesh></group>:null;})}
 </group>:null;
}
function RoutineActor({routine,engine,name,local,reduced,onClick,timeZone,agent,occupiedSeats}:{occupiedSeats:readonly {x:number;z:number}[];agent?:PlacedAgent;timeZone?:string;routine:RoutineVisual;engine?:RoutineEngine;name:string;local?:boolean;reduced:boolean;onClick:()=>void}){
 const group=useRef<Group>(null),body=useRef<Group>(null),bag=useRef<Group>(null),motion=useRef<AvatarMotion>({moving:false,gesture:null,gestureStarted:0}),previous=useRef({x:routine.x,z:routine.z});
 useFrame(({clock},dt)=>{const current=engine?(routine.id==='office:hr'?engine.snapshot().hr:engine.snapshot().actors.find(r=>r.id===routine.id))??routine:routine;if(!group.current)return;group.current.visible=current.visible;const seat=agentSeatPose(current,agent,occupiedSeats);group.current.position.set(seat.x,0,seat.z);group.current.rotation.y=seat.yaw;motion.current.seated=seat.seated;motion.current.activity=seat.activity;const presentation=routinePresentation(current,previous.current,reduced,dt,clock.elapsedTime,body.current?.rotation.x);motion.current.moving=presentation.moving;previous.current={x:current.x,z:current.z};if(body.current){body.current.rotation.x=seat.seatBlocked?0:presentation.lean;body.current.position.y=seat.seated?.08:presentation.bob;}if(bag.current)bag.current.visible=current.state==='packing'||current.state==='leaving'||current.id==='office:hr';});
 return <group ref={group} name={`agent-person:${routine.id}`} userData={{personId:routine.id,noCollision:true}} onClick={event=>{event.stopPropagation();onClick();}}>
  <group ref={body}><group scale={.82}><Avatar appearance={{...DEFAULT_APPEARANCE,shirt:routine.id==='office:hr'?'#de9c62':local?'#678d83':'#6375b7',accessory:local?'headphones':'glasses',outfit:routine.id==='office:hr'?'jacket':'hoodie'}} motion={motion} reducedMotion={reduced} /></group></group>

  <group ref={bag} position={[-.35,.4,0]}><mesh><boxGeometry args={[.26,.3,.12]} /><meshStandardMaterial color="#c79b71" /></mesh><mesh position={[0,.18,0]}><torusGeometry args={[.06,.012,6,12,Math.PI]} /><meshStandardMaterial color="#66554b" /></mesh></group>
  <mesh position={[0,.02,0]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[.35,.39,24]} /><meshStandardMaterial color={routine.state==='approaching'?'#ddb15f':'#85a7a4'} transparent opacity={.65} /></mesh>
  {timeZone?<LocalTimeLabel timeZone={timeZone} lines={[{text:name,kind:"title"},{text:agentSeatPose(routine,agent,occupiedSeats).seatBlocked||routine.seatBlocked?"Aguardando cadeira livre":captions[routine.state],kind:"meta"}]} />:<ProjectedLabel position={[0,1.75,0]} lines={[{text:name,kind:"title"},{text:agentSeatPose(routine,agent,occupiedSeats).seatBlocked||routine.seatBlocked?"Aguardando cadeira livre":captions[routine.state],kind:"meta"}]} />}
 </group>;
}
