import type { BookDimensions } from "../config/bookConfig";
import { clamp01, smootherstep } from "../animation/easing";

/**
 * Gutter (spine hollow) geometry.
 *
 * A real hardcover's gutter is a curve, not a straight hinge line:
 *
 *   - the curve starts at the BACK cover's inner lining edge,
 *   - dips into the spine hollow,
 *   - ends at the FRONT cover's inner lining edge.
 *
 * Each sheet is bound at its own parameter `s` along that curve, so the
 * sheets' inner edges fan along the gutter instead of all meeting at one
 * sharp x = 0 line. A landed sheet then curves up from its gutter point to
 * the height of the stack it rests on.
 *
 * All functions are in WORLD X/Y (metres). The gutter runs along Z.
 *
 * The covers' inner linings are inset from the spine by `width * 0.015`
 * (3.6 mm for a 240 mm book) and their top surface is `coverThickness * 1.1`
 * (2.75 mm). Between those lining edges the board top is exposed at
 * `coverThickness` (2.5 mm); that 0.25 mm difference is the gutter's dip.
 */

/** Lining inset as a fraction of the page-block width (matches createCover). */
export const LINING_INSET = 0.015;

/** Board top surface (the exposed board between the linings). */
export function boardTopY(dims: BookDimensions): number {
  return dims.coverThickness;
}

/** Cover lining top surface (the surface a page rests on outside the gutter). */
export function liningTopY(dims: BookDimensions): number {
  return dims.coverThickness * 1.1;
}

/** Half-width of the gutter hollow (world x of the lining edges). */
export function gutterHalfWidth(dims: BookDimensions): number {
  return dims.width * LINING_INSET;
}

/** Surface height of the gutter hollow at world x, for opening progress u. */
export function gutterSurfaceY(
  worldX: number,
  dims: BookDimensions,
  u = 1,
): number {
  const half = gutterHalfWidth(dims);
  const s = clamp01((worldX + half) / (2 * half));
  const edge = liningTopY(dims);
  const dip = liningTopY(dims) - boardTopY(dims); // 0.25 mm
  return edge - dip * Math.sin(Math.PI * s) * smootherstep(clamp01(u));
}

/** Particle-centre floor on the gutter (page mid-surface + half shell + gap). */
export function gutterParticleFloorY(
  worldX: number,
  dims: BookDimensions,
  u = 1,
): number {
  return gutterSurfaceY(worldX, dims, u) + 0.000125 + 0.00005;
}

/** World (x, y) binding point for a sheet at gutter parameter s in [0, 1]. */
export function gutterBinding(
  s: number,
  dims: BookDimensions,
): { x: number; y: number } {
  const half = gutterHalfWidth(dims);
  const t = clamp01(s);
  const x = -half + 2 * half * t;
  return { x, y: gutterParticleFloorY(x, dims, 1) };
}

/** Even gutter parameter for sheet k of `count` (0 = front-cover side). */
export function gutterBindingS(k: number, count: number): number {
  if (count <= 1) return 0.5;
  return (k + 0.5) / count;
}