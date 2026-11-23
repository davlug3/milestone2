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

  constructor(options: {
    cols: number;
    rows: number;
    width: number;
    height: number;
    dt?: number;
    iterations?: number;
  }) {
    this.topology = createSheetTopology({
      cols: options.cols,
      rows: options.rows,
      width: options.width,
      height: options.height,
    });
    this.solver = new XPBDSolver({ dt: options.dt, iterations: options.iterations });
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
        p.x = p.px = -width / 2 + c * dx;
        p.y = p.py = -height / 2 + r * dy;
        p.z = p.pz = 0;
        p.vx = p.vy = p.vz = 0;
      }
    }
  }
}