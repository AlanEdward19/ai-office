import type {MeetingArea} from './meeting-areas';
/** Canonical world-space rectangle. Null disables the pass in circulation areas. */
export function areaFocusBounds(area:MeetingArea|null):[number,number,number,number]|null {
 return area?[area.minX,area.maxX,area.minZ,area.maxZ]:null;
}
