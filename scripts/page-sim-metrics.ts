/**
 * Headless page-turn quality metrics (no rendering). Mirrors the demo's
 * single-page setup: a CLOSED-book page turning from a tall right stack, over a
 * gutter, down onto a low left stack. Uses the real PageTurnController and a
 * heightfield collision.
 *
 * Reports: stretch, dihedral (fold angle), curl (in-plane bow, mid row),
 * penetration (free particles below the local book surface), nan, fore-edge pos.
 *
 * Tune via env: BEND, ITERS, BENDSPANS, LIFTSCALE, LEAD, LIFTVAR, W, H, DUR,
 *                SETTLE, COLS, ROWS
 * Run: npm run test:page
 */
import { PaperSimulation } from "../src/physics/PaperSimulation";
import { PageTurnController } from "../src/animation/PageTurnController";
import { BOOK_DIMENSIONS } from "../src/config/bookConfig";
import { openCoverSurface } from "../src/book/coverRig";
import {
  LINING_INSET,
  gutterBinding,
  gutterParticleFloorY,
} from "../src/book/gutterRig";

const W = Number(process.env.W ?? 0.24);
const H = Number(process.env.H ?? 0.31);
const COLS = Number(process.env.COLS ?? 25);
const ROWS = Number(process.env.ROWS ?? 33);
const BEND = Number(process.env.BEND ?? 1.0);
const ITERS = Number(process.env.ITERS ?? 12);
const BENDSTIFF = Number(process.env.BENDSTIFF ?? 0.5);
const BENDSPANS = (process.env.BENDSPANS ?? "3,4,5,6")
  .split(",")
  .map((s) => Number(s.trim()))
  .filter((n) => Number.isFinite(n) && n > 0);
const LIFTSCALE = Number(process.env.LIFTSCALE ?? 0.6);
const LEAD = Number(process.env.LEAD ?? 0.04);
const LIFTVAR = Number(process.env.LIFTVAR ?? 0.06);
const DUR = Number(process.env.DUR ?? 2.5);
const SETTLE = Number(process.env.SETTLE ?? 1.0);
const CT = BOOK_DIMENSIONS.coverThickness;
const PBT = 0.022;
const blockTop = CT + PBT;
const gutterX = -W / 2;
const restY = Number(process.env.RESTY ?? blockTop + 0.0005);

// Open-cover collision surface (mirrors the demo).
const OPEN_COVER = openCoverSurface(BOOK_DIMENSIONS, CT / 2);
const PAGE_SHELL_HALF = 0.000125;
const COVER_GAP = 0.00005;
const COVER_FLOOR = OPEN_COVER.topY + PAGE_SHELL_HALF + COVER_GAP;
const landY = Number(process.env.LANDY ?? COVER_FLOOR + 0.0002);
const DT = 1 / 120;

// Curved gutter (mirrors the demo).
const GUTTER_HALF = BOOK_DIMENSIONS.width * LINING_INSET;
const BLOCK_INNER_X = 0.005;
const BINDING = gutterBinding(0.5, BOOK_DIMENSIONS);

