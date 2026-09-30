import type { Pose } from './walker';
export type CameraMode = 'first' | 'third' | 'isometric';
export function cameraView(mode: CameraMode, pose: Pose, zoom: number) {
  const { x, z, yaw, pitch } = pose;
  if (mode === 'isometric') return { position: [x + 7 * zoom, 9.5 * zoom, z + 7 * zoom], focus: [x, 0.65, z] };
  if (mode === 'first') return {
    position: [x, 1.52, z],
    focus: [x + Math.sin(yaw) * 4, 1.52 - pitch * 4, z - Math.cos(yaw) * 4],
  };
  const distance = 3.8 * zoom;
  return {
    position: [x - Math.sin(yaw) * distance, 2.7 + pitch * 0.2, z + Math.cos(yaw) * distance],
    focus: [x + Math.sin(yaw) * 2, 1.1 - pitch, z - Math.cos(yaw) * 2],
  };
}
