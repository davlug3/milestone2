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
 *   - spine edge (x = gutterX) starts at `spineRestY` (its height on the spine
 *     binding plane, which may be lower than the fore-edge `restY`). It stays
 *     on that binding through the crossing and settles to `landSpineY` at its
 *     own point in the gutter, so a landed sheet curves up from the binding to
 *     the stack instead of being flat all the way in.
 *   - fore-edge starts at (gutterX + width, restY) on the right
 *   - fore-edge sweeps over the top and descends to landY on the left
 *     (gutterX - width, landY), where landY is the destination surface height
 *
 * The vertical arc lifts the fore-edge by width * liftScale at mid-turn while
 * gradually descending from restY to landY. Radius = width keeps the sheet near
 * its natural length (no excess material to buckle); long-range bending in the
 * solver distributes curvature so the curl stays smooth.
 *
 * Letting the spine edge descend as well keeps the landed sheet flat on the
 * destination surface instead of cantilevering it from the old stack height
 * (which produced a sharp crease next to the gutter).
 *
 * Deterministic: targets depend only on normalized progress p.
 */
export interface PageTurnConfig {
  /** Particle indices forming the driven fore-edge (one per row at c = cols-1). */
  foreEdgeIndices: number[];
  /** Particle indices forming the pinned spine edge (one per row at c = 0). */
  spineIndices?: number[];
  /** Local x of the gutter / spine axis. */
  gutterX: number;
  /** Rest height (y) of the sheet at the spine/gutter. */
  restY: number;
  /**
   * Rest height (y) of the pinned spine edge. Defaults to `restY`. Set this
   * lower than `restY` when the sheet is bound on the spine plane and ramps up
   * to the stack: the spine edge stays on the binding while the fore-edge rests
   * at the stack height.
   */
  spineRestY?: number;
  /** Final fore-edge height (y) on the destination side (e.g. lower stack). */
  landY: number;
  /** Final height (y) of the spine edge on the destination side. Defaults to
   * `spineRestY` (the spine stays at its binding height).
   */
  landSpineY?: number;
  /**
   * Local x the spine edge moves to on the destination side (its own point in
   * the curved gutter). Defaults to `gutterX` (no sideways motion).
   */
  spineTargetX?: number;
  /**
   * Normalized progress at which the spine edge starts moving to its gutter
   * binding point. It stays at the old stack height through the crossing so
   * the sheet is not folded over the block edge; it settles into the gutter
   * once the page is on the destination side. Default 0.5.
   */
  landSpineStart?: number;
  /**
   * Extra X shift (negative, world) applied to the page as it lands. Used for
   * the spine panel: when open, the front cover sits `panelWidth` further left,
   * and the landed page must follow it (fore-edge stays flush with the board).
   * Default 0 (no shift).
   */
  landOffsetX?: number;
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
  /** Current target of the pinned spine edge. */
  private spineTargetX: number;
  private spineTargetY: number;
  public guiding = true;
  public released = false;

  constructor(cfg: PageTurnConfig) {
    this.cfg = cfg;
    this.targets = cfg.foreEdgeIndices.map(() => ({ x: 0, y: 0, z: 0 }));
    this.spineTargetX = cfg.gutterX;
    this.spineTargetY = cfg.spineRestY ?? cfg.restY;
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

    // The spine edge stays at the old stack height through the crossing, then
    // moves to its own point in the gutter once the sheet is on that side. This
    // keeps the mid-turn sheet smooth (no fold over the block edge) while
    // letting a landed page curve up from the gutter to its stack.
    const start = c.landSpineStart ?? 0.5;
    const settleK = smootherstep(clamp01((base - start) / (1 - start)));
    // Spine-panel landing shift: the whole sheet follows the front board left
    // as it settles (0 for a zero-width spine).
    const shift = (c.landOffsetX ?? 0) * settleK;
    const spineRestY = c.spineRestY ?? c.restY;
    if (c.landSpineY !== undefined) {
      const targetX = c.spineTargetX ?? c.gutterX;
      this.spineTargetX = c.gutterX + (targetX - c.gutterX) * settleK + shift;
      this.spineTargetY = spineRestY + (c.landSpineY - spineRestY) * settleK;
    } else {
      this.spineTargetX = c.gutterX + shift;
      this.spineTargetY = spineRestY;
    }

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

      const tx = c.gutterX + c.width * cos + shift;
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

  /** Drive the fore-edge and spine-edge particles to their targets by pinning them. */
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
    // Keep the gutter edge on its own point in the curved gutter. X and Y are
    // driven; Z stays where the sheet's rest shape put it.
    if (this.cfg.spineIndices) {
      for (const i of this.cfg.spineIndices) {
        const p = particles[i];
        p.x = p.px = this.spineTargetX;
        p.y = p.py = this.spineTargetY;
        p.vx = p.vy = 0;
        p.invMass = 0;
        p.pinned = true;
      }
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