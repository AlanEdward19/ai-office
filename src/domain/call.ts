import { areaAt, meetingAreas, type MeetingArea } from "./meeting-areas";
import { walkBounds, type Pose } from "./walker";
import { type FloorId } from "./floors";
/**
 * A direct call between open pages. The hub forwards one signal and forgets it.
 * Nothing here is an agent event, and nothing is kept after the last page leaves.
 */

export type CallSignal =
  | { type: "offer"; sdp: string }
  | { type: "answer"; sdp: string }
  | { type: "ice"; candidate: string; sdpMid: string | null; sdpMLineIndex: number | null }
  | { type: "media"; audio: boolean; video: boolean };

export type CallPeer = Pose & {
  id: string; name: string; floor: FloorId; timeZone: string;
  areaId: string | null; meetingId: string | null;
};
export type CallLock = { areaId: string; owner: string };
export type CallInvite = { id: string; from: string; to: string; expiresAt: number };
export type CallDownlink =
  | { type: "roster"; self: string; peers: CallPeer[]; areas: MeetingArea[]; locks: CallLock[]; invites: CallInvite[] }
  | { type: "signal"; from: string; meetingId: string; signal: CallSignal }
  | { type: "notice"; message: string };
export type CallAction =
  | { type: "presence"; floor: FloorId; x: number; z: number; yaw: number; pitch: number; timeZone: string;seated?:boolean }
  | { type: "lock"; locked: boolean; areaId?: string }
  | { type: "invite"; to: string }
  | { type: "accept" | "decline" | "cancel"; inviteId: string }
  | { type: "leave" };
export type CallResult = { ok: true; peer?: CallPeer } | { ok: false; reason: "closed" | "invalid" | "forbidden" | "locked" | "busy" | "expired" };

const PEER_ID = /^[A-Za-z0-9_-]{8,80}$/;
const SDP_MAX = 24_000;

export function isPeerId(value: string): boolean {
  return PEER_ID.test(value);
}

type PeerIdSource = {
  randomUUID?: () => string;
  getRandomValues?: (bytes: Uint8Array) => Uint8Array;
};

/**
 * A page id for the call. `randomUUID` exists only in a secure context, so a
 * colleague on http://<lan-ip> must still get an id the hub accepts.
 */
export function createPeerId(source: PeerIdSource | undefined = globalThis.crypto): string {
  if (source && typeof source.randomUUID === "function") {
    try {
      const id = source.randomUUID();
      if (isPeerId(id)) return id;
    } catch {
      /* An insecure page can expose the method and still refuse to run it. */
    }
  }
  const bytes = new Uint8Array(16);
  if (source && typeof source.getRandomValues === "function") source.getRandomValues(bytes);
  else for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** The lower id offers. The other side only answers, so the two pages do not glare. */
export function callInitiator(localId: string, remoteId: string): boolean {
  return localId < remoteId;
}

export function parseCallSignal(value: unknown): CallSignal | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (record.type === "offer" || record.type === "answer") {
    if (typeof record.sdp !== "string") return null;
    if (!record.sdp.trimStart().startsWith("v=0") || record.sdp.length > SDP_MAX) return null;
    return { type: record.type, sdp: record.sdp };
  }
  if (record.type === "ice") {
    if (typeof record.candidate !== "string") return null;
    const candidate = record.candidate.trim();
    if (!candidate || candidate.length > 2000) return null;
    const mid = record.sdpMid === undefined ? null : record.sdpMid;
    if (mid !== null && typeof mid !== "string") return null;
    const line = record.sdpMLineIndex === undefined ? null : record.sdpMLineIndex;
    if (line !== null && (typeof line !== "number" || !Number.isInteger(line) || line < 0 || line > 64)) {
      return null;
    }
    return {
      type: "ice",
      candidate,
      sdpMid: mid === null ? null : mid.slice(0, 32),
      sdpMLineIndex: line,
    };
  }
  if (record.type === "media") {
    if (typeof record.audio !== "boolean" || typeof record.video !== "boolean") return null;
    return { type: "media", audio: record.audio, video: record.video };
  }
  return null;
}

