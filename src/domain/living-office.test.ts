import test from 'node:test';
import assert from 'node:assert/strict';
import { FURNISHED_AREAS, OFFICE_ENTRY, PROJECT_CAPACITY, PROJECT_ROOM, projectSlot } from './office-map';
import { commonAreas } from './office-layout';
import { meetingAreas, areaAt } from './meeting-areas';
import { bindRoom } from './opened-rooms';
import { officeRoute, segmentClear } from './office-navigation';
import { walkBounds, type Obstacle } from './walker';

test('living office C1',()=>{
 const areas=meetingAreas([]);assert.equal(areas.length,FURNISHED_AREAS.length+PROJECT_CAPACITY);
 for(const furnished of FURNISHED_AREAS)assert.ok(areas.some(a=>a.id===furnished.id&&a.name===furnished.name&&a.floor===furnished.floor));
 for(let i=0;i<PROJECT_CAPACITY;i++){const slot=projectSlot(i);assert.ok(commonAreas([]).some(a=>a.x===slot.x&&a.z===slot.z));}
 assert.equal(areaAt(areas,'ground',0,-5.8),null,'main circulation remains outside calls');
});
test('living office C2',()=>{for(const area of meetingAreas([]))assert.equal(areaAt(meetingAreas([]),area.floor,(area.minX+area.maxX)/2,area.maxZ-.25)?.id,area.id);});
test('living office C5',()=>{
 assert.ok(OFFICE_ENTRY.width>=1.2);assert.ok(PROJECT_ROOM.gap>=1.2);assert.ok(PROJECT_ROOM.door>=1.2);
 const obstacles:Obstacle[]=[{minX:-2,maxX:2,minZ:-2,maxZ:2}];const start={x:-3,z:0},end={x:3,z:0};const route=officeRoute(start,end,walkBounds('ground'),obstacles);assert.ok(route);let current=start;for(const next of route){assert.ok(segmentClear(current,next,obstacles));current=next;}assert.deepEqual(current,end);
});
test('living office C6',()=>{
 const projects=Array.from({length:PROJECT_CAPACITY+1},(_,i)=>({id:String(i)}));assert.deepEqual(bindRoom(projects.slice(0,8).map(p=>p.id),projects,'8'),{ok:false,error:'capacity'});assert.throws(()=>projectSlot(8),/Capacidade/);
});

