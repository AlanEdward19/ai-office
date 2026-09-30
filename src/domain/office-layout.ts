import { roomSlot, type PlacedRoom } from "./rooms";

const ZONE_NAMES = ["Biblioteca", "Foco", "Ideias", "Pausa", "Estúdio", "Pesquisa", "Planejamento", "Convivência"];

/** Furnished common areas occupy available project slots, without creating fake projects. */
export function commonAreas(rooms: readonly PlacedRoom[]) {
  return ZONE_NAMES.flatMap((name, index) => {
    const point = roomSlot(index);
    return rooms.some(room => Math.abs(room.x - point.x) < 2 && Math.abs(room.z - point.z) < 2) ? [] : [{ name, ...point, style: index % 3 }];
  });
}

/** The elevator door faces west, toward its interaction and arrival point. */
export const ELEVATOR_DOOR_ROTATION = -Math.PI / 2;