type Member = CallPeer & {
  token: string; host: boolean; listener: (event: CallDownlink) => void;
};
export function createCallHub(options: { areas?: MeetingArea[]; now?: () => number } = {}) {
  const members = new Map<string, Member>();
  const departed = new Map<string, { peer: CallPeer; token: string; expiresAt: number }>();
  const locks = new Map<string, string>();
  const invites = new Map<string, CallInvite>();
  let areas = options.areas ?? meetingAreas([]);
  const now = options.now ?? Date.now;
  let sequence = 0;
  const publicPeer = (m: Member): CallPeer => ({ id:m.id,name:m.name,x:m.x,z:m.z,yaw:m.yaw,pitch:m.pitch,floor:m.floor,timeZone:m.timeZone,seated:m.seated===true,areaId:m.areaId,meetingId:m.meetingId });
  const notice = (id: string, message: string) => members.get(id)?.listener({type:'notice',message});
  const restore = (m: Member) => { m.meetingId=m.areaId ? `area:${m.areaId}` : null; };
  const endPrivate = (m: Member) => {
    if (!m.meetingId?.startsWith('private:')) return;
    const meeting=m.meetingId;
    for (const other of members.values()) if (other.meetingId===meeting) { restore(other); notice(other.id,'A conversa privada terminou.'); }
  };
  const cancelInvite = (invite: CallInvite, message: string) => {
    invites.delete(invite.id); notice(invite.from,message); notice(invite.to,message);
  };
  const nearby = (a:Member,b:Member, reach:number) => a.floor===b.floor && Math.hypot(a.x-b.x,a.z-b.z)<=reach;
  const boundaryLocked = (a: Member,b: Member) => a.areaId!==b.areaId && Boolean((a.areaId&&locks.has(a.areaId)) || (b.areaId&&locks.has(b.areaId)));
  const reconcile = () => {
    for (const [id, owner] of locks) {
      const occupants=[...members.values()].filter(m=>m.areaId===id);
      if (!occupants.length) locks.delete(id);
      else if (!occupants.some(m=>m.id===owner)) locks.set(id,occupants[0].id);
    }
    for (const invite of invites.values()) {
      const a=members.get(invite.from),b=members.get(invite.to);
      if (!a || !b || invite.expiresAt<=now() || !nearby(a,b,2.5) || boundaryLocked(a,b)) cancelInvite(invite,'O convite expirou ou perdeu proximidade.');
    }
    for (const m of members.values()) if (m.meetingId?.startsWith('private:')) {
      const pair=[...members.values()].filter(p=>p.meetingId===m.meetingId);
      if (pair.length!==2 || !nearby(pair[0],pair[1],3.5)) endPrivate(m);
    }
    for (const [id,item] of departed) if (item.expiresAt<=now()) departed.delete(id);
  };
  const sendRoster = () => {
    reconcile();
    const peers=[...members.values()].map(publicPeer).sort((a,b)=>a.id.localeCompare(b.id));
    for (const m of members.values()) m.listener({type:'roster',self:m.id,peers,areas,locks:[...locks].map(([areaId,owner])=>({areaId,owner})),invites:[...invites.values()].filter(i=>i.from===m.id||i.to===m.id)});
  };
  return {
    peerCount:()=>members.size,
    tick:sendRoster,
    setAreas(next:MeetingArea[]) {
      areas=next;
      for (const m of members.values()) {
        const nextId=areaAt(areas,m.floor,m.x,m.z)?.id??null;
        if (nextId!==m.areaId) { endPrivate(m);m.areaId=nextId;restore(m); }
      }
      sendRoster();
    },
    join(input:{id:string;name:string;token:string;host?:boolean},listener:(event:CallDownlink)=>void): {ok:true;leave:()=>void}|{ok:false;reason:'invalid'|'forbidden'} {
      const id=input.id.trim(),name=input.name.trim().slice(0,40),token=input.token.trim();
      if (!isPeerId(id)||!name||!token) return {ok:false,reason:'invalid'};
      const existing=members.get(id), saved=departed.get(id);
      if (existing && existing.token!==token) return {ok:false,reason:'forbidden'};
      const old=existing??(saved?.token===token&&saved.expiresAt>now()?saved.peer:null);
      const m:Member={id,name,token,host:input.host===true,listener,x:old?.x??0,z:old?.z??2.6,yaw:old?.yaw??0,pitch:old?.pitch??0,floor:old?.floor??'ground',timeZone:old?.timeZone??'UTC',seated:old?.seated===true,areaId:null,meetingId:null};
      m.areaId=areaAt(areas,m.floor,m.x,m.z)?.id??null;
      if(m.areaId&&locks.has(m.areaId)&&!existing) { m.x=0;m.z=2.6;m.areaId=null; }
      m.meetingId=existing?.meetingId??(m.areaId?`area:${m.areaId}`:null);
      members.set(id,m);departed.delete(id);sendRoster();
      return {ok:true,leave:()=>{
        if(members.get(id)!==m)return;
        endPrivate(m);departed.set(id,{peer:publicPeer(m),token,expiresAt:now()+30_000});
        members.delete(id);sendRoster();
      }};
    },
    action(input:{token:string;from:string;action:unknown}):CallResult {
      const m=members.get(input.from);
      if(!m||m.token!==input.token)return {ok:false,reason:'forbidden'};
      const a=input.action as Record<string,unknown> | null;
      if(!a||typeof a!=='object')return {ok:false,reason:'invalid'};
      reconcile();
      switch(a.type) {
        case 'presence': {
          if(a.seated!==undefined&&typeof a.seated!=='boolean')return {ok:false,reason:'invalid'};
          if((a.floor!=='ground'&&a.floor!=='hr') || !['x','z','yaw','pitch'].every(k=>typeof a[k]==='number'&&Number.isFinite(a[k])) || typeof a.timeZone!=='string'||a.timeZone.length>80)return {ok:false,reason:'invalid'};
          try {new Intl.DateTimeFormat('en',{timeZone:a.timeZone});}catch{return {ok:false,reason:'invalid'};}
          const floor=a.floor as FloorId,x=a.x as number,z=a.z as number,bounds=walkBounds(floor);
          if(x<bounds.minX||x>bounds.maxX||z<bounds.minZ||z>bounds.maxZ||Math.abs(a.yaw as number)>1e6||Math.abs(a.pitch as number)>1)return {ok:false,reason:'invalid'};
          const next=areaAt(areas,floor,x,z)?.id??null;
          if(next!==m.areaId&&next&&locks.has(next))return {ok:false,reason:'locked'};
          if(next!==m.areaId||floor!==m.floor)endPrivate(m);
          Object.assign(m,{floor,x,z,yaw:a.yaw,pitch:a.pitch,timeZone:a.timeZone,seated:a.seated===true,areaId:next});
          if(!m.meetingId?.startsWith('private:'))restore(m);
          break;
        }
        case 'lock': {
          if(typeof a.locked!=='boolean')return {ok:false,reason:'invalid'};
          const areaId=typeof a.areaId==='string'?a.areaId:m.areaId;
          if(!areaId||!areas.some(area=>area.id===areaId))return {ok:false,reason:'forbidden'};
          if(areaId!==m.areaId&&!(m.host&&!a.locked))return {ok:false,reason:'forbidden'};
          const owner=locks.get(areaId);
          if(owner&&owner!==m.id&&!m.host)return {ok:false,reason:'forbidden'};
          if(a.locked)locks.set(areaId,m.id);else locks.delete(areaId);
          break;
        }
        case 'invite': {
          const to=typeof a.to==='string'?members.get(a.to):undefined;
          if(!to||to.id===m.id||!nearby(m,to,2.5)||boundaryLocked(m,to))return {ok:false,reason:'forbidden'};
          if(m.meetingId?.startsWith('private:')||to.meetingId?.startsWith('private:')||[...invites.values()].some(i=>[i.from,i.to].includes(m.id)||[i.from,i.to].includes(to.id)))return {ok:false,reason:'busy'};
          const id=`invite:${++sequence}`;
          invites.set(id,{id,from:m.id,to:to.id,expiresAt:now()+30_000});
          break;
        }
        case 'accept': case 'decline': case 'cancel': {
          const invite=typeof a.inviteId==='string'?invites.get(a.inviteId):undefined;
          if(!invite)return {ok:false,reason:'expired'};
          if((a.type==='cancel'?invite.from:invite.to)!==m.id)return {ok:false,reason:'forbidden'};
          if(a.type!=='accept'){cancelInvite(invite,a.type==='decline'?'Convite recusado.':'Convite cancelado.');break;}
          const other=members.get(invite.from);
          if(!other||!nearby(m,other,2.5)||boundaryLocked(m,other))return {ok:false,reason:'expired'};
          if(m.meetingId?.startsWith('private:')||other.meetingId?.startsWith('private:'))return {ok:false,reason:'busy'};
          invites.delete(invite.id);m.meetingId=other.meetingId=`private:${++sequence}`;
          break;
        }
        case 'leave': endPrivate(m);break;
        default:return {ok:false,reason:'invalid'};
      }
      sendRoster();return {ok:true,peer:publicPeer(m)};
    },
    post(input:{token:string;from:string;to:string;signal:unknown}):CallResult {
      reconcile();
      const from=members.get(input.from),to=members.get(input.to);
      if(!from||from.token!==input.token||!to||input.from===input.to)return {ok:false,reason:'closed'};
      const signal=parseCallSignal(input.signal);
      if(!signal)return {ok:false,reason:'invalid'};
      if(!from.meetingId||from.meetingId!==to.meetingId)return {ok:false,reason:'forbidden'};
      to.listener({type:'signal',from:from.id,meetingId:from.meetingId,signal});return {ok:true};
    },
  };
}
