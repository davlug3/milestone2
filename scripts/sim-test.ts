/**
 * Non-rendering simulation checks (AGENTS.md section 7.2).
 *
 * Runs headlessly via `node` (Node 24 strips TS types). Verifies the paper
 * solver without any rendering:
 *   - pinned particles stay fixed
 *   - gravity moves free particles downward
 *   - positions stay finite (no NaN/Infinity)
 *   - a fixed sequence is repeatable (determinism)
 *   - reset returns to the initial state
 *
 * Run: node scripts/sim-test.ts
 */
import { PaperSimulation } from "../src/physics/PaperSimulation";

let failures = 0;
function check(name: string, cond: boolean, detail = ""): void {
  if (cond) {
    console.log(`PASS ${name}`);
  } else {
    failures++;
    console.error(`FAIL ${name} ${detail}`);
  }
}

function allFinite(sim: PaperSimulation): boolean {
  for (const p of sim.particles) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)) {
      return false;
    }
  }
  return true;
}

function makeSim(): PaperSimulation {
  const cols = 15;
  const rows = 20;
  const sim = new PaperSimulation({
    cols,
    rows,
    width: 0.2,
    height: 0.28,
    dt: 1 / 120,
    iterations: 8,
  });
  // Pin the top row.
  for (let c = 0; c < cols; c++) sim.pin((rows - 1) * cols + c);
  return sim;
}

function stepN(sim: PaperSimulation, n: number): void {
  for (let i = 0; i < n; i++) sim.step();
}

// 1. Pinned particles stay fixed.
{
  const sim = makeSim();
  const topBefore = sim.particles[(sim.topology.rows - 1) * sim.topology.cols].y;
  stepN(sim, 60);
  const topAfter = sim.particles[(sim.topology.rows - 1) * sim.topology.cols].y;
  check("pinned top stays fixed", topBefore === topAfter, `${topBefore} -> ${topAfter}`);
}

// 2. Gravity pulls a free particle downward (-Y).
{
  const sim = makeSim();
  const freeIdx = 0; // bottom-left, free
  const y0 = sim.particles[freeIdx].y;
  stepN(sim, 60);
  const y1 = sim.particles[freeIdx].y;
  check("gravity moves free particle down", y1 < y0, `${y0} -> ${y1}`);
}

// 3. Positions remain finite after many steps.
{
  const sim = makeSim();
  stepN(sim, 480);
  check("positions finite after 480 steps", allFinite(sim));
}

// 4. Determinism: two identical sims produce identical state.
{
  const a = makeSim();
  const b = makeSim();
  stepN(a, 120);
  stepN(b, 120);
  let maxDiff = 0;
  for (let i = 0; i < a.particles.length; i++) {
    const pa = a.particles[i];
    const pb = b.particles[i];
    maxDiff = Math.max(
      maxDiff,
      Math.abs(pa.x - pb.x),
      Math.abs(pa.y - pb.y),
      Math.abs(pa.z - pb.z),
    );
  }
  check("deterministic: identical state", maxDiff === 0, `maxDiff=${maxDiff}`);
}

// 5. Reset returns to initial state.
{
  const sim = makeSim();
  // Capture initial positions.
  const init = sim.particles.map((p) => ({ x: p.x, y: p.y, z: p.z }));
  stepN(sim, 240);
  sim.reset();
  let maxDiff = 0;
  for (let i = 0; i < sim.particles.length; i++) {
    const p = sim.particles[i];
    maxDiff = Math.max(
      maxDiff,
      Math.abs(p.x - init[i].x),
      Math.abs(p.y - init[i].y),
      Math.abs(p.z - init[i].z),
    );
  }
  check("reset returns to initial state", maxDiff === 0, `maxDiff=${maxDiff}`);
}

// 6. Structural constraints limit stretching: the sheet should not blow up.
{
  const sim = makeSim();
  stepN(sim, 480);
  // Max distance between any structural neighbor should stay bounded.
  const cols = sim.topology.cols;
  const restMax = sim.topology.width / (cols - 1);
  let maxStretch = 0;
  for (const c of sim.topology.constraints) {
    const pa = sim.particles[c.a];
    const pb = sim.particles[c.b];
    const d = Math.hypot(pb.x - pa.x, pb.y - pa.y, pb.z - pa.z);
    maxStretch = Math.max(maxStretch, d / c.restLength);
  }
  // Allow generous margin; flag only gross stretching (>3x rest).
  check("no gross stretching (<3x rest)", maxStretch < 3.0, `maxStretch=${maxStretch.toFixed(2)}x (restMax~${restMax.toFixed(4)})`);
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll simulation checks passed");