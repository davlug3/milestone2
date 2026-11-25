import type { Particle } from "./Particle";
import type { DistanceConstraint } from "./DistanceConstraint";

/**
 * Deterministic XPBD solver for a deformable paper sheet.
 * Constraint multipliers are accumulated within a step and reset between steps.
 */
export class XPBDSolver {
  public readonly particles: Particle[] = [];
  public readonly constraints: DistanceConstraint[] = [];
  public readonly dt: number;
  public readonly iterations: number;
  public readonly gravity: number;
  public damping: number;
  public groundY: number | null;
  public groundHeight: ((x: number, z: number) => number) | null;
  /** Tangential velocity retained after ground contact (0 = no sliding). */
  public groundFriction: number;
  /** Normal velocity retained after impact (0 = no bounce). */
  public groundRestitution: number;
  private multipliers = new Float64Array(0);

  constructor(options?: {
    dt?: number;
    iterations?: number;
    gravity?: number;
    damping?: number;
    groundY?: number | null;
    groundHeight?: ((x: number, z: number) => number) | null;
    groundFriction?: number;
    groundRestitution?: number;
  }) {
    this.dt = options?.dt ?? 1 / 120;
    this.iterations = options?.iterations ?? 6;
    this.gravity = options?.gravity ?? 9.81;
    this.damping = options?.damping ?? 0.999;
    this.groundY = options?.groundY ?? null;
    this.groundHeight = options?.groundHeight ?? null;
    this.groundFriction = options?.groundFriction ?? 0.28;
    this.groundRestitution = options?.groundRestitution ?? 0.015;
  }

  addParticle(p: Particle): number {
    this.particles.push(p);
    return this.particles.length - 1;
  }

  addConstraint(c: DistanceConstraint): void {
    this.constraints.push(c);
    if (this.multipliers.length !== this.constraints.length) {
      const next = new Float64Array(this.constraints.length);
      next.set(this.multipliers);
      this.multipliers = next;
    }
  }

  private savePrevious(): void {
    for (const p of this.particles) {
      p.px = p.x;
      p.py = p.y;
      p.pz = p.z;
    }
  }

  private integrate(): void {
    const dt = this.dt;
    for (const p of this.particles) {
      if (p.pinned || p.invMass <= 0) {
        p.vx = p.vy = p.vz = 0;
        continue;
      }
      p.vy -= this.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
    }
  }

  /**
   * XPBD distance projection. Compliance makes material response substantially
   * less dependent on iteration count and timestep than per-iteration stiffness.
   */
  private solveConstraints(): void {
    const inv = this.particles.map((p) => Math.max(0, p.invMass));
    const alphaScale = 1 / (this.dt * this.dt);
    for (let i = 0; i < this.constraints.length; i++) {
      const c = this.constraints[i];
      const pa = this.particles[c.a];
      const pb = this.particles[c.b];
      const wa = inv[c.a];
      const wb = inv[c.b];
      const w = wa + wb;
      if (w === 0) continue;

      const dx = pb.x - pa.x;
      const dy = pb.y - pa.y;
      const dz = pb.z - pa.z;
      const dist = Math.hypot(dx, dy, dz);
      if (dist < 1e-10) continue;

      const C = dist - c.restLength;
      const alpha = Math.max(0, c.compliance ?? 0) * alphaScale;
      const dlambda = (-C - alpha * this.multipliers[i]) / (w + alpha);
      this.multipliers[i] += dlambda;

      const nx = dx / dist;
      const ny = dy / dist;
      const nz = dz / dist;
      if (wa > 0) {
        pa.x -= wa * nx * dlambda;
        pa.y -= wa * ny * dlambda;
        pa.z -= wa * nz * dlambda;
      }
      if (wb > 0) {
        pb.x += wb * nx * dlambda;
        pb.y += wb * ny * dlambda;
        pb.z += wb * nz * dlambda;
      }
    }
  }

  private updateVelocities(): void {
    const invDt = 1 / this.dt;
    for (const p of this.particles) {
      if (p.pinned || p.invMass <= 0) continue;
      p.vx = (p.x - p.px) * invDt * this.damping;
      p.vy = (p.y - p.py) * invDt * this.damping;
      p.vz = (p.z - p.pz) * invDt * this.damping;
    }
  }

  /** Project positions against the flat ground or sampled heightfield. */
  private solveGround(): boolean[] {
    const contacts = new Array<boolean>(this.particles.length).fill(false);
    if (!this.groundHeight && this.groundY === null) return contacts;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (p.pinned || p.invMass <= 0) continue;
      const ground = this.groundHeight
        ? this.groundHeight(p.x, p.z)
        : this.groundY as number;
      if (p.y < ground) {
        p.y = ground;
        contacts[i] = true;
      }
    }
    return contacts;
  }

  /**
   * Remove inward normal velocity and damp tangential motion at contact.
   * Heightfield normals are estimated locally so pages slide along book stacks.
   */
  private solveContactVelocity(contacts: boolean[]): void {
    const friction = Math.max(0, Math.min(1, this.groundFriction));
    const restitution = Math.max(0, Math.min(1, this.groundRestitution));
    const h = this.groundHeight;
    for (let i = 0; i < contacts.length; i++) {
      if (!contacts[i]) continue;
      const p = this.particles[i];
      let nx = 0, ny = 1, nz = 0;
      if (h) {
        const e = 0.001;
        const dhdx = (h(p.x + e, p.z) - h(p.x - e, p.z)) / (2 * e);
        const dhdz = (h(p.x, p.z + e) - h(p.x, p.z - e)) / (2 * e);
        const length = Math.hypot(dhdx, 1, dhdz);
        nx = -dhdx / length;
        ny = 1 / length;
        nz = -dhdz / length;
      }
      const vn = p.vx * nx + p.vy * ny + p.vz * nz;
      if (vn < 0) {
        const impulse = (1 + restitution) * vn;
        p.vx -= impulse * nx;
        p.vy -= impulse * ny;
        p.vz -= impulse * nz;
      }
      const normalSpeed = p.vx * nx + p.vy * ny + p.vz * nz;
      const tx = p.vx - normalSpeed * nx;
      const ty = p.vy - normalSpeed * ny;
      const tz = p.vz - normalSpeed * nz;
      p.vx = normalSpeed * nx + tx * (1 - friction);
      p.vy = normalSpeed * ny + ty * (1 - friction);
      p.vz = normalSpeed * nz + tz * (1 - friction);
    }
  }

  step(): void {
    this.savePrevious();
    this.integrate();
    this.multipliers.fill(0);
    for (let i = 0; i < this.iterations; i++) this.solveConstraints();
    const contacts = this.solveGround();
    this.updateVelocities();
    this.solveContactVelocity(contacts);
  }
}