test('living office C8',async()=>{
 const {historyExecution,mergeHistory}=await import('./agent-history');const now=Date.now();
 for(const provider of ['cursor','anthropic','openai'] as const){const row=historyExecution({provider,origin:provider==='cursor'?'cloud':'local',sourceId:'real-run',observedAt:new Date(now).toISOString()});assert.ok(row);assert.equal(row.title,null);assert.equal(row.endedAt,null);assert.equal(row.status,'unknown');assert.equal(mergeHistory([row],[row],now).length,1);}
});
test('living office C9',async()=>{
 const {historyExecution,historyPage,historyResponse,mergeHistory}=await import('./agent-history');const now=Date.now();const rows=Array.from({length:25},(_,i)=>historyExecution({provider:'openai',origin:'local',sourceId:String(i),startedAt:new Date(now+i).toISOString(),observedAt:new Date(now).toISOString()})!);const sorted=mergeHistory([],rows,now);assert.equal(sorted[0].sourceId,'24');const page=historyPage(sorted,{provider:'openai',origin:'local',agentId:'desk',cursor:0},{state:'available',message:'Sessões reais'});assert.equal(page.executions.length,20);assert.equal(page.nextCursor,'20');assert.equal(historyPage(sorted,{provider:'openai',origin:'local',agentId:'desk',cursor:20},page.availability).executions.length,5);
 const read=async()=>page;assert.equal((await historyResponse(new Request('http://office/api/agents/history?provider=openai&origin=local&agentId=desk'),{role:'host'},read)).status,200);assert.equal((await historyResponse(new Request('http://office/api/agents/history?provider=bad'),{role:'host'},read)).status,400);
});
test('living office C10',async()=>{const {historyPage}=await import('./agent-history');const page=historyPage([],{provider:'anthropic',origin:'local',agentId:'desk',cursor:0},{state:'unavailable',message:'Provedor não expõe sessões anteriores.'});assert.deepEqual(page.executions,[]);assert.equal(page.availability.state,'unavailable');});
test('living office C11',async()=>{
 const {historyResponse,historyText}=await import('./agent-history');const request=new Request('http://office/api/agents/history?provider=openai&origin=local&agentId=desk');const read=async()=>{throw new Error('must not read');};assert.equal((await historyResponse(request,null,read)).status,401);assert.equal((await historyResponse(request,{role:'colleague'},read)).status,403);const text=historyText('Bearer abcdef123 secret=unsafe /Users/person/private/file ghp_abcdefghijklmnop my-secret-value',['my-secret-value']);assert.ok(text);for(const secret of ['abcdef123','unsafe','/Users/','ghp_','my-secret-value'])assert.ok(!text.includes(secret));
});
test('living office C12',async()=>{
 const {historyRepository,historyExecution,historyResponse}=await import('./agent-history');let disk:string|null=null,writes=0;const io={read:async()=>disk,writeAtomic:async(raw:string)=>{disk=raw;writes++;}};const row=historyExecution({provider:'openai',origin:'local',sourceId:'actual',observedAt:new Date().toISOString()})!;await historyRepository(io).append([row]);assert.equal((await historyRepository(io).read())[0].id,row.id);disk='corrupt';await assert.rejects(()=>historyRepository(io).append([row]));assert.equal(writes,1);assert.equal(disk,'corrupt');assert.equal((await historyResponse(new Request('http://office/api/agents/history?provider=openai&origin=local&agentId=desk'),{role:'host'},async()=>{throw new Error('corrupt');})).status,503);
});
test('living office C13',async()=>{
 const {historyExecution,mergeHistory}=await import('./agent-history');const now=Date.now();const rows=Array.from({length:505},(_,i)=>historyExecution({provider:'openai',origin:'local',sourceId:String(i),observedAt:new Date(now-i).toISOString(),summary:'a'.repeat(13000)})!);assert.equal(rows[0].summary?.length,12000);assert.equal(rows[0].truncated,true);const expired=historyExecution({provider:'openai',origin:'local',sourceId:'expired',observedAt:new Date(now-31*86400000).toISOString()})!;const result=mergeHistory([], [...rows,expired],now);assert.equal(result.length,500);assert.ok(!result.some(row=>row.sourceId==='expired'));
});

