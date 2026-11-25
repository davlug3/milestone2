import { clamp01 } from "../animation/easing";

/** Fixed 85mm full-frame lens, using a 36mm-wide 16:9 crop in the presentation. */
export const CAMERA_FOCAL_MM = 85;
export const CAMERA_SENSOR_W_MM = 36;
export const CAMERA_SENSOR_H_MM = 24;
export const BOOK_ASPECT = 16/9;
export function cameraVerticalFov(aspect: number): number {
  const gateHeight = CAMERA_SENSOR_W_MM / Math.max(aspect, 0.01);
  return 2 * Math.atan(gateHeight / (2 * CAMERA_FOCAL_MM)) * 180 / Math.PI;
}

/** Absolute timeline camera path, in metres. Smooth start and stop, no zoom. */
export function cinematicCameraPose(time: number, duration: number) {
  const t = clamp01(time / Math.max(duration, 0.001));
  const u = t * t * (3 - 2 * t);
  const lerp = (a: number, b: number) => a + (b - a) * u;
  const position: [number, number, number] = [
    lerp(0.035, 0.025), lerp(0.58, 0.54), lerp(0.88, 0.48),
  ];
  const target: [number, number, number] = [
    lerp(0.015, 0.005), lerp(0.065, 0.025), 0,
  ];
  // Dolly back along the viewing ray to preserve the projected subject size.
  const ratio = CAMERA_FOCAL_MM / 35;
  for(let i=0;i<3;i++)position[i]=target[i]+(position[i]-target[i])*ratio;
  return { position, target };
}
