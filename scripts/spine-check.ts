/**
 * Animated spine + endpaper check (headless).
 *
 * The spine is what makes the case read as a real hardcover instead of a
 * rectangular bar. This test validates the cross-section kinematics without a
 * browser:
 *
 * 1. Attachments
 *    - the strip starts on the back board's edge (fixed)
 *    - it ends on the front board's outer hinge corner (moves with the cover)
 *
 * 2. Shape
 *    - the section stays on the outer side of its chord (it bulges outward)
 *    - it never dips below the table
 *    - it never enters the back board, the page block, or (before the cover is
 *      past vertical) the front board
 *
 * 3. Opening response
 *    - closed: a real bulge around the page block (>= 3.5 mm proud, left of x=0)
 *    - half open: still outside the raised cover
 *    - open: tucked inside the spine hollow (inside the plinth footprint and
 *      below the cover lining), and flush (no bulge)
 *
 * 4. Shell mesh
 *    - the generated geometry has finite vertices and the expected layout
 *
 * Run: npm run test:spine
 */
import { BOOK_DIMENSIONS } from "../src/config/bookConfig";
import { coverPose } from "../src/book/coverRig";
import { gutterHalfWidth, liningTopY } from "../src/book/gutterRig";
import { createBookMaterials } from "../src/book/materials";
import { createSpineRig } from "../src/book/spine";
import {
  type Point2,
  type SpinePose,
  spineBackPoint,
  spineChord,
  spineCrossSection,
  spineFrontPoint,
  spineProtrusion,
} from "../src/book/caseSpineRig";

const W = BOOK_DIMENSIONS.width;
const H = BOOK_DIMENSIONS.height;
const CT = BOOK_DIMENSIONS.coverThickness;
const PBT = 0.022;
const blockTop = CT + PBT;
const BLOCK_INNER_X = 0.005;
const NUM_SHEETS = 15;
const vStep = 0.0003;
const restBase = blockTop + 0.0004;
const restY = restBase + (NUM_SHEETS - 1) * vStep;
const closedCenterY = restY + 0.0005 + CT / 2;
const OPEN_CENTER_Y = CT / 2;
const GUTTER_HALF = gutterHalfWidth(BOOK_DIMENSIONS);
const LINING_TOP = liningTopY(BOOK_DIMENSIONS);

const EPS = 1e-9;

function fail(msg: string): never {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

function approx(a: number, b: number, eps = 1e-9): boolean {
  return Math.abs(a - b) <= eps;
}

function poseAt(u: number): SpinePose {
  const pose = coverPose(u, closedCenterY, OPEN_CENTER_Y);
  return { u, hingeY: pose.hingeY, angle: pose.angle };
}

/** Outward-facing signed distance of p from the attachment chord. */
function outwardDistance(
  p: Point2,
  a: Point2,
  b: Point2,
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-12) return 0;
  const nx = -dy / len;
  const ny = dx / len;
  return (p.x - a.x) * nx + (p.y - a.y) * ny;
}

const SAMPLES = 41;
let worstBelowTable = Infinity;
let worstOutward = Infinity;
const badBackBoard: string[] = [];
const badBlock: string[] = [];
const badFrontBoard: string[] = [];
let nan = false;

