import test from 'node:test';
import assert from 'node:assert/strict';
import { createCallHub, type CallDownlink } from './call';
import { meetingAreas, areaAt } from './meeting-areas';
const cafe=meetingAreas([]).find(a=>a.id==='cafe')!;
const cafeX=(cafe.minX+cafe.maxX)/2,cafeZ=(cafe.minZ+cafe.maxZ)/2;
const research=meetingAreas([]).find(a=>a.id==='research')!;
function setup() {
 let time=1000;
 const hub=createCallHub({now:()=>time});
 const events:Record<string,CallDownlink[]>={};
 const joins: Record<string,()=>void>={};
 for (const id of ['person-a','person-b','person-c']) {
  events[id]=[];
  const join=hub.join({id,name:id,token:id,host:id==='person-c'},e=>events[id].push(e));
  if(join.ok) joins[id]=join.leave;
 }
 const act=(id:string,action:unknown)=>hub.action({from:id,token:id,action});
 const move=(id:string,x=cafeX,z=cafeZ,floor='ground')=>act(id,{type:'presence',floor,x,z,yaw:0,pitch:0,timeZone:'America/Sao_Paulo'});
 const roster=(id='person-a')=>{const e=events[id].findLast(e=>e.type==='roster');assert.equal(e?.type,'roster');if(e?.type!=='roster')throw Error();return e;};
 const signal=(a='person-a',b='person-b',type='offer')=>hub.post({from:a,to:b,token:a,signal:type==='media'?{type,audio:true,video:false}:type==='ice'?{type,candidate:'candidate:1'}:{type,sdp:'v=0\r\n'}});
 return {hub,events,joins,act,move,roster,signal,advance:(ms:number)=>{time+=ms;hub.tick();}};
}
test('area admission and map coverage',()=>{
 const s=setup();s.move('person-a');assert.equal(s.roster().peers[0].meetingId,'area:cafe');
 s.move('person-a',0,2.6);assert.equal(s.roster().peers[0].meetingId,null);
 const areas=meetingAreas([{id:'project-a',name:'A',x:-6.825,z:-9}]);
 for(const a of areas)assert.equal(areaAt(areas,a.floor,(a.minX+a.maxX)/2,(a.minZ+a.maxZ)/2)?.id,a.id);
 assert.ok(areas.some(a=>a.id==='project:project-a'));assert.ok(areas.some(a=>a.name==='Estúdio'));assert.ok(areas.some(a=>a.name==='Estudo'));
});
test('signals require same authorized meeting',()=>{
 const s=setup();
 for(const type of ['offer','answer','ice','media']) {
  assert.deepEqual(s.signal('person-a','person-b',type),{ok:false,reason:'forbidden'});
  s.move('person-a');s.move('person-b');assert.equal(s.signal('person-a','person-b',type).ok,true);
  s.move('person-b',(research.minX+research.maxX)/2,(research.minZ+research.maxZ)/2);assert.equal(s.signal('person-a','person-b',type).ok,false);
  s.move('person-a',0,2.6);s.move('person-b',0,2.6);
 }
 assert.ok(!JSON.stringify(s.roster()).includes('token'));
});
test('locked entrance rejects newcomers and permits exit',()=>{
 const s=setup();s.move('person-a');s.act('person-a',{type:'lock',locked:true});
 assert.deepEqual(s.move('person-b'),{ok:false,reason:'locked'});
 assert.equal(s.move('person-a',0,2.6).ok,true);assert.equal(s.roster().locks.length,0);assert.equal(s.move('person-b').ok,true);
});
test('unlock authorization and empty cleanup',()=>{
 const s=setup();s.move('person-a');s.move('person-b');s.move('person-c');s.act('person-a',{type:'lock',locked:true});
 assert.equal(s.act('person-b',{type:'lock',locked:false}).ok,false);
 s.move('person-c',0,2.6);
 assert.equal(s.act('person-b',{type:'lock',locked:false,areaId:'cafe'}).ok,false);
 assert.equal(s.act('person-c',{type:'lock',locked:false,areaId:'cafe'}).ok,true);
 s.act('person-a',{type:'lock',locked:true});s.joins['person-a']();s.joins['person-b']();s.joins['person-c']();assert.equal(s.hub.peerCount(),0);
});
test('lock ownership transfers on exit',()=>{
 const s=setup();s.move('person-a');s.move('person-b');s.act('person-a',{type:'lock',locked:true});s.move('person-a',0,2.6);
 assert.equal(s.roster().locks[0].owner,'person-b');assert.equal(s.act('person-b',{type:'lock',locked:false}).ok,true);
});
test('disconnect and reconnect identity',()=>{
 const s=setup();s.move('person-a');
 assert.deepEqual(s.hub.join({id:'person-a',name:'hijack',token:'wrong'},()=>{}),{ok:false,reason:'forbidden'});
 let last:CallDownlink|null=null;
 const replacement=s.hub.join({id:'person-a',name:'A',token:'person-a'},e=>{last=e;});assert.equal(replacement.ok,true);
 s.joins['person-a']();assert.equal(s.hub.peerCount(),3);
 if(replacement.ok)replacement.leave();assert.equal(s.hub.peerCount(),2);
 s.hub.join({id:'person-a',name:'A',token:'person-a'},e=>{last=e;});assert.equal(s.hub.peerCount(),3);
 assert.ok(last);const r=last as unknown as Extract<CallDownlink,{type:'roster'}>;assert.equal(r.peers.find(p=>p.id==='person-a')?.areaId,'cafe');
});
test('private pair is isolated',()=>{
 const s=setup();s.move('person-a');s.move('person-b');s.move('person-c');
 s.act('person-a',{type:'invite',to:'person-b'});assert.equal(s.roster().peers[0].meetingId,'area:cafe');
 const invite=s.roster().invites[0];s.act('person-b',{type:'accept',inviteId:invite.id});
 assert.ok(s.roster().peers[0].meetingId?.startsWith('private:'));assert.equal(s.signal().ok,true);assert.equal(s.signal('person-a','person-c').ok,false);
});
test('invite cancellation expiration and distance',()=>{
 for(const end of ['decline','cancel','time','distance','floor']) {
  const s=setup();s.move('person-a');s.move('person-b');s.act('person-a',{type:'invite',to:'person-b'});const id=s.roster().invites[0].id;
  if(end==='decline'||end==='cancel')s.act(end==='decline'?'person-b':'person-a',{type:end,inviteId:id});
  if(end==='time')s.advance(30_000);
  if(end==='distance')s.move('person-b',cafeX+3,cafeZ);
  if(end==='floor')s.move('person-b',0,2.6,'hr');
  assert.equal(s.roster().invites.length,0);assert.equal(s.act('person-b',{type:'accept',inviteId:id}).ok,false);assert.ok(s.events['person-a'].some(e=>e.type==='notice'));
 }
});
test('private ends on exit distance floor and disconnect',()=>{
 for(const end of ['leave','distance','floor','area','disconnect']) {
  const s=setup();s.move('person-a');s.move('person-b');s.act('person-a',{type:'invite',to:'person-b'});s.act('person-b',{type:'accept',inviteId:s.roster().invites[0].id});
  if(end==='leave')s.act('person-a',{type:'leave'});
  if(end==='distance')s.move('person-b',cafe.maxX-.1,cafeZ); // still same cafe but >3.5 from x11.8 below
  if(end==='distance')s.move('person-a',cafe.minX+.1,cafeZ);
  if(end==='floor')s.move('person-b',0,2.6,'hr');
  if(end==='area')s.move('person-b',0,2.6);
  if(end==='disconnect')s.joins['person-b']();
  assert.ok(s.roster().peers.every(p=>!p.meetingId?.startsWith('private:')));
 }
});
test('invite authentication busy and locked boundaries',()=>{
 const s=setup();
 s.move('person-a',0,2.6);s.move('person-b',3,2.6);
 assert.deepEqual(s.act('person-a',{type:'invite',to:'person-b'}),{ok:false,reason:'forbidden'},'direct invite >2.5 m rejected');
 s.move('person-b',0,2.6,'hr');
 assert.deepEqual(s.act('person-a',{type:'invite',to:'person-b'}),{ok:false,reason:'forbidden'},'direct invite to another floor rejected');
 s.move('person-a',cafe.minX+.1,cafeZ);s.move('person-b',cafe.minX-.1,cafeZ);s.act('person-a',{type:'lock',locked:true});
 assert.equal(s.act('person-a',{type:'invite',to:'person-b'}).ok,false);
 s.act('person-a',{type:'lock',locked:false});s.move('person-b');s.move('person-c');s.act('person-a',{type:'invite',to:'person-b'});const id=s.roster().invites[0].id;
 assert.equal(s.hub.action({from:'person-b',token:'person-a',action:{type:'accept',inviteId:id}}).ok,false);
 assert.equal(s.act('person-c',{type:'accept',inviteId:id}).ok,false);
 s.act('person-b',{type:'accept',inviteId:id});assert.equal(s.act('person-c',{type:'invite',to:'person-b'}).ok,false);
});

