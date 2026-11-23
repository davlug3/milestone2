/**
 * A single simulation particle (plain data, no Three.js dependency).
 *
 * Positions and velocities are flat 3-vectors. The solver operates on arrays
 * of these; rendering reads `position` to update geometry.
 */
export interface Particle {
  x: number;
  y: number;
  z: number;
  px: number; // previous position (for PBD velocity reconstruction)
  py: number;
  pz: number;
  vx: number; // velocity (units/second)
  vy: number;
  vz: number;
  /** Inverse mass. 0 = pinned/infinite mass. */
  invMass: number;
  pinned: boolean;
}

export function createParticle(
  x: number,
  y: number,
  z: number,
  invMass = 1,
): Particle {
  return { x, y, z, px: x, py: y, pz: z, vx: 0, vy: 0, vz: 0, invMass, pinned: invMass === 0 };
}