/**
 * Cover opening + curved gutter + page/cover collision check (headless).
 *
 * 1. Cover kinematics
 *    - hinged at the spine: closed at one end, flat on the left at the other
 *    - monotonic swing; never below the table; never inside the page block
 *
 * 2. Curved gutter
 *    - the gutter curve starts/ends at the covers' inner lining edges
 *    - it dips to the board top in the middle
 *    - each sheet's binding point is unique and ordered along the curve
 *
 * 3. Page landing
 *    - one page turns exactly like the demo (right-stack height, open-cover
 *      floor, curved gutter binding) and comes to rest on the cover
 *    - its spine edge is at its own gutter binding point
 *    - its fore-edge is at the stack height
 *    - the sheet is curved (spine edge below the stack height)
 *    - no part of the page goes below the book surface
 *
 * Run: npm run test:cover
 */
import { PaperSimulation } from "../src/physics/PaperSimulation";
import { PageTurnController } from "../src/animation/PageTurnController";
import { Heightfield } from "../src/physics/Heightfield";
import { BOOK_DIMENSIONS } from "../src/config/bookConfig";
import {
  HINGE_DROP_START,
  LINING_PROTRUSION,
  coverLowestY,
  coverPose,
  openCoverSurface,
  openCoverTopAt,
} from "../src/book/coverRig";
import {
  LINING_INSET,
  gutterBinding,
  gutterBindingS,
  gutterParticleFloorY,
  gutterSurfaceY,
} from "../src/book/gutterRig";

const W = BOOK_DIMENSIONS.width;
const H = BOOK_DIMENSIONS.height;
const CT = BOOK_DIMENSIONS.coverThickness;
const PBT = 0.022;
const SPINE_PANEL_W = 2 * CT + PBT; // case spine width = closed thickness
const blockTop = CT + PBT;
const cols = 25;
const rows = 33;
const DT = 1 / 120;
const gutterX = -W / 2;
const NUM_SHEETS = 15;
const vStep = 0.0003;
const restBase = blockTop + 0.0004;
const restY = restBase + (NUM_SHEETS - 1) * vStep;
const belowRestY = restBase + (NUM_SHEETS - 2) * vStep;

const OPEN_CENTER_Y = CT / 2;
const OPEN_COVER = openCoverSurface(
  BOOK_DIMENSIONS,
  OPEN_CENTER_Y,
  SPINE_PANEL_W,
);
const PAGE_SHELL_HALF = 0.000125;
const COVER_GAP = 0.00005;
const COVER_FLOOR = OPEN_COVER.topY + PAGE_SHELL_HALF + COVER_GAP;
const landY = COVER_FLOOR + 0.0002;
const topSheetY = restY;
const closedCenterY = topSheetY + 0.0005 + CT / 2;

// Curved gutter (mirrors the demo).
const GUTTER_HALF = W * LINING_INSET;
const BLOCK_INNER_X = 0.005;
const blockLeftLocal = BLOCK_INNER_X - W / 2;
const BINDING = gutterBinding(0.5, BOOK_DIMENSIONS);

const DUR = 2.5;
const SETTLE = 0.5;

