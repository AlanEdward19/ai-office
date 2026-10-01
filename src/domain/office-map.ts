/** Stable physical identities. Coordinates are shared by geometry, meetings and navigation. */
export const PROJECT_CAPACITY = 8;
export const DESK_CAPACITY = 9;
export const LOCAL_CAPACITY = 9;
export const LOCAL_POSTS = { x:11, z:2.7, columnGap:2.9, rowGap:2.75 };
export const LOCAL_AREA = {id:"local",name:"Ala local",floor:"ground",x:12.45,z:-2.8,width:5.8,depth:13.8} as const;
export const PROJECT_ROOM = { width: 4.05, depth: 4.4, gap: 1.55, door: 1.8 };
export const OFFICE_ENTRY = { x: -3.3, z: 6.3, width: 2 };
export const OFFICE_BOUNDS = { minX: -9.3, maxX: 15.9, minZ: -24.1, maxZ: 6.3 };
export function projectSlot(index: number) {
  if (!Number.isInteger(index) || index < 0 || index >= PROJECT_CAPACITY) throw new Error('Capacidade de salas atingida (8).');
  return { x: -6 + (index % 3) * 5.6, z: -8.8 - Math.floor(index / 3) * 6 };
}
export const FURNISHED_AREAS = [
 {id:'reception',name:'Recepção',floor:'ground',x:-5.4,z:4.15,width:3.5,depth:3.2},
 {id:'ideas',name:'Café & ideias',floor:'ground',x:-6.4,z:-2.4,width:3.8,depth:3.8},
 {id:'cafe',name:'Café da equipe',floor:'ground',x:12,z:-14.5,width:5,depth:4},
 {id:'research',name:'Laboratório',floor:'ground',x:12,z:-20.5,width:5,depth:4},
 {id:'ceo',name:'Sala do CEO',floor:'ground',x:6.15,z:-3.55,width:4.4,depth:3.6},
 {id:'lounge',name:'Convivência',floor:'ground',x:1.8,z:4.4,width:2.2,depth:2},
 LOCAL_AREA,
 {id:'hr:waiting',name:'Recepção RH',floor:'hr',x:-5.5,z:2.8,width:3.8,depth:3.8},
 {id:'hr:study',name:'Estudo',floor:'hr',x:-5.5,z:-3.4,width:3.8,depth:3.6},
 {id:'hr:training',name:'Treinamento',floor:'hr',x:4.6,z:-3.3,width:3.8,depth:3.8},
 {id:'hr:interview',name:'Entrevistas',floor:'hr',x:4.6,z:.4,width:3.8,depth:2},
 {id:'hr:recruitment',name:'Contratação',floor:'hr',x:-1.4,z:-.2,width:3.8,depth:3.4},
] as const;
