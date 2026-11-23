import { XPBDSolver } from "./XPBDSolver";
import { createSheetTopology, type SheetTopology } from "./SheetTopology";
import type { Particle } from "./Particle";

/**
 * Coordinates one sheet's physics: owns the topology and the solver, and
 * exposes a simple step/reset API. Knows nothing about rendering.
 */
export class PaperSimulation {
  public readonly topology: SheetTopology;
  public readonly solver: XPBDSolver;
  private readonly plane: "xy" | "xz";

  constructor(options: {
    cols: number;
    rows: number;
    width: number;
    height: number;
    dt?: number;
    iterations?: number;
    bendStiffness?: number;
    plane?: "xy" | "xz";
    groundY?: number | null;
  }) {
    this.plane = options.plane ?? "xy";
    this.topology = createSheetTopology({
      cols: options.cols,
      rows: options.rows,
      width: options.width,
      height: options.height,
      bendStiffness: options.bendStiffness,
      plane: this.plane,
    });
    this.solver = new XPBDSolver({
      dt: options.dt,
      iterations: options.iterations,
      groundY: options.groundY,
    });
    for (const p of this.topology.particles) this.solver.addParticle(p);
    for (const c of this.topology.constraints) this.solver.addConstraint(c);
  }

  get particles(): Particle[] {
    return this.topology.particles;
  }

  /** Pin a particle (invMass = 0) so it stays fixed. */
  pin(index: number): void {
    const p = this.topology.particles[index];
    p.invMass = 0;
    p.pinned = true;
  }

  /** Un-pin a particle (restore unit inverse mass). */
  unpin(index: number): void {
    const p = this.topology.particles[index];
    p.invMass = 1;
    p.pinned = false;
  }

  /** Advance one fixed step. */
  step(): void {
    this.solver.step();
  }

  /**
   * Reset the sheet to its original flat rest shape and zero velocity.
   * Deterministic: returns to the same initial state.
   */
  reset(): void {
    const { cols, width, height } = this.topology;
    const rows = this.topology.rows;
    const dx = width / (cols - 1);
    const dy = height / (rows - 1);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const p = this.topology.particles[r * cols + c];
        const u = -width / 2 + c * dx;
        const v = -height / 2 + r * dy;
        if (this.plane === "xz") {
          p.x = p.px = u;
          p.y = p.py = 0;
          p.z = p.pz = v;
        } else {
          p.x = p.px = u;
          p.y = p.py = v;
          p.z = p.pz = 0;
        }
        p.vx = p.vy = p.vz = 0;
      }
    }
  }
}