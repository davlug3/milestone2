import { clamp01 } from "../animation/easing";

/** Fixed 100mm full-frame lens, using a 36mm-wide 16:9 crop in the presentation. */
export const CAMERA_FOCAL_MM = 100;
export const CAMERA_SENSOR_W_MM = 36;
export const CAMERA_SENSOR_H_MM = 24;
export const BOOK_ASPECT = 16/9;
export const CAMERA_ORBIT_DEG = 20;
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
  // Preserve the original 85mm camera path independently of the lens.
  // Changing focal length now changes framing without moving the camera.
  const ratio = 85 / 35;
  for(let i=0;i<3;i++)position[i]=target[i]+(position[i]-target[i])*ratio;
  // Elevate the viewing ray by five degrees around the existing subject target.
  // Preserve camera distance, focal length, dolly timing and subject centering.
  const elevation = 5 * Math.PI / 180;
  const dx = position[0] - target[0], dy = position[1] - target[1], dz = position[2] - target[2];
  const horizontal = Math.hypot(dx, dz);
  const distance = Math.hypot(horizontal, dy);
  const pitch = Math.atan2(dy, horizontal) + elevation;
  const scale = distance * Math.cos(pitch) / horizontal;
  // Orbit the optical centre about the book, not a lens roll or a stationary pan.
  // A centred 20-degree arc adds lateral parallax without changing dolly radius.
  const orbit = (u - 0.5) * CAMERA_ORBIT_DEG * Math.PI / 180;
  position[0] = target[0] + (dx * Math.cos(orbit) + dz * Math.sin(orbit)) * scale;
  position[1] = target[1] + distance * Math.sin(pitch);
  position[2] = target[2] + (dz * Math.cos(orbit) - dx * Math.sin(orbit)) * scale;
  return { position, target };
}
