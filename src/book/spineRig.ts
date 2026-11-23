import type { BookDimensions } from "../config/bookConfig";
import { clamp01, smootherstep } from "../animation/easing";

/**
 * Spine (case) cross-section for the animated hardcover.
 *
 * A real case-bound spine is a curved strip of board+cloth that wraps from the
 * back board's edge around the outside of the book to the front board's edge.
 * It is not a rigid rectangular bar: when the book is closed the strip bulges
 * outward around the page block; as the front cover swings open the strip rolls
 * with it and finally tucks in under the opened cover, following the spine
 * hollow.
 *
 * The cross-section is modelled as a quadratic Bezier in WORLD X/Y:
 *
 *   P0 = back board's top-left edge              (fixed)
 *   P2 = front board's OUTER hinge corner        (moves with the cover)
 *   P1 = chord midpoint + outward normal * offset
 *
 * The Bezier's midpoint protrudes half the control offset from the chord, so
 * `spineProtrusion` is the visible bulge depth. Protrusion goes to zero near
 * the end of the opening, where the strip would otherwise fold inside the
 * opened board; the result is a flush ribbon hidden in the spine hollow.
 *
 * Everything here is pure math (metres, world X/Y) so it can be validated
 * headlessly; the mesh builder lives in `spine.ts`.
 */

export interface SpinePose {
  /** Normalized cover-opening progress in [0, 1]. */
  u: number;
  /** World Y of the cover hinge line. */
  hingeY: number;
  /** Cover rotation about the spine axis. 0 = closed, PI = open flat. */
  angle: number;
}

export interface Point2 {
  x: number;
  y: number;
}

/** How far the closed spine bulges beyond its chord (m). */
export function closedProtrusion(dims: BookDimensions): number {
  return dims.coverThickness * 1.6;
}

/**
 * Visible bulge depth at opening progress u.
 *
 * Fully bulged when closed, then eased away from u=0.70 and flat by u=0.88.
 * The strip's chord shrinks to zero (and flips direction) at about u=0.90 as
 * the hinge drops past the back board's top edge; flattening before that point
 * keeps the strip from folding into the back board / flipping its normal.
 */
export function spineProtrusion(dims: BookDimensions, u: number): number {
  const t = clamp01(u);
  const tuck = smootherstep(clamp01((t - 0.7) / 0.18));
  return closedProtrusion(dims) * (1 - tuck);
}

/** Back-board attachment point (top-left edge of the back board). */
export function spineBackPoint(dims: BookDimensions, originX = 0): Point2 {
  return { x: originX, y: dims.coverThickness };
}

/**
 * Front-board attachment point: the outer hinge corner of the cover, i.e. the
 * hinge-line point offset by half the board thickness along the board's outer
 * normal. Rotating (0, +CT/2) by `angle` (about Z) and adding the hinge.
 */
export function spineFrontPoint(
  dims: BookDimensions,
  pose: SpinePose,
  originX = 0,
): Point2 {
  const half = dims.coverThickness * 0.5;
  return {
    x: originX - Math.sin(pose.angle) * half,
    y: pose.hingeY + Math.cos(pose.angle) * half,
  };
}

/** Bezier control point (chord midpoint pushed out along the outward normal). */
export function spineControlPoint(
  dims: BookDimensions,
  pose: SpinePose,
  originX = 0,
): Point2 {
  const a = spineBackPoint(dims, originX);
  const b = spineFrontPoint(dims, pose, originX);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  const protrusion = spineProtrusion(dims, pose.u);
  // Outward normal of the chord (left of the back->front direction). For a
  // closed book this is -X (away from the page block).
  const nx = len > 1e-9 ? -dy / len : -1;
  const ny = len > 1e-9 ? dx / len : 0;
  // A quadratic Bezier's midpoint sits half the control offset off the chord.
  const offset = protrusion * 2;
  return {
    x: (a.x + b.x) * 0.5 + nx * offset,
    y: (a.y + b.y) * 0.5 + ny * offset,
  };
}

/** Point on the spine centre-line at parameter t in [0, 1] (0 = back edge). */
export function spinePoint(
  dims: BookDimensions,
  pose: SpinePose,
  t: number,
  originX = 0,
): Point2 {
  const p0 = spineBackPoint(dims, originX);
  const p1 = spineControlPoint(dims, pose, originX);
  const p2 = spineFrontPoint(dims, pose, originX);
  const s = clamp01(t);
  const w0 = (1 - s) * (1 - s);
  const w1 = 2 * (1 - s) * s;
  const w2 = s * s;
  return {
    x: w0 * p0.x + w1 * p1.x + w2 * p2.x,
    y: w0 * p0.y + w1 * p1.y + w2 * p2.y,
  };
}

/** Outward 2D normal of the centre-line at parameter t. */
export function spineNormal(
  dims: BookDimensions,
  pose: SpinePose,
  t: number,
  originX = 0,
): Point2 {
  const s = clamp01(t);
  const p0 = spineBackPoint(dims, originX);
  const p1 = spineControlPoint(dims, pose, originX);
  const p2 = spineFrontPoint(dims, pose, originX);
  // d/dt of the quadratic Bezier.
  const dx = 2 * (1 - s) * (p1.x - p0.x) + 2 * s * (p2.x - p1.x);
  const dy = 2 * (1 - s) * (p1.y - p0.y) + 2 * s * (p2.y - p1.y);
  const len = Math.hypot(dx, dy);
  if (len < 1e-12) return { x: -1, y: 0 };
  return { x: -dy / len, y: dx / len };
}

/** Sampled cross-section from the back attachment (t=0) to the front (t=1). */
export function spineCrossSection(
  dims: BookDimensions,
  pose: SpinePose,
  samples: number,
  originX = 0,
): Point2[] {
  const n = Math.max(2, samples);
  const out: Point2[] = [];
  for (let i = 0; i < n; i++) {
    out.push(spinePoint(dims, pose, i / (n - 1), originX));
  }
  return out;
}

/** Chord length between the two attachment points. */
export function spineChord(
  dims: BookDimensions,
  pose: SpinePose,
  originX = 0,
): number {
  const a = spineBackPoint(dims, originX);
  const b = spineFrontPoint(dims, pose, originX);
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Bounding box of a sampled cross-section. */
export function spineBounds(points: Point2[]) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, maxX, minY, maxY };
}