test('historical provider imports whitelist actual session and run identities',async()=>{
 const {localHistoryLog,providerHistoryRows}=await import('./agent-history-import');const now=new Date().toISOString();
 const codex=localHistoryLog('openai',[{type:'session_meta',timestamp:now,payload:{id:'session-a',cwd:'/Users/private'}},{type:'response_item',payload:{role:'assistant',content:[{type:'output_text',text:'Implemented the real change'}]}},{type:'response_item',payload:{role:'tool',content:'secret=unsafe'}},{type:'event_msg',timestamp:now,payload:{type:'task_complete'}}].map(r=>JSON.stringify(r)).join('\n'),now);assert.ok(codex);assert.equal(codex.sourceId,'session-a');assert.equal(codex.status,'completed');assert.equal(codex.summary,'Implemented the real change');assert.ok(!JSON.stringify(codex).includes('/Users/'));
 const claude=localHistoryLog('anthropic',[{type:'user',sessionId:'session-b',timestamp:now,message:{content:'Fix this task'}},{type:'assistant',sessionId:'session-b',message:{role:'assistant',content:[{type:'tool_use',input:{secret:'unsafe'}},{type:'text',text:'Real response'}]}},{type:'result',sessionId:'session-b',timestamp:now,is_error:false}].map(r=>JSON.stringify(r)).join('\n'),now);assert.ok(claude);assert.equal(claude.title,'Fix this task');assert.equal(claude.summary,'Real response');assert.equal(claude.status,'completed');assert.ok(!JSON.stringify(claude).includes('unsafe'));
 const cloud=providerHistoryRows('cursor',{items:[{id:'cloud-a',latestRunId:'run-a',name:'Actual task',status:'FINISHED'},{id:'not-a-run',name:'No execution'}]},now);assert.equal(cloud.length,1);assert.equal(cloud[0].sourceId,'cloud-a:run-a');assert.equal(cloud[0].cloudId,'cloud-a');assert.equal(cloud[0].status,'completed');assert.equal(cloud[0].summary,null);
 const threads=providerHistoryRows('openai',{result:{data:[{id:'thread-a',preview:'Available title',status:{type:'active'},createdAt:Date.now()/1000}]}},now);assert.equal(threads[0].status,'running');assert.equal(threads[0].title,'Available title');assert.equal(threads[0].endedAt,null);
 assert.equal(localHistoryLog('openai','{"type":"unknown"}',now),null);
});
test('history concurrent append serializes atomic writes without losing a run',async()=>{
 const {historyExecution,historyRepository}=await import('./agent-history');let disk:string|null=null;const repository=historyRepository({read:async()=>disk,writeAtomic:async(raw)=>{await new Promise(resolve=>setTimeout(resolve,2));disk=raw;}});const rows=['a','b','c'].map(sourceId=>historyExecution({provider:'openai',origin:'local',sourceId,observedAt:new Date().toISOString()})!);await Promise.all(rows.map(row=>repository.append([row])));assert.equal((await repository.read()).length,3);
});

