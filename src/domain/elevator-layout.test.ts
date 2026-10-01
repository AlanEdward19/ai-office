import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement, act } from 'react';
import { createRoot, extend, type RootState } from '@react-three/fiber';
import * as THREE from 'three';
import { OfficeScene } from '../components/office/office-scene';
import { DEFAULT_APPEARANCE } from './character';
import { sceneObstacles } from './scene-collision';
import { ELEVATOR_CORRIDOR } from './office-layout';
import { meetingAreas } from './meeting-areas';
import { arrivalPose, integrateWalk, walkBounds, PLAYER_RADIUS, type Obstacle } from './walker';
import { layoutRooms } from './rooms';
import { deskSlot, localWingSlot, type PlacedAgent } from './placement';
import type { FloorId } from './floors';
import type { CameraMode } from './camera';
extend(THREE as unknown as Parameters<typeof extend>[0]);
const overlaps=(a:Obstacle,b:Obstacle)=>a.minX<b.maxX&&a.maxX>b.minX&&a.minZ<b.maxZ&&a.maxZ>b.minZ;
const rooms=layoutRooms(Array.from({length:8},(_,i)=>({id:`room-${i}`,name:`Sala ${i}`})));
const cloudAgents:PlacedAgent[]=Array.from({length:9},(_,i)=>({id:`desk:${i}`,...deskSlot(i),form:null,event:{provider:'cursor',origin:'cloud',owner:'A',machineId:null,projectId:null,status:'idle',observedAt:'2026-09-30T00:00:00Z'}}));
const agents:PlacedAgent[]=[...cloudAgents,...cloudAgents.map((a,i)=>({...a,id:`local:${i}`,...localWingSlot(i),event:{...a.event,origin:'local' as const,machineId:'machine-local'}}))];
async function realObstacles(floor:FloorId,cameraMode:CameraMode):Promise<Obstacle[]> {
 // Run the actual R3F scene reconciler with a renderer that performs no GPU work.
 // Geometry, layout transforms and collision extraction are the production code.
 const priorWindow=globalThis.window;
 const events=new EventTarget();
 const fakeWindow={addEventListener:events.addEventListener.bind(events),removeEventListener:events.removeEventListener.bind(events),setInterval,clearInterval};
 Object.assign(globalThis,{window:fakeWindow,IS_REACT_ACT_ENVIRONMENT:true});
 const canvas=Object.assign(new EventTarget(),{width:800,height:600,parentElement:null,getBoundingClientRect:()=>({left:0,top:0,width:800,height:600})});
 const renderer={domElement:canvas,render(){},setSize(){},setPixelRatio(){},getContext(){return {};}};
 const root=createRoot(canvas as unknown as HTMLCanvasElement);
 let state:RootState|undefined;
 try {
  await root.configure({gl:renderer as unknown as THREE.WebGLRenderer,frameloop:'never',size:{width:800,height:600,top:0,left:0},onCreated:s=>{state=s;}});
  await act(async()=>{root.render(createElement(OfficeScene,{appearance:DEFAULT_APPEARANCE,cameraMode,zoom:1,gesture:null,rooms,agents,nearId:null,dropArmed:false,floor,localOffline:true,enabled:false,onNearby:()=>{},onPose:()=>{},presence:null,correction:null,onPerson:()=>{}}));});
  const environment=state?.scene.getObjectByName('office-environment');
  assert.ok(environment,'actual office environment rendered');
  return sceneObstacles(environment);
 } finally {
  await act(async()=>{root.unmount();});
  Object.assign(globalThis,{window:priorWindow,IS_REACT_ACT_ENVIRONMENT:false});
 }
}
const layouts: {floor:FloorId;mode:CameraMode;obstacles:Obstacle[]}[]=[];
test('elevator actual geometry clearance',async()=>{
 for(const floor of ['ground','hr'] as const)for(const mode of ['first','third','isometric'] as const){
  const obstacles=await realObstacles(floor,mode);assert.ok(obstacles.length>20);
  const pose=arrivalPose();
  assert.ok(!obstacles.some(o=>pose.x>o.minX-PLAYER_RADIUS&&pose.x<o.maxX+PLAYER_RADIUS&&pose.z>o.minZ-PLAYER_RADIUS&&pose.z<o.maxZ+PLAYER_RADIUS),`${floor}/${mode} arrival clear`);
  assert.ok(!obstacles.some(o=>overlaps(o,ELEVATOR_CORRIDOR)),`${floor}/${mode} reserved 1 m corridor clear`);
  layouts.push({floor,mode,obstacles});
 }
});
test('elevator reserved corridor',()=>{
 for(const area of meetingAreas(rooms)) {
  const barrier={minX:area.minX-PLAYER_RADIUS,maxX:area.maxX+PLAYER_RADIUS,minZ:area.minZ-PLAYER_RADIUS,maxZ:area.maxZ+PLAYER_RADIUS};
  assert.ok(!overlaps(barrier,ELEVATOR_CORRIDOR),`${area.id} cannot lock elevator landing including avatar clearance`);
 }
 assert.ok(ELEVATOR_CORRIDOR.maxZ-ELEVATOR_CORRIDOR.minZ>=1);
});
test('elevator repeated arrival walking and return',()=>{
 assert.equal(layouts.length,6);
 const keys={forward:1,strafe:0,turn:0,yawDelta:0,pitchDelta:0};
 for(let cycle=0;cycle<3;cycle++)for(const layout of layouts){
  const arrival=arrivalPose();
  const away=integrateWalk(arrival,keys,null,2/4.2,walkBounds(layout.floor),layout.obstacles).pose;
  assert.ok(arrival.x-away.x>=1.99,`${layout.floor}/${layout.mode} walks 2 m`);
  const back=integrateWalk(away,{...keys,forward:-1},null,2/4.2,walkBounds(layout.floor),layout.obstacles).pose;
  assert.ok(Math.hypot(back.x-arrival.x,back.z-arrival.z)<.01,`${layout.floor}/${layout.mode} returns`);
 }
});