function fail(msg: string): never {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

function approx(a: number, b: number, eps = 1e-9): boolean {
  return Math.abs(a - b) <= eps;
}

// --- 1. Cover kinematics ---------------------------------------------------
let worstLowest = Infinity;
let boardInBlock = 0;
let nonMonotonic = 0;
let prevAngle = -Infinity;
let prevHinge = Infinity;

// Sample the board and the protruding lining as local (x, y) points.
const localPts: { x: number; y: number }[] = [];
const ix = 12;
for (let i = 0; i <= ix; i++) {
  const x = -W / 2 + (W * i) / ix;
  localPts.push({ x, y: -CT / 2 });
  localPts.push({ x, y: CT / 2 });
}
const liningHalfW = W * 0.97 / 2;
for (let i = 0; i <= ix; i++) {
  const x = -liningHalfW + (2 * liningHalfW * i) / ix;
  localPts.push({ x, y: -CT * (0.5 + LINING_PROTRUSION) });
}

const block = {
  x0: BLOCK_INNER_X,
  x1: W,
  y0: CT,
  y1: blockTop,
};

for (let s = 0; s <= 400; s++) {
  const u = s / 400;
  const pose = coverPose(
    u,
    closedCenterY,
    OPEN_CENTER_Y,
    HINGE_DROP_START,
    SPINE_PANEL_W,
  );
  worstLowest = Math.min(worstLowest, coverLowestY(pose, BOOK_DIMENSIONS));

  const cos = Math.cos(pose.angle);
  const sin = Math.sin(pose.angle);
  for (const q of localPts) {
    // Cover-group point (q.x + W/2, q.y) rotated about the (moving) spine.
    const x = pose.hingeX + (q.x + W / 2) * cos - q.y * sin;
    const y = pose.hingeY + (q.x + W / 2) * sin + q.y * cos;
    if (
      x >= block.x0 - 1e-9 &&
      x <= block.x1 + 1e-9 &&
      y >= block.y0 - 1e-9 &&
      y <= block.y1 + 1e-9
    ) {
      boardInBlock++;
    }
  }

  if (pose.angle < prevAngle - 1e-12) nonMonotonic++;
  prevAngle = pose.angle;
  if (u >= 0.55 && pose.hingeY > prevHinge + 1e-12) nonMonotonic++;
  prevHinge = pose.hingeY;
}

const closed = coverPose(0, closedCenterY, OPEN_CENTER_Y, HINGE_DROP_START, SPINE_PANEL_W);
const open = coverPose(1, closedCenterY, OPEN_CENTER_Y, HINGE_DROP_START, SPINE_PANEL_W);
if (!approx(closed.angle, 0)) fail(`closed angle ${closed.angle}`);
if (!approx(closed.hingeY, closedCenterY, 1e-12)) fail("closed hinge height");
if (!approx(closed.hingeX, 0, 1e-12)) fail("closed hinge x");
if (!approx(open.angle, Math.PI, 1e-12)) fail(`open angle ${open.angle}`);
if (!approx(open.hingeY, OPEN_CENTER_Y, 1e-12)) fail("open hinge height");
if (!approx(open.hingeX, -SPINE_PANEL_W, 1e-12)) fail(`open hinge x ${open.hingeX}`);
const openSpan = W - OPEN_COVER.x0;
const expectedSpan = 2 * W + SPINE_PANEL_W;
if (!approx(openSpan, expectedSpan, 1e-9)) {
  fail(`open span ${(openSpan * 1000).toFixed(2)}mm != 2L+T ${(expectedSpan * 1000).toFixed(2)}mm`);
}
if (worstLowest < -1e-9) fail(`cover goes below table by ${-worstLowest * 1000}mm`);
if (boardInBlock > 0) fail(`${boardInBlock} cover samples inside the page block`);
if (nonMonotonic > 0) fail(`${nonMonotonic} non-monotonic cover samples`);

// --- 2. Open-cover surface -------------------------------------------------
const topInside = openCoverTopAt(-W / 2, 0, BOOK_DIMENSIONS, OPEN_CENTER_Y, SPINE_PANEL_W);
const topOutsideX = openCoverTopAt(0.05, 0, BOOK_DIMENSIONS, OPEN_CENTER_Y, SPINE_PANEL_W);
const topOutsideZ = openCoverTopAt(-W / 2, H, BOOK_DIMENSIONS, OPEN_CENTER_Y, SPINE_PANEL_W);
const expectedTop = OPEN_CENTER_Y + CT * (0.5 + LINING_PROTRUSION);
if (!approx(topInside, expectedTop)) fail(`open cover top ${topInside}`);
if (topOutsideX !== 0 || topOutsideZ !== 0) fail("cover footprint leaks outside board");
if (!approx(OPEN_COVER.topY, expectedTop)) fail("openCoverSurface topY");

// --- 3. Curved gutter ------------------------------------------------------
const edgeY = gutterSurfaceY(-GUTTER_HALF, BOOK_DIMENSIONS, 1);
const edgeYRight = gutterSurfaceY(GUTTER_HALF, BOOK_DIMENSIONS, 1);
const middleY = gutterSurfaceY(0, BOOK_DIMENSIONS, 1);
if (!approx(edgeY, expectedTop)) fail(`gutter left edge ${edgeY} != lining top`);
if (!approx(edgeYRight, expectedTop)) fail(`gutter right edge ${edgeYRight} != lining top`);
if (!(middleY < edgeY - 1e-6)) fail("gutter does not dip in the middle");

const bindingXs: number[] = [];
for (let k = 0; k < 8; k++) {
  const b = gutterBinding(gutterBindingS(k, 8), BOOK_DIMENSIONS);
  bindingXs.push(b.x);
}
for (let k = 1; k < bindingXs.length; k++) {
  if (!(bindingXs[k] > bindingXs[k - 1])) fail("gutter binding x not increasing");
}
// The curve is symmetric, so y values repeat about the middle; uniqueness is
// in the (x, y) pair, which the increasing-x check already guarantees.

// --- 4. Page landing on the cover -----------------------------------------
const hf = new Heightfield({ width: W, height: H, nx: 110, nz: 110 });
hf.setBase((x) => {
  const worldX = x + W / 2;
  if (worldX >= BLOCK_INNER_X) return blockTop;
  if (worldX >= -GUTTER_HALF && worldX <= GUTTER_HALF) {
    return gutterParticleFloorY(worldX, BOOK_DIMENSIONS, 1);
  }
  return COVER_FLOOR;
});

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

const spineIndices: number[] = [];
const foreEdgeIndices: number[] = [];
for (let r = 0; r < rows; r++) {
  spineIndices.push(r * cols + 0);
  foreEdgeIndices.push(r * cols + (cols - 1));
}

const controller = new PageTurnController({
  foreEdgeIndices,
  spineIndices,
  gutterX,
  restY,
  landY,
  landSpineY: Math.max(BINDING.y, COVER_FLOOR),
  spineTargetX: BINDING.x - W / 2,
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

// Track book-surface penetration at every step, not just at the end.
let worstBelowSurface = Infinity;
const steps = Math.round((DUR + SETTLE) / DT);
for (let s = 0; s <= steps; s++) {
  const progress = Math.min((s * DT) / DUR, 1);
  controller.setProgress(progress);
  controller.apply(sim.particles);
  sim.step();
  for (const p of sim.particles) {
    const worldX = p.x + W / 2;
    let surface: number;
    if (worldX >= BLOCK_INNER_X) {
      surface = blockTop;
    } else if (worldX >= -GUTTER_HALF && worldX <= GUTTER_HALF) {
      surface = gutterSurfaceY(worldX, BOOK_DIMENSIONS, 1);
    } else {
      surface = OPEN_COVER.topY;
    }
    worstBelowSurface = Math.min(
      worstBelowSurface,
      p.y - PAGE_SHELL_HALF - surface,
    );
  }
}

let minY = Infinity;
let maxY = -Infinity;
let nan = false;
for (const p of sim.particles) {
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)) {
    nan = true;
  }
  if (p.y < minY) minY = p.y;
  if (p.y > maxY) maxY = p.y;
}

let foreY = 0;
for (const i of foreEdgeIndices) foreY += sim.particles[i].y;
foreY /= foreEdgeIndices.length;
const spine = sim.particles[spineIndices[0]];
const spineY = spine.y;
const spineX = spine.x + W / 2;

const spread = maxY - minY;

console.log(
  `cover: lowestY=${(worstLowest * 1000).toFixed(2)}mm ` +
    `boardInBlock=${boardInBlock} topY=${(expectedTop * 1000).toFixed(2)}mm ` +
    `gutterEdge=${(edgeY * 1000).toFixed(3)}mm gutterMid=${(middleY * 1000).toFixed(3)}mm`,
);
console.log(
  `page: belowSurface=${worstBelowSurface === Infinity ? "none" : `${(worstBelowSurface * 1000).toFixed(3)}mm`} ` +
    `spine=(${(spineX * 1000).toFixed(3)},${(spineY * 1000).toFixed(3)})mm ` +
    `binding=(${(BINDING.x * 1000).toFixed(3)},${(BINDING.y * 1000).toFixed(3)})mm ` +
    `foreEdgeY=${(foreY * 1000).toFixed(3)}mm spread=${(spread * 1000).toFixed(2)}mm nan=${nan}`,
);

if (nan) fail("NaN particle");
if (worstBelowSurface < -1e-6) {
  fail(`page sinks into the book by ${-worstBelowSurface * 1000}mm`);
}
if (!approx(spineX, BINDING.x - SPINE_PANEL_W, 1e-9)) {
  fail(`spine edge x ${spineX} != shifted binding x ${BINDING.x - SPINE_PANEL_W}`);
}
const landSpineY = Math.max(BINDING.y, COVER_FLOOR);
if (!approx(spineY, landSpineY, 1e-9)) {
  fail(`spine edge y ${spineY} != landing spine y ${landSpineY}`);
}
if (!approx(foreY, landY, 1e-9)) {
  fail(`fore-edge did not settle to landY (${foreY} vs ${landY})`);
}
if (!(spineY < landY - 1e-4)) {
  fail("spine edge is not below the stack height (gutter not curved)");
}
if (spread > 0.0015) {
  fail(`landed page is not smooth enough (spread ${spread * 1000}mm)`);
}

console.log("PASS: cover opens, gutter is curved, and the page rests on the cover");