function clamp01(x: number) {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

const groundHeight = (x: number, _z: number): number => {
  const worldX = x + W / 2;
  if (worldX >= BLOCK_INNER_X) return blockTop;
  if (worldX >= -GUTTER_HALF && worldX <= GUTTER_HALF) {
    return gutterParticleFloorY(worldX, BOOK_DIMENSIONS, 1);
  }
  return COVER_FLOOR;
};

const sim = new PaperSimulation({
  cols: COLS,
  rows: ROWS,
  width: W,
  height: H,
  dt: DT,
  iterations: ITERS,
  bendStiffness: BEND,
  longRangeBend: true,
  bendSpans: BENDSPANS,
  longRangeStiffness: BENDSTIFF,
  plane: "xz",
  groundHeight,
});
for (const p of sim.particles) p.y = p.py = restY;
const foreEdge: number[] = [];
const spineEdge: number[] = [];
for (let r = 0; r < ROWS; r++) {
  spineEdge.push(r * COLS + 0);
  foreEdge.push(r * COLS + (COLS - 1));
}

const controller = new PageTurnController({
  foreEdgeIndices: foreEdge,
  spineIndices: spineEdge,
  gutterX,
  restY,
  landY,
  landSpineY: BINDING.y,
  spineTargetX: BINDING.x - W / 2,
  landSpineStart: 0.5,
  width: W,
  duration: DUR,
  liftScale: LIFTSCALE,
  lead: LEAD,
  liftVar: LIFTVAR,
  rows: ROWS,
});
controller.seedZ(sim.particles);
controller.setProgress(0);
controller.apply(sim.particles);

function chordCurl(): number {
  const r = Math.floor(ROWS / 2);
  const s = sim.particles[r * COLS + 0];
  const f = sim.particles[r * COLS + (COLS - 1)];
  const abx = f.x - s.x, aby = f.y - s.y;
  const abLen = Math.hypot(abx, aby) || 1;
  let maxD = 0;
  for (let c = 0; c < COLS; c++) {
    const p = sim.particles[r * COLS + c];
    const t = ((p.x - s.x) * abx + (p.y - s.y) * aby) / (abLen * abLen);
    const cx = s.x + abx * t, cy = s.y + aby * t;
    maxD = Math.max(maxD, Math.hypot(p.x - cx, p.y - cy));
  }
  return maxD;
}

function metrics(label: string) {
  const P = sim.particles;
  let maxStretch = 0;
  for (const c of sim.topology.constraints) {
    const a = P[c.a], b = P[c.b];
    maxStretch = Math.max(maxStretch, Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) / c.restLength);
  }
  const cellNormal = (c: number, r: number) => {
    const i0 = r * COLS + c;
    const p0 = P[i0], p1 = P[i0 + 1], p2 = P[i0 + COLS];
    const e1x = p1.x - p0.x, e1y = p1.y - p0.y, e1z = p1.z - p0.z;
    const e2x = p2.x - p0.x, e2y = p2.y - p0.y, e2z = p2.z - p0.z;
    let nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
    const l = Math.hypot(nx, ny, nz) || 1;
    return { x: nx / l, y: ny / l, z: nz / l };
  };
  let maxDihedral = 0;
  for (let r = 0; r < ROWS - 1; r++) {
    for (let c = 0; c < COLS - 1; c++) {
      const n = cellNormal(c, r);
      if (c < COLS - 2) {
        const nr = cellNormal(c + 1, r);
        maxDihedral = Math.max(maxDihedral, (Math.acos(Math.max(-1, Math.min(1, n.x * nr.x + n.y * nr.y + n.z * nr.z))) * 180) / Math.PI);
      }
      if (r < ROWS - 2) {
        const nr = cellNormal(c, r + 1);
        maxDihedral = Math.max(maxDihedral, (Math.acos(Math.max(-1, Math.min(1, n.x * nr.x + n.y * nr.y + n.z * nr.z))) * 180) / Math.PI);
      }
    }
  }
  let nan = false;
  let penetration = 0;
  for (const p of P) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)) nan = true;
    if (!p.pinned && p.y < groundHeight(p.x, p.z) - 0.0004) penetration++;
  }
  let fx = 0, fy = 0;
  for (const i of foreEdge) { fx += P[i].x; fy += P[i].y; }
  fx /= foreEdge.length; fy /= foreEdge.length;
  const curl = chordCurl();
  console.log(
    `${label}: stretch=${maxStretch.toFixed(2)}x dihedral=${maxDihedral.toFixed(1)} curl=${(curl * 100).toFixed(1)}cm ` +
      `penetration=${penetration} nan=${nan} foreEdgeX=${fx.toFixed(3)} foreEdgeY=${fy.toFixed(3)}`,
  );
  return { maxStretch, maxDihedral, curl, penetration, nan, foreEdgeX: fx, foreEdgeY: fy };
}

const turnSteps = Math.round(DUR / DT);
const settleSteps = Math.round(SETTLE / DT);
let worst = { stretch: 0, dihedral: 0, penetration: 0, nan: false, maxCurl: 0 };
for (let s = 0; s <= turnSteps + settleSteps; s++) {
  const progress = clamp01((s * DT) / DUR);
  controller.setProgress(progress);
  controller.apply(sim.particles);
  sim.step();
  if (s % Math.max(1, Math.round(turnSteps / 4)) === 0 || s === turnSteps || s === turnSteps + settleSteps) {
    const m = metrics(`s=${s}(${(s * DT).toFixed(2)}s)`);
    worst.stretch = Math.max(worst.stretch, m.maxStretch);
    worst.dihedral = Math.max(worst.dihedral, m.maxDihedral);
    worst.penetration = Math.max(worst.penetration, m.penetration);
    worst.maxCurl = Math.max(worst.maxCurl, m.curl);
    if (m.nan) worst.nan = true;
  }
}
const final = metrics("FINAL");
console.log(
  `SUMMARY: worstStretch=${worst.stretch.toFixed(2)}x worstDihedral=${worst.dihedral.toFixed(1)}deg ` +
    `maxCurl=${(worst.maxCurl * 100).toFixed(1)}cm worstPenetration=${worst.penetration} nan=${worst.nan} ` +
    `crossed=${final.foreEdgeX < 0}`,
);