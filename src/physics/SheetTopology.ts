import { createParticle, type Particle } from "./Particle";
import {
  createDistanceConstraint,
  type DistanceConstraint,
} from "./DistanceConstraint";

/**
 * Grid topology + XPBD constraint wiring for one rectangular paper sheet.
 * Structural links preserve in-plane dimensions, shear links resist racking,
 * and softer bend links let the sheet curl without behaving like a rigid plate.
 */
export interface SheetTopology {
  cols: number;
  rows: number;
  width: number;
  height: number;
  particles: Particle[];
  constraints: DistanceConstraint[];
}

export function createSheetTopology(options: {
  cols: number;
  rows: number;
  width: number;
  height: number;
  bendStiffness?: number;
  longRangeBend?: boolean;
  longRangeBendStiffness?: number;
  bendSpans?: number[];
  plane?: "xy" | "xz";
}): SheetTopology {
  const { cols, rows, width, height } = options;
  if (cols < 2 || rows < 2) throw new Error("Sheet topology requires at least 2 columns and rows.");
  const plane = options.plane ?? "xy";
  const particles: Particle[] = [];
  const constraints: DistanceConstraint[] = [];
  const dx = width / (cols - 1);
  const dy = height / (rows - 1);
  const idx = (c: number, r: number): number => r * cols + c;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const u = -width / 2 + c * dx;
      const v = -height / 2 + r * dy;
      particles.push(plane === "xz" ? createParticle(u, 0, v) : createParticle(u, v, 0));
    }
  }

  // In-plane structural constraints.
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (c < cols - 1) constraints.push(createDistanceConstraint(idx(c, r), idx(c + 1, r), dx, 1));
      if (r < rows - 1) constraints.push(createDistanceConstraint(idx(c, r), idx(c, r + 1), dy, 1));
    }
  }

  // Shear constraints prevent cells from collapsing into parallelograms.
  const diagonal = Math.hypot(dx, dy);
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      constraints.push(createDistanceConstraint(idx(c, r), idx(c + 1, r + 1), diagonal, 0.7));
      constraints.push(createDistanceConstraint(idx(c + 1, r), idx(c, r + 1), diagonal, 0.7));
    }
  }

  // Two-cell bending links resist sharp creases while remaining compliant.
  const bend = options.bendStiffness ?? 0.35;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (c < cols - 2) constraints.push(createDistanceConstraint(idx(c, r), idx(c + 2, r), dx * 2, bend));
      if (r < rows - 2) constraints.push(createDistanceConstraint(idx(c, r), idx(c, r + 2), dy * 2, bend));
    }
  }

  // Longer spans distribute curvature and suppress isolated sharp buckles.
  if (options.longRangeBend || options.bendSpans) {
    const stiffness = options.longRangeBendStiffness ?? bend * 0.5;
    const spans = options.bendSpans ?? (options.longRangeBend ? [3, 4] : []);
    for (const span of spans) {
      if (!Number.isInteger(span) || span <= 2) continue;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (c + span < cols) constraints.push(createDistanceConstraint(idx(c, r), idx(c + span, r), dx * span, stiffness));
          if (r + span < rows) constraints.push(createDistanceConstraint(idx(c, r), idx(c, r + span), dy * span, stiffness));
        }
      }
    }
  }

  return { cols, rows, width, height, particles, constraints };
}
