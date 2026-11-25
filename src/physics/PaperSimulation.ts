import { XPBDSolver } from "./XPBDSolver";
import { createSheetTopology, type SheetTopology } from "./SheetTopology";
import type { Particle } from "./Particle";

/** Owns one sheet's topology and deterministic XPBD simulation. */
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
    groundHeight?: ((x: number, z: number) => number) | null;
    longRangeBend?: boolean;
    bendSpans?: number[];
    longRangeStiffness?: number;
    damping?: number;
    gravity?: number;
    groundFriction?: number;
    groundRestitution?: number;
  }) {
    this.plane = options.plane ?? "xy";
    this.topology = createSheetTopology({
      cols: options.cols,
      rows: options.rows,
      width: options.width,
      height: options.height,
      bendStiffness: options.bendStiffness,
      longRangeBend: options.longRangeBend,
      bendSpans: options.bendSpans,
      longRangeBendStiffness: options.longRangeStiffness,
      plane: this.plane,
    });
    this.solver = new XPBDSolver({
      dt: options.dt,
      iterations: options.iterations,
      gravity: options.gravity,
      damping: options.damping,
      groundY: options.groundY,
      groundHeight: options.groundHeight,
      groundFriction: options.groundFriction,
      groundRestitution: options.groundRestitution,
    });
    for (const p of this.topology.particles) this.solver.addParticle(p);
    for (const c of this.topology.constraints) this.solver.addConstraint(c);
  }

  get particles(): Particle[] {
    return this.topology.particles;
  }

  pin(index: number): void {
    const p = this.topology.particles[index];
    if (!p) throw new RangeError(`Particle index ${index} is out of range.`);
    p.invMass = 0;
    p.pinned = true;
    p.vx = p.vy = p.vz = 0;
  }

  unpin(index: number): void {
    const p = this.topology.particles[index];
    if (!p) throw new RangeError(`Particle index ${index} is out of range.`);
    p.invMass = 1;
    p.pinned = false;
  }

  step(): void {
    this.solver.step();
  }

  /** Restore the flat rest shape and zero all velocities. */
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
