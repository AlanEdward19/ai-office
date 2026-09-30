"use client";
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei/core/OrbitControls';
import { ContactShadows } from '@react-three/drei/core/ContactShadows';
import type { Appearance } from '@/domain/character';
import { Avatar } from './avatar';

export default function CharacterPreview({ appearance }: { appearance: Appearance }) {
  return <Canvas shadows dpr={[1, 1.5]} camera={{position: [2.4, 1.8, -4], fov: 32}} aria-label="Prévia 3D do personagem">
    <ambientLight intensity={1.3} /><directionalLight position={[-3, 5, -4]} intensity={2} castShadow /><directionalLight position={[3, 2, 3]} intensity={1} color="#9bdbd1" />
    <Avatar appearance={appearance} preview />
    <ContactShadows position={[0, 0.03, 0]} opacity={0.3} scale={6} blur={2} far={4} />
    <OrbitControls target={[0, 0.85, 0]} enablePan={false} enableZoom={false} minPolarAngle={0.7} maxPolarAngle={1.7} />
  </Canvas>;
}