async function routineFixture(){const {createAgentRoutines}=await import('./agent-routines');const engine=createAgentRoutines();const agent={id:'actor-a',x:0,z:0,form:null,event:{provider:'openai' as const,origin:'local' as const,owner:'A',machineId:'machine',projectId:null,status:'idle' as 'idle'|'working',observedAt:new Date().toISOString()}};let now=0;const input={agents:[agent],now,dt:.1,obstacles:[] as Obstacle[],bounds:walkBounds('ground'),user:{x:4,z:1,yaw:0,pitch:0},floor:'ground' as 'ground'|'hr',locks:[] as Obstacle[],idleMs:300000,reducedMotion:false};return {engine,agent,input,tick:(advance=100)=>{now+=advance;input.now=now;return engine.tick(input);}};}
test('living office C14',async()=>{const f=await routineFixture();const states=new Set<string>();for(let i=0;i<900;i++){f.agent.event.observedAt=new Date(i).toISOString();states.add(f.tick().actors[0].state);}assert.ok(states.has('coffee'));assert.ok(states.has('sleeping'));assert.equal(f.agent.event.status,'idle');});
test('living office C15',async()=>{const {DEFAULT_IDLE_MS}=await import('./agent-routines');const f=await routineFixture();assert.equal(DEFAULT_IDLE_MS,300000);f.tick();f.input.idleMs=30000;let packed=false,absent=false;for(let i=0;i<700;i++){f.agent.event.observedAt=new Date(i+1000).toISOString();const state=f.tick().actors[0].state;packed ||= state==='packing';absent ||= state==='absent';}assert.ok(packed);assert.ok(absent);assert.equal(f.agent.event.status,'idle');const {createRoutineControl,routinesResponse}=await import('./routines-http');const control=createRoutineControl();assert.equal((await routinesResponse(new Request('http://office/api/office/routines'),{role:'host'},control,[])).status,200);assert.equal((await routinesResponse(new Request('http://office/api/office/routines',{method:'POST',body:JSON.stringify({type:'configure',idleMs:60000})}),{role:'host'},control,[])).status,200);assert.equal(control.read().idleMs,60000);assert.equal((await routinesResponse(new Request('http://office/api/office/routines',{method:'POST',body:JSON.stringify({type:'configure',idleMs:0})}),{role:'host'},control,[])).status,400);});
test('living office C16',async()=>{const f=await routineFixture();f.input.idleMs=30000;for(let i=0;i<800;i++)f.tick();assert.equal(f.engine.snapshot().actors[0].state,'absent');f.agent.event.status='working';let returned=false;for(let i=0;i<300;i++)returned ||= f.tick().actors[0].state==='working';assert.ok(returned);assert.equal(f.engine.snapshot().actors[0].visible,true);});
test('living office C17',async()=>{const f=await routineFixture();f.engine.hire(f.agent.id);let assembling=false,ready=false,arrived=false;for(let i=0;i<500;i++){const state=f.tick();const a=state.actors[0];if(!a.deskReady)assert.equal(a.visible,false);assembling ||= state.hr?.state==='assembling';ready ||= a.deskReady;arrived ||= a.deskReady&&a.state==='sleeping';}assert.ok(assembling);assert.ok(ready);assert.ok(arrived);});
test('living office C18',async()=>{const f=await routineFixture();f.engine.hire(f.agent.id);f.engine.hire(f.agent.id);for(let i=0;i<500;i++)f.tick();assert.equal(f.engine.snapshot().actors.length,1);assert.equal(f.engine.snapshot().actors[0].deskReady,true);});
test('living office C19',async()=>{const f=await routineFixture();let previous=f.tick().actors[0];for(let i=0;i<150;i++){const next=f.tick().actors[0];assert.ok(Number.isFinite(next.x)&&Number.isFinite(next.yaw));assert.ok(Math.hypot(next.x-previous.x,next.z-previous.z)<=.221);previous=next;}f.input.reducedMotion=true;const next=f.tick().actors[0];assert.ok(Number.isFinite(next.x));});
test('living office C20',async()=>{const f=await routineFixture();f.tick();f.engine.command({type:'approach',agentId:f.agent.id,target:'user',targetId:null,stamp:1});let arrived=false;for(let i=0;i<120;i++){const next=f.tick();for(const result of next.results)if(result.status==='arrived'){assert.ok(Math.hypot(next.actors[0].x-f.input.user.x,next.actors[0].z-f.input.user.z)<=1.5);arrived=true;}}assert.ok(arrived);});
test('living office C21',async()=>{const f=await routineFixture();f.input.agents.push({...f.agent,id:'actor-b',x:5});f.tick();f.engine.command({type:'approach',agentId:f.agent.id,target:'agent',targetId:'actor-b',stamp:1});let arrived=false;for(let i=0;i<150;i++)arrived ||= f.tick().results.some(r=>r.status==='arrived'&&r.target==='agent');assert.ok(arrived);assert.equal(f.agent.event.status,'idle');});
test('living office C22',async()=>{const f=await routineFixture();f.tick();f.engine.command({type:'approach',agentId:f.agent.id,target:'user',targetId:null,stamp:1});f.tick();f.input.floor='hr';assert.ok(f.tick().results.some(r=>r.status==='cancelled'));const {createRoutineControl,routinesResponse}=await import('./routines-http');const response=await routinesResponse(new Request('http://office/api/office/routines',{method:'POST',body:JSON.stringify({type:'approach',agentId:'missing',target:'user',floor:'ground'})}),{role:'host'},createRoutineControl(),[]);assert.equal(response.status,409);});
test('living office C23',async()=>{const f=await routineFixture();f.tick();f.input.locks=[{minX:3,maxX:5,minZ:0,maxZ:2}];f.engine.command({type:'approach',agentId:f.agent.id,target:'user',targetId:null,stamp:1});assert.ok(f.tick().results.some(r=>r.status==='blocked'));const {createRoutineControl,routinesResponse}=await import('./routines-http');const control=createRoutineControl();for(const role of [null,{role:'colleague'}])assert.equal((await routinesResponse(new Request('http://office/api/office/routines'),role,control,[])).status,role?403:401);});

test('local post capacity is finite and disjoint from cloud posts',async()=>{
 const {localWingSlot,deskSlot}=await import('./placement');
 const local=Array.from({length:9},(_,i)=>localWingSlot(i)),cloud=Array.from({length:9},(_,i)=>deskSlot(i));
 assert.throws(()=>localWingSlot(9),/Capacidade/);assert.throws(()=>deskSlot(9),/Capacidade/);
 assert.equal(new Set([...local,...cloud].map(p=>`${p.x}:${p.z}`)).size,18);
 for(const post of local)assert.ok(areaAt(meetingAreas([]),'ground',post.x,post.z)?.id==='local');
});

