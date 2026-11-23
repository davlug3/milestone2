/**
 * A distance constraint between two particles.
 *
 * Holds the rest length and a stiffness (0..1) used by the PBD solver. For
 * XPBD-style compliance this is the starting point; compliance can be layered
 * on later. Stiffness is applied per solver iteration.
 */
export interface DistanceConstraint {
  a: number; // particle index
  b: number; // particle index
  restLength: number;
  stiffness: number;
}

export function createDistanceConstraint(
  a: number,
  b: number,
  restLength: number,
  stiffness = 1,
): DistanceConstraint {
  return { a, b, restLength, stiffness };
}