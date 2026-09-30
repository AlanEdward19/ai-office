"use client";
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { Check, RotateCcw, Sparkles, Shirt, Smile, Scissors, Headphones } from 'lucide-react';
import { DEFAULT_APPEARANCE, HAIRSTYLES, OUTFITS, ACCESSORIES, type Appearance } from '@/domain/character';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const Preview = dynamic(() => import('./character-preview'), { ssr: false, loading: () => <p className="p-8 text-sm text-slate-500">Preparando seu avatar…</p> });
const colors = ['#398779', '#497cb0', '#705bab', '#d67a61', '#e1b760', '#e8e4db', '#303e53', '#ad5381'];
const skins = ['#f4d5bc', '#e8bd99', '#dba882', '#be8865', '#9b694c', '#774d38', '#593829', '#e5bfad'];
const hairs = ['#30231e', '#665043', '#af8056', '#dfc18c', '#dedbd6', '#763b39', '#705bab', '#263e59'];
const names = { short:'Curto', bob:'Chanel', curls:'Cacheado', ponytail:'Rabo de cavalo', mohawk:'Moicano', none:'Nenhum', tee:'Camiseta', hoodie:'Moletom', jacket:'Jaqueta', formal:'Social', glasses:'Óculos', headphones:'Fones', cap:'Boné' };
const tabs = [{id:'style', label:'Looks', icon:Sparkles}, {id:'face', label:'Pele', icon:Smile}, {id:'hair', label:'Cabelo', icon:Scissors}, {id:'clothes', label:'Roupa', icon:Shirt}, {id:'extras', label:'Extras', icon:Headphones}] as const;

