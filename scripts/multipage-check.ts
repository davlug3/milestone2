/**
 * N-page stacking collision check.
 *
 * Turns pages sequentially, one at a time, exactly like the demo:
 *  - page k starts at its own height on the right stack
 *  - it is driven over the gutter and lands on the left stack
 *  - once settled it is baked into a shared Heightfield
 *  - later pages collide against that heightfield
 *
 * After all pages settle, it verifies that every free particle of every page
 * sits at or above the ACTUAL surface of the pages below it (no page-to-page
 * interpenetration outside the gutter strip).
 *
 * Run: npm run test:twopage          (8 pages, mirrors the demo)
 *      PAGES=4 npm run test:twopage  (faster subset)
 */
import { PaperSimulation } from "../src/physics/PaperSimulation";
import { PageTurnController } from "../src/animation/PageTurnController";
import { Heightfield } from "../src/physics/Heightfield";
import { BOOK_DIMENSIONS } from "../src/config/bookConfig";
import { openCoverSurface } from "../src/book/coverRig";
import {
  LINING_INSET,
  gutterBinding,
  gutterBindingS,
  gutterParticleFloorY,
} from "../src/book/gutterRig";

const W = BOOK_DIMENSIONS.width;
const H = BOOK_DIMENSIONS.height;
const CT = BOOK_DIMENSIONS.coverThickness;
const PBT = 0.022;
const blockTop = CT + PBT;
const cols = 25;
const rows = 33;
const DT = 1 / 120;
const gutterX = -W / 2;
const NUM_SHEETS = 15;
const vStep = 0.0003;
const restBase = blockTop + 0.0004;

// Open-cover collision surface (mirrors the demo).
const OPEN_CENTER_Y = CT / 2;
const OPEN_COVER = openCoverSurface(BOOK_DIMENSIONS, OPEN_CENTER_Y);
const PAGE_SHELL_HALF = 0.000125;
const COVER_GAP = 0.00005;
const COVER_FLOOR = OPEN_COVER.topY + PAGE_SHELL_HALF + COVER_GAP;
const landBase = COVER_FLOOR + 0.0002;

const landStep = 0.0008;
const bakeMinX = gutterX - 0.04; // gutter strip is left free (natural fan)
const bakeTop = 0.0006;
const PAGES = Number(process.env.PAGES ?? 8);

// Curved gutter (mirrors the demo).
const GUTTER_HALF = W * LINING_INSET;
const BLOCK_INNER_X = 0.005;
const blockLeftLocal = BLOCK_INNER_X - W / 2;

const hf = new Heightfield({ width: W, height: H, nx: 110, nz: 110 });
hf.setBase((x) => {
  const worldX = x + W / 2;
  if (worldX >= BLOCK_INNER_X) return blockTop;
  if (worldX >= -GUTTER_HALF && worldX <= GUTTER_HALF) {
    return gutterParticleFloorY(worldX, BOOK_DIMENSIONS, 1);
  }
  return COVER_FLOOR;
});

interface Settled {
  particles: { x: number; y: number; z: number; pinned: boolean }[];
}

function makePage(restY: number, landY: number, belowRestY: number, k: number) {
  const groundHeight = (x: number, z: number): number =>
    x >= blockLeftLocal
      ? Math.max(belowRestY, hf.heightAt(x, z))
      : hf.heightAt(x, z);
  const sim = new PaperSimulation({
    cols,
    rows,
    width: W,
    height: H,
    dt: DT,
    iterations: 12,
    bendStiffness: 1.0,
    longRangeBend: true,
    bendSpans: [3, 4, 5, 6],
    plane: "xz",
    groundHeight,
  });
  for (const p of sim.particles) p.y = p.py = restY;
  const spine: number[] = [];
  const fe: number[] = [];
  for (let r = 0; r < rows; r++) {
    spine.push(r * cols + 0);
    fe.push(r * cols + (cols - 1));
  }
  const binding = gutterBinding(gutterBindingS(k, PAGES), BOOK_DIMENSIONS);
  const ctrl = new PageTurnController({
    foreEdgeIndices: fe,
    spineIndices: spine,
    gutterX,
    restY,
    landY,
    landSpineY: binding.y,
    spineTargetX: binding.x - W / 2,
    landSpineStart: 0.5,
    width: W,
    duration: 2.5,
    liftScale: 0.6,
    lead: 0.04,
    liftVar: 0.06,
    rows,
  });
  ctrl.seedZ(sim.particles);
  ctrl.setProgress(0);
  ctrl.apply(sim.particles);
  return { sim, ctrl };
}

function turn(sim: PaperSimulation, ctrl: PageTurnController, dur: number) {
  const steps = Math.round((dur + 0.5) / DT);
  for (let s = 0; s < steps; s++) {
    const p = Math.min((s * DT) / dur, 1);
    ctrl.setProgress(p);
    ctrl.apply(sim.particles);
    sim.step();
  }
}

function bake(sim: PaperSimulation) {
  for (const p of sim.particles) {
    if (p.x < bakeMinX) hf.splat(p.x, p.z, p.y + bakeTop, 2);
  }
}

/** Highest settled surface among `pages` within a small radius of (x,z). */
function surfaceAt(pages: Settled[], x: number, z: number): number {
  let best = -Infinity;
  for (const pg of pages) {
    for (const q of pg.particles) {
      if (Math.abs(q.x - x) < 0.006 && Math.abs(q.z - z) < 0.012) {
        if (q.y > best) best = q.y;
      }
    }
  }
  return best;
}

const settled: Settled[] = [];
let worstPen = 0;
let totalChecks = 0;
let badParticles = 0;

for (let k = 0; k < PAGES; k++) {
  const restY = restBase + (NUM_SHEETS - 1 - k) * vStep;
  const belowRestY = restBase + (NUM_SHEETS - 1 - (k + 1)) * vStep;
  const landY = landBase + k * landStep;
  const { sim, ctrl } = makePage(restY, landY, belowRestY, k);
  turn(sim, ctrl, 2.5);

  // Compare this page against the pages already below it.
  let pageWorst = 0;
  let pageBad = 0;
  for (const p of sim.particles) {
    if (p.pinned || p.x >= bakeMinX) continue;
    const below = surfaceAt(settled, p.x, p.z);
    if (below === -Infinity) continue;
    totalChecks++;
    const pen = below - p.y;
    if (pen > pageWorst) pageWorst = pen;
    if (pen > 0.0005) pageBad++;
  }
  if (pageWorst > worstPen) worstPen = pageWorst;
  badParticles += pageBad;

  let belowHF = 0;
  for (const p of sim.particles) {
    if (!p.pinned && p.y < hf.heightAt(p.x, p.z) - 0.0004) belowHF++;
  }

  console.log(
    `page ${k}: belowHeightfield=${belowHF} vsPagesPenetration=${pageBad} worst=${(pageWorst * 1000).toFixed(2)}mm`,
  );

  settled.push({ particles: sim.particles.map((p) => ({ x: p.x, y: p.y, z: p.z, pinned: p.pinned })) });
  bake(sim);
}

console.log(
  `SUMMARY pages=${PAGES} checks=${totalChecks} badParticles(>0.5mm)=${badParticles} ` +
    `worstPenetration=${(worstPen * 1000).toFixed(2)}mm`,
);
console.log(
  badParticles === 0 ? "PASS: no page-to-page interpenetration" : "FAIL: page-to-page interpenetration",
);
process.exit(badParticles === 0 ? 0 : 1);
