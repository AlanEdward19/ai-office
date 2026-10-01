import { FURNISHED_AREAS, PROJECT_ROOM } from "./office-map";
import { commonAreas } from './office-layout';
import { type PlacedRoom } from './rooms';
import { type FloorId } from './floors';
import { type Obstacle } from './walker';
export type MeetingArea = Obstacle & { id: string; name: string; floor: FloorId };
function area(id: string, name: string, floor: FloorId, x: number, z: number, width: number, depth: number): MeetingArea {
  return { id, name, floor, minX: x-width/2, maxX: x+width/2, minZ: z-depth/2, maxZ: z+depth/2 };
}
export function meetingAreas(rooms: readonly PlacedRoom[]): MeetingArea[] {
  return [
    ...rooms.map(r=>area(`project:${r.id}`,r.name,'ground',r.x,r.z,PROJECT_ROOM.width,PROJECT_ROOM.depth)),
    ...commonAreas(rooms).map(r=>area(`common:${r.name}`,r.name,'ground',r.x,r.z,PROJECT_ROOM.width,PROJECT_ROOM.depth)),
    ...FURNISHED_AREAS.map(a=>area(a.id,a.name,a.floor,a.x,a.z,a.width,a.depth)),
  ];
}
export function areaAt(areas: readonly MeetingArea[], floor: FloorId, x: number, z: number): MeetingArea | null {
  return areas.find(a=>a.floor===floor && x>a.minX && x<a.maxX && z>a.minZ && z<a.maxZ)??null;
}
