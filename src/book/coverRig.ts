import type { BookDimensions } from "../config/bookConfig";
import { clamp01, smootherstep } from "../animation/easing";

/**
 * Kinematics and collision surface for the animated front cover.
 *
 * The cover is a rigid board hinged at the spine (world x = 0). It rotates
 * about the spine axis from 0 (closed, lying on the right stack) to PI (open,
 * lying flat on the left).
 *
 * A closed hardcover's board pivots at the TOP of the page block; once it is
 * past vertical the hinge line rolls down the spine to table height. The
 * hinge-Y profile below reproduces that: hold the hinge at the closed cover
 * plane until the board is past vertical, then settle it to the open plane.
 * The board therefore never slides sideways or lifts off the spine, and its
 * trailing edge never sweeps through the page block or the table.
 *
 * The open cover's collision surface is the inner lining, which protrudes
 * slightly above the board face (see `createCover`). Pages landing on the
 * open cover should rest on that higher surface, not sink into the board.
 */

/** Lining protrusion beyond the board face, as a fraction of cover thickness. */
export const LINING_PROTRUSION = 0.1;

export interface CoverPose {
  /** World Y of the hinge (spine) line. */
  hingeY: number;
  /** Rotation about the spine axis. 0 = closed, PI = open flat on the left. */
  angle: number;
}

export interface OpenCoverSurface {
  /** World Y of the highest point of the open cover (inner lining top). */
  topY: number;
  /** Footprint of the open board in world XZ (x0..x1, z0..z1). */
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

/** Normalized progress at which the hinge starts descending the spine. */
export const HINGE_DROP_START = 0.55;

/**
 * Pose of the front cover at normalized opening progress `u` in [0, 1].
 *
 * @param closedCenterY World Y of the board's centre when the book is closed.
 * @param openCenterY   World Y of the board's centre when open flat on the left.
 */
export function coverPose(
  u: number,
  closedCenterY: number,
  openCenterY: number,
  dropStart: number = HINGE_DROP_START,
): CoverPose {
  const t = clamp01(u);
  const angle = Math.PI * smootherstep(t);
  const drop = smootherstep(clamp01((t - dropStart) / (1 - dropStart)));
  const hingeY = closedCenterY + (openCenterY - closedCenterY) * drop;
  return { hingeY, angle };
}

/**
 * Height and footprint of the fully open front cover.
 *
 * The inner lining is the topmost surface. Its footprint is 97% of the board;
 * treat the whole board footprint as the lining height so a landing page is
 * never pressed into the board's bevel.
 */
export function openCoverSurface(
  dims: BookDimensions,
  openCenterY: number,
): OpenCoverSurface {
  return {
    topY:
      openCenterY +
      dims.coverThickness * (0.5 + LINING_PROTRUSION),
    x0: -dims.width,
    x1: 0,
    z0: -dims.height / 2,
    z1: dims.height / 2,
  };
}

/**
 * Top surface height of the open cover at a world XZ point, or 0 (the table)
 * outside the board footprint.
 */
export function openCoverTopAt(
  worldX: number,
  worldZ: number,
  dims: BookDimensions,
  openCenterY: number,
): number {
  const s = openCoverSurface(dims, openCenterY);
  if (worldX < s.x0 || worldX > s.x1 || worldZ < s.z0 || worldZ > s.z1) {
    return 0;
  }
  return s.topY;
}

/**
 * Lowest world Y of the rigid board/lining at a given pose.
 *
 * The minimum is always on the hinge edge (local x = 0). Before vertical the
 * lining protrudes below the board; after vertical the board's outer face is
 * underneath. Used by validation to prove the cover never dips below the
 * table.
 */
export function coverLowestY(pose: CoverPose, dims: BookDimensions): number {
  const half = dims.coverThickness / 2;
  const lining = dims.coverThickness * (0.5 + LINING_PROTRUSION);
  const cos = Math.cos(pose.angle);
  return cos >= 0 ? pose.hingeY - lining * cos : pose.hingeY + half * cos;
}
