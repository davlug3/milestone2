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
}): SheetTopology {
  const { cols, rows, width, height } = options;
  const particles: Particle[] = [];
  const constraints: DistanceConstraint[] = [];

  const dx = width / (cols - 1);
  const dy = height / (rows - 1);

  const idx = (c: number, r: number): number => r * cols + c;

  // Build particles in the XY plane, centered at origin, z=0.
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = -width / 2 + c * dx;
      const y = -height / 2 + r * dy;
      particles.push(createParticle(x, y, 0));
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

  return { cols, rows, width, height, particles, constraints };
}