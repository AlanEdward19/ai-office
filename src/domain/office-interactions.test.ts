import test from 'node:test';
import assert from 'node:assert/strict';
import {sitAt,seatedPose,chairRotation,agentSeatPose,CAFE_SEATS,coffeeApproach} from './seating';
import {createAgentRoutines} from './agent-routines';
import {applyAvatarActivity} from './character';
import {Group,Vector3} from 'three';
import {walkBounds,type Pose} from './walker';
import type {PlacedAgent} from './placement';
const agent:PlacedAgent={id:'local:test',x:0,z:0,form:null,event:{provider:'openai',origin:'local',owner:'A',machineId:'m',projectId:null,status:'idle',observedAt:'2026-10-01T00:00:00Z'}};
test('office interactions focus shader',async()=>{
 const {createAreaFocusEffect}=await import('../components/office/area-focus');const effect=createAreaFocusEffect();
 try{assert.doesNotMatch(effect.material.fragmentShader,/\buniform\s+\w+\s+active\b/);assert.match(effect.material.fragmentShader,/outside=maskEnabled\*/);assert.equal(effect.material.depthTest,false);assert.equal(effect.material.depthWrite,false);assert.equal(effect.scene.children[0].frustumCulled,false);assert.match(effect.material.vertexShader,/gl_Position=vec4\(position.xy,0.,1.\)/);assert.equal(effect.material.uniforms.image.value,effect.target.texture);assert.equal(effect.material.uniforms.depth.value,effect.target.depthTexture);}finally{effect.geometry.dispose();effect.material.dispose();effect.target.depthTexture?.dispose();effect.target.dispose();}
});
test('office interactions chair orientation',()=>{
 for(const facing of [0,Math.PI/2,Math.PI,3*Math.PI/2]){const front=new Vector3(0,0,1).applyAxisAngle(new Vector3(0,1,0),chairRotation(facing));const expected=new Vector3(-Math.sin(facing),0,-Math.cos(facing));assert.ok(front.distanceTo(expected)<1e-8);}
});
test('office interactions user seating',async()=>{
 const standing:Pose={x:0,z:.6,yaw:0,pitch:0},seat={x:0,z:0,yaw:0,id:'chair'};
 const chair={minX:-.25,maxX:.25,minZ:-.25,maxZ:.25,seatId:'chair'};
 const sitting=sitAt(standing,seat,[chair]);assert.ok(sitting);assert.deepEqual(sitting.standing,standing);assert.equal(seatedPose(sitting).seated,true);assert.equal(seatedPose(sitting).z,0);
 assert.equal(sitAt({...standing,z:2},seat,[chair]),null);assert.equal(sitAt(standing,{...seat,occupied:true},[chair]),null);
 assert.equal(sitAt(standing,seat,[chair,{minX:-.3,maxX:.3,minZ:.3,maxZ:.35}]),null,'small wall is never exempted as a chair');
 const {createCallHub}=await import('./call');const hub=createCallHub();let roster:unknown;hub.join({id:'person-a',name:'A',token:'a'},event=>{roster=event;});
 const action={type:'presence',floor:'ground',x:0,z:2.6,yaw:0,pitch:0,timeZone:'UTC',seated:true};assert.equal(hub.action({from:'person-a',token:'a',action}).ok,true);assert.equal((roster as {peers:{seated:boolean}[]}).peers[0].seated,true);
 assert.equal(hub.action({from:'person-a',token:'a',action:{...action,seated:'yes'}}).ok,false);assert.equal(hub.action({from:'person-a',token:'a',action:{...action,seated:false}}).ok,true);assert.equal((roster as {peers:{seated:boolean}[]}).peers[0].seated,false);
});
test('office interactions agent poses',()=>{
 const routine={id:agent.id,x:agent.x,z:agent.z-1.15,yaw:0,state:'working' as const,visible:true,deskReady:true,buildProgress:1};const desk=agentSeatPose(routine,agent);assert.equal(desk.seated,true);assert.equal(desk.z,agent.z-.55);assert.equal(desk.activity,'typing');assert.equal(agentSeatPose({...routine,state:'sleeping'},agent).seated,true);assert.ok(Math.hypot(desk.x-routine.x,desk.z-routine.z)<=.61,'sit transition stays beside chair, not across table');
 for(let i=0;i<4;i++){const coffee=agentSeatPose({...routine,...coffeeApproach(i),state:'coffee',coffeeSeat:i},agent);assert.equal(coffee.seated,true);assert.equal(coffee.x,CAFE_SEATS[i].x);assert.equal(coffee.z,CAFE_SEATS[i].z);}
 const root=new Group(),arms=[new Group(),new Group()],legs=[new Group(),new Group()];const motion={seated:true,activity:'typing' as const,moving:false,gesture:null,gestureStarted:0};applyAvatarActivity(root,arms,legs,motion,0,false);const first=arms[0].rotation.x;applyAvatarActivity(root,arms,legs,motion,.2,false);assert.notEqual(arms[0].rotation.x,first);assert.equal(root.position.y,-.36);assert.equal(legs[0].rotation.x,1.35);applyAvatarActivity(root,arms,legs,{...motion,activity:'talking',seated:false},1,false);assert.ok(arms[0].rotation.z>.1);
});
test('office interactions coffee seat reservations',()=>{
 const engine=createAgentRoutines(),agents=Array.from({length:9},(_,i)=>({...agent,id:`local:seat${i}`,x:i*.5}));let now=0,sat=false;
 for(let tick=0;tick<700;tick++){const state=engine.tick({agents,now:now+=100,dt:.1,obstacles:[],bounds:walkBounds('ground'),user:{x:0,z:2.6,yaw:0,pitch:0},floor:'ground',locks:[],idleMs:300000,reducedMotion:false});const coffee=state.actors.filter(a=>a.state==='coffee'&&a.coffeeSeat!==undefined);assert.ok(coffee.length<=4);assert.equal(new Set(coffee.map(a=>a.coffeeSeat)).size,coffee.length);sat ||= coffee.some(a=>agentSeatPose(a,agents.find(p=>p.id===a.id)).seated);}
 assert.ok(sat);
});
test('office interactions agent inspection',async()=>{
 // Source wiring proof only: rendered browser proof remains unavailable.
 const {readFile}=await import('node:fs/promises');const source=await readFile('src/components/office/office-app.tsx','utf8');assert.match(source,/onAgent=\{id=>\{setSelectedTab\("history"\);setSelectedDeskId\(id\);\}\}/);assert.match(source,/event.origin==="local"\?"history":"activity"/);const avatar=await readFile('src/components/office/avatar.tsx','utf8');assert.match(avatar,/<group ref=\{node => \{ arms.current\[i\]/);assert.match(avatar,/name="held-coffee"/);assert.match(avatar,/cup.current.visible=motion\?\.current.activity==="coffee"/);
 assert.match(source,/onApproach=\{\(\)=>void approachAgent/);
 const player=await readFile('src/components/office/player.tsx','utf8');assert.match(player,/if \(correction\) \{ sitting.current=null/);assert.match(player,/keyboardForward\|\|keyboardStrafe\|\|held.has\("Space"\)\|\|target.current/);
});

test('office interactions human seating reserves all coffee seats and releases them',()=>{
 const engine=createAgentRoutines(),agents=Array.from({length:9},(_,i)=>({...agent,id:`local:human${i}`,x:i*.5}));let now=0;
 const user={...CAFE_SEATS[0],pitch:0,seated:true},occupiedSeats=CAFE_SEATS.slice(1);
 const input={agents,now,dt:.1,obstacles:[],bounds:walkBounds('ground'),user,floor:'ground' as const,locks:[],idleMs:300000,reducedMotion:false,occupiedSeats};
 for(let tick=0;tick<50;tick++){input.now=now+=100;const state=engine.tick(input);assert.equal(state.actors.some(a=>a.coffeeSeat!==undefined),false);for(const actor of state.actors)assert.notEqual(agentSeatPose(actor,agents.find(a=>a.id===actor.id),CAFE_SEATS).activity,'coffee');}
 input.user.seated=false;input.occupiedSeats=[];let allocated=false;for(let tick=0;tick<50;tick++){input.now=now+=100;allocated ||= engine.tick(input).actors.some(a=>a.coffeeSeat!==undefined);}assert.ok(allocated,'free human seats become available again');
 const reserved=engine.snapshot().actors.find(a=>a.coffeeSeat!==undefined)!;assert.ok(reserved);input.user={...CAFE_SEATS[reserved.coffeeSeat!],pitch:0,seated:true};input.now=now+=100;const reassigned=engine.tick(input).actors.find(a=>a.id===reserved.id)!;assert.notEqual(reassigned.coffeeSeat,reserved.coffeeSeat,'reservation moves when human takes seat before arrival');
});
test('office interactions own desk waits for human then resumes real activity',()=>{
 const working={...agent,event:{...agent.event,status:'working' as const}},engine=createAgentRoutines(),seat={x:agent.x,z:agent.z-.55},input={agents:[working],now:0,dt:.1,obstacles:[],bounds:walkBounds('ground'),user:{...seat,yaw:0,pitch:0,seated:true},floor:'ground' as const,locks:[],idleMs:300000,reducedMotion:false};
 let visual=engine.tick(input).actors[0];assert.equal(visual.seatBlocked,true);assert.equal(agentSeatPose({...visual,state:'working'},working,[seat]).seated,false);assert.equal(working.event.status,'working','visual wait never stops provider work');
 input.user.seated=false;input.now=100;visual=engine.tick(input).actors[0];assert.equal(visual.seatBlocked,undefined);assert.equal(visual.state,'working');assert.equal(agentSeatPose(visual,working,[]).seated,true);
});
test('office interactions colleague seating is sanitized to ground humans and immediate local pose',async()=>{
 const {occupiedHumanSeats}=await import('./seating');const base={x:1,z:2,yaw:0,pitch:0};const peers=[{...base,id:'self',floor:'ground',seated:true},{...base,id:'other',floor:'ground',seated:true},{...base,id:'upstairs',floor:'hr',seated:true},{...base,id:'standing',floor:'ground',seated:false}];
 assert.deepEqual(occupiedHumanSeats(peers,'self',{...base,x:3,seated:true},'ground').map(p=>p.x),[1,3]);assert.equal(occupiedHumanSeats(peers,'self',{...base,seated:true},'hr').length,1);
});
