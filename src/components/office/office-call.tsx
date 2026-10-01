"use client";
import { Mic, MicOff, Video, VideoOff, ChevronDown, ChevronUp, Lock, LockOpen, Users } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { callInitiator, parseCallSignal, type CallDownlink, type CallAction, type CallPeer, type CallSignal } from '@/domain/call';
import { areaAt } from '@/domain/meeting-areas';
import type { FloorId } from '@/domain/floors';
import type { Pose } from '@/domain/walker';
import { Button } from '@/components/ui/button';
export type PresenceRoster = Extract<CallDownlink,{type:'roster'}>;
type Tile = { id:string;name:string;stream:MediaStream|null;audio:boolean;video:boolean };
type Link = {pc:RTCPeerConnection;queued:RTCIceCandidateInit[];audio:RTCRtpTransceiver;video:RTCRtpTransceiver};
type Props = {onEvent:(channel:string,value:unknown)=>void;onConnected:(connected:boolean)=>void;pose:Pose;floor:FloorId;host:boolean;onRoster:(roster:PresenceRoster|null)=>void;onCorrection:(pose:Pose)=>void;inviteTarget:{id:string;stamp:number}|null;onClearInvite:()=>void};
const errors:Record<string,string>={locked:'Esta área está trancada. Peça ao responsável para abrir.',busy:'Essa pessoa já está em uma conversa ou convite.',forbidden:'Ação indisponível: aproxime-se no mesmo andar e confira a tranca.',expired:'Este convite expirou.',invalid:'Não foi possível atualizar a presença.',closed:'A presença está reconectando.'};
export function OfficeCall(props:Props) {
 const [collapsed,setCollapsed]=useState(false),[roster,setRoster]=useState<PresenceRoster|null>(null),[connected,setConnected]=useState(false),[hint,setHint]=useState('Conectando presença…'),[tiles,setTiles]=useState<Tile[]>([]),[audioOn,setAudioOn]=useState(false),[videoOn,setVideoOn]=useState(false),[confirm,setConfirm]=useState<CallPeer|null>(null),[pendingMedia,setPendingMedia]=useState(false);
 const latest=useRef(props),snapshot=useRef<PresenceRoster|null>(null),self=useRef(''),scope=useRef<string|null>(null),epoch=useRef(0),links=useRef(new Map<string,Link>()),stream=useRef<MediaStream|null>(null),source=useRef<EventSource|null>(null),localVideo=useRef<HTMLVideoElement>(null),desired=useRef({audio:false,video:false}),closed=useRef(false),busyPresence=useRef(false);
 useEffect(()=>{latest.current=props;});
 const send=async(payload:Record<string,unknown>)=>{
  if(!self.current||closed.current)return null;
  try {const response=await fetch('/api/call',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({from:self.current,...payload})});const result=await response.json();if(!response.ok)setHint(errors[result.error]??'A ação não foi concluída. Tente novamente.');return result;}catch{setHint('Sem conexão. Tentando reconectar…');return null;}
 };
 const act=async(action:CallAction)=>send({action});
 const signal=async(to:string,signal:CallSignal)=>send({to,signal});
 const reset=()=>{
  epoch.current++;for(const link of links.current.values())link.pc.close();links.current.clear();
  stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;desired.current={audio:false,video:false};
  if(localVideo.current)localVideo.current.srcObject=null;
  setTiles([]);setAudioOn(false);setVideoOn(false);
 };
 const announce=()=>{for(const id of links.current.keys())void signal(id,{type:'media',...desired.current});};
 const allowed=(id:string)=>{const r=snapshot.current;return Boolean(scope.current&&r?.peers.some(p=>p.id===id&&p.meetingId===scope.current));};
 const createLink=(peer:CallPeer):Link=>{
  const old=links.current.get(peer.id);if(old)return old;
  const generation=epoch.current,pc=new RTCPeerConnection({iceServers:[]});
  const audio=pc.addTransceiver('audio',{direction:'sendrecv'}),video=pc.addTransceiver('video',{direction:'sendrecv'});
  if(stream.current)for(const t of stream.current.getTracks())void(t.kind==='audio'?audio:video).sender.replaceTrack(t);
  const link={pc,audio,video,queued:[] as RTCIceCandidateInit[]};links.current.set(peer.id,link);
  pc.onicecandidate=e=>{if(e.candidate&&generation===epoch.current&&allowed(peer.id))void signal(peer.id,{type:'ice',candidate:e.candidate.candidate,sdpMid:e.candidate.sdpMid,sdpMLineIndex:e.candidate.sdpMLineIndex});};
  pc.ontrack=e=>{
   if(generation!==epoch.current||!allowed(peer.id))return;
   setTiles(current=>current.map(tile=>{if(tile.id!==peer.id)return tile;const media=tile.stream??new MediaStream();if(!media.getTracks().includes(e.track))media.addTrack(e.track);return {...tile,stream:media};}));
  };
  return link;
 };
 const offer=async(peer:CallPeer)=>{
  const generation=epoch.current,link=createLink(peer);
  try {await link.pc.setLocalDescription(await link.pc.createOffer());if(generation!==epoch.current||!allowed(peer.id))return;const sdp=link.pc.localDescription?.sdp;if(sdp)await signal(peer.id,{type:'offer',sdp});}catch{/* Disconnected or superseded scope. */}
 };
 const receiveSignal=async(event:Extract<CallDownlink,{type:'signal'}>)=>{
  if(event.meetingId!==scope.current||!allowed(event.from))return;
  const s=parseCallSignal(event.signal);if(!s)return;
  if(s.type==='media'){setTiles(t=>t.map(tile=>tile.id===event.from?{...tile,audio:s.audio,video:s.video}:tile));return;}
  const peer=snapshot.current?.peers.find(p=>p.id===event.from);if(!peer)return;
  const link=createLink(peer),generation=epoch.current;
  const flush=async()=>{for(const ice of link.queued.splice(0))await link.pc.addIceCandidate(ice);};
  try {
   if(s.type==='offer'){
    await link.pc.setRemoteDescription({type:'offer',sdp:s.sdp});await flush();
    if(generation!==epoch.current||!allowed(peer.id))return;
    await link.pc.setLocalDescription(await link.pc.createAnswer());if(generation===epoch.current&&allowed(peer.id)&&link.pc.localDescription?.sdp)await signal(peer.id,{type:'answer',sdp:link.pc.localDescription.sdp});announce();
   }else if(s.type==='answer'){await link.pc.setRemoteDescription({type:'answer',sdp:s.sdp});await flush();announce();}
   else{const ice={candidate:s.candidate,sdpMid:s.sdpMid,sdpMLineIndex:s.sdpMLineIndex};if(link.pc.remoteDescription)await link.pc.addIceCandidate(ice);else link.queued.push(ice);}
  }catch{/* A pending signal can belong to a just-closed connection. */}
 };
 const receiveRoster=(r:PresenceRoster)=>{
  snapshot.current=r;
  const own=r.peers.find(p=>p.id===r.self);
  const physical=areaAt(r.areas,latest.current.floor,latest.current.pose.x,latest.current.pose.z)?.id??null;
  // An SSE roster can arrive before our position POST: never reconnect the previous area.
  const privatePartner=own?.meetingId?.startsWith('private:') ? r.peers.find(p=>p.id!==own.id&&p.meetingId===own.meetingId) : null;
  const separated=privatePartner && (privatePartner.floor!==latest.current.floor || Math.hypot(privatePartner.x-latest.current.pose.x,privatePartner.z-latest.current.pose.z)>3.5);
  const meeting=own?.floor===latest.current.floor && own.areaId===physical && !separated ? own.meetingId : null;
  if(r.invites.some(invite=>invite.to===r.self))setCollapsed(false);
  if(scope.current!==meeting){reset();scope.current=meeting;}
  const others=r.peers.filter(p=>p.id!==r.self&&meeting&&p.meetingId===meeting),ids=new Set(others.map(p=>p.id));
  for(const [id,link]of links.current)if(!ids.has(id)){link.pc.close();links.current.delete(id);}
  setTiles(old=>others.map(p=>({...old.find(t=>t.id===p.id)??{stream:null,audio:false,video:false},id:p.id,name:p.name})));
  for(const peer of others)if(!links.current.has(peer.id)){createLink(peer);if(callInitiator(r.self,peer.id))void offer(peer);}
  setRoster(r);latest.current.onRoster(r);setConnected(true);
 };
 const publishPresence=async()=>{
  if(busyPresence.current||!snapshot.current)return;busyPresence.current=true;
  const p=latest.current;const result=await act({type:'presence',floor:p.floor,...p.pose,timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone});
  busyPresence.current=false;
  if(result?.error==='locked') {const own=snapshot.current?.peers.find(p=>p.id===self.current);if(own)latest.current.onCorrection(own);}
 };
 useEffect(()=>{
  closed.current=false;self.current=crypto.randomUUID();
  const es=new EventSource(`/api/call?peer=${encodeURIComponent(self.current)}`);source.current=es;
  es.addEventListener('roster',e=>{try{const r=JSON.parse((e as MessageEvent).data) as PresenceRoster;if(r.type==='roster'&&r.self===self.current&&Array.isArray(r.peers)){const first=!snapshot.current;receiveRoster(r);if(first)void publishPresence();}}catch{}});
  es.addEventListener('signal',e=>{try{void receiveSignal(JSON.parse((e as MessageEvent).data));}catch{}});
  es.addEventListener('notice',e=>{try{setHint(JSON.parse((e as MessageEvent).data).message);}catch{}});
  for(const channel of ['claude-status','claude-notice','snapshot','local-agent','local-presence','local-notice','cloud-agent','cloud-notice'])es.addEventListener(channel,e=>{try{latest.current.onEvent(channel,JSON.parse((e as MessageEvent).data));}catch{}});
  es.onopen=()=>{setConnected(true);latest.current.onConnected(true);setHint('');};
  es.onerror=()=>{setConnected(false);latest.current.onConnected(false);setHint('Reconectando presença…');scope.current=null;reset();latest.current.onRoster(null);};
  const timer=window.setInterval(()=>void publishPresence(),180);
  return()=>{closed.current=true;es.close();source.current=null;window.clearInterval(timer);scope.current=null;reset();latest.current.onRoster(null);};
  // This transport owns a stable tab identity; mutable UI values travel through latest/snapshot refs.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);
 useEffect(()=>{
  const r=snapshot.current,own=r?.peers.find(p=>p.id===self.current);if(!r||!own)return;
  const next=areaAt(r.areas,props.floor,props.pose.x,props.pose.z)?.id??null;
  const partner=own.meetingId?.startsWith('private:')?r.peers.find(p=>p.id!==own.id&&p.meetingId===own.meetingId):null;
  if(own.floor!==props.floor||own.areaId!==next||(partner&&Math.hypot(partner.x-props.pose.x,partner.z-props.pose.z)>3.5)) {scope.current=null;reset();}
  // Movement must stop old media before server roundtrip confirms new membership.
 },[props.floor,props.pose]);
 useEffect(()=>{
  if(!props.inviteTarget)return;
  const r=snapshot.current,own=r?.peers.find(p=>p.id===self.current),peer=r?.peers.find(p=>p.id===props.inviteTarget?.id);
  if(own&&peer&&peer.id!==own.id&&peer.floor===own.floor&&Math.hypot(peer.x-own.x,peer.z-own.z)<=2.5){setConfirm(peer);setCollapsed(false);}else setHint('Aproxime-se até 2,5 m para convidar essa pessoa.');
  latest.current.onClearInvite();
 },[props.inviteTarget]);
 useEffect(()=>{if(localVideo.current)localVideo.current.srcObject=stream.current;},[videoOn]);
 const toggle=async(kind:'audio'|'video')=>{
  if(!scope.current||pendingMedia)return;
  if(desired.current[kind]) {
   for(const t of stream.current?.getTracks()??[])if(t.kind===(kind==='audio'?'audio':'video')){t.stop();stream.current?.removeTrack(t);}
   for(const l of links.current.values())void l[kind].sender.replaceTrack(null);
   desired.current[kind]=false;if(kind==='audio')setAudioOn(false);else setVideoOn(false);announce();return;
  }
  const generation=epoch.current;setPendingMedia(true);
  try {
   const captured=await navigator.mediaDevices.getUserMedia(kind==='audio'?{audio:{echoCancellation:true,noiseSuppression:true},video:false}:{audio:false,video:true});
   if(closed.current||generation!==epoch.current||!scope.current){captured.getTracks().forEach(t=>t.stop());return;}
   stream.current??=new MediaStream();for(const t of captured.getTracks()){stream.current.addTrack(t);for(const l of links.current.values())await l[kind].sender.replaceTrack(t);}
   if(localVideo.current)localVideo.current.srcObject=stream.current;
   desired.current[kind]=true;if(kind==='audio')setAudioOn(true);else setVideoOn(true);setHint('');announce();
  }catch{setHint('Permissão recusada ou dispositivo indisponível. Libere o acesso no navegador e tente novamente.');}
  finally{setPendingMedia(false);}
 };
 const own=roster?.peers.find(p=>p.id===roster.self),area=roster?.areas.find(a=>a.id===own?.areaId),lock=roster?.locks.find(l=>l.areaId===own?.areaId),privateMeeting=own?.meetingId?.startsWith('private:'),incoming=roster?.invites.find(i=>i.to===roster.self),outgoing=roster?.invites.find(i=>i.from===roster.self);
 return <section className={`call-panel meeting-panel absolute top-24 left-4 z-20 rounded-2xl border border-white/70 bg-white/90 text-slate-700 shadow-sm backdrop-blur ${collapsed?'call-collapsed':''}`} data-testid="call-panel" data-audio={audioOn?'on':'off'} data-video={videoOn?'on':'off'}>
  <button className="call-heading" aria-label={collapsed?'Expandir chamada':'Recolher chamada'} aria-expanded={!collapsed} onClick={()=>setCollapsed(!collapsed)}><span>{privateMeeting?'Conversa privada':area?.name??'No corredor'}</span>{collapsed?<ChevronDown size={16}/>:<ChevronUp size={16}/>}</button>
  <p className="text-xs leading-5" data-testid="call-waiting">{!connected?'Reconectando…':!own?.meetingId?'Entre em uma área para reunir-se.':tiles.length?`${tiles.length+1} pessoas nesta reunião`:'Só você nesta reunião.'}</p>
  {hint&&<p role="status" className="my-2 text-xs leading-5 text-amber-800">{hint}</p>}
  <div className="meeting-content">
   {lock&&<p className="mb-2 text-xs">Área trancada · {roster?.peers.find(p=>p.id===lock.owner)?.name}</p>}
   {area&&<Button size="sm" variant="outline" disabled={Boolean(lock&&lock.owner!==roster?.self&&!props.host)} onClick={()=>void act({type:'lock',locked:!lock})}>{lock?<LockOpen size={14}/>:<Lock size={14}/>} {lock?'Destrancar área':'Trancar área'}</Button>}
   {Boolean(roster?.locks.length)&&<div className="meeting-invite"><p>Áreas trancadas</p>{roster?.locks.map(locked=><div key={locked.areaId} className="w-full"><p>{roster.areas.find(a=>a.id===locked.areaId)?.name} · {roster.peers.find(p=>p.id===locked.owner)?.name}</p>{props.host&&<Button size="sm" variant="outline" onClick={()=>void act({type:'lock',locked:false,areaId:locked.areaId})}>Destrancar como anfitrião</Button>}</div>)}</div>}
   {privateMeeting&&<Button size="sm" variant="outline" onClick={()=>void act({type:'leave'})}>Encerrar conversa</Button>}
   {confirm&&<div className="meeting-invite" role="dialog" aria-label="Confirmar convite"><p>Conversar em particular com {confirm.name}?</p><Button size="sm" onClick={()=>{void act({type:'invite',to:confirm.id});setConfirm(null);}}>Confirmar convite</Button><Button size="sm" variant="outline" onClick={()=>setConfirm(null)}>Cancelar</Button></div>}
   {incoming&&<div className="meeting-invite" role="dialog" aria-label="Convite para conversar"><p>{roster?.peers.find(p=>p.id===incoming.from)?.name} quer conversar. Expira em 30 s.</p><Button size="sm" onClick={()=>void act({type:'accept',inviteId:incoming.id})}>Aceitar</Button><Button size="sm" variant="outline" onClick={()=>void act({type:'decline',inviteId:incoming.id})}>Recusar</Button></div>}
   {outgoing&&<div className="meeting-invite"><p>Aguardando confirmação de {roster?.peers.find(p=>p.id===outgoing.to)?.name}…</p><Button size="sm" variant="outline" onClick={()=>void act({type:'cancel',inviteId:outgoing.id})}>Cancelar convite</Button></div>}
   {videoOn&&<video ref={localVideo} autoPlay muted playsInline data-testid="call-local" className="rounded-xl bg-black object-cover"/>}
   {tiles.map(tile=><RemoteVideo key={tile.id} tile={tile}/>)}
   <details className="meeting-people mt-3" open><summary><Users size={14}/> Pessoas conectadas ({roster?.peers.length??0})</summary>{roster?.peers.map(p=><button key={p.id} disabled={p.id===roster.self} onClick={()=>{if(own&&p.floor===own.floor&&Math.hypot(p.x-own.x,p.z-own.z)<=2.5)setConfirm(p);else setHint('Aproxime-se até 2,5 m no mesmo andar para conversar.');}}><strong>{p.name}{p.id===roster.self?' (você)':''}{roster.peers.filter(other=>other.name===p.name).length>1?' · outra aba':''}</strong><span>{p.floor==='hr'?'RH':'Térreo'} · {roster.areas.find(a=>a.id===p.areaId)?.name??'Corredor'}{p.meetingId?.startsWith('private:')?' · em conversa':''}</span></button>)}</details>
  </div>
  <div className="call-controls mt-3 grid grid-cols-2 gap-2"><Button size="sm" variant="outline" disabled={!connected||!own?.meetingId||pendingMedia} aria-label={audioOn?'Desligar microfone':'Ligar microfone'} aria-pressed={audioOn} data-testid="call-mic" onClick={()=>void toggle('audio')}>{audioOn?<Mic size={15}/>:<MicOff size={15}/>}</Button><Button size="sm" variant="outline" disabled={!connected||!own?.meetingId||pendingMedia} aria-label={videoOn?'Desligar câmera':'Ligar câmera'} aria-pressed={videoOn} data-testid="call-camera" onClick={()=>void toggle('video')}>{videoOn?<Video size={15}/>:<VideoOff size={15}/>}</Button></div>
 </section>;
}
function RemoteVideo({tile}:{tile:Tile}){
 const ref=useRef<HTMLVideoElement>(null);
 useEffect(()=>{const node=ref.current;if(!node)return;node.srcObject=tile.stream;return()=>{node.pause();node.srcObject=null;};},[tile.stream]);
 return <div className="mt-3"><video ref={ref} autoPlay playsInline muted={!tile.audio} data-testid="call-remote" data-name={tile.name} className={tile.video?'rounded-xl bg-black object-cover':'h-0! opacity-0'} /><p className="mt-1 text-xs">{tile.name} · {tile.audio?'microfone ligado':'mudo'}{tile.video?' · câmera ligada':''}</p></div>;
}
