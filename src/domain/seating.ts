import type {Pose,Obstacle} from './walker';
import {FURNISHED_AREAS} from './office-map';
import {segmentClear} from './office-navigation';
export type Seat={x:number;z:number;yaw:number;occupied?:boolean;id?:string};
export type Sitting={seat:Seat;standing:Pose};
const cafe=FURNISHED_AREAS.find(a=>a.id==='ideas')!;
export const CAFE_SEAT:Seat={x:cafe.x,z:cafe.z+1.3,yaw:0};
export const CAFE_SEATS=Array.from({length:4},(_,index)=>{const yaw=index*Math.PI/2;return {x:cafe.x+Math.sin(yaw)*1.3,z:cafe.z+Math.cos(yaw)*1.3,yaw};});
export function coffeeApproach(index:number){const seat=CAFE_SEATS[index];return {x:seat.x+Math.sin(seat.yaw)*.7,z:seat.z+Math.cos(seat.yaw)*.7};}
export const CAFE_APPROACH={x:CAFE_SEAT.x,z:CAFE_SEAT.z+.8};
/** Chair geometry faces +Z; avatars face -Z. */
export function chairRotation(facing:number){return facing-Math.PI;}
export function sitAt(standing:Pose,seat:Seat,obstacles:readonly Obstacle[]):Sitting|null {
 if(seat.occupied||Math.hypot(standing.x-seat.x,standing.z-seat.z)>.7)return null;
 const solid=obstacles.filter(o=>!seat.id||o.seatId!==seat.id);
 if(!segmentClear(standing,seat,solid))return null;
 return {seat,standing:{...standing}};
}
export function seatedPose(sitting:Sitting):Pose{return {...sitting.standing,x:sitting.seat.x,z:sitting.seat.z,yaw:-sitting.seat.yaw,pitch:0,seated:true};}

import type {RoutineVisual} from './agent-routines';
import type {PlacedAgent} from './placement';
export function seatOccupied(seat:{x:number;z:number},occupied:readonly {x:number;z:number}[]){return occupied.some(person=>Math.hypot(person.x-seat.x,person.z-seat.z)<.55);}
export function occupiedHumanSeats(peers:readonly (Pose&{id:string;floor:string})[],self:string|undefined,user:Pose,floor:string){return [...peers.filter(peer=>peer.id!==self&&peer.floor==='ground'&&peer.seated),...(floor==='ground'&&user.seated?[user]:[])];}
export function agentSeatPose(actor:RoutineVisual,agent:PlacedAgent|undefined,occupied:readonly {x:number;z:number}[]=[]){
 const standing={x:actor.x,z:actor.z,yaw:actor.yaw,seated:false,seatBlocked:true,activity:undefined};
 const atDesk=agent&&Math.hypot(actor.x-agent.x,actor.z-agent.z+1.15)<.25;
 if(atDesk&&(actor.state==='working'||actor.state==='sleeping')){if(seatOccupied({x:agent.x,z:agent.z-.55},occupied))return standing;return {x:agent.x,z:agent.z-.55,yaw:Math.PI,seated:true,seatBlocked:false,activity:actor.state==='working'?'typing' as const:undefined};}
 if(actor.state==='coffee'&&actor.coffeeSeat!==undefined){const approach=coffeeApproach(actor.coffeeSeat);if(Math.hypot(actor.x-approach.x,actor.z-approach.z)<.25){if(seatOccupied(CAFE_SEATS[actor.coffeeSeat],occupied))return standing;return {...CAFE_SEATS[actor.coffeeSeat],seated:true,seatBlocked:false,activity:'coffee' as const};}}
 return {x:actor.x,z:actor.z,yaw:actor.yaw,seated:false,seatBlocked:false,activity:actor.state==='talking'?'talking' as const:undefined};
}