test('living office C7',async()=>{
 const {officeRoute,pointClear,segmentClear}=await import('./office-navigation');
 const {OFFICE_ENTRY}=await import('./office-map');
 for(const layout of layouts) {
  const start=layout.floor==='ground'?{x:OFFICE_ENTRY.x,z:5.45}:arrivalPose();
  assert.ok(pointClear(start,layout.obstacles),`${layout.floor}/${layout.mode} entrance clear`);
  for(const area of meetingAreas(rooms).filter(a=>a.floor===layout.floor)) {
   let destination:{x:number;z:number}|null=null;
   // Find a walkable point just inside each southern doorway/area edge.
   for(let z=area.maxZ-.3;z>area.minZ+.3&&!destination;z-=.3)for(let x=area.minX+.3;x<area.maxX-.3;x+=.3){const p={x,z};if(pointClear(p,layout.obstacles)&&officeRoute(start,p,walkBounds(layout.floor),layout.obstacles)){destination=p;break;}}
   assert.ok(destination,`${layout.floor}/${layout.mode} reaches ${area.name} without walls or furniture`);
   const route=officeRoute(start,destination,walkBounds(layout.floor),layout.obstacles);assert.ok(route);let current=start;for(const step of route){assert.ok(segmentClear(current,step,layout.obstacles));current=step;}
  }
 }
});

// A .36 m expansion plus the production .24 m body proves a 1.2 m wide route.
test('living office C5 actual 1.2 m routes and all eighteen posts',async()=>{
 const {officeRoute,pointClear}=await import('./office-navigation');
 const {OFFICE_ENTRY}=await import('./office-map');
 for(const layout of layouts){
  const expanded=layout.obstacles.map(o=>({minX:o.minX-.36,maxX:o.maxX+.36,minZ:o.minZ-.36,maxZ:o.maxZ+.36}));
  const start=layout.floor==='ground'?{x:OFFICE_ENTRY.x,z:OFFICE_ENTRY.z+.7}:arrivalPose();
  assert.ok(pointClear(start,expanded),`${layout.floor}/${layout.mode} outside threshold clear`);
  for(const area of meetingAreas(rooms).filter(a=>a.floor===layout.floor)){
   let reachable=false;
   for(let z=area.maxZ-.2;z>area.minZ+.2&&!reachable;z-=.25)for(let x=area.minX+.2;x<area.maxX-.2;x+=.25){const p={x,z};if(pointClear(p,expanded)&&officeRoute(start,p,walkBounds(layout.floor),expanded)){reachable=true;break;}}
   assert.ok(reachable,`${layout.floor}/${layout.mode}: 1.2 m corridor to ${area.name}`);
  }
  if(layout.floor==='ground')for(const agent of agents){
   assert.ok(officeRoute(start,{x:agent.x,z:agent.z+1.25},walkBounds('ground'),expanded),`${layout.mode}: 1.2 m access to ${agent.id}`);
   assert.ok(officeRoute(start,{x:agent.x,z:agent.z+.95},walkBounds('ground'),layout.obstacles),`${layout.mode}: physical routine reaches ${agent.id}`);
  }
 }
});

