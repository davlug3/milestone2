/**
 * Easing functions for animation targets. Pure, deterministic.
 */

export function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Smoothstep: ease in/out over [0,1]. */
export function smoothstep(t: number): number {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}

/** Smootherstep: gentler ease in/out. */
export function smootherstep(t: number): number {
  const x = clamp01(t);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

/** Ease-in quadratic. */
export function easeInQuad(t: number): number {
  const x = clamp01(t);
  return x * x;
}

/** Ease-out quadratic. */
export function easeOutQuad(t: number): number {
  const x = clamp01(t);
  return 1 - (1 - x) * (1 - x);
}

/** Map a value from one range to another (unclamped). */
export function remap(
  v: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number {
  const t = (v - inMin) / (inMax - inMin);
  return outMin + (outMax - outMin) * t;
}