import type { Particle } from "../physics/Particle";
import { clamp01, smootherstep } from "./easing";

/**
 * Guides one corner of a sheet through a page-turn sequence.
 *
 * It does NOT rotate the page rigidly. Instead it pins one free corner and
 * moves that pin along a smooth 3D path (lift, across the gutter, down onto the
 * destination stack). The solver + constraints compute the rest of the shape;
 * gravity and the ground produce the fall and settle.
 *
 * The sheet is assumed to lie in the XZ plane with the spine at -X (left).
 * The guided corner starts at the fore-edge (+X) and ends mirrored on the
 * destination side (-X), lifted over the gutter.
 *
 * Phases are driven by a normalized progress p in [0,1] over `duration`.
 */
export interface PageTurnConfig {
  /** Corner particle index to guide (usually a fore-edge corner). */
  cornerIndex: number;
  /** Rest position of the corner (x,y,z). */
  cornerRest: { x: number; y: number; z: number };
  /** Which fore-edge corner along Z: -1 or +1 (head/tail). */
  corner: { x: number; z: number };
  /** Peak lift height above the rest plane (m). */
  liftHeight: number;
  /** How far across to travel in X (usually the sheet width). */
  travelX: number;
  /** Duration of the full turn (seconds). */
  duration: number;
  /** Extra flutter amplitude (m), small. */
  flutter?: number;
}

export class PageTurnController {
  private readonly cfg: PageTurnConfig;
  /** Current target position for the guided corner. */
  public readonly target = { x: 0, y: 0, z: 0 };
  /** Whether the corner pin is currently engaged. */
  public engaged = false;

  constructor(cfg: PageTurnConfig) {
    this.cfg = cfg;
  }

  /** Phase name at progress p, for debugging/telemetry. */
  phaseAt(p: number): string {
    if (p <= 0) return "preparation";
    if (p < 0.15) return "corner-lift";
    if (p < 0.4) return "peel";
    if (p < 0.6) return "arch";
    if (p < 0.72) return "crossing";
    if (p < 0.9) return "fall";
    if (p < 1) return "contact";
    return "settled";
  }

  /**
   * Compute the target for the guided corner at normalized progress p.
   * Returns the target and updates `this.target`.
   */
  update(p: number): { x: number; y: number; z: number } {
    const c = this.cfg;
    const t = clamp01(p);

    const x0 = c.cornerRest.x;
    let z0 = c.cornerRest.z;
    const dir = Math.sign(c.travelX) || 1;

    // Horizontal travel eases across the whole turn (smooth, monotonic).
    const travel = smootherstep(clamp01((t - 0.1) / 0.7));
    const x = x0 + c.travelX * travel;

    // Lift profile: rises to peak mid-turn, returns to ground at the end.
    // sin-shaped bump peaking around t=0.5.
    const liftCurve = Math.sin(Math.PI * clamp01((t - 0.05) / 0.9));
    let y = Math.max(0, liftCurve) * c.liftHeight;

    // Add a little settle bounce near the end (decaying).
    if (t > 0.85) {
      const s = (t - 0.85) / 0.15;
      y += Math.sin(s * Math.PI * 2) * (1 - s) * c.liftHeight * 0.04;
    }

    // Subtle flutter across the width while airborne (deterministic).
    if (c.flutter && t > 0.1 && t < 0.9) {
      const env = Math.sin(Math.PI * clamp01((t - 0.1) / 0.8));
      z0 += Math.sin(t * Math.PI * 6) * c.flutter * env * dir;
    }

    this.target.x = x;
    this.target.y = y;
    this.target.z = z0;
    return this.target;
  }

  /**
   * Apply the target to the corner particle by pinning it at the target.
   * The caller should have pinned the corner initially; this keeps its
   * position locked to the animated target each step.
   */
  apply(particle: Particle): void {
    particle.x = particle.px = this.target.x;
    particle.y = particle.py = this.target.y;
    particle.z = particle.pz = this.target.z;
    particle.vx = particle.vy = particle.vz = 0;
    // Keep it pinned (invMass 0) so constraints don't move it.
    particle.invMass = 0;
    particle.pinned = true;
    this.engaged = true;
  }
}