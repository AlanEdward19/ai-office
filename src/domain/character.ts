export const HAIRSTYLES = ['short', 'bob', 'curls', 'ponytail', 'mohawk', 'none'] as const;
export const OUTFITS = ['tee', 'hoodie', 'jacket', 'formal'] as const;
export const ACCESSORIES = ['none', 'glasses', 'headphones', 'cap'] as const;
export type Appearance = {
  shirt: string; skin: string; hair: string; pants: string; shoes: string;
  hairstyle: typeof HAIRSTYLES[number]; outfit: typeof OUTFITS[number]; accessory: typeof ACCESSORIES[number];
};
export const DEFAULT_APPEARANCE: Appearance = { shirt: '#398779', skin: '#dba882', hair: '#30231e', pants: '#33465f', shoes: '#f0e9de', hairstyle: 'short', outfit: 'hoodie', accessory: 'none' };
export type Gesture = 'wave' | 'dance';
export type AvatarMotion = { moving: boolean; gesture: Gesture | null; gestureStarted: number };
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