for (let s = 0; s <= 400; s++) {
  const u = s / 400;
  const pose = poseAt(u);
  const a = spineBackPoint(BOOK_DIMENSIONS);
  const b = spineFrontPoint(BOOK_DIMENSIONS, pose);
  const section = spineCrossSection(BOOK_DIMENSIONS, pose, SAMPLES);

  // Endpoints must coincide with the attachment points.
  if (!approx(section[0].x, a.x, 1e-6) || !approx(section[0].y, a.y, 1e-6)) {
    fail(`u=${u.toFixed(3)}: spine does not start on the back board edge`);
  }
  const last = section[section.length - 1];
  if (!approx(last.x, b.x, 1e-6) || !approx(last.y, b.y, 1e-6)) {
    fail(`u=${u.toFixed(3)}: spine does not end on the front hinge corner`);
  }

  const cos = Math.cos(pose.angle);
  const sin = Math.sin(pose.angle);
  for (const p of section) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) nan = true;
    worstBelowTable = Math.min(worstBelowTable, p.y);
    worstOutward = Math.min(worstOutward, outwardDistance(p, a, b));

    // Inside the back board (x 0..W, y 0..CT)?
    if (p.x > 1e-6 && p.x < W - 1e-6 && p.y > 1e-6 && p.y < CT - 1e-6) {
      badBackBoard.push(`u=${u.toFixed(3)} (${(p.x * 1000).toFixed(2)},${(p.y * 1000).toFixed(2)})mm`);
    }
    // Inside the page block?
    if (
      p.x > BLOCK_INNER_X + 1e-6 &&
      p.x < W - 1e-6 &&
      p.y > CT + 1e-6 &&
      p.y < blockTop - 1e-6
    ) {
      badBlock.push(`u=${u.toFixed(3)}`);
    }
    // Inside the front board while it is still raised (u <= 0.55). Later the
    // strip is meant to tuck into the closed case/hollow.
    if (u <= 0.55) {
      const qx = p.x;
      const qy = p.y - pose.hingeY;
      const lx = qx * cos + qy * sin; // R(-angle)
      const ly = -qx * sin + qy * cos;
      if (lx > 1e-6 && lx < W - 1e-6 && ly > -CT / 2 + 1e-6 && ly < CT / 2 - 1e-6) {
        badFrontBoard.push(`u=${u.toFixed(3)}`);
      }
    }
  }
}

if (nan) fail("spine cross-section produced NaN");
if (worstBelowTable < -EPS) {
  fail(`spine goes below the table by ${(-worstBelowTable * 1000).toFixed(3)}mm`);
}
if (worstOutward < -1e-7) {
  fail(`spine crosses to the inner side of its chord by ${(-worstOutward * 1000).toFixed(3)}mm`);
}
if (badBackBoard.length > 0) {
  fail(`spine enters the back board: ${badBackBoard.slice(0, 3).join(", ")}`);
}
if (badBlock.length > 0) {
  fail(`spine enters the page block: ${badBlock.slice(0, 3).join(", ")}`);
}
if (badFrontBoard.length > 0) {
  fail(`spine enters the raised front cover: ${badFrontBoard.slice(0, 3).join(", ")}`);
}

// --- Closed pose -----------------------------------------------------------
const closedPose = poseAt(0);
const closedSection = spineCrossSection(BOOK_DIMENSIONS, closedPose, SAMPLES);
const closedChord = spineChord(BOOK_DIMENSIONS, closedPose);
let closedMinX = Infinity;
let closedMaxX = -Infinity;
for (const p of closedSection) {
  closedMinX = Math.min(closedMinX, p.x);
  closedMaxX = Math.max(closedMaxX, p.x);
}
const closedBulge = spineProtrusion(BOOK_DIMENSIONS, 0);
if (!(closedChord > CT * 5)) {
  fail(`closed spine chord too short (${(closedChord * 1000).toFixed(2)}mm)`);
}
if (!(closedBulge >= 0.0035)) {
  fail(`closed spine bulge too shallow (${(closedBulge * 1000).toFixed(2)}mm)`);
}
if (!(closedMinX <= -0.003)) {
  fail(`closed spine does not bulge outward (minX ${(closedMinX * 1000).toFixed(2)}mm)`);
}
if (!(Math.abs(closedMaxX) <= 1e-6)) {
  fail(`closed spine leaks into the book (maxX ${(closedMaxX * 1000).toFixed(2)}mm)`);
}

// --- Half-open pose --------------------------------------------------------
const halfSection = spineCrossSection(BOOK_DIMENSIONS, poseAt(0.5), SAMPLES);
let halfMinX = Infinity;
for (const p of halfSection) halfMinX = Math.min(halfMinX, p.x);
if (!(halfMinX < -0.001)) {
  fail(`mid-open spine is not outside the raised cover (minX ${(halfMinX * 1000).toFixed(2)}mm)`);
}

