/**
 * Cover opening + page/cover collision check (headless, no rendering).
 *
 * 1. Cover kinematics
 *    - the board is hinged at the spine: closed at one end, flat on the left
 *      at the other, with a monotonic swing
 *    - the board/lining never goes below the table
 *    - the board never enters the page block's volume
 *
 * 2. Open-cover surface
 *    - the top surface is the inner lining height
 *    - points outside the board footprint fall back to the table
 *
 * 3. Page landing on the cover
 *    - one page turns exactly like the demo (same right-stack height, open
 *      cover floor, spine settle) and comes to rest on the cover
 *    - no part of the page goes below the cover surface
 *    - the landed page is flat (spine and fore-edge both on the left stack)
 *
 * Run: npm run test:cover
 */
import { PaperSimulation } from "../src/physics/PaperSimulation";
import { PageTurnController } from "../src/animation/PageTurnController";
import { Heightfield } from "../src/physics/Heightfield";
import { BOOK_DIMENSIONS } from "../src/config/bookConfig";
import {
  LINING_PROTRUSION,
  coverLowestY,
  coverPose,
  openCoverSurface,
  openCoverTopAt,
} from "../src/book/coverRig";

const W = BOOK_DIMENSIONS.width;
const H = BOOK_DIMENSIONS.height;
const CT = BOOK_DIMENSIONS.coverThickness;
const PBT = 0.012;
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
const OPEN_COVER = openCoverSurface(BOOK_DIMENSIONS, OPEN_CENTER_Y);
const PAGE_SHELL_HALF = 0.000125;
const COVER_GAP = 0.00005;
const COVER_FLOOR = OPEN_COVER.topY + PAGE_SHELL_HALF + COVER_GAP;
const landY = COVER_FLOOR + 0.0002;
const topSheetY = restY;
const closedCenterY = topSheetY + 0.0005 + CT / 2;

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
  x0: W / 2 - (W * 0.96) / 2,
  x1: W / 2 + (W * 0.96) / 2,
  y0: CT,
  y1: blockTop,
};

for (let s = 0; s <= 400; s++) {
  const u = s / 400;
  const pose = coverPose(u, closedCenterY, OPEN_CENTER_Y);
  worstLowest = Math.min(worstLowest, coverLowestY(pose, BOOK_DIMENSIONS));

  const cos = Math.cos(pose.angle);
  const sin = Math.sin(pose.angle);
  for (const q of localPts) {
    // Cover-group point (q.x + W/2, q.y) rotated about the spine.
    const x = (q.x + W / 2) * cos - q.y * sin;
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

const closed = coverPose(0, closedCenterY, OPEN_CENTER_Y);
const open = coverPose(1, closedCenterY, OPEN_CENTER_Y);
if (!approx(closed.angle, 0)) fail(`closed angle ${closed.angle}`);
if (!approx(closed.hingeY, closedCenterY, 1e-12)) fail("closed hinge height");
if (!approx(open.angle, Math.PI, 1e-12)) fail(`open angle ${open.angle}`);
if (!approx(open.hingeY, OPEN_CENTER_Y, 1e-12)) fail("open hinge height");
if (worstLowest < -1e-9) fail(`cover goes below table by ${-worstLowest * 1000}mm`);
if (boardInBlock > 0) fail(`${boardInBlock} cover samples inside the page block`);
if (nonMonotonic > 0) fail(`${nonMonotonic} non-monotonic cover samples`);

// --- 2. Open-cover surface -------------------------------------------------
const topInside = openCoverTopAt(-W / 2, 0, BOOK_DIMENSIONS, OPEN_CENTER_Y);
const topOutsideX = openCoverTopAt(0.05, 0, BOOK_DIMENSIONS, OPEN_CENTER_Y);
const topOutsideZ = openCoverTopAt(-W / 2, H, BOOK_DIMENSIONS, OPEN_CENTER_Y);
const expectedTop = OPEN_CENTER_Y + CT * (0.5 + LINING_PROTRUSION);
if (!approx(topInside, expectedTop)) fail(`open cover top ${topInside}`);
if (topOutsideX !== 0 || topOutsideZ !== 0) fail("cover footprint leaks outside board");
if (!approx(OPEN_COVER.topY, expectedTop)) fail("openCoverSurface topY");

// --- 3. Page landing on the cover -----------------------------------------
const hf = new Heightfield({ width: W, height: H, nx: 110, nz: 110 });
hf.setBase((x, z) =>
  x >= gutterX
    ? blockTop
    : openCoverTopAt(x + W / 2, z, BOOK_DIMENSIONS, OPEN_CENTER_Y) +
      PAGE_SHELL_HALF +
      COVER_GAP,
);

const groundHeight = (x: number, z: number): number =>
  x >= gutterX
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
  landSpineY: landY,
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

// Track cover penetration at every step, not just at the end.
let worstBelowCover = Infinity;
const steps = Math.round((DUR + SETTLE) / DT);
for (let s = 0; s <= steps; s++) {
  const progress = Math.min((s * DT) / DUR, 1);
  controller.setProgress(progress);
  controller.apply(sim.particles);
  sim.step();
  for (const p of sim.particles) {
    // Only the part of the sheet over the open cover matters.
    if (p.x < gutterX) {
      const coverTop = openCoverTopAt(
        p.x + W / 2,
        p.z,
        BOOK_DIMENSIONS,
        OPEN_CENTER_Y,
      );
      worstBelowCover = Math.min(
        worstBelowCover,
        p.y - PAGE_SHELL_HALF - coverTop,
      );
    }
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
const spineY = sim.particles[spineIndices[0]].y;

const spread = maxY - minY;

console.log(
  `cover: lowestY=${(worstLowest * 1000).toFixed(2)}mm ` +
    `boardInBlock=${boardInBlock} topY=${(expectedTop * 1000).toFixed(2)}mm ` +
    `floorY=${(COVER_FLOOR * 1000).toFixed(3)}mm`,
);
console.log(
  `page: belowCover=${worstBelowCover === Infinity ? "none" : `${(worstBelowCover * 1000).toFixed(3)}mm`} ` +
    `spineY=${(spineY * 1000).toFixed(3)}mm foreEdgeY=${(foreY * 1000).toFixed(3)}mm ` +
    `spread=${(spread * 1000).toFixed(2)}mm nan=${nan}`,
);

if (nan) fail("NaN particle");
if (worstBelowCover < -1e-6) {
  fail(`page sinks into the cover by ${-worstBelowCover * 1000}mm`);
}
if (!approx(spineY, landY, 1e-9)) {
  fail(`spine edge did not settle to landY (${spineY} vs ${landY})`);
}
if (!approx(foreY, landY, 1e-9)) {
  fail(`fore-edge did not settle to landY (${foreY} vs ${landY})`);
}
if (spread > 0.0015) {
  fail(`landed page is not flat enough (spread ${spread * 1000}mm)`);
}

console.log("PASS: cover opens without clipping and pages rest on the cover");
