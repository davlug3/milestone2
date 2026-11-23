import { createParticle, type Particle } from "./Particle";
import {
  createDistanceConstraint,
  type DistanceConstraint,
} from "./DistanceConstraint";

/**
 * Grid topology + constraint wiring for one rectangular paper sheet.
 *
 * Produces particles in a (cols x rows) grid plus structural (horizontal /
 * vertical neighbor) and shear (cell diagonal) distance constraints. Pure data;
 * no rendering. The rest shape is a flat grid in the XY plane at z=0.
 */
export interface SheetTopology {
  cols: number;
  rows: number;
  /** Grid width in meters. */
  width: number;
  /** Grid height in meters. */
  height: number;
  particles: Particle[];
  constraints: DistanceConstraint[];
}

export function createSheetTopology(options: {
  cols: number;
  rows: number;
  width: number;
  height: number;
  /** Bending constraint stiffness (0..1). Defaults to a soft 0.35. */
  bendStiffness?: number;
  /** Add 3- and 4-cell bending links to spread curvature (smoother curl). */
  longRangeBend?: boolean;
  /** Stiffness for the long-range links. Defaults to half of bendStiffness. */
  longRangeBendStiffness?: number;
  /**
   * Orientation of the flat rest sheet:
   *   'xy' (default): sheet in the XY plane at z=0 (vertical, for drop tests).
   *   'xz': sheet flat in the XZ plane at y=0 (horizontal, for page turns;
   *         width along X, height along Z, gravity -Y perpendicular).
   */
  plane?: "xy" | "xz";
}): SheetTopology {
  const { cols, rows, width, height } = options;
  const plane = options.plane ?? "xy";
  const particles: Particle[] = [];
  const constraints: DistanceConstraint[] = [];

  const dx = width / (cols - 1);
  const dy = height / (rows - 1);

  const idx = (c: number, r: number): number => r * cols + c;

  // Build particles in the chosen plane, centered at origin.
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const u = -width / 2 + c * dx; // along width
      const v = -height / 2 + r * dy; // along height
      if (plane === "xz") {
        // Flat on the ground: width->X, height->Z, y=0.
        particles.push(createParticle(u, 0, v));
      } else {
        // Vertical: width->X, height->Y, z=0.
        particles.push(createParticle(u, v, 0));
      }
    }
  }

  // Structural constraints: horizontal and vertical neighbors.
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (c < cols - 1) {
        constraints.push(
          createDistanceConstraint(idx(c, r), idx(c + 1, r), dx, 1),
        );
      }
      if (r < rows - 1) {
        constraints.push(
          createDistanceConstraint(idx(c, r), idx(c, r + 1), dy, 1),
        );
      }
    }
  }

  // Shear constraints: both diagonals of each cell.
  const diag = Math.hypot(dx, dy);
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      constraints.push(
        createDistanceConstraint(idx(c, r), idx(c + 1, r + 1), diag, 0.7),
      );
      constraints.push(
        createDistanceConstraint(idx(c + 1, r), idx(c, r + 1), diag, 0.7),
      );
    }
  }

  // Bending constraints: two-step neighbors in each direction. These resist
  // folding by keeping the distance across a 2-cell span near its rest length.
  // Simple and stable; dihedral bending can be layered on later if needed.
  const bendX = dx * 2;
  const bendY = dy * 2;
  const bendStiffness = options.bendStiffness ?? 0.35; // softer than structural/shear
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (c < cols - 2) {
        constraints.push(
          createDistanceConstraint(idx(c, r), idx(c + 2, r), bendX, bendStiffness),
        );
      }
      if (r < rows - 2) {
        constraints.push(
          createDistanceConstraint(idx(c, r), idx(c, r + 2), bendY, bendStiffness),
        );
      }
    }
  }

  // Long-range bending constraints (3- and 4-cell spans). Two-step bending
  // alone lets curvature concentrate into a couple of cells (a sharp buckle).
  // Adding longer-range links resists localized folding and spreads the bend
  // across many cells, producing a smooth, paper-like curl instead of a crease.
  if (options.longRangeBend) {
    const lrStiffness = options.longRangeBendStiffness ?? bendStiffness * 0.5;
    for (let span = 3; span <= 4; span++) {
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (c < cols - span) {
            constraints.push(
              createDistanceConstraint(idx(c, r), idx(c + span, r), dx * span, lrStiffness),
            );
          }
          if (r < rows - span) {
            constraints.push(
              createDistanceConstraint(idx(c, r), idx(c, r + span), dy * span, lrStiffness),
            );
          }
        }
      }
    }
  }

  return { cols, rows, width, height, particles, constraints };
}