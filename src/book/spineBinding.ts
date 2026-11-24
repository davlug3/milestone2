import type { BookDimensions } from "../config/bookConfig";
import { clamp01, smootherstep } from "../animation/easing";
import { HINGE_DROP_START, coverPose } from "./coverRig";

/**
 * Spine binding geometry.
 *
 * The pages are not loose sheets lying on the covers: they are bound to the
 * SPINE. The binding is a horizontal cloth plane between the two cover hinges
 * (the edges where each board meets the spine). Its two long edges are:
 *
 *   - the back cover hinge, at world x = 0
 *   - the front cover hinge, at world x = -spinePanelWidth (open book)
 *
 * A cloth mull rises from this plane and the text block fans out of it: every
 * sheet's inner edge starts on the spine plane and ramps up to its own height
 * in the stack. That is the "pages bound perpendicularly to the spine plane"
 * look: a continuous bound line instead of loose sheets floating beside a
 * gutter trough.
 *
 * All functions are in world metres. X = width, Y = up, Z = head-to-tail.
 */

/** Particle mid-surface to page face (half the visual shell thickness). */
export const SHELL_HALF = 0.000125;
/** Contact gap between a page underside and the surface below it. */
export const CONTACT_GAP = 0.00005;
/**
 * Per-sheet fan step at the spine. Without it every sheet's inner edge would
 * sit at exactly the same point and z-fight. Small enough to read as one bound
 * edge, large enough to keep the sheets separated.
 */
export const SPINE_FAN_STEP = 0.00028;
/** Horizontal run over which a sheet ramps from the spine plane to its stack. */
export const BIND_RAMP = 0.05;

/**
 * Binding height at fraction `t` in [0, 1] of the ramp: flat at the spine plane
 * (zero slope) easing to flat at the stack. The paper itself leaves the plane
 * smoothly; the perpendicular cloth hinge is the mull, not the paper.
 */
function bindingCurve(t: number): number {
  return smootherstep(clamp01(t));
}

/** Top of the cloth covering the spine plane (cover lining height). */
export function spineClothTopY(dims: BookDimensions): number {
  return dims.coverThickness * 1.1;
}

/** Particle-centre height of a page bound directly on the spine plane. */
export function spinePlaneY(dims: BookDimensions): number {
  return spineClothTopY(dims) + SHELL_HALF + CONTACT_GAP;
}

/** Particle-centre spine height for a sheet at fan index (0 = bottom sheet). */
export function spineFanY(dims: BookDimensions, fanIndex: number): number {
  return spinePlaneY(dims) + fanIndex * SPINE_FAN_STEP;
}

/**
 * Top surface of the text-block wedge on the right at world x.
 *
 * At the spine it is the cloth height; it ramps up to the flat block top over
 * `BIND_RAMP`. This is the solid the page stack sits on, so a turning page has
 * a surface to collide with instead of a vertical wall in the gutter.
 */
export function blockRampY(
  worldX: number,
  dims: BookDimensions,
  blockTop: number,
): number {
  const base = spineClothTopY(dims);
  if (worldX <= 0) return base;
  if (worldX >= BIND_RAMP) return blockTop;
  return base + (blockTop - base) * bindingCurve(worldX / BIND_RAMP);
}

/**
 * Mid-surface of a right-hand (un-turned) sheet at world x.
 *
 * At the spine it is `spineY` (on the binding plane); beyond `BIND_RAMP` it is
 * the sheet's stack height `stackY`.
 */
export function rightSheetY(
  worldX: number,
  spineY: number,
  stackY: number,
): number {
  if (worldX <= 0) return spineY;
  if (worldX >= BIND_RAMP) return stackY;
  return spineY + (stackY - spineY) * bindingCurve(worldX / BIND_RAMP);
}

/**
 * Mid-surface of a landed (left-hand) sheet at world x.
 *
 * The sheet binds at `spineLeftX` (the front cover hinge) and ramps up to
 * `stackY` over `BIND_RAMP` towards the fore-edge (decreasing x).
 */
export function leftSheetY(
  worldX: number,
  spineLeftX: number,
  spineY: number,
  stackY: number,
): number {
  const t = clamp01((spineLeftX - worldX) / BIND_RAMP);
  if (t <= 0) return spineY;
  if (t >= 1) return stackY;
  return spineY + (stackY - spineY) * bindingCurve(t);
}

/**
 * Fan index for a sheet in the closed stack.
 *
 * `sheetIndex` 0 is the top sheet (turns first); `count - 1` is the bottom.
 * The returned index is 0 at the bottom so the fan order matches the stack
 * order (top sheet highest at the spine).
 */
export function fanIndex(sheetIndex: number, count: number): number {
  return count - 1 - sheetIndex;
}

/**
 * Particle-centre floor for the shared collision heightfield at world x.
 *
 * Right: the text-block wedge (then the flat block top). Left: the open cover
 * lining / spine plane. This mirrors the surfaces the sheets actually rest on.
 */
export function bindingFloorY(
  worldX: number,
  dims: BookDimensions,
  blockTop: number,
  coverFloorY: number,
): number {
  if (worldX >= BIND_RAMP) return blockTop + SHELL_HALF + CONTACT_GAP;
  if (worldX >= 0) return blockRampY(worldX, dims, blockTop) + SHELL_HALF + CONTACT_GAP;
  return Math.max(coverFloorY, spinePlaneY(dims));
}

/** A point on the spine plane in world XY. */
export interface SpinePlaneEdge {
  x: number;
  y: number;
}

/**
 * The two long edges of the spine plane at cover-opening progress `u`.
 *
 * The back edge is fixed on the back cover's inner lining (world x = 0). The
 * front edge is the FRONT COVER's inner lining point at its hinge, so it moves
 * with the cover: closed it is at the top of the text block (the plane is
 * vertical), open it is at the front cover hinge (the plane is flat). This is
 * what makes the plane "bounded by the front cover" instead of a static strip.
 */
export function spinePlaneEdges(
  u: number,
  dims: BookDimensions,
  closedCenterY: number,
  openCenterY: number,
  hingeTravel: number,
): { back: SpinePlaneEdge; front: SpinePlaneEdge } {
  const pose = coverPose(
    u,
    closedCenterY,
    openCenterY,
    HINGE_DROP_START,
    hingeTravel,
  );
  // Board centre to the inner lining top (coverThickness * 0.5 board + 0.1
  // lining protrusion = 0.6 * coverThickness). This is the page-facing lining
  // surface at every angle: below the board when closed, above when open.
  const off = dims.coverThickness * 0.6;
  const sin = Math.sin(pose.angle);
  const cos = Math.cos(pose.angle);
  return {
    back: { x: 0, y: dims.coverThickness * 1.1 },
    front: {
      x: pose.hingeX + off * sin,
      y: pose.hingeY - off * cos,
    },
  };
}