test('living office actual meshes hiring travel coffee departure and moving interlocutor',async()=>{
 const {createAgentRoutines}=await import('./agent-routines');
 const {pointClear,officeRoute}=await import('./office-navigation');
 const {OFFICE_ENTRY}=await import('./office-map');
 const obstacles=layouts.find(l=>l.floor==='ground'&&l.mode==='third')!.obstacles;
 const roster=agents.map(a=>({...a,event:{...a.event,status:'working' as const}}));
 const engine=createAgentRoutines();for(const agent of roster)engine.hire(agent.id);
 for(const a of roster)assert.ok(officeRoute({x:a.x,z:a.z+.95},{x:OFFICE_ENTRY.x,z:7},walkBounds('ground'),obstacles),`reverse ${a.id}`);
 let now=0,assembly=false,doorCrossing=false;
 const input={agents:roster,now,dt:.1,obstacles,bounds:walkBounds('ground'),user:{x:OFFICE_ENTRY.x,z:5.2,yaw:0,pitch:0},floor:'ground' as const,locks:[] as Obstacle[],idleMs:120000,reducedMotion:false};
 const tick=()=>{input.now=now+=100;const state=engine.tick(input);for(const actor of [...state.actors,...(state.hr?[state.hr]:[])])if(actor.visible){assert.ok(pointClear(actor,obstacles),`${actor.id} ${actor.state} never penetrates actual furniture`);doorCrossing ||= actor.z>OFFICE_ENTRY.z;}assembly ||= state.hr?.state==='assembling';return state;};
 let recruited=false;
 for(let i=0;i<8000;i++){const state=tick();if(state.actors.length===18&&state.actors.every(a=>a.deskReady&&a.state==='working')&&!state.hr){recruited=true;break;}}
 assert.ok(assembly);assert.ok(doorCrossing);assert.ok(recruited,`all eighteen posts receive physical HR assembly then arrivals: ${JSON.stringify(engine.snapshot())}`);
 assert.ok(engine.command({type:'approach',agentId:roster[17].id,target:'user',targetId:null,stamp:1}));
 let arrived=false;
 for(let i=0;i<1000;i++){if(i===10)input.user={...input.user,x:-3.2,z:4.7};const state=tick();if(state.results.some(r=>r.status==='arrived')){const actor=state.actors.find(a=>a.id===roster[17].id)!;assert.ok(Math.hypot(actor.x-input.user.x,actor.z-input.user.z)<=1.5);arrived=true;break;}}
 assert.ok(arrived,'approach follows actual moving user');
 engine.command({type:'cancel',agentId:roster[17].id,target:'user',targetId:null,stamp:2});
 roster[17].event.status='idle' as 'working';let coffee=false,packing=false,exited=false;
 for(let i=0;i<3000;i++){const actor=tick().actors.find(a=>a.id===roster[17].id)!;coffee ||= actor.state==='coffee'&&actor.x<-4.5&&actor.z<0;packing ||= actor.state==='packing';if(actor.state==='absent'){assert.ok(actor.z>OFFICE_ENTRY.z,'exit crosses the external doorway');exited=true;break;}}
 assert.ok(coffee,'local agent reaches cafe physically');assert.ok(packing);assert.ok(exited);
});

test('office interactions coffee reaches every real chair approach',async()=>{
 const {createAgentRoutines}=await import('./agent-routines');const {agentSeatPose}=await import('./seating');const {pointClear}=await import('./office-navigation');
 const obstacles=layouts.find(l=>l.floor==='ground'&&l.mode==='third')!.obstacles,engine=createAgentRoutines(),roster=agents.map(a=>({...a,event:{...a.event,status:'idle' as const}})),reached=new Set<number>();let now=0;
 for(let tick=0;tick<900;tick++){const state=engine.tick({agents:roster,now:now+=100,dt:.1,obstacles,bounds:walkBounds('ground'),user:{x:0,z:2.6,yaw:0,pitch:0},floor:'ground',locks:[],idleMs:300000,reducedMotion:false});for(const actor of state.actors){assert.ok(pointClear(actor,obstacles),'physical approach never penetrates actual furniture');if(actor.state==='coffee'&&actor.coffeeSeat!==undefined&&agentSeatPose(actor,roster.find(a=>a.id===actor.id)).seated)reached.add(actor.coffeeSeat);}if(reached.size===4)break;}
 assert.deepEqual([...reached].sort(),[0,1,2,3],'every reserved coffee seat is actually reachable before seating');
});
