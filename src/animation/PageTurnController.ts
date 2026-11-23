import type { Particle } from "../physics/Particle";
import { clamp01, smootherstep } from "./easing";

/**
 * Guides a sheet through a page turn by driving its FORE-EDGE, not a single
 * corner.
 *
 * The fore-edge follows an arc about the gutter (spine axis). Unlike a perfect
 * cylinder, each row gets a small phase lead (`lead`) so the head and tail of
 * the page lead/trail differently — this twists the sheet and produces a 2D
 * curl (bending in both the width and height directions) instead of a
 * uniform roll about a single axis.
 *
 * Geometry (sheet in the XZ plane, gutter at local x = gutterX):
 *   - spine edge (x = gutterX) stays pinned at restY (the gutter height)
 *   - fore-edge starts at (gutterX + width, restY) on the right
 *   - fore-edge sweeps over the top and descends to landY on the left
 *     (gutterX - width, landY), where landY is the destination surface height
 *
 * The vertical arc lifts the fore-edge by width * liftScale at mid-turn while
 * gradually descending from restY to landY. Radius = width keeps the sheet near
 * its natural length (no excess material to buckle); long-range bending in the
 * solver distributes curvature so the curl stays smooth.
 *
 * Deterministic: targets depend only on normalized progress p.
 */
export interface PageTurnConfig {
  /** Particle indices forming the driven fore-edge (one per row at c = cols-1). */
  foreEdgeIndices: number[];
  /** Local x of the gutter / spine axis. */
  gutterX: number;
  /** Rest height (y) of the sheet at the spine/gutter. */
  restY: number;
  /** Final fore-edge height (y) on the destination side (e.g. lower stack). */
  landY: number;
  /** Page width: gutter to fore-edge distance (m). Also the arc radius. */
  width: number;
  /** Turn duration (seconds) over which the sweep runs. */
  duration: number;
  /** Vertical arc height as a fraction of width (1.0 = semicircle). */
  liftScale?: number;
  /** Per-row phase lead for a 2D (twisted) curl. 0 = cylindrical. */
  lead?: number;
  /**
   * Per-row lift variation: >0 makes the head/tail edges curl more than the
   * center (a 2D dome), <0 the reverse. Adds height-direction bending without
   * shearing the sheet.
   */
  liftVar?: number;
  /** Number of rows (for per-row normalization). Defaults to foreEdgeIndices.length. */
  rows?: number;
}

export class PageTurnController {
  private readonly cfg: PageTurnConfig;
  private readonly targets: { x: number; y: number; z: number }[];
  public guiding = true;
  public released = false;

  constructor(cfg: PageTurnConfig) {
    this.cfg = cfg;
    this.targets = cfg.foreEdgeIndices.map(() => ({ x: 0, y: 0, z: 0 }));
    this.setProgress(0);
  }

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

  setProgress(p: number): void {
    const c = this.cfg;
    const base = clamp01(p);
    const rows = c.rows ?? this.targets.length;
    const lead = c.lead ?? 0;
    const liftVar = c.liftVar ?? 0;
    const liftScale = c.liftScale ?? 0.6;

    for (let i = 0; i < this.targets.length; i++) {
      // Per-row phase offset: head vs tail lead differently, strongest mid-turn.
      const rz = rows > 1 ? i / (rows - 1) : 0.5;
      const env = Math.sin(Math.PI * base); // 0 at both ends
      const pRow = clamp01(base + lead * (rz - 0.5) * env);

      const phi = Math.PI * smootherstep(pRow);
      const cos = Math.cos(phi);
      const sin = Math.sin(phi);

      // Per-row lift modulation: head/tail curl more (dome) -> 2D bend.
      const edge = (2 * rz - 1) * (2 * rz - 1); // 0 at center, 1 at edges
      const liftMod = 1 + liftVar * edge;

      const tx = c.gutterX + c.width * cos;
      // Descend gradually from restY (spine) to landY (fore-edge final).
      const descent = (c.landY - c.restY) * (phi / Math.PI);
      const ty = c.restY + descent + c.width * liftScale * liftMod * sin;

      const tgt = this.targets[i];
      tgt.x = tx;
      tgt.y = ty;
    }
  }

  /** Seed each target's z from the current particle rest z (call once at init). */
  seedZ(particles: Particle[]): void {
    for (let i = 0; i < this.cfg.foreEdgeIndices.length; i++) {
      this.targets[i].z = particles[this.cfg.foreEdgeIndices[i]].z;
    }
  }

  /** Drive the fore-edge particles to their targets by pinning them. */
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