// --- Open pose: tucked into the hollow -------------------------------------
const openPose = poseAt(1);
const openSection = spineCrossSection(BOOK_DIMENSIONS, openPose, SAMPLES);
let openMinY = Infinity;
let openMaxY = -Infinity;
let openMinX = Infinity;
let openMaxX = -Infinity;
for (const p of openSection) {
  openMinY = Math.min(openMinY, p.y);
  openMaxY = Math.max(openMaxY, p.y);
  openMinX = Math.min(openMinX, p.x);
  openMaxX = Math.max(openMaxX, p.x);
}
const openBulge = spineProtrusion(BOOK_DIMENSIONS, 1);
if (!(Math.abs(openBulge) < 1e-9)) {
  fail(`open spine still bulges (${(openBulge * 1000).toFixed(3)}mm)`);
}
if (!(openMaxX <= GUTTER_HALF + 1e-6 && openMinX >= -GUTTER_HALF - 1e-6)) {
  fail(
    `open spine leaves the gutter footprint ` +
      `(x ${(openMinX * 1000).toFixed(2)}..${(openMaxX * 1000).toFixed(2)}mm)`,
  );
}
if (!(openMaxY <= LINING_TOP + 1e-6)) {
  fail(`open spine rises above the cover lining (${(openMaxY * 1000).toFixed(2)}mm)`);
}
if (openMinY < -EPS) fail("open spine dips below the table");

// --- Monotonic tuck --------------------------------------------------------
const p0 = spineProtrusion(BOOK_DIMENSIONS, 0);
const p75 = spineProtrusion(BOOK_DIMENSIONS, 0.75);
const p90 = spineProtrusion(BOOK_DIMENSIONS, 0.9);
if (!(p0 > p75 && p75 > p90)) {
  fail(
    `spine bulge is not monotonically tucked ` +
      `(${(p0 * 1000).toFixed(2)} / ${(p75 * 1000).toFixed(2)} / ${(p90 * 1000).toFixed(2)}mm)`,
  );
}

// --- Shell mesh ------------------------------------------------------------
const materials = createBookMaterials();
const rig = createSpineRig(BOOK_DIMENSIONS, materials, { originX: 0 });
const pos = rig.mesh.geometry.getAttribute("position");
const expectedVerts = (6 + 1) * (24 + 1) * 2;
if (pos.count !== expectedVerts) {
  fail(`spine shell has ${pos.count} vertices, expected ${expectedVerts}`);
}
for (const u of [0, 0.25, 0.5, 0.75, 1]) {
  rig.update(poseAt(u));
  const attr = rig.mesh.geometry.getAttribute("position");
  for (let i = 0; i < attr.count * 3; i++) {
    if (!Number.isFinite(attr.array[i] as number)) {
      fail(`spine shell vertex NaN at u=${u}`);
    }
  }
  const b = rig.bounds();
  if (!(b.minX >= -0.05 && b.maxX <= 0.01)) {
    fail(`spine shell bounds look wrong at u=${u}: ${JSON.stringify(b)}`);
  }
}
if (materials.spine.side !== 2) {
  fail("spine material must be double-sided for a closed shell");
}

console.log(
  `closed: chord=${(closedChord * 1000).toFixed(2)}mm ` +
    `bulge=${(closedBulge * 1000).toFixed(2)}mm x=${(closedMinX * 1000).toFixed(2)}..` +
    `${(closedMaxX * 1000).toFixed(2)}mm`,
);
console.log(
  `open:   x=${(openMinX * 1000).toFixed(2)}..${(openMaxX * 1000).toFixed(2)}mm ` +
    `y=${(openMinY * 1000).toFixed(2)}..${(openMaxY * 1000).toFixed(2)}mm ` +
    `bulge=${(openBulge * 1000).toFixed(3)}mm`,
);
console.log(
  `mid:    minX=${(halfMinX * 1000).toFixed(2)}mm ` +
    `bounds=${pos.count} verts, outwardMargin=${(worstOutward * 1000).toFixed(4)}mm`,
);
console.log("PASS: spine is curved, attaches to the hinge, and tucks into the hollow");
