"use client";

import { RoundedBox } from '@react-three/drei/core/RoundedBox';
import { useFrame } from '@react-three/fiber';
import { useRef, type RefObject } from 'react';
import type { Group } from 'three';
import { activeGesture, blendMotion, resetReducedAvatar, applyAvatarActivity, type Appearance, type AvatarMotion } from '@/domain/character';

function SoftPart({ position, scale, color }: { position: [number, number, number]; scale: [number, number, number]; color: string }) {
  return <mesh position={position} scale={scale} castShadow><sphereGeometry args={[1, 20, 16]} /><meshStandardMaterial color={color} roughness={0.75} /></mesh>;
}

export function Avatar({ appearance: a, motion, preview = false, reducedMotion = false }: { appearance: Appearance; motion?: RefObject<AvatarMotion>; preview?: boolean; reducedMotion?:boolean }) {
  const root = useRef<Group>(null);
  const head = useRef<Group>(null);
  const arms = useRef<(Group | null)[]>([]);
  const legs = useRef<(Group | null)[]>([]);
  const blend = useRef(0);
  const cup=useRef<Group>(null);
  useFrame(({ clock }, dt) => {
    if(cup.current)cup.current.visible=motion?.current.activity==="coffee";
    if(reducedMotion){resetReducedAvatar(root.current,head.current,arms.current,legs.current);applyAvatarActivity(root.current,arms.current,legs.current,motion?.current,clock.elapsedTime,true);return;}
    const t = clock.elapsedTime;
    blend.current = blendMotion(blend.current, motion?.current.moving ?? false, dt);
    const gesture = motion ? activeGesture(motion.current.gesture, t - motion.current.gestureStarted) : null;
    const swing = Math.sin(t * 9) * 0.6 * blend.current;
    if (root.current) {
      root.current.position.y = Math.sin(t * 2) * 0.012 + Math.abs(Math.sin(t * 9)) * 0.04 * blend.current;
      root.current.rotation.z = gesture === 'dance' ? Math.sin(t * 7) * 0.12 : 0;
      root.current.rotation.y = preview ? Math.sin(t * 0.4) * 0.12 : gesture === 'dance' ? Math.sin(t * 4) * 0.25 : 0;
    }
    if (head.current) head.current.rotation.z = gesture === 'wave' ? -0.08 : Math.sin(t * 1.1) * 0.025;
    arms.current.forEach((arm, i) => {
      if (!arm) return;
      arm.rotation.x = swing * (i === 0 ? -0.65 : 0.65);
      arm.rotation.z = (i === 0 ? 1 : -1) * 0.08;
      if (gesture === 'wave' && i === 1) { arm.rotation.z = -2.4 + Math.sin(t * 12) * 0.25; arm.rotation.x = -0.3; }
      if (gesture === 'dance') arm.rotation.z = (i === 0 ? 1 : -1) * (0.9 + Math.sin(t * 7) * 0.3);
    });
    legs.current.forEach((leg, i) => { if (leg) leg.rotation.x = swing * (i === 0 ? 1 : -1); });
    applyAvatarActivity(root.current,arms.current,legs.current,motion?.current,t,false);
  });
  const coat = a.outfit === 'jacket' || a.outfit === 'formal';
  return <group ref={root} name="avatar">
    <SoftPart position={[0, 0.72, 0]} scale={[0.23, 0.16, 0.15]} color={a.pants} />
    <SoftPart position={[0, 1.02, 0]} scale={[0.28, 0.36, 0.18]} color={a.shirt} />
    {a.outfit === 'hoodie' && <>
      <SoftPart position={[0, 1.23, 0.09]} scale={[0.23, 0.16, 0.15]} color={a.shirt} />
      <RoundedBox args={[0.28, 0.12, 0.025]} radius={0.025} position={[0, 0.88, -0.175]}><meshStandardMaterial color={a.shirt} roughness={1} /></RoundedBox>
      {[-0.055, 0.055].map(x => <mesh key={x} position={[x, 1.12, -0.17]}><capsuleGeometry args={[0.008, 0.15, 3, 6]} /><meshStandardMaterial color="#e9e6db" /></mesh>)}
    </>}
    {coat && <>
      <SoftPart position={[0, 1.08, -0.17]} scale={[0.11, 0.23, 0.012]} color="#f5f0e7" />
      <mesh position={[0, 1.05, -0.19]}><boxGeometry args={[0.025, 0.25, 0.015]} /><meshStandardMaterial color={a.outfit === 'formal' ? '#db8067' : a.shirt} /></mesh>
    </>}
    <group ref={head} position={[0, 1.48, 0]}>
      <SoftPart position={[0, 0, 0]} scale={[0.235, 0.25, 0.21]} color={a.skin} />
      {[-1, 1].map(side => <SoftPart key={side} position={[side * 0.225, -0.01, 0]} scale={[0.045, 0.07, 0.055]} color={a.skin} />)}
      <SoftPart position={[0, -0.015, -0.215]} scale={[0.033, 0.035, 0.035]} color={a.skin} />
      {[-0.078, 0.078].map(x => <group key={x}>
        <SoftPart position={[x, 0.04, -0.197]} scale={[0.033, 0.04, 0.016]} color="#fffaf2" />
        <SoftPart position={[x, 0.035, -0.212]} scale={[0.016, 0.025, 0.008]} color="#26313c" />
        <SoftPart position={[x, 0.11, -0.185]} scale={[0.045, 0.012, 0.012]} color={a.hair} />
        <SoftPart position={[x * 1.45, -0.055, -0.183]} scale={[0.04, 0.018, 0.008]} color="#d38d7d" />
      </group>)}
      <mesh position={[0, -0.08, -0.202]} rotation={[0, 0, Math.PI]}><torusGeometry args={[0.045, 0.007, 6, 16, Math.PI]} /><meshStandardMaterial color="#754b41" /></mesh>
      {a.hairstyle !== 'none' && <>
        <SoftPart position={[0, 0.16, 0.035]} scale={[0.242, 0.135, 0.21]} color={a.hair} />
        {(a.hairstyle === 'short' || a.hairstyle === 'bob') && [-1, 1].map(side => <SoftPart key={side} position={[side * 0.18, a.hairstyle === 'bob' ? -0.01 : 0.1, 0.07]} scale={[0.09, a.hairstyle === 'bob' ? 0.24 : 0.1, 0.18]} color={a.hair} />)}
        {a.hairstyle === 'curls' && Array.from({length: 9}, (_, i) => <SoftPart key={i} position={[Math.sin(i * 2.4) * 0.19, 0.18 + (i % 3) * 0.03, Math.cos(i * 2.4) * 0.16]} scale={[0.095, 0.095, 0.09]} color={a.hair} />)}
        {a.hairstyle === 'ponytail' && <SoftPart position={[0, 0.04, 0.3]} scale={[0.1, 0.24, 0.1]} color={a.hair} />}
        {a.hairstyle === 'mohawk' && <SoftPart position={[0, 0.27, 0]} scale={[0.075, 0.15, 0.23]} color={a.hair} />}
      </>}
      {a.accessory === 'glasses' && [-0.082, 0.082].map(x => <mesh key={x} position={[x, 0.04, -0.222]}><torusGeometry args={[0.056, 0.009, 6, 20]} /><meshStandardMaterial color="#283345" /></mesh>)}
      {a.accessory === 'glasses' && <mesh position={[0, 0.04, -0.225]}><boxGeometry args={[0.06, 0.012, 0.015]} /><meshStandardMaterial color="#283345" /></mesh>}
      {a.accessory === 'headphones' && <>
        <mesh position={[0, 0.03, 0.01]}><torusGeometry args={[0.26, 0.025, 8, 24, Math.PI]} /><meshStandardMaterial color="#263845" /></mesh>
        {[-1,1].map(side => <SoftPart key={side} position={[side * 0.26, 0, 0]} scale={[0.05, 0.09, 0.07]} color="#e6a764" />)}
      </>}
      {a.accessory === 'cap' && <>
        <SoftPart position={[0, 0.18, 0]} scale={[0.25, 0.12, 0.23]} color={a.shirt} />
        <SoftPart position={[0, 0.13, -0.21]} scale={[0.22, 0.025, 0.15]} color={a.shirt} />
      </>}
    </group>
    {[-1, 1].map((side, i) => <group key={side}>
      <group ref={node => { arms.current[i] = node; }} position={[side * 0.3, 1.2, 0]}>
        {i===1&&<group ref={cup} name="held-coffee" visible={false} position={[0,-.48,0]}><mesh><cylinderGeometry args={[.06,.05,.14,16]} /><meshStandardMaterial color="#fff4db" /></mesh></group>}
        <SoftPart position={[0, -0.16, 0]} scale={[0.09, a.outfit === 'tee' ? 0.14 : 0.23, 0.095]} color={a.shirt} />
        <SoftPart position={[0, -0.34, 0]} scale={[0.075, 0.1, 0.08]} color={a.skin} />
      </group>
      <group ref={node => { legs.current[i] = node; }} position={[side * 0.12, 0.72, 0]}>
        <SoftPart position={[0, -0.25, 0]} scale={[0.105, 0.28, 0.115]} color={a.pants} />
        <RoundedBox args={[0.21, 0.14, 0.32]} radius={0.05} smoothness={3} position={[0, -0.57, -0.055]} castShadow><meshStandardMaterial color={a.shoes} roughness={0.7} /></RoundedBox>
      </group>
    </group>)}
  </group>;
}
