/**
 * Headless page-turn quality metrics (no rendering).
 *
 * Simulates one page turn with the PBD solver + fore-edge controller and
 * reports objective deformation-quality signals at several progress points:
 *   - maxStretch: worst structural/shear/bend edge length / rest length
 *   - maxDihedral: sharpest fold angle between adjacent grid quads (deg)
 *   - nan: any non-finite position
 *   - foreEdgeX / foreEdgeY: driven edge position (did it cross the gutter?)
 *   - belowGround: count of particles clamped at/below ground (landing)
 *
 * Tune parameters via env:
 *   BEND (bend stiffness), ITERS, LIFT (m), W, H, DUR, SETTLE, COLS, ROWS
 *
 * Run: esbuild bundle + node (see package.json "test:page")
 */
import { PaperSimulation } from "../src/physics/PaperSimulation";

const W = Number(process.env.W ?? 0.24);
const H = Number(process.env.H ?? 0.31);
const COLS = Number(process.env.COLS ?? 25);
const ROWS = Number(process.env.ROWS ?? 33);
const BEND = Number(process.env.BEND ?? 0.4);
const ITERS = Number(process.env.ITERS ?? 8);
const LIFT = Number(process.env.LIFT ?? 0.11);
const DUR = Number(process.env.DUR ?? 2.4);
const SETTLE = Number(process.env.SETTLE ?? 1.2);
const DT = 1 / 120;

function clamp01(x: number) {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}
function smootherstep(t: number) {
  const x = clamp01(t);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

const restY = Number(process.env.RESTY ?? 0.05); // elevated like a real page
const gutterX = -W / 2; // local spine x
const sim = new PaperSimulation({
  cols: COLS,
  rows: ROWS,
  width: W,
  height: H,
  dt: DT,
  iterations: ITERS,
  bendStiffness: BEND,
  plane: "xz",
  groundY: restY - 0.002, // land on a surface just below rest (small drop)
});
for (const p of sim.particles) p.y = p.py = restY;
// Pin spine edge c=0.
for (let r = 0; r < ROWS; r++) sim.pin(r * COLS + 0);
// Fore-edge indices c=COLS-1.
const foreEdge: number[] = [];
for (let r = 0; r < ROWS; r++) foreEdge.push(r * COLS + (COLS - 1));

const targets = foreEdge.map((i) => ({ x: 0, y: 0, z: sim.particles[i].z }));

function drive(p: number) {
  const e = smootherstep(clamp01(p));
  const phi = Math.PI * e;
  const tx = gutterX + W * Math.cos(phi);
  const ty = restY + LIFT * Math.sin(phi);
  for (let i = 0; i < foreEdge.length; i++) {
    const pt = sim.particles[foreEdge[i]];
    pt.x = pt.px = tx;
    pt.y = pt.py = ty;
    pt.z = pt.pz = targets[i].z;
    pt.vx = pt.vy = pt.vz = 0;
    pt.invMass = 0;
    pt.pinned = true;
  }
}

function release() {
  for (const i of foreEdge) {
    const pt = sim.particles[i];
    pt.invMass = 1;
    pt.pinned = false;
  }
}

function metrics(label: string) {
  const cols = COLS, rows = ROWS;
  const P = sim.particles;
  let maxStretch = 0;
  for (const c of sim.topology.constraints) {
    const a = P[c.a], b = P[c.b];
    const d = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    maxStretch = Math.max(maxStretch, d / c.restLength);
  }
  // Max dihedral across grid interior edges (sharp fold detector).
  // For each cell compute normal; compare with neighbor cell sharing an edge.
  const cellNormal = (c: number, r: number) => {
    const i0 = r * cols + c;
    const p0 = P[i0], p1 = P[i0 + 1], p2 = P[i0 + cols];
    const e1x = p1.x - p0.x, e1y = p1.y - p0.y, e1z = p1.z - p0.z;
    const e2x = p2.x - p0.x, e2y = p2.y - p0.y, e2z = p2.z - p0.z;
    let nx = e1y * e2z - e1z * e2y;
    let ny = e1z * e2x - e1x * e2z;
    let nz = e1x * e2y - e1y * e2x;
    const l = Math.hypot(nx, ny, nz) || 1;
    return { x: nx / l, y: ny / l, z: nz / l };
  };
  let maxDihedral = 0;
  let maxAt = { c: 0, r: 0 };
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const n = cellNormal(c, r);
      // neighbor right
      if (c < cols - 2) {
        const nr = cellNormal(c + 1, r);
        const dot = Math.max(-1, Math.min(1, n.x * nr.x + n.y * nr.y + n.z * nr.z));
        const ang = (Math.acos(dot) * 180) / Math.PI;
        if (ang > maxDihedral) { maxDihedral = ang; maxAt = { c, r }; }
      }
      if (r < rows - 2) {
        const nr = cellNormal(c, r + 1);
        const dot = Math.max(-1, Math.min(1, n.x * nr.x + n.y * nr.y + n.z * nr.z));
        const ang = (Math.acos(dot) * 180) / Math.PI;
        if (ang > maxDihedral) { maxDihedral = ang; maxAt = { c, r }; }
      }
    }
  }
  let nan = false;
  let belowGround = 0;
  for (const p of P) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)) nan = true;
    if (p.y <= restY - 0.004) belowGround++;
  }
  // fore-edge centroid
  let fx = 0, fy = 0;
  for (const i of foreEdge) {
    fx += P[i].x;
    fy += P[i].y;
  }
  fx /= foreEdge.length;
  fy /= foreEdge.length;
  console.log(
    `${label}: stretch=${maxStretch.toFixed(2)}x dihedral=${maxDihedral.toFixed(1)}deg@(${maxAt.c},${maxAt.r}) ` +
      `nan=${nan} belowGround=${belowGround} foreEdgeX=${fx.toFixed(3)} foreEdgeY=${fy.toFixed(3)}`,
  );
  return { maxStretch, maxDihedral, nan, belowGround, foreEdgeX: fx, foreEdgeY: fy };
}

// Run: turn (phi 0->PI over DUR) then settle (release + SETTLE).
const turnSteps = Math.round(DUR / DT);
const settleSteps = Math.round(SETTLE / DT);
let worstStretch = 0;
let worstDihedral = 0;
let released = false;
for (let s = 0; s <= turnSteps + settleSteps; s++) {
  if (s <= turnSteps) {
    const p = s / turnSteps;
    drive(p);
  } else {
    // Settle: hold the fore-edge at its final rest position (page now lying on
    // the left) and let the body relax under gravity onto the landing surface.
    // A real turned page rests on the opposite stack, not the floor.
    drive(1); // final arc position = fore-edge flat on the left at restY
    if (!released) released = true;
  }
  sim.step();
  if (s % Math.max(1, Math.round(turnSteps / 4)) === 0 || s === turnSteps || s === turnSteps + settleSteps) {
    const m = metrics(`s=${s}(${(s * DT).toFixed(2)}s)`);
    worstStretch = Math.max(worstStretch, m.maxStretch);
    worstDihedral = Math.max(worstDihedral, m.maxDihedral);
  }
}
const final = metrics("FINAL");
console.log(
  `SUMMARY: worstStretch=${worstStretch.toFixed(2)}x worstDihedral=${worstDihedral.toFixed(1)}deg ` +
    `finalForeEdgeX=${final.foreEdgeX.toFixed(3)} (gutter=${gutterX.toFixed(3)}) ` +
    `crossed=${final.foreEdgeX < gutterX + W * 0.3}`,
);