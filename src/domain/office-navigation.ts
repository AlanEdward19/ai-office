import { PLAYER_RADIUS, type Obstacle, type WalkBounds } from './walker';
export type Point = {x:number;z:number};
export function pointClear(p:Point, obstacles:readonly Obstacle[], radius=PLAYER_RADIUS) {
 return !obstacles.some(o=>p.x>o.minX-radius&&p.x<o.maxX+radius&&p.z>o.minZ-radius&&p.z<o.maxZ+radius);
}
export function segmentClear(a:Point,b:Point,obstacles:readonly Obstacle[]) {
 // Exact segment/AABB slabs avoid a thin furniture corner falling between samples.
 for(const obstacle of obstacles){
  let low=0,high=1,miss=false;
  for(const axis of ['x','z'] as const){const min=(axis==='x'?obstacle.minX:obstacle.minZ)-PLAYER_RADIUS,max=(axis==='x'?obstacle.maxX:obstacle.maxZ)+PLAYER_RADIUS,delta=b[axis]-a[axis];
   if(Math.abs(delta)<1e-10){if(a[axis]<=min||a[axis]>=max){miss=true;break;}}
   else {const first=(min-a[axis])/delta,last=(max-a[axis])/delta;low=Math.max(low,Math.min(first,last));high=Math.min(high,Math.max(first,last));if(low>=high-1e-10){miss=true;break;}}
  }
  if(!miss&&low<high-1e-10)return false;
 }
 return true;
}
/** Bounded grid search followed by line-of-sight simplification against production collisions. */
export function officeRoute(start:Point,end:Point,bounds:WalkBounds,obstacles:readonly Obstacle[]):Point[]|null {
 if(!pointClear(start,obstacles)||!pointClear(end,obstacles))return null;
 if(segmentClear(start,end,obstacles))return [end];
 const step=.3, width=Math.ceil((bounds.maxX-bounds.minX)/step)+1, height=Math.ceil((bounds.maxZ-bounds.minZ)/step)+1;
 const point=(id:number)=>({x:bounds.minX+(id%width)*step,z:bounds.minZ+Math.floor(id/width)*step});
 const cell=(p:Point)=>Math.round((p.z-bounds.minZ)/step)*width+Math.round((p.x-bounds.minX)/step);
 const connect=(p:Point)=>{
  const center=cell(p),candidates:number[]=[];
  for(let row=-2;row<=2;row++)for(let col=-2;col<=2;col++){const id=center+row*width+col;if(id<0||id>=width*height)continue;const candidate=point(id);if(candidate.x>bounds.maxX||candidate.z>bounds.maxZ||Math.abs(candidate.x-p.x)>.7||Math.abs(candidate.z-p.z)>.7)continue;if(segmentClear(p,candidate,obstacles))candidates.push(id);}
  candidates.sort((a,b)=>Math.hypot(point(a).x-p.x,point(a).z-p.z)-Math.hypot(point(b).x-p.x,point(b).z-p.z));return candidates[0];
 };
 const first=connect(start),last=connect(end);if(first===undefined||last===undefined)return null;
 const previous=new Int32Array(width*height).fill(-1),queue=[first];previous[first]=first;
 for(let cursor=0;cursor<queue.length;cursor++) {
  const id=queue[cursor];if(id===last)break;
  for(const delta of [-width,width,-1,1]) {const next=id+delta;
   if(next<0||next>=previous.length||previous[next]>=0||(Math.abs(delta)===1&&Math.floor(next/width)!==Math.floor(id/width)))continue;
   const p=point(next);if(p.x>bounds.maxX||p.z>bounds.maxZ||!segmentClear(point(id),p,obstacles))continue;
   previous[next]=id;queue.push(next);
  }
 }
 if(previous[last]<0)return null;
 const raw:Point[]=[end];for(let at=last;at!==first;at=previous[at])raw.push(point(at));raw.push(point(first));raw.push(start);raw.reverse();
 const result:Point[]=[];let at=0;
 while(at<raw.length-1) {let next=raw.length-1;while(next>at+1&&!segmentClear(raw[at],raw[next],obstacles))next--;result.push(raw[next]);at=next;}
 return result;
}
export function nearestClear(target:Point,bounds:WalkBounds,obstacles:readonly Obstacle[],maxDistance=1.5):Point|null {
 for(let radius=0;radius<=maxDistance;radius+=.15)for(let angle=0;angle<Math.PI*2;angle+=Math.PI/8){const p={x:target.x+Math.cos(angle)*radius,z:target.z+Math.sin(angle)*radius};if(p.x>=bounds.minX&&p.x<=bounds.maxX&&p.z>=bounds.minZ&&p.z<=bounds.maxZ&&pointClear(p,obstacles))return p;}return null;
}
