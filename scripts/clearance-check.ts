/**
 * Paper / spine clearance check (headless).
 *
 * Mirrors the demo's current page-turn setup and verifies, at every solver
 * step, that no particle of a turning sheet:
 *
 *   1. sinks below the book surface (block top, gutter, open-cover lining),
 *   2. enters the right text block's solid,
 *   3. dips below the table,
 *
 * The demo's heightfield used to stop at `blockWidth`, which pushed the last
 * 4 mm of every sheet down to the cover floor and through the block. This test
 * exists to catch that class of regression: it compares particles against the
 * same per-x surfaces the demo collides with.
 *
 * Run: npm run test:clearance
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
const SPINE_PANEL_W = 2 * CT + PBT;
const blockTop = CT + PBT;
const GUTTER_HALF = W * LINING_INSET;
const BLOCK_INNER_X = 0.005;
const BLOCK_ROUND_R = 0.0025;
const BLOCK_WIDTH = W - 0.004;
const BLOCK_DEPTH = H * 0.97;

const NUM_TURNS = 8;
const NUM_SHEETS = 15;
const vStep = 0.0003;
const restBase = blockTop + 0.0004;
const PAGE_SHELL_HALF = 0.000125;
const COVER_CONTACT_GAP = 0.00005;
const OPEN_CENTER_Y = CT / 2;
const OPEN_COVER = openCoverSurface(BOOK_DIMENSIONS, OPEN_CENTER_Y);
const COVER_FLOOR_Y =
  OPEN_COVER.topY + PAGE_SHELL_HALF + COVER_CONTACT_GAP;
const landBase = COVER_FLOOR_Y + 0.0002;
const landStep = 0.0008;

const cols = 25;
const rows = 33;
const DT = 1 / 120;
const DUR = 2.5;
const SETTLE = 0.5;
const gutterX = -W / 2;
const blockLeftLocal = BLOCK_INNER_X - W / 2;

const topSheetY = restBase + (NUM_SHEETS - 1) * vStep;
const closedCenterY = topSheetY + 0.0005 + CT / 2;

function fail(msg: string): never {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

/**
 * Particle-centre floor the demo's heightfield provides at world x (u = 1).
 * Mirrors `resetHeightfield()` exactly: block top, gutter particle floor
 * (surface + shell + gap), or the open-cover particle floor.
 */
function floorAt(worldX: number): number {
  if (worldX >= BLOCK_INNER_X) return blockTop;
  if (worldX >= -GUTTER_HALF && worldX <= GUTTER_HALF) {
    return gutterParticleFloorY(worldX, BOOK_DIMENSIONS, 1);
  }
  return COVER_FLOOR_Y;
}

interface TurnReport {
  worstBelowSurface: number;
  worstInsideBlock: number;
  worstY: number;
  nan: boolean;
  worstInfo: string;
}

function runTurn(k: number): TurnReport {
  const restY = restBase + (NUM_SHEETS - 1 - k) * vStep;
  const landY = landBase + k * landStep;
  const belowRestY = restBase + (NUM_SHEETS - 1 - (k + 1)) * vStep;
  const belowFloorY = belowRestY + 0.00025;

  const hf = new Heightfield({ width: W, height: H, nx: 110, nz: 110 });
  hf.setBase((x) => floorAt(x + W / 2));

  const groundHeight = (x: number, z: number): number =>
    x >= blockLeftLocal
      ? Math.max(belowFloorY, hf.heightAt(x, z))
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

  const spineIndices: number[] = [];
  const foreEdgeIndices: number[] = [];
  for (let r = 0; r < rows; r++) {
    spineIndices.push(r * cols + 0);
    foreEdgeIndices.push(r * cols + (cols - 1));
  }

  const binding = gutterBinding(gutterBindingS(k, NUM_TURNS), BOOK_DIMENSIONS);
  const controller = new PageTurnController({
    foreEdgeIndices,
    spineIndices,
    gutterX,
    restY,
    landY,
    landSpineY: Math.max(binding.y, COVER_FLOOR_Y),
    spineTargetX: binding.x - W / 2,
    landSpineStart: 0.5,
    landOffsetX: -SPINE_PANEL_W,
    width: W,
    duration: DUR,
    liftScale: 0.6,
    lead: 0.04,
    liftVar: 0.06,
    rows,
  });
  controller.seedZ(sim.particles);
  controller.setProgress(0);
  controller.apply(sim.particles);

  let worstBelowSurface = Infinity;
  let worstInsideBlock = Infinity;
  let worstY = Infinity;
  let nan = false;
  let worstInfo = "";

  const steps = Math.round((DUR + SETTLE) / DT);
  for (let s = 0; s <= steps; s++) {
    const progress = Math.min((s * DT) / DUR, 1);
    controller.setProgress(progress);
    controller.apply(sim.particles);
    sim.step();

    for (const p of sim.particles) {
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) nan = true;
      worstY = Math.min(worstY, p.y);

      const worldX = p.x + W / 2;
      const clearance = p.y - floorAt(worldX);
      if (clearance < worstBelowSurface) {
        worstBelowSurface = clearance;
        worstInfo =
          `t=${(s * DT).toFixed(3)}s world=(${(worldX * 1000).toFixed(2)},` +
          `${(p.y * 1000).toFixed(2)},${(p.z * 1000).toFixed(2)})mm`;
      }

      // Depth inside the text block's solid (if any). The particle must be
      // strictly inside all three extents for this to count.
      if (
        worldX > BLOCK_INNER_X + 1e-6 &&
        worldX < BLOCK_WIDTH - 1e-6 &&
        p.y > CT + 1e-6 &&
        p.y < blockTop - 1e-6 &&
        Math.abs(p.z) < BLOCK_DEPTH / 2 - 1e-6
      ) {
        const depth = Math.min(
          worldX - BLOCK_INNER_X,
          BLOCK_WIDTH - worldX,
          p.y - CT,
          blockTop - p.y,
        );
        worstInsideBlock = Math.min(worstInsideBlock, depth);
      }
    }
  }

  return { worstBelowSurface, worstInsideBlock, worstY, nan, worstInfo };
}

let failed = false;
for (const k of [0, 3, NUM_TURNS - 1]) {
  const r = runTurn(k);
  const below = (r.worstBelowSurface * 1000).toFixed(3);
  const inside = Number.isFinite(r.worstInsideBlock)
    ? `${(r.worstInsideBlock * 1000).toFixed(3)}mm`
    : "none";
  console.log(
    `page ${k}: belowSurface=${below}mm insideBlock=${inside} ` +
      `minY=${(r.worstY * 1000).toFixed(3)}mm nan=${r.nan}`,
  );
  console.log(`  worst: ${r.worstInfo}`);
  if (r.nan) {
    console.error(`FAIL: page ${k} produced NaN`);
    failed = true;
  }
  if (r.worstBelowSurface < -1e-6) {
    console.error(`FAIL: page ${k} sinks below the book surface`);
    failed = true;
  }
  if (Number.isFinite(r.worstInsideBlock)) {
    console.error(`FAIL: page ${k} enters the text block`);
    failed = true;
  }
  if (r.worstY < -1e-9) {
    console.error(`FAIL: page ${k} dips below the table`);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log("PASS: paper clears the text block, gutter and table through a turn");
