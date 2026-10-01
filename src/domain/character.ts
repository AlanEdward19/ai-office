export const HAIRSTYLES = ['short', 'bob', 'curls', 'ponytail', 'mohawk', 'none'] as const;
export const OUTFITS = ['tee', 'hoodie', 'jacket', 'formal'] as const;
export const ACCESSORIES = ['none', 'glasses', 'headphones', 'cap'] as const;
export type Appearance = {
  shirt: string; skin: string; hair: string; pants: string; shoes: string;
  hairstyle: typeof HAIRSTYLES[number]; outfit: typeof OUTFITS[number]; accessory: typeof ACCESSORIES[number];
};
export const DEFAULT_APPEARANCE: Appearance = { shirt: '#398779', skin: '#dba882', hair: '#30231e', pants: '#33465f', shoes: '#f0e9de', hairstyle: 'short', outfit: 'hoodie', accessory: 'none' };
export type Gesture = 'wave' | 'dance';
export type AvatarMotion = { seated?:boolean; activity?:"typing"|"coffee"|"talking"; moving: boolean; gesture: Gesture | null; gestureStarted: number };
export function activeGesture(gesture: Gesture | null, elapsed: number): Gesture | null {
  return elapsed >= 0 && elapsed < 3 ? gesture : null;
}
export function blendMotion(current: number, moving: boolean, dt: number) {
  return current + ((moving ? 1 : 0) - current) * (1 - Math.exp(-10 * Math.max(0, dt)));
}
export function gait(time: number, moving: boolean) {
  const swing = moving ? Math.sin(time * 10) * 0.55 : 0;
  return { left: swing, right: -swing, bob: moving ? Math.abs(Math.sin(time * 10)) * 0.035 : Math.sin(time * 2) * 0.008 };
}

type ReducedJoint={rotation:{x:number;y:number;z:number}};
export function resetReducedAvatar(root:(ReducedJoint&{position:{y:number}})|null,head:ReducedJoint|null,arms:readonly (ReducedJoint|null)[],legs:readonly (ReducedJoint|null)[]){
 if(root){root.position.y=0;root.rotation.x=0;root.rotation.y=0;root.rotation.z=0;}if(head)head.rotation.z=0;
 arms.forEach((arm,i)=>{if(arm){arm.rotation.x=0;arm.rotation.z=(i===0?1:-1)*.08;}});legs.forEach(leg=>{if(leg)leg.rotation.x=0;});
}

export function applyAvatarActivity(root:(ReducedJoint&{position:{y:number}})|null,arms:readonly (ReducedJoint|null)[],legs:readonly (ReducedJoint|null)[],motion:AvatarMotion|undefined,time:number,reduced:boolean){
 if(!motion?.seated&&!motion?.activity)return;
 if(root&&motion.seated)root.position.y=-.36;
 if(motion.seated)legs.forEach(leg=>{if(leg)leg.rotation.x=1.35;});
 arms.forEach((arm,i)=>{if(!arm)return;const oscillation=reduced?0:Math.sin(time*(motion.activity==='typing'?11:3)+i)*.08;
  if(motion.activity==='typing'){arm.rotation.x=.95+oscillation;arm.rotation.z=(i===0?1:-1)*.12;}
  if(motion.activity==='coffee'&&i===1){arm.rotation.x=2+oscillation;arm.rotation.z=-.25;}
  if(motion.activity==='talking'){arm.rotation.x=.4+oscillation;arm.rotation.z=(i===0?1:-1)*(.25+oscillation);}
 });
}
