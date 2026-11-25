/**
 * XPBD distance constraint between two particles.
 * Compliance is expressed in inverse-force units; zero is rigid.
 */
export interface DistanceConstraint {
  a: number;
  b: number;
  restLength: number;
  /** Legacy authoring control (0..1), retained for scene compatibility. */
  stiffness: number;
  /** XPBD compliance. When omitted, derived from stiffness. */
  compliance?: number;
}

export function createDistanceConstraint(
  a: number,
  b: number,
  restLength: number,
  stiffness = 1,
  compliance?: number,
): DistanceConstraint {
  const k = Math.max(0, Math.min(1, stiffness));
  // A small scale keeps paper links firm at a 120 Hz simulation rate while
  // allowing bend links to yield more than structural links.
  return {
    a,
    b,
    restLength,
    stiffness: k,
    compliance: compliance ?? 1e-6 * (1 - k) * (1 - k),
  };
}