export function CharacterCreator({ open, onOpenChange, appearance, onChange }: {
  open: boolean; onOpenChange: (open: boolean) => void; appearance: Appearance; onChange: (appearance: Appearance) => void;
}) {
  const [tab, setTab] = useState<typeof tabs[number]['id']>('style');
  function palette(key: 'shirt'|'skin'|'hair'|'pants'|'shoes', values: string[], label: string) {
    return <fieldset className="mt-5"><legend className="mb-3 text-xs font-semibold tracking-wide text-slate-500 uppercase">{label}</legend>
      <div className="flex flex-wrap gap-2">{values.map(color => <button key={color} aria-label={`${label} ${color}`} aria-pressed={appearance[key] === color} onClick={() => onChange({...appearance, [key]:color})} className="avatar-swatch" style={{background:color}}>{appearance[key] === color && <Check size={16} color={['#e8e4db','#f4d5bc','#dedbd6'].includes(color) ? '#243647' : 'white'} />}</button>)}
        <label className="relative grid size-9 cursor-pointer place-items-center overflow-hidden rounded-full border border-dashed border-slate-300 text-slate-500">+<input aria-label={`${label} personalizada`} type="color" value={appearance[key]} onChange={event => onChange({...appearance, [key]:event.target.value})} className="absolute inset-0 size-full cursor-pointer opacity-0" /></label>
      </div></fieldset>;
  }
  function options(key: 'hairstyle'|'outfit'|'accessory', values: readonly string[]) {
    return <div className="grid grid-cols-2 gap-2">{values.map(value => <button key={value} aria-pressed={appearance[key] === value} className={`avatar-option ${appearance[key] === value ? 'selected' : ''}`} onClick={() => onChange({...appearance, [key]:value})}>{names[value as keyof typeof names]}{appearance[key] === value && <Check size={14} />}</button>)}</div>;
  }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="avatar-dialog max-h-[90dvh] w-[min(100%-1.5rem,52rem)] overflow-y-auto border-white/70 bg-[#f8faf9] p-0 text-slate-800">
    <DialogHeader className="mb-0 px-6 pt-6"><p className="mb-2 text-[10px] font-bold tracking-[0.2em] text-teal-600 uppercase">Seu espaço, seu estilo</p><DialogTitle className="font-sans text-2xl font-semibold">Seu jeito de estar aqui</DialogTitle><DialogDescription>Monte seu personagem. Você pode mudar tudo quando quiser.</DialogDescription></DialogHeader>
    <div className="grid gap-0 sm:grid-cols-[0.9fr_1.1fr]">
      <div className="relative m-4 flex min-h-64 flex-col overflow-hidden rounded-2xl bg-gradient-to-b from-[#d8eee5] to-[#eef2e9] sm:m-6 sm:mr-0">
        <span className="absolute top-4 left-4 z-10 rounded-full bg-white/65 px-3 py-1 text-[10px] font-semibold tracking-wide text-teal-800">PRÉVIA AO VIVO</span>
        <div className="h-64 flex-1 sm:min-h-80"><Preview appearance={appearance} /></div>
        <p className="pb-4 text-center text-xs text-teal-800/60">Arraste para ver todos os lados</p>
      </div>
      <div className="p-5 sm:p-6">
        <div className="mb-5 flex gap-1 rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Personalização">{tabs.map(({id,label,icon:Icon}) => <button key={id} id={`avatar-tab-${id}`} role="tab" aria-selected={tab === id} aria-controls="avatar-panel" onClick={() => setTab(id)} onKeyDown={event => {
          if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const index = tabs.findIndex(item => item.id === id);
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
          setTab(tabs[next].id);
          (event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next])?.focus();
        }} className={`flex flex-1 flex-col items-center gap-1 rounded-lg px-1 py-2 text-[10px] transition ${tab === id ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500'}`}><Icon size={17} />{label}</button>)}</div>
        <div id="avatar-panel" role="tabpanel" aria-labelledby={`avatar-tab-${tab}`} className="min-h-60">
          {tab === 'style' && <><h3 className="text-sm font-semibold">Um ponto de partida</h3><p className="mb-4 mt-1 text-xs text-slate-500">Escolha um look e dê seu toque pessoal.</p><div className="grid grid-cols-2 gap-3">{[
            {name:'Studio',color:'#398779',outfit:'hoodie',hair:'curls',extra:'headphones'},
            {name:'Creative',color:'#705bab',outfit:'jacket',hair:'bob',extra:'glasses'},
            {name:'Everyday',color:'#d67a61',outfit:'tee',hair:'ponytail',extra:'none'},
            {name:'Executive',color:'#303e53',outfit:'formal',hair:'short',extra:'none'},
          ].map(look => <button key={look.name} className="group rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-teal-500" onClick={() => onChange({...appearance,shirt:look.color,outfit:look.outfit as Appearance['outfit'],hairstyle:look.hair as Appearance['hairstyle'],accessory:look.extra as Appearance['accessory']})}><span className="mb-3 grid h-12 place-items-center rounded-lg" style={{background:look.color+'20'}}><Shirt color={look.color} size={26}/></span><span className="text-sm font-medium">{look.name}</span></button>)}</div></>}
          {tab === 'face' && <><h3 className="text-sm font-semibold">Cada pessoa, um tom</h3>{palette('skin',skins,'Tom de pele')}</>}
          {tab === 'hair' && <>{options('hairstyle', HAIRSTYLES)}{palette('hair',hairs,'Cor do cabelo')}</>}
          {tab === 'clothes' && <>{options('outfit', OUTFITS)}{palette('shirt',colors,'Roupa')}{palette('pants',colors,'Calça')}{palette('shoes',colors,'Tênis')}</>}
          {tab === 'extras' && <><h3 className="mb-4 text-sm font-semibold">Os detalhes fazem você</h3>{options('accessory', ACCESSORIES)}</>}
        </div>
        <div className="mt-5 flex items-center gap-3 border-t border-slate-200 pt-4"><button aria-label="Restaurar aparência padrão" title="Restaurar aparência padrão" className="rounded-xl border border-slate-200 p-3 text-slate-500" onClick={() => onChange(DEFAULT_APPEARANCE)}><RotateCcw size={17}/></button><button className="flex-1 rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-800" onClick={() => onOpenChange(false)}>Pronto, vamos entrar</button></div>
        <p className="mt-3 text-center text-[10px] text-slate-400">Seu visual fica salvo enquanto esta aba estiver aberta.</p>
      </div>
    </div>
  </DialogContent></Dialog>;
}