test('living office C20 routes through a doorway before arrival across a nearby wall',async()=>{
 const f=await routineFixture();f.tick();const start=f.engine.snapshot().actors[0];
 f.input.user={...f.input.user,x:start.x+1.2,z:start.z};
 const wall={minX:start.x+.5,maxX:start.x+.7,minZ:start.z-2,maxZ:start.z+.5};f.input.obstacles=[wall];
 f.engine.command({type:'approach',agentId:f.agent.id,target:'user',targetId:null,stamp:1});
 let arrived=false;for(let i=0;i<200;i++){const state=f.tick();const actor=state.actors[0];if(i===0){assert.equal(state.results.some(r=>r.status==='arrived'),false);assert.notEqual(actor.state,'talking');}if(state.results.some(r=>r.status==='arrived')){assert.ok(segmentClear(actor,f.input.user,f.input.obstacles));assert.ok(Math.hypot(actor.x-f.input.user.x,actor.z-f.input.user.z)<=1.5);arrived=true;break;}}assert.ok(arrived);
});
test('living office C22 closed wall gives blocked feedback instead of conversation or endless approach',async()=>{
 const f=await routineFixture();f.tick();const start=f.engine.snapshot().actors[0];f.input.user={...f.input.user,x:start.x+1.2,z:start.z};
 f.input.obstacles=[{minX:start.x+.5,maxX:start.x+.7,minZ:f.input.bounds.minZ,maxZ:f.input.bounds.maxZ}];
 f.engine.command({type:'approach',agentId:f.agent.id,target:'user',targetId:null,stamp:1});
 const next=f.tick();assert.equal(next.results.some(r=>r.status==='arrived'),false);assert.ok(next.results.some(r=>r.status==='blocked'&&r.message.length>0));assert.equal(next.actors[0].state,'blocked');
});