test('HTTP call boundary statuses',async()=>{
 const {callCommandResponse,callStreamStatus,callStreamResponse}=await import('./call-http');
 let opened=0;
 const open=(peer:string,session:{token:string})=>{assert.equal(peer,'person-a');assert.equal(session.token,'person-a');opened++;return new Response('event: roster\ndata: {}\n\n',{headers:{'Content-Type':'text/event-stream'}});};
 const denied=callStreamResponse(new Request('http://local/api/call?peer=person-a'),null,open);
 assert.equal(denied.status,401);assert.deepEqual(await denied.json(),{error:'signed_out'});assert.equal(opened,0);
 const malformed=callStreamResponse(new Request('http://local/api/call?peer=bad'),{token:'person-a'},open);
 assert.equal(malformed.status,400);assert.deepEqual(await malformed.json(),{error:'invalid'});assert.equal(opened,0);
 const accepted=callStreamResponse(new Request('http://local/api/call?peer=person-a'),{token:'person-a'},open);
 assert.equal(accepted.status,200);assert.equal(accepted.headers.get('Content-Type'),'text/event-stream');assert.match(await accepted.text(),/event: roster/);assert.equal(opened,1);
 assert.equal(callStreamStatus(false,'person-a'),401);assert.equal(callStreamStatus(true,'bad'),400);assert.equal(callStreamStatus(true,'person-a'),200);
 const s=setup();
 const cmd=(i:Parameters<typeof s.hub.action>[0] & {to:string;signal:unknown;action:unknown;channel?:"meeting"|"office"})=>i.action===undefined?s.hub.post(i):s.hub.action(i);
 const send=(body:unknown,session:{token:string}|null={token:'person-a'})=>callCommandResponse(new Request('http://local/api/call',{method:'POST',body:JSON.stringify(body)}),session,cmd);
 assert.equal((await send({},null)).status,401);assert.equal((await send({})).status,400);
 assert.equal((await send({from:'person-a',action:{type:'presence',x:0,z:2.6,yaw:0,pitch:0,floor:'ground',timeZone:'UTC'}})).status,200);
 assert.equal((await send({from:'person-a',to:'person-b',signal:{type:'offer',sdp:'v=0'}})).status,403);
 assert.equal((await send({from:'person-a',action:{type:'accept',inviteId:'gone'}})).status,409);
 assert.equal((await send({from:'person-a',action:{type:'presence',x:NaN}})).status,400);
});

test('physical locks block entry and permit boundary exit',async()=>{
 const {entryBarriers,integrateWalk,walkBounds}=await import('./walker');
 const area={minX:1,maxX:3,minZ:1,maxZ:3};
 const keys={forward:0,strafe:1,turn:0,yawDelta:0,pitchDelta:0};
 const outside={x:0,z:2,yaw:0,pitch:0};
 const stopped=integrateWalk(outside,keys,null,1,walkBounds('ground'),entryBarriers(outside,[area])).pose;
 assert.ok(stopped.x<1);
 const leaving={x:3.05,z:2,yaw:0,pitch:0};
 const freed=integrateWalk(leaving,keys,null,.3,walkBounds('ground'),entryBarriers(leaving,[area])).pose;
 assert.ok(freed.x>4);
 assert.equal(entryBarriers(freed,[area]).length,1);
});
