import type { Particle } from "./Particle";
import { clamp01, smootherstep } from "../animation/easing";

/** Ease the rendered sheet from its curved resting pose into the XPBD solution.
 * The solver and collision geometry are untouched; fixed material roots coincide
 * in both poses. The blend has zero slope at both ends. */
export const TURN_HANDOFF_SECONDS = 0.32;
export function turnHandoffWeight(elapsed: number): number {
  return smootherstep(clamp01(elapsed / TURN_HANDOFF_SECONDS));
}

export class TurnHandoff {
  private rest: Particle[] = [];
  private display: Particle[] = [];

  capture(particles: readonly Particle[]): void {
    this.rest = particles.map(p => ({...p}));
    this.display = particles.map(p => ({...p}));
  }

  pose(particles: Particle[], elapsed: number): Particle[] {
    const k = turnHandoffWeight(elapsed);
    if (k === 1 || this.rest.length !== particles.length) return particles;
    for (let i = 0; i < particles.length; i++) {
      const a = this.rest[i], b = particles[i], out = this.display[i];
      out.x = a.x + (b.x - a.x) * k;
      out.y = a.y + (b.y - a.y) * k;
      out.z = a.z + (b.z - a.z) * k;
    }
    return this.display;
  }
}
