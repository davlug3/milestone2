import type { Particle } from "../physics/Particle";
import { clamp01, smootherstep } from "./easing";

/**
 * Guides a sheet through a page turn by driving its FORE-EDGE, not a single
 * corner.
 *
 * Why the fore-edge: pinning one corner (the previous approach) forces the
 * sheet into a cone with the pinned corner as apex, which produces sharp
 * triangular folds, self-intersection, and a vertical yank near the binding.
 * Real paper bends into a smooth developable (curl) surface. Driving the whole
 * free edge along a smooth arc while the spine edge stays bound lets the PBD
 * solver + bending constraints + gravity form that curl.
 *
 * The fore-edge follows a circular arc of radius = page width about the gutter
 * (spine) axis:
 *   dx = width * cos(phi)        (from +width at fore-edge to -width, i.e. over)
 *   dy = width * sin(phi)        (rises to `width` at the top, returns to rest)
 * with phi sweeping 0 -> PI over the turn. Using radius = width (not a smaller
 * lift) keeps the sheet at its natural length throughout, so it never has to
 * buckle to absorb excess material — that buckling was the source of the sharp
 * gutter crease. The sheet instead sweeps a clean semicircle and gravity +
 * bending form the gentle curl. (A `liftScale` < 1 can flatten the arc slightly
 * for a lower-profile turn, but values near 1 give the smoothest result.)
 *
 * After the turn the controller holds the fore-edge at its final rest position
 * (lying on the destination side) so the page settles there. `release()` is
 * available to hand the sheet fully to gravity if desired.
 *
 * The sheet is assumed to lie in the XZ plane, gutter at local x = gutterX,
 * fore-edge at local x = gutterX + width. Deterministic: targets depend only
 * on normalized progress p.
 */
export interface PageTurnConfig {
  /** Particle indices forming the driven fore-edge (one per row at c = cols-1). */
  foreEdgeIndices: number[];
  /** Local x of the gutter / spine axis. */
  gutterX: number;
  /** Rest height (y) of the sheet plane. */
  restY: number;
  /** Page width: gutter to fore-edge distance (m). Also the arc radius. */
  width: number;
  /** Turn duration (seconds) over which phi sweeps 0 -> PI. */
  duration: number;
  /**
   * Vertical semi-axis of the fore-edge arc as a fraction of width.
   * 1.0 = true semicircle (smoothest, no buckling). <1 flattens the arc.
   */
  liftScale?: number;
}

export class PageTurnController {
  private readonly cfg: PageTurnConfig;
  /** Per-fore-edge-particle target (x,y,z), same order as foreEdgeIndices. */
  private readonly targets: { x: number; y: number; z: number }[];
  /** Whether the fore-edge is currently being driven. */
  public guiding = true;
  /** Whether the fore-edge has been released (free to settle). */
  public released = false;

  constructor(cfg: PageTurnConfig) {
    this.cfg = cfg;
    this.targets = cfg.foreEdgeIndices.map(() => ({ x: 0, y: 0, z: 0 }));
    this.setProgress(0);
  }

  /** Phase name at progress p, for debugging/telemetry. */
  phaseAt(p: number): string {
    if (p <= 0) return "preparation";
    if (p < 0.15) return "corner-lift";
    if (p < 0.4) return "peel";
    if (p < 0.6) return "arch";
    if (p < 0.75) return "crossing";
    if (p < 0.92) return "fall";
    if (p < 1) return "contact";
    return "settled";
  }

  /**
   * Compute fore-edge targets at normalized progress p (0..1). Updates the
   * internal target list. Call `apply()` afterward to drive the particles.
   */
  setProgress(p: number): void {
    const c = this.cfg;
    const t = clamp01(p);
    // Ease the sweep so the peel starts gently and lands softly.
    const e = smootherstep(t);
    const phi = Math.PI * e;
    const cos = Math.cos(phi);
    const sin = Math.sin(phi);

    // Circular arc of radius = width (liftScale ~1) so the sheet spans its
    // natural length and never buckles into a gutter crease.
    const radius = c.width;
    const liftScale = c.liftScale ?? 1.0;
    const dx = radius * cos;
    const dy = radius * liftScale * sin;
    const tx = c.gutterX + dx;
    const ty = c.restY + dy;

    for (let i = 0; i < this.targets.length; i++) {
      const tgt = this.targets[i];
      tgt.x = tx;
      tgt.y = ty;
      // z stays at each fore-edge particle's rest z (caller seeded targets.z).
    }
  }

  /** Seed each target's z from the current particle rest z (call once at init). */
  seedZ(particles: Particle[]): void {
    for (let i = 0; i < this.cfg.foreEdgeIndices.length; i++) {
      const p = particles[this.cfg.foreEdgeIndices[i]];
      this.targets[i].z = p.z;
    }
  }

  /**
   * Drive the fore-edge particles to their current targets by pinning them.
   * No-op once released. Call before each solver step.
   */
  apply(particles: Particle[]): void {
    if (this.released) return;
    const idx = this.cfg.foreEdgeIndices;
    for (let i = 0; i < idx.length; i++) {
      const p = particles[idx[i]];
      const t = this.targets[i];
      p.x = p.px = t.x;
      p.y = p.py = t.y;
      p.z = p.pz = t.z;
      p.vx = p.vy = p.vz = 0;
      p.invMass = 0;
      p.pinned = true;
    }
    this.guiding = true;
  }

  /** Release the fore-edge so the sheet falls and settles under gravity. */
  release(particles: Particle[]): void {
    if (this.released) return;
    for (const i of this.cfg.foreEdgeIndices) {
      const p = particles[i];
      p.invMass = 1;
      p.pinned = false;
    }
    this.guiding = false;
    this.released = true;
  }
}