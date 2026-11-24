/**
 * Cover opening + bound spine + page/cover collision check (headless).
 *
 * 1. Cover kinematics
 *    - hinged at the spine: closed at one end, flat on the left at the other
 *    - monotonic swing; never below the table; never inside the page block
 *
 * 2. Bound spine
 *    - the cloth plane is flat at the cover lining height between the hinges
 *    - the text-block wedge starts at the cloth at the spine and reaches the
 *      flat block top over BIND_RAMP
 *    - the sheets fan out from the spine plane in stack order
 *
 * 3. Page landing
 *    - one page turns exactly like the demo (right-stack height, open-cover
 *      floor, bound spine) and comes to rest on the cover
 *    - its spine edge lands at the front cover hinge at its binding height
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
import { spineCoverGeometry } from "../src/book/spineRig";
import {
  BIND_RAMP,
  bindingFloorY,
  blockRampY,
  fanIndex,
  rightSheetY,
  spineClothTopY,
  spineFanY,
  spinePlaneEdges,
} from "../src/book/spineBinding";

const W = BOOK_DIMENSIONS.width;
const H = BOOK_DIMENSIONS.height;
const CT = BOOK_DIMENSIONS.coverThickness;
const PBT = 0.022;
const SPINE_PANEL_W = 2 * CT + PBT; // case spine width = closed thickness
const SPINE_TURN_IN = 0.003; // cloth turn-in onto the boards
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

// Spine binding (mirrors the demo): the top sheet binds highest on the spine
// plane and lands first, i.e. at the bottom of the left stack.
const SPINE_REST_Y = spineFanY(BOOK_DIMENSIONS, fanIndex(0, NUM_SHEETS));
const LAND_SPINE_Y = spineFanY(BOOK_DIMENSIONS, 0);
const SPINE_CLOTH_Y = spineClothTopY(BOOK_DIMENSIONS);
const blockLeftLocal = gutterX;
const belowSpineY = spineFanY(BOOK_DIMENSIONS, fanIndex(1, NUM_SHEETS));

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
  x0: 0,
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

// --- 3. Spine binding plane -----------------------------------------------
// The cloth plane spans the two cover hinges and is flat at the lining height.
if (!approx(SPINE_CLOTH_Y, expectedTop)) {
  fail(`spine cloth ${SPINE_CLOTH_Y} != lining top`);
}
if (!(SPINE_REST_Y > SPINE_CLOTH_Y)) fail("spine binding is not above the cloth");
// The text-block wedge starts at the cloth height at the spine and reaches the
// flat block top at BIND_RAMP.
if (!approx(blockRampY(0, BOOK_DIMENSIONS, blockTop), SPINE_CLOTH_Y)) {
  fail("block ramp does not start at the cloth");
}
if (!approx(blockRampY(BIND_RAMP, BOOK_DIMENSIONS, blockTop), blockTop)) {
  fail("block ramp does not reach the block top");
}
// The sheets fan out from the spine plane in stack order: the top sheet binds
// highest, the bottom sheet lowest.
for (let k = 1; k < 8; k++) {
  const above = spineFanY(BOOK_DIMENSIONS, fanIndex(k - 1, NUM_SHEETS));
  const below = spineFanY(BOOK_DIMENSIONS, fanIndex(k, NUM_SHEETS));
  if (!(below < above)) fail("spine fan is not ordered");
}
// The plane's front edge is the FRONT COVER's inner lining point at its moving
// hinge, so the plane is bounded by the cover at every opening angle.
for (const u of [0, 0.25, 0.5, 0.75, 1]) {
  const edges = spinePlaneEdges(
    u,
    BOOK_DIMENSIONS,
    closedCenterY,
    OPEN_CENTER_Y,
    SPINE_PANEL_W,
  );
  const pose = coverPose(
    u,
    closedCenterY,
    OPEN_CENTER_Y,
    HINGE_DROP_START,
    SPINE_PANEL_W,
  );
  const off = BOOK_DIMENSIONS.coverThickness * 0.6;
  const expectedFrontX = pose.hingeX + off * Math.sin(pose.angle);
  const expectedFrontY = pose.hingeY - off * Math.cos(pose.angle);
  if (!approx(edges.back.x, 0, 1e-9) || !approx(edges.back.y, SPINE_CLOTH_Y, 1e-9)) {
    fail(`spine plane back edge is not on the back lining at u=${u}`);
  }
  if (
    !approx(edges.front.x, expectedFrontX, 1e-9) ||
    !approx(edges.front.y, expectedFrontY, 1e-9)
  ) {
    fail(`spine plane front edge does not follow the front cover at u=${u}`);
  }
}

// --- 4. Page landing on the cover -----------------------------------------
const hf = new Heightfield({ width: W, height: H, nx: 110, nz: 110 });
hf.setBase((x) => bindingFloorY(x + W / 2, BOOK_DIMENSIONS, blockTop, COVER_FLOOR));

const groundHeight = (x: number, z: number): number => {
  const h = hf.heightAt(x, z);
  if (x < blockLeftLocal) return h;
  const below = rightSheetY(x + W / 2, belowSpineY, belowRestY) + 0.00025;
  return Math.max(below, h);
};

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
for (const p of sim.particles) {
  p.y = p.py = rightSheetY(p.x + W / 2, SPINE_REST_Y, restY);
}

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
  spineRestY: SPINE_REST_Y,
  landY,
  landSpineY: LAND_SPINE_Y,
  spineTargetX: gutterX,
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
    if (worldX >= BIND_RAMP) {
      surface = blockTop;
    } else if (worldX >= 0) {
      surface = blockRampY(worldX, BOOK_DIMENSIONS, blockTop);
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
    `spineCloth=${(SPINE_CLOTH_Y * 1000).toFixed(3)}mm bindRamp=${(BIND_RAMP * 1000).toFixed(1)}mm`,
);
console.log(
  `page: belowSurface=${worstBelowSurface === Infinity ? "none" : `${(worstBelowSurface * 1000).toFixed(3)}mm`} ` +
    `spine=(${(spineX * 1000).toFixed(3)},${(spineY * 1000).toFixed(3)})mm ` +
    `binding=(0.000,${(SPINE_REST_Y * 1000).toFixed(3)})mm ` +
    `foreEdgeY=${(foreY * 1000).toFixed(3)}mm spread=${(spread * 1000).toFixed(2)}mm nan=${nan}`,
);

if (nan) fail("NaN particle");
if (worstBelowSurface < -1e-6) {
  fail(`page sinks into the book by ${-worstBelowSurface * 1000}mm`);
}
if (!approx(spineX, -SPINE_PANEL_W, 1e-9)) {
  fail(`spine edge x ${spineX} != front hinge ${-SPINE_PANEL_W}`);
}
if (!approx(spineY, LAND_SPINE_Y, 1e-9)) {
  fail(`spine edge y ${spineY} != landing spine y ${LAND_SPINE_Y}`);
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

// --- Spine shell (C-section) ---------------------------------------------
for (const u of [0, 0.25, 0.5, 0.75, 1]) {
  const geo = spineCoverGeometry(u, BOOK_DIMENSIONS, closedCenterY, OPEN_CENTER_Y, SPINE_PANEL_W, SPINE_TURN_IN);
  const pos = geo.getAttribute("position");
  const pose = coverPose(u, closedCenterY, OPEN_CENTER_Y, HINGE_DROP_START, SPINE_PANEL_W);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (!Number.isFinite(x + y + z)) fail(`spine shell NaN at u=${u}`);
    // The front turn-in lies 0.1 mm under the opened cover (hidden by the
    // table); allow that tolerance, not a visible dip.
    if (y < -0.0002) fail(`spine shell below table at u=${u}: y=${y}`);
    // Never enter the back board interior (overlap eps is allowed).
    if (x > 0.0002 && x < W - 1e-6 && y > 0.0002 && y < CT - 1e-5) {
      fail(`spine shell enters back board at u=${u} (${(x * 1000).toFixed(2)},${(y * 1000).toFixed(2)})mm`);
    }
    // Never enter the page block.
    if (x > 0.0001 && x < W - 1e-6 && y > CT + 1e-5 && y < blockTop - 1e-5) {
      fail(`spine shell enters block at u=${u}`);
    }
    // Never enter the front board interior while raised.
    if (u <= 0.55) {
      const c = Math.cos(pose.angle), s = Math.sin(pose.angle);
      const lx = (x - pose.hingeX) * c + (y - pose.hingeY) * s;
      const ly = -(x - pose.hingeX) * s + (y - pose.hingeY) * c;
      if (lx > 0.0002 && lx < W - 1e-6 && ly > -CT / 2 + 1e-5 && ly < CT / 2 - 1e-5) {
        fail(`spine shell enters front board at u=${u}`);
      }
    }
  }
  if (u === 1) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      minX = Math.min(minX, pos.getX(i));
      maxX = Math.max(maxX, pos.getX(i));
      minY = Math.min(minY, pos.getY(i));
      maxY = Math.max(maxY, pos.getY(i));
    }
    if (!approx(minX, -SPINE_PANEL_W - SPINE_TURN_IN, 0.0002)) fail(`open shell minX ${(minX * 1000).toFixed(2)}mm`);
    if (!approx(maxX, SPINE_TURN_IN, 0.0002)) fail(`open shell maxX ${(maxX * 1000).toFixed(2)}mm`);
    if (minY < -0.0002) fail(`open shell minY ${(minY * 1000).toFixed(2)}mm`);
    if (!approx(maxY, CT, 0.0002)) fail(`open shell maxY ${(maxY * 1000).toFixed(2)}mm`);
  }
  if (u === 0) {
    let minX = Infinity;
    for (let i = 0; i < pos.count; i++) minX = Math.min(minX, pos.getX(i));
    if (!(minX <= -0.01)) fail(`closed shell not bulged outward (minX ${(minX * 1000).toFixed(2)}mm)`);
  }
  geo.dispose();
}

console.log("PASS: cover opens, the spine is bound, and the page rests on the cover");
