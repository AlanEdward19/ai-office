"use client";

import type { CameraMode } from "@/domain/camera";
import { useState } from 'react';
import { UserRound, Hand, Music2, Camera, Map, HelpCircle, Minus, Plus, Compass } from 'lucide-react';
import type { Gesture } from '@/domain/character';
import type { Pose } from '@/domain/walker';
import { ELEVATOR, type FloorId } from '@/domain/floors';
import type { PlacedRoom } from '@/domain/rooms';
import type { PlacedAgent } from '@/domain/placement';

export function OfficeHud({ onCharacter, onGesture, cameraMode, onCamera, zoom, onZoom, pose, floor, rooms, agents }: {
  onCharacter: () => void; onGesture: (gesture: Gesture) => void; cameraMode: CameraMode; onCamera: (mode: CameraMode) => void;
  zoom: number; onZoom: (zoom: number) => void; pose: Pose; floor: FloorId; rooms: PlacedRoom[]; agents: PlacedAgent[];
}) {
  const [mapOpen, setMapOpen] = useState(true);
  const [help, setHelp] = useState(false);
  const actions = [
    {name:'Seu personagem',icon:UserRound,action:onCharacter},
    {name:'Acenar',icon:Hand,action:() => onGesture('wave')},
    {name:'Dançar',icon:Music2,action:() => onGesture('dance')},
    {name:'Mapa',icon:Map,action:() => setMapOpen(!mapOpen),active:mapOpen},
    {name:'Como jogar',icon:HelpCircle,action:() => setHelp(!help),active:help},
  ];
  return <>
    <div className="camera-modes" role="group" aria-label="Modo de câmera">{([{mode:'first',label:'1ª pessoa'},{mode:'third',label:'3ª pessoa'},{mode:'isometric',label:'Isométrica'}] as const).map(({mode,label}) => <button key={mode} aria-pressed={cameraMode === mode} onClick={() => onCamera(mode)}><Camera size={14}/>{label}</button>)}</div>
    <nav className="social-dock" aria-label="Controles do escritório">{actions.map(({name,icon:Icon,action,active}) => <button key={name} onClick={action} aria-label={name} title={name} aria-pressed={active} className={active ? 'active' : ''}><Icon size={20}/><span>{name}</span></button>)}</nav>
    <div className="office-zoom absolute right-4 bottom-5 z-20 hidden items-center gap-1 rounded-xl border border-white/70 bg-white/85 p-1 text-slate-600 shadow-lg backdrop-blur md:flex" aria-label="Zoom"><button aria-label="Aproximar" className="rounded-lg p-2 hover:bg-slate-100" onClick={() => onZoom(Math.max(0.65, zoom - 0.15))}><Plus size={17}/></button><span className="min-w-10 text-center text-[10px]">{Math.round(100 / zoom)}%</span><button aria-label="Afastar" className="rounded-lg p-2 hover:bg-slate-100" onClick={() => onZoom(Math.min(1.6, zoom + 0.15))}><Minus size={17}/></button></div>
    {mapOpen && <aside className="office-minimap" aria-label="Mapa do andar"><div className="mb-2 flex items-center justify-between text-[10px] font-semibold tracking-wide text-slate-500 uppercase"><span>Explore o andar</span><Compass size={13}/></div><svg viewBox={floor === "ground" && rooms.length ? "-10 -17 27 24" : "-10 -7 27 14"} role="img" aria-label="Sua posição no escritório">
      <rect x="-9" y="-6" width="18" height="12" rx="0.7" fill="#dce8df" stroke="#b9cdc2" strokeWidth="0.15"/>
      {floor === 'ground' && rooms.map(room => <rect key={room.id} x={room.x-1.9} y={room.z-2} width="3.8" height="4" rx="0.3" fill="#b9d4ca" stroke="#83aa9c" strokeWidth="0.1"><title>{room.name}</title></rect>)}
      {floor === 'ground' && agents.map(agent => <circle key={agent.id} cx={agent.x} cy={agent.z} r="0.28" fill="#e0a565"/>)}
      <circle cx={ELEVATOR.x} cy={ELEVATOR.z} r="0.45" fill="#738b9b"/>
      <circle cx={pose.x} cy={pose.z} r="0.45" fill="#177f69" stroke="white" strokeWidth="0.2"/>
    </svg><div className="mt-1 flex items-center gap-1.5 text-[10px] text-slate-500"><span className="size-1.5 rounded-full bg-teal-600"/>Você está aqui</div></aside>}
    {help && <aside className="office-help absolute bottom-36 left-1/2 z-30 w-[min(90%,22rem)] -translate-x-1/2 rounded-2xl border border-white/80 bg-white/95 p-5 text-slate-700 shadow-xl"><h3 className="mb-3 font-semibold">Explore no seu ritmo</h3><p className="text-sm leading-7"><kbd>W A S D</kbd> ou setas para andar<br/>Clique no chão para escolher um destino<br/><kbd>E</kbd> para interagir perto dos objetos<br/>Em 1ª ou 3ª pessoa, arraste para olhar</p><button onClick={() => setHelp(false)} className="mt-4 min-h-10 rounded-lg px-3 text-sm font-semibold text-teal-700 hover:bg-teal-50">Entendi</button></aside>}
  </>;
}