test('living office C3',async()=>{
 // GPU-free shader contract; this does not claim a rendered visual proof.
 const {AREA_FOCUS_FRAGMENT}=await import('../components/office/area-focus');
 assert.match(AREA_FOCUS_FRAGMENT,/world\*vec4\(view.xyz\/view.w/);
 assert.match(AREA_FOCUS_FRAGMENT,/float outside=maskEnabled\*\(1.-inside\)/);
 assert.match(AREA_FOCUS_FRAGMENT,/texture2D\(image,uvPoint\+vec2/);
 assert.match(AREA_FOCUS_FRAGMENT,/mix\(source.rgb,dim,outside\)/);
 assert.match(AREA_FOCUS_FRAGMENT,/blur\*\.53/);
 assert.match(AREA_FOCUS_FRAGMENT,/#include <tonemapping_fragment>/);
 assert.match(AREA_FOCUS_FRAGMENT,/#include <colorspace_fragment>/);
});
test('living office C4',async()=>{
 const {areaFocusBounds}=await import('./area-focus');
 const areas=meetingAreas([]);for(const area of areas)assert.deepEqual(areaFocusBounds(area),[area.minX,area.maxX,area.minZ,area.maxZ]);
 const first=areas[0],second=areas[1];assert.notDeepEqual(areaFocusBounds(first),areaFocusBounds(second));
 assert.equal(areaFocusBounds(areaAt(areas,'ground',0,-5.8)),null,'circulation disables the pass');
});

test('living office C18 production hire admission preserves failed full and duplicate transactions',async()=>{
 const {admitHire}=await import('./hire-admission');const {deskStore}=await import('../components/office/desk-store');
 const priorWindow=globalThis.window;let stored='',fail=false,notifications=0;
 Object.assign(globalThis,{window:{localStorage:{getItem:()=>stored,setItem:(_key:string,value:string)=>{if(fail)throw new Error('Armazenamento indisponível');stored=value;}}}});
 const unsubscribe=deskStore.subscribe(()=>notifications++);
 try{
  const form={provider:'cursor' as const,role:'Teste'},input={form,session:1,confirmed:0,desks:[],localEvents:{},observed:null};
  fail=true;assert.throws(()=>admitHire(input,deskStore.add),/Armazenamento indisponível/);assert.equal(deskStore.getSnapshot(),'');assert.equal(stored,'');assert.equal(notifications,0);assert.equal(input.confirmed,0);
  fail=false;const desk=admitHire(input,deskStore.add);assert.ok(desk.id);assert.equal(deskStore.desksFrom(stored).length,1);assert.equal(notifications,1);
  input.confirmed=1;const before=stored;assert.throws(()=>admitHire(input,deskStore.add),/já foi confirmada/);assert.equal(stored,before);assert.equal(notifications,1);
  for(let i=1;i<9;i++)deskStore.add(form);const full=stored,desks=deskStore.desksFrom(full);
  assert.throws(()=>admitHire({...input,session:2,desks},deskStore.add),/Capacidade atingida/);assert.equal(stored,full);assert.equal(deskStore.getSnapshot(),full);assert.equal(notifications,9);
  assert.throws(()=>deskStore.add(form),/Capacidade atingida/);assert.equal(stored,full);assert.equal(new Set(desks.map(d=>d.id)).size,9);
 }finally{unsubscribe();Object.assign(globalThis,{window:priorWindow});}
});
test('living office C19 actual reduced presentation has no gait bob or interpolated assembly',async()=>{
 const {routinePresentation}=await import('./agent-routines');const {resetReducedAvatar}=await import('./character');const {Group}=await import('three');
 const f=await routineFixture();const actor=f.tick().actors[0];
 for(const state of ['sleeping','packing','assembling','leaving'] as const)for(const time of [0,.5,2]){
  const current={...actor,state,buildProgress:.3,deskReady:false};const reduced=routinePresentation(current,{x:current.x-1,z:current.z},true,.001,time,.1);
  assert.equal(reduced.moving,false);assert.equal(reduced.bob,0);assert.equal(reduced.buildScale,1);assert.equal(reduced.building,true);assert.equal(reduced.lean,state==='sleeping'?.32:state==='packing'||state==='assembling'?.22:0);
 }
 assert.equal(routinePresentation({...actor,buildProgress:0,deskReady:false},actor,true,0,0).building,false);assert.equal(routinePresentation({...actor,buildProgress:1,deskReady:true},actor,true,0,0).building,false);
 const root=new Group(),head=new Group(),arms=[new Group(),new Group()],legs=[new Group(),new Group()];root.position.y=.4;for(const joint of [root,head,...arms,...legs])joint.rotation.set(.3,.4,.5);
 resetReducedAvatar(root,head,arms,legs);assert.equal(root.position.y,0);assert.deepEqual([root.rotation.x,root.rotation.y,root.rotation.z],[0,0,0]);assert.equal(head.rotation.z,0);for(const leg of legs)assert.equal(leg.rotation.x,0);assert.deepEqual(arms.map(a=>a.rotation.x),[0,0]);assert.deepEqual(arms.map(a=>a.rotation.z),[.08,-.08]);
});
test('living office C22 explicit cancellation and disappearing recipient prevent arrival',async()=>{
 for(const reason of ['cancel','disappear'] as const){const f=await routineFixture();f.input.agents.push({...f.agent,id:'recipient',x:6});f.tick();f.engine.command({type:'approach',agentId:f.agent.id,target:'agent',targetId:'recipient',stamp:1});assert.equal(f.tick().results.some(r=>r.status==='arrived'),false);
  if(reason==='cancel')f.engine.command({type:'cancel',agentId:f.agent.id,target:'agent',targetId:'recipient',stamp:2});else f.input.agents.splice(1,1);
  const next=f.tick();assert.ok(next.results.some(r=>r.agentId===f.agent.id&&r.status==='cancelled'&&r.message.length>0));assert.equal(next.results.some(r=>r.status==='arrived'),false);assert.notEqual(next.actors[0].state,'talking');for(let i=0;i<50;i++)assert.equal(f.tick().results.some(r=>r.status==='arrived'),false);
 }
});

test('living office C13 native atomic history filesystem preserves failed writes and corruption',async()=>{
 // server-only package is loaded under its legitimate react-server condition in an isolated process.
 const {execFile}=await import('node:child_process');const {promisify}=await import('node:util');
 const {mkdtemp,writeFile,rm}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const {join}=await import('node:path');const {pathToFileURL}=await import('node:url');
 const dir=await mkdtemp(join(tmpdir(),'office-c13-runner-')),runner=join(dir,'run.mts');
 const history=pathToFileURL(join(process.cwd(),'src/server/history-file.ts')).href;
 const repository=pathToFileURL(join(process.cwd(),'src/domain/agent-history.ts')).href;
 const script=`
 import assert from 'node:assert/strict';
 import {mkdtemp,stat,readdir,chmod,readFile,writeFile,rm} from 'node:fs/promises';
 import {tmpdir} from 'node:os';import {join} from 'node:path';
 import {historyFileIO} from ${JSON.stringify(history)};import {historyRepository} from ${JSON.stringify(repository)};
 const root=await mkdtemp(join(tmpdir(),'office-native-history-')),directory=join(root,'private'),file=join(directory,'history.json'),io=historyFileIO(directory);
 try{
  assert.equal(await io.read(),null);await io.writeAtomic('old');assert.equal((await stat(directory)).mode&511,448);assert.equal((await stat(file)).mode&511,384);
  await io.writeAtomic('new');assert.equal(await readFile(file,'utf8'),'new');assert.deepEqual(await readdir(directory),['history.json']);
  await chmod(directory,320);await assert.rejects(io.writeAtomic('failed'));assert.equal(await readFile(file,'utf8'),'new');await chmod(directory,448);assert.deepEqual(await readdir(directory),['history.json']);
  await writeFile(file,'corrupt');const repository=historyRepository(io);await assert.rejects(repository.read());await assert.rejects(repository.append([]));assert.equal(await readFile(file,'utf8'),'corrupt');assert.deepEqual(await readdir(directory),['history.json']);
 }finally{await chmod(directory,448).catch(()=>{});await rm(root,{recursive:true,force:true});}
 `;
 try{
  await writeFile(runner,script);
  await promisify(execFile)(process.execPath,['--conditions=react-server','--import','tsx',runner],{cwd:process.cwd(),timeout:15000});
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('living office C3 render target preserves physical DPR pixels and CSS blur radius',async()=>{
 const {applyAreaFocusResolution}=await import('../components/office/area-focus');const {WebGLRenderTarget,Vector2,DepthTexture}=await import('three');
 const target=new WebGLRenderTarget(1,1),pixel=new Vector2();target.depthTexture=new DepthTexture(1,1);let resizes=0;target.addEventListener('dispose',()=>resizes++);
 try{for(const [dpr,width,height] of [[1,800,600],[1.5,1200,900],[2,1600,1200]] as const){
  applyAreaFocusResolution(target,pixel,{width:800,height:600},new Vector2(width,height));assert.equal(target.width,800*dpr);assert.equal(target.height,600*dpr);assert.equal(target.depthTexture.image.width,width);assert.equal(target.depthTexture.image.height,height);assert.deepEqual(pixel.toArray(),[1/800,1/600]);
  const before=resizes;applyAreaFocusResolution(target,pixel,{width:800,height:600},new Vector2(width,height));assert.equal(resizes,before,'unchanged buffer is not reallocated');
 }
 applyAreaFocusResolution(target,pixel,{width:500,height:400},new Vector2(1000,800));assert.equal(target.width,1000);assert.equal(target.height,800);assert.deepEqual(pixel.toArray(),[1/500,1/400]);assert.equal(resizes,4,'DPR and logical resize update the actual render target');
 }finally{target.dispose();target.depthTexture?.dispose();}
});
