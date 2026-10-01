import { Box3, Mesh, Vector3, type Object3D } from 'three';
import type { Obstacle } from './walker';
/** One extraction path for the running scene and real-geometry regressions. */
export function sceneObstacles(root: Object3D): Obstacle[] {
 const obstacles:Obstacle[]=[];
 root.updateWorldMatrix(true,true);
 root.traverse(object=>{
  if(!(object instanceof Mesh)||object.userData.noCollision)return;
  for(let ancestor=object.parent;ancestor;ancestor=ancestor.parent)if(ancestor.userData.noCollision)return;
  const box=new Box3().setFromObject(object);
  if(box.max.y<=.12||box.min.y>=1.7)return;
  let seatId:string|undefined;for(let ancestor: Object3D|null=object;ancestor;ancestor=ancestor.parent)if(ancestor.userData.seat){const position=ancestor.getWorldPosition(new Vector3());seatId=`${position.x.toFixed(3)}:${position.z.toFixed(3)}`;break;}
  obstacles.push({seatId,minX:box.min.x,maxX:box.max.x,minZ:box.min.z,maxZ:box.max.z});
 });
 return obstacles;
}
