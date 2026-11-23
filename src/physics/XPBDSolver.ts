import type { Particle } from "./Particle";
import type { DistanceConstraint } from "./DistanceConstraint";

/**
 * Position-Based Dynamics (PBD) solver for a single deformable sheet.
 *
 * This is a plain-data solver: it knows nothing about Three.js. It integrates
 * gravity, predicts positions, and iteratively projects distance constraints,
 * then reconstructs velocities. XPBD compliance can be added later by giving
 * constraints a compliance term; for Milestone 2 we use per-iteration stiffness.
 *
 * Determinism: fixed timestep, fixed iteration count, no randomness. Given the
 * same initial state and the same number of steps, the result is identical.
 */
export class XPBDSolver {
  public readonly particles: Particle[] = [];
  public readonly constraints: DistanceConstraint[] = [];

  /** Fixed timestep in seconds. */
  public readonly dt: number;
  /** Solver iterations per step. */
  public readonly iterations: number;
  /** Gravity along -Y (m/s^2). */
  public readonly gravity: number;
  /** Global velocity damping per step (0..1). 1 = no damping. */
  public damping: number;
  /**
   * Optional ground: either a flat plane at `groundY`, or a heightfield
   * callback `groundHeight(x, z)` returning the surface height at that point.
   * Particles are clamped to stay at or above the surface (PBD projection after
   * constraint iterations). A heightfield lets a turning page collide with a
   * tall book stack on one side and a low surface on the other. `null` disables.
   */
  public groundY: number | null;
  public groundHeight: ((x: number, z: number) => number) | null;

  constructor(options?: {
    dt?: number;
    iterations?: number;
    gravity?: number;
    damping?: number;
    groundY?: number | null;
    groundHeight?: ((x: number, z: number) => number) | null;
  }) {
    this.dt = options?.dt ?? 1 / 120;
    this.iterations = options?.iterations ?? 6;
    this.gravity = options?.gravity ?? 9.81;
    this.damping = options?.damping ?? 0.999;
    this.groundY = options?.groundY ?? null;
    this.groundHeight = options?.groundHeight ?? null;
  }

  addParticle(p: Particle): number {
    this.particles.push(p);
    return this.particles.length - 1;
  }

  addConstraint(c: DistanceConstraint): void {
    this.constraints.push(c);
  }

  /** Save current positions into the previous-position slot. */
  private savePrevious(): void {
    for (const p of this.particles) {
      p.px = p.x;
      p.py = p.y;
      p.pz = p.z;
    }
  }

  /** Integrate: apply gravity to velocity, then predict positions. */
  private integrate(): void {
    const dt = this.dt;
    for (const p of this.particles) {
      if (p.pinned) {
        p.vx = 0;
        p.vy = 0;
        p.vz = 0;
        continue;
      }
      // Semi-implicit Euler: v += a*dt ; x += v*dt
      p.vy += -this.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
    }
  }

  /** Project all distance constraints once. */
  private solveConstraints(): void {
    const inv = this.particles.map((p) => p.invMass);
    for (const c of this.constraints) {
      const pa = this.particles[c.a];
      const pb = this.particles[c.b];
      const w = inv[c.a] + inv[c.b];
      if (w === 0) continue; // both pinned

      let dx = pb.x - pa.x;
      let dy = pb.y - pa.y;
      let dz = pb.z - pa.z;
      const dist = Math.hypot(dx, dy, dz);
      if (dist === 0) continue;

      // Error between current and rest length.
      const diff = (dist - c.restLength) / dist;
      const k = c.stiffness / w;

      dx *= diff * k;
      dy *= diff * k;
      dz *= diff * k;

      if (!pa.pinned) {
        pa.x += dx * inv[c.a];
        pa.y += dy * inv[c.a];
        pa.z += dz * inv[c.a];
      }
      if (!pb.pinned) {
        pb.x -= dx * inv[c.b];
        pb.y -= dy * inv[c.b];
        pb.z -= dz * inv[c.b];
      }
    }
  }

  /** Reconstruct velocities from position change, apply damping. */
  private updateVelocities(): void {
    const invDt = 1 / this.dt;
    for (const p of this.particles) {
      if (p.pinned) continue;
      p.vx = (p.x - p.px) * invDt * this.damping;
      p.vy = (p.y - p.py) * invDt * this.damping;
      p.vz = (p.z - p.pz) * invDt * this.damping;
    }
  }

  /** Clamp particles above the ground (flat plane or heightfield). */
  private solveGround(): void {
    if (this.groundHeight) {
      const h = this.groundHeight;
      for (const p of this.particles) {
        if (p.pinned) continue;
        const g = h(p.x, p.z);
        if (p.y < g) p.y = g;
      }
      return;
    }
    if (this.groundY === null) return;
    const g = this.groundY;
    for (const p of this.particles) {
      if (p.pinned) continue;
      if (p.y < g) p.y = g;
    }
  }

  /** Advance the simulation by one fixed step. */
  step(): void {
    this.savePrevious();
    this.integrate();
    for (let i = 0; i < this.iterations; i++) {
      this.solveConstraints();
    }
    this.solveGround();
    this.updateVelocities();
  }
}