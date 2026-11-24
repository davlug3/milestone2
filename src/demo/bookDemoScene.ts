import * as THREE from "three";
import { BOOK_DIMENSIONS } from "../config/bookConfig";
import { createBookMaterials } from "../book/materials";
import { createCover } from "../book/cover";
import { addStudioLighting } from "../rendering/lighting";
import { PaperSimulation } from "../physics/PaperSimulation";
import { ThickSheetGeometry } from "../paper/ThickSheetGeometry";
import { createPaperMaterial } from "../paper/PaperMaterial";
import { PageTurnController } from "../animation/PageTurnController";
import { Heightfield } from "../physics/Heightfield";
import { clamp01 } from "../animation/easing";
import {
  HINGE_DROP_START,
  coverPose,
  openCoverSurface,
} from "../book/coverRig";
import {
  BIND_RAMP,
  bindingFloorY,
  blockRampY,
  fanIndex,
  rightSheetY,
  spineClothTopY,
  spineFanY,
  spinePlaneEdges,
  spinePlaneY,
} from "../book/spineBinding";
import {
  headbandGeometry,
  spineCoverGeometry,
  updateSpineCoverGeometry,
} from "../book/spineRig";

/**
 * Animated hardcover book demo with a play/pause button.
 *
 * A CLOSED book (~15 visible sheets) rests on the right. On Play:
 *   1. the front cover swings open to the left, hinged at the spine
 *   2. 8 sheets turn right->left one at a time, accumulating on the opened
 *      cover, while 7 sheets remain on the right
 *
 * Realism / stability:
 *  - The cover is a rigid board hinged at the spine: it rotates about x=0 and
 *    its hinge line stays at the top of the block until past vertical, then
 *    settles to the table. No centre-line slide, no hop, no clipping through
 *    the page block or the table.
 *  - The gutter is a BOUND SPINE, not a trough. The pages are bound to a
 *    horizontal cloth plane between the two cover hinges (world x = 0 and
 *    x = -SPINE_PANEL_W). Every sheet's inner edge starts on that plane and
 *    ramps up to its own height in the stack, so the text block fans out of a
 *    continuous bound line instead of loose sheets floating beside a gap.
 *  - The pinned SPINE edge stays on the binding plane through the crossing and
 *    settles at the front hinge on the left, so a landed sheet curves up from
 *    the binding to its stack instead of cantilevering from the old height.
 *  - Long-range bending links distribute curvature (smooth curl, no crease).
 *  - Page-to-page collision via a heightfield: a shared Heightfield stores the
 *    top surface of everything below. Each landed sheet is baked into it (outer
 *    region only, leaving the gutter free so pages fan naturally). The active
 *    sheet collides against this, so it rests on the pages below it.
 *
 * Playback is deterministic in an absolute timeline `time` (seconds).
 */

const W = BOOK_DIMENSIONS.width;
const H = BOOK_DIMENSIONS.height;
const CT = BOOK_DIMENSIONS.coverThickness;
const PBT = 0.022;
// Case spine panel width: the closed book thickness. Open, it lies flat
// between the boards, so the open book is 2 * width + SPINE_PANEL_W long.
const SPINE_PANEL_W = 2 * CT + PBT;
// How far the spine cloth turns in onto the boards' outer faces (hides the
// board bevel at the hinge, so the case reads as one continuous surface).
const SPINE_TURN_IN = 0.003;
const NUM_TURNS = 8;
const NUM_STATIC = 7;
const NUM_SHEETS = NUM_TURNS + NUM_STATIC;

const FIXED_DT = 1 / 120;
const blockTop = CT + PBT;
const sheetVStep = 0.0003; // right-stack spacing (exaggerated for visibility)
const restBase = blockTop + 0.0004;

// --- Spine binding ---------------------------------------------------------
// The pages are bound on a cloth plane between the two cover hinges. A sheet's
// inner edge sits on this plane at `spineFanY` and ramps up to its stack height
// over BIND_RAMP. See src/book/spineBinding.ts.
const SPINE_Y = spinePlaneY(BOOK_DIMENSIONS);
const SPINE_CLOTH_Y = spineClothTopY(BOOK_DIMENSIONS);

// --- Cover geometry / collision -------------------------------------------
// The open front cover lies flat on the left; its inner lining is the top
// surface that landing pages must rest on.
const OPEN_COVER_CENTER_Y = CT / 2;
const OPEN_COVER = openCoverSurface(
  BOOK_DIMENSIONS,
  OPEN_COVER_CENTER_Y,
  SPINE_PANEL_W,
);
const PAGE_SHELL_HALF = 0.000125; // particle mid-surface to page face
const COVER_CONTACT_GAP = 0.00005;
// Particle-centre floor on the open cover (page underside just touches it).
const COVER_FLOOR_Y =
  OPEN_COVER.topY + PAGE_SHELL_HALF + COVER_CONTACT_GAP;
// Keep each page's fore-edge pin just above the floor, then stack upward.
const landBase = COVER_FLOOR_Y + 0.0002;
// Must exceed the bake clearance (0.0006) so each page lands just above the
// surface of the pages already stacked below it.
const landStep = 0.0008;

const TURN_DUR = 2.5;
const SETTLE_DUR = 0.5;

// --- Timeline --------------------------------------------------------------
interface TurnWindow {
  start: number;
  dur: number;
  settle: number;
}

const COVER_START = 0.6;
const COVER_END = 2.8; // 2.2 s hinge swing
const FIRST_TURN = 3.7;
const TURN_GAP = TURN_DUR + SETTLE_DUR + 0.3;

const TIMELINE = {
  coverStart: COVER_START,
  coverEnd: COVER_END,
  turns: Array.from({ length: NUM_TURNS }, (_, k) => ({
    start: FIRST_TURN + k * TURN_GAP,
    dur: TURN_DUR,
    settle: SETTLE_DUR,
  })) as TurnWindow[],
  end: FIRST_TURN + NUM_TURNS * TURN_GAP + 0.5,
};

interface PageInstance {
  sim: PaperSimulation;
  geo: ThickSheetGeometry;
  mesh: THREE.Mesh;
  controller: PageTurnController;
  window: TurnWindow;
  stepped: number;
  maxSteps: number;
  restY: number;
  landY: number;
  baked: boolean;
  /** Last `stepped` value at which the GPU geometry was refreshed. */
  geoStep: number;
}

export function startBookDemo(container: HTMLElement): () => void {
  // --- Renderer / scene / camera ------------------------------------------
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    // Prefer the discrete/high-performance GPU when the client has one. This
    // is only a hint: browsers without a usable GPU fall back automatically.
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0b0d);

  const camera = new THREE.PerspectiveCamera(
    42,
    window.innerWidth / window.innerHeight,
    0.01,
    100,
  );
  camera.position.set(0.03, 0.52, 0.72);
  camera.lookAt(0, 0.03, 0);

  addStudioLighting(scene);
  const pageKey = new THREE.DirectionalLight(0xffffff, 0.7);
  pageKey.position.set(0.2, 0.9, 0.3);
  scene.add(pageKey);
  // Soft fill over the gutter. The key light comes from the left, so the open
  // front cover shadows the gutter and the right block; without this fill the
  // curved spine hollow reads as a black band.
  const gutterFill = new THREE.DirectionalLight(0xfff4e8, 1.2);
  gutterFill.position.set(0.1, 1.0, 0.3);
  scene.add(gutterFill);

  // --- Ground --------------------------------------------------------------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 8),
    new THREE.MeshStandardMaterial({ color: 0x111317, roughness: 0.95 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // --- Static book parts (closed on the right; gutter at x=0) --------------
  const materials = createBookMaterials();

  const backCover = createCover(BOOK_DIMENSIONS, materials, "back");
  backCover.position.set(W / 2, CT / 2, 0);
  scene.add(backCover);

  // Text block: a wedge whose top follows the spine binding ramp. At the spine
  // (x = 0) the top is the cloth height; it rises to the flat block top over
  // BIND_RAMP. This is the surface the page stack sits on, so there is no
  // vertical wall in the gutter for a turning page to cut through.
  const topSheetY = restBase + (NUM_SHEETS - 1) * sheetVStep;
  const coverBottom = topSheetY + 0.0005;
  const closedCenterY = coverBottom + CT / 2;
  const blockDepth = H * 0.97;
  const blockWidth = W - 0.004; // 4 mm fore-edge square under the cover
  const blockShape = new THREE.Shape();
  blockShape.moveTo(0, CT);
  blockShape.lineTo(0, SPINE_CLOTH_Y);
  const rampSegments = 24;
  for (let i = 1; i <= rampSegments; i++) {
    const x = (BIND_RAMP * i) / rampSegments;
    blockShape.lineTo(x, blockRampY(x, BOOK_DIMENSIONS, blockTop));
  }
  blockShape.lineTo(blockWidth, blockTop);
  blockShape.lineTo(blockWidth, CT);
  blockShape.closePath();
  const blockGeo = new THREE.ExtrudeGeometry(blockShape, {
    depth: blockDepth,
    bevelEnabled: false,
    curveSegments: 16,
  });
  blockGeo.translate(0, 0, -blockDepth / 2);
  const rightBlock = new THREE.Mesh(blockGeo, materials.paperEdge);
  rightBlock.name = "right-block";
  rightBlock.castShadow = true;
  rightBlock.receiveShadow = true;
  scene.add(rightBlock);

  // Cloth mull: a thin cloth layer on the text-block ramp. It is the visible
  // binding the pages emerge from and hides the paper wedge in the gutter.
  const mullShape = new THREE.Shape();
  const mullSegments = 24;
  const mullTop = (x: number): number =>
    blockRampY(x, BOOK_DIMENSIONS, blockTop) + 0.00002;
  const mullBottom = (x: number): number =>
    blockRampY(x, BOOK_DIMENSIONS, blockTop) - 0.0002;
  for (let i = 0; i <= mullSegments; i++) {
    const x = (BIND_RAMP * i) / mullSegments;
    if (i === 0) mullShape.moveTo(x, mullTop(x));
    else mullShape.lineTo(x, mullTop(x));
  }
  for (let i = mullSegments; i >= 0; i--) {
    const x = (BIND_RAMP * i) / mullSegments;
    mullShape.lineTo(x, mullBottom(x));
  }
  mullShape.closePath();
  const mullGeo = new THREE.ExtrudeGeometry(mullShape, {
    depth: H * 0.99,
    bevelEnabled: false,
    curveSegments: 1,
  });
  mullGeo.translate(0, 0, -(H * 0.99) / 2);
  const mull = new THREE.Mesh(mullGeo, materials.spine);
  mull.name = "spine-mull";
  mull.receiveShadow = true;
  scene.add(mull);

  // Static (never-turning) sheets: thin curved sheets that start on the spine
  // binding and fan up to their own stack heights, so the closed block reads as
  // pages bound at the spine rather than a solid slab.
  const staticSheetGeo = (stackY: number, spineY: number): THREE.ExtrudeGeometry => {
    const half = (sheetVStep * 0.9) / 2;
    const segs = 24;
    const shape = new THREE.Shape();
    for (let i = 0; i <= segs; i++) {
      const x = (W * i) / segs;
      const y = rightSheetY(x, spineY, stackY) - half;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    for (let i = segs; i >= 0; i--) {
      const x = (W * i) / segs;
      shape.lineTo(x, rightSheetY(x, spineY, stackY) + half);
    }
    shape.closePath();
    const depth = H * 0.97;
    const g = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: false,
      curveSegments: 1,
    });
    g.translate(0, 0, -depth / 2);
    return g;
  };
  for (let i = 0; i < NUM_STATIC; i++) {
    const sheetIndex = NUM_TURNS + i; // 8..14
    const stackY = restBase + (NUM_SHEETS - 1 - sheetIndex) * sheetVStep;
    const spineY = spineFanY(BOOK_DIMENSIONS, fanIndex(sheetIndex, NUM_SHEETS));
    const m = new THREE.Mesh(
      staticSheetGeo(stackY, spineY),
      i % 2 === 0 ? materials.paper : materials.paperEdge,
    );
    m.name = "static-sheet";
    m.receiveShadow = true;
    scene.add(m);
  }

  // Inner hollow lining: the cloth spine plane between the two cover hinges.
  // Its front edge is the FRONT COVER's inner lining point at the hinge, so the
  // plane follows the cover as it opens (vertical when closed, flat when open).
  // The unit box is re-transformed every frame in `updateCover`.
  const hollowGeo = new THREE.BoxGeometry(1, 1, H * 0.99);
  const hollowLining = new THREE.Mesh(hollowGeo, materials.endpaper);
  hollowLining.name = "hollow-lining";
  hollowLining.castShadow = true;
  hollowLining.receiveShadow = true;
  scene.add(hollowLining);

  // Hollow spine cover: a curved ribbon from the back cover's lower edge to the
  // front cover's hinge edge. It stays convex while the text block's spine
  // throws up inside it, leaving the hollow.
  const spineCoverGeo = spineCoverGeometry(
    0,
    BOOK_DIMENSIONS,
    closedCenterY,
    OPEN_COVER_CENTER_Y,
    SPINE_PANEL_W,
    SPINE_TURN_IN,
  );
  const spineCover = new THREE.Mesh(spineCoverGeo, materials.spine);
  spineCover.name = "spine-cover";
  spineCover.castShadow = true;
  spineCover.receiveShadow = true;
  scene.add(spineCover);
  function updateSpineCover(u: number): void {
    updateSpineCoverGeometry(
      spineCoverGeo,
      u,
      BOOK_DIMENSIONS,
      closedCenterY,
      OPEN_COVER_CENTER_Y,
      SPINE_PANEL_W,
      SPINE_TURN_IN,
    );
  }
  updateSpineCover(0);

  // Headbands: cords at the head and tail of the text-block spine. The block's
  // inner face is now the spine at x = 0, so the band sits just in the joint;
  // the case hides it while closed and it shows in the open joint.
  const headbandGeo = headbandGeometry(0.0015, PBT);
  for (const z of [-H / 2 + 0.0015, H / 2 - 0.0015]) {
    const hb = new THREE.Mesh(headbandGeo, materials.headband);
    hb.position.set(-0.0008, CT + PBT / 2, z);
    hb.castShadow = true;
    scene.add(hb);
  }

  // Front cover: a rigid board hinged on the spine (x=0). The board is offset
  // +W/2 inside the pivot, so the pivot line is the book's hinge and rotation
  // alone opens the cover. Its hinge height is animated separately (see
  // coverPose) to model the hinge rolling down the spine as it goes flat.
  const frontCover = createCover(BOOK_DIMENSIONS, materials, "front");
  frontCover.position.x = W / 2;
  const coverPivot = new THREE.Group();
  coverPivot.name = "front-cover-hinge";
  coverPivot.position.set(0, closedCenterY, 0);
  coverPivot.add(frontCover);
  scene.add(coverPivot);

  // --- Heightfield (shared collision surface) ------------------------------
  const heightfield = new Heightfield({ width: W, height: H, nx: 110, nz: 110 });
  const gutterX = -W / 2; // local x of the spine
  // The right-hand stack starts at the spine (x = 0). Pages there must stay
  // above the sheet below them.
  const blockLeftLocal = gutterX;
  const bakeMinX = gutterX - 0.04; // leave a 4cm gutter strip free (natural fan)
  function resetHeightfield(): void {
    heightfield.setBase((x) => {
      const worldX = x + W / 2;
      return bindingFloorY(worldX, BOOK_DIMENSIONS, blockTop, COVER_FLOOR_Y);
    });
  }
  resetHeightfield();

  // --- Turning sheets ------------------------------------------------------
  const cols = 25;
  const rows = 33;
  const pages: PageInstance[] = [];

  for (let k = 0; k < NUM_TURNS; k++) {
    const win = TIMELINE.turns[k];
    // Sheet 0 is the TOP of the 15-sheet stack (turns first); sheet k sits at
    // restBase + (NUM_SHEETS-1-k)*vStep. Static sheets fill the bottom 7 slots.
    const restY = restBase + (NUM_SHEETS - 1 - k) * sheetVStep;
    const landY = landBase + k * landStep; // first turned lands lowest

    // Surface of whatever is directly beneath this sheet on the right (the next
    // sheet down, or the top static sheet). The sheet below is itself bound on
    // the spine plane, so its surface is a ramp, not a flat height. Clamp a
    // shell thickness above it so the turning page cannot lie flush with it.
    const belowRestY = restBase + (NUM_SHEETS - 1 - (k + 1)) * sheetVStep;
    const belowSpineY = spineFanY(
      BOOK_DIMENSIONS,
      fanIndex(k + 1, NUM_SHEETS),
    );
    const groundHeight = (x: number, z: number): number => {
      const h = heightfield.heightAt(x, z);
      if (x < blockLeftLocal) return h;
      const worldX = x + W / 2;
      const below = rightSheetY(worldX, belowSpineY, belowRestY) + 0.00025;
      return Math.max(below, h);
    };

    const sim = new PaperSimulation({
      cols,
      rows,
      width: W,
      height: H,
      dt: FIXED_DT,
      iterations: 12,
      bendStiffness: 1.0,
      longRangeBend: true,
      bendSpans: [3, 4, 5, 6], // longer links => stiffer, smoother sheet
      plane: "xz",
      groundHeight,
    });
    // The sheet is bound on the spine plane: its inner edge starts at the
    // binding height for its place in the closed stack and ramps up to the
    // fore-edge stack height over BIND_RAMP.
    const spineRestY = spineFanY(BOOK_DIMENSIONS, fanIndex(k, NUM_SHEETS));
    for (const p of sim.particles) {
      const worldX = p.x + W / 2;
      p.y = p.py = rightSheetY(worldX, spineRestY, restY);
    }

    const spineIndices: number[] = [];
    const foreEdgeIndices: number[] = [];
    for (let r = 0; r < rows; r++) {
      spineIndices.push(r * cols + 0);
      foreEdgeIndices.push(r * cols + (cols - 1));
    }

    // On the left the sheet binds at the front cover hinge; the first sheet
    // turned is the bottom of the left stack, so its fan index is k.
    const landSpineY = spineFanY(BOOK_DIMENSIONS, k);

    const controller = new PageTurnController({
      foreEdgeIndices,
      spineIndices,
      gutterX,
      restY,
      spineRestY,
      landY,
      landSpineY,
      // Local x of the spine is `gutterX`; the landing shift moves the whole
      // sheet left by the spine panel, so the spine edge lands at the front
      // cover hinge (world x = -SPINE_PANEL_W).
      spineTargetX: gutterX,
      landSpineStart: 0.5,
      landOffsetX: -SPINE_PANEL_W,
      width: W,
      duration: win.dur,
      liftScale: 0.6,
      lead: 0.04,
      liftVar: 0.06,
      rows,
    });
    controller.seedZ(sim.particles);
    controller.setProgress(0);
    controller.apply(sim.particles);

    const geo = new ThickSheetGeometry(cols, rows, 0.00025);
    // Sheet 0 is the front flyleaf and the last sheet is the back flyleaf: the
    // free halves of the front/back endpapers. They are the same simulated
    // sheets as any page, just on endpaper stock, so the first and last turns
    // read as endpapers connecting the case to the block.
    const isFlyleaf = k === 0 || k === NUM_TURNS - 1;
    const material = isFlyleaf
      ? createPaperMaterial({ color: 0xd8ccb4, roughness: 0.95 })
      : createPaperMaterial();
    material.side = THREE.DoubleSide;
    const mesh = new THREE.Mesh(geo.geometry, material);
    mesh.name =
      k === 0
        ? "front-flyleaf"
        : k === NUM_TURNS - 1
          ? "back-flyleaf"
          : `turning-page-${k}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.x = W / 2; // gutter at world x=0
    scene.add(mesh);
    geo.update(sim.particles);

    const maxSteps = Math.ceil((win.dur + win.settle) / FIXED_DT);
    pages.push({ sim, geo, mesh, controller, window: win, stepped: 0, maxSteps, restY, landY, baked: false, geoStep: -1 });
  }

  // Bake a settled sheet's top surface into the heightfield (outer region only).
  function bakePage(pg: PageInstance): void {
    const P = pg.sim.particles;
    const top = 0.0006; // half thickness + clearance so the next page clears bumps
    for (let i = 0; i < P.length; i++) {
      const p = P[i];
      if (p.x < bakeMinX) heightfield.splat(p.x, p.z, p.y + top, 2);
    }
  }

  // --- UI ------------------------------------------------------------------
  const ui = document.createElement("div");
  ui.className = "demo-ui";
  ui.innerHTML = `
    <button class="demo-play" type="button">▶ Play</button>
    <span class="demo-time">0.0s</span>
  `;
  document.body.appendChild(ui);
  const button = ui.querySelector(".demo-play") as HTMLButtonElement;
  const timeLabel = ui.querySelector(".demo-time") as HTMLSpanElement;

  // --- Playback state ------------------------------------------------------
  let time = 0;
  let playing = false;
  let last = performance.now();
  let acc = 0;
  let raf = 0;

  function setPlaying(next: boolean): void {
    if (next && time >= TIMELINE.end) seek(0);
    playing = next;
    button.textContent = playing ? "❚❚ Pause" : "▶ Play";
  }

  function resetPage(pg: PageInstance): void {
    pg.stepped = 0;
    pg.baked = false;
    pg.sim.reset();
    for (const p of pg.sim.particles) p.y = p.py = pg.restY;
    pg.controller.setProgress(0);
    pg.controller.apply(pg.sim.particles);
    pg.geo.update(pg.sim.particles);
    pg.geoStep = pg.stepped;
  }

  function seek(t: number): void {
    time = Math.max(0, Math.min(t, TIMELINE.end));
    resetHeightfield();
    for (const pg of pages) resetPage(pg);
    stepPagesTo(time);
    updateCover(time);
  }

  function stepPagesTo(t: number): void {
    for (const pg of pages) {
      const target = Math.max(
        0,
        Math.min(pg.maxSteps, Math.floor((t - pg.window.start) / FIXED_DT)),
      );
      while (pg.stepped < target) {
        const local = pg.stepped * FIXED_DT;
        const progress = clamp01(local / pg.window.dur);
        pg.controller.setProgress(progress);
        pg.controller.apply(pg.sim.particles);
        pg.sim.step();
        pg.stepped++;
      }
      // Bake once the sheet has settled, so later sheets collide with it.
      if (!pg.baked && pg.stepped >= pg.maxSteps) {
        bakePage(pg);
        pg.baked = true;
      }
      // Only rebuild GPU geometry when this page actually moved.
      if (pg.stepped !== pg.geoStep) {
        pg.geo.update(pg.sim.particles);
        pg.geoStep = pg.stepped;
      }
    }
  }

  function updateCover(t: number): void {
    const u = clamp01(
      (t - TIMELINE.coverStart) / (TIMELINE.coverEnd - TIMELINE.coverStart),
    );
    const pose = coverPose(
      u,
      closedCenterY,
      OPEN_COVER_CENTER_Y,
      HINGE_DROP_START,
      SPINE_PANEL_W,
    );
    coverPivot.position.x = pose.hingeX;
    coverPivot.position.y = pose.hingeY;
    coverPivot.rotation.z = pose.angle;
    // The hollow cover-spine ribbon stays convex while the cover opens.
    updateSpineCover(u);
    // The joint reads as cloth while closed and as endpaper once opened.
    hollowLining.material = u >= 0.5 ? materials.endpaper : materials.spine;
    // The spine plane is bounded by the FRONT COVER: its front edge is the
    // cover's inner lining point at the moving hinge. Build a thin slab whose
    // page-facing face is the plane and which extends away from the pages.
    const edges = spinePlaneEdges(
      u,
      BOOK_DIMENSIONS,
      closedCenterY,
      OPEN_COVER_CENTER_Y,
      SPINE_PANEL_W,
    );
    const dx = edges.front.x - edges.back.x;
    const dy = edges.front.y - edges.back.y;
    const len = Math.max(1e-6, Math.hypot(dx, dy));
    // Extend slightly past both cover hinges so the cloth tucks under the
    // pastedown linings and there is no visible gap at the cover boundary.
    const overlap = 0.003;
    const ux = dx / len;
    const uy = dy / len;
    const bx = edges.back.x - ux * overlap;
    const by = edges.back.y - uy * overlap;
    const fx = edges.front.x + ux * overlap;
    const fy = edges.front.y + uy * overlap;
    const fullLen = len + overlap * 2;
    const nx = -dy / len; // local +Y (points away from the pages)
    const ny = dx / len;
    const thickness = 0.0008;
    // Sit just below the page-facing plane to avoid z-fighting with linings.
    const inset = 0.00015;
    hollowLining.position.set(
      (bx + fx) / 2 + nx * (thickness / 2 - inset),
      (by + fy) / 2 + ny * (thickness / 2 - inset),
      0,
    );
    hollowLining.rotation.z = Math.atan2(dy, dx);
    hollowLining.scale.set(fullLen, thickness, 1);
  }
  updateCover(0);

  button.addEventListener("click", () => setPlaying(!playing));

  // --- Main loop -----------------------------------------------------------
  function frame(now: number): void {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    if (playing) {
      acc += dt;
      let steps = 0;
      while (acc >= FIXED_DT && steps < 12) {
        time += FIXED_DT;
        acc -= FIXED_DT;
        steps++;
      }
      if (time >= TIMELINE.end) {
        time = TIMELINE.end;
        setPlaying(false);
      }
      stepPagesTo(time);
      updateCover(time);
    }

    timeLabel.textContent = `${time.toFixed(1)}s`;
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  function onResize(): void {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener("resize", onResize);

  (window as unknown as { __demo: unknown }).__demo = {
    play: () => setPlaying(true),
    pause: () => setPlaying(false),
    seek,
    get time() {
      return time;
    },
    duration: TIMELINE.end,
    /** WebGL backend actually in use (hardware GPU or software renderer). */
    gpu: () => {
      const gl = renderer.getContext();
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      return {
        renderer: ext
          ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL))
          : String(gl.getParameter(gl.RENDERER)),
        vendor: ext
          ? String(gl.getParameter(ext.UNMASKED_VENDOR_WEBGL))
          : String(gl.getParameter(gl.VENDOR)),
      };
    },
    /** Debug aid: show/hide every object with the given name. */
    debug: (name: string, visible: boolean) => {
      scene.traverse((o) => {
        if (o.name === name) o.visible = visible;
      });
    },
    /** Debug aid: place the camera for close-up validation shots. */
    camera: (
      position: [number, number, number],
      lookAt: [number, number, number],
    ) => {
      camera.position.set(...position);
      camera.lookAt(lookAt[0], lookAt[1], lookAt[2]);
    },
    /** Current cover pose + the open-cover collision surface (debug aid). */
    cover: () => {
      const u = clamp01(
        (time - TIMELINE.coverStart) / (TIMELINE.coverEnd - TIMELINE.coverStart),
      );
      const pose = coverPose(
        u,
        closedCenterY,
        OPEN_COVER_CENTER_Y,
        HINGE_DROP_START,
        SPINE_PANEL_W,
      );
      return {
        u,
        angle: pose.angle,
        hingeY: pose.hingeY,
        closedCenterY,
        openCenterY: OPEN_COVER_CENTER_Y,
        topY: OPEN_COVER.topY,
        floorY: COVER_FLOOR_Y,
        spinePlaneY: SPINE_Y,
        spineClothY: SPINE_CLOTH_Y,
        bindRamp: BIND_RAMP,
        spinePlane: spinePlaneEdges(
          u,
          BOOK_DIMENSIONS,
          closedCenterY,
          OPEN_COVER_CENTER_Y,
          SPINE_PANEL_W,
        ),
        bindings: pages.map((_, k) => ({
          right: { x: 0, y: spineFanY(BOOK_DIMENSIONS, fanIndex(k, NUM_SHEETS)) },
          left: { x: -SPINE_PANEL_W, y: spineFanY(BOOK_DIMENSIONS, k) },
        })),
      };
    },
    /** Current spine cover bounds + text-block morph (debug/validation aid). */
    spine: () => {
      const u = clamp01(
        (time - TIMELINE.coverStart) / (TIMELINE.coverEnd - TIMELINE.coverStart),
      );
      spineCoverGeo.computeBoundingBox();
      const box = spineCoverGeo.boundingBox;
      return {
        u,
        minX: box ? box.min.x : 0,
        maxX: box ? box.max.x : 0,
        minY: box ? box.min.y : 0,
        maxY: box ? box.max.y : 0,
        protrusion: box ? Math.max(0, -box.min.x) : 0,
      };
    },
    /** Per-page particle bounds in world space (debug/validation aid). */
    pageBounds: () =>
      pages.map((pg) => {
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;
        for (const p of pg.sim.particles) {
          const wx = p.x + W / 2; // mesh offset
          if (wx < minX) minX = wx;
          if (wx > maxX) maxX = wx;
          if (p.y < minY) minY = p.y;
          if (p.y > maxY) maxY = p.y;
          if (p.z < minZ) minZ = p.z;
          if (p.z > maxZ) maxZ = p.z;
        }
        const spine = pg.sim.particles[0];
        return {
          stepped: pg.stepped,
          restY: pg.restY,
          landY: pg.landY,
          spineX: spine.x + W / 2,
          spineY: spine.y,
          minX,
          maxX,
          minY,
          maxY,
          minZ,
          maxZ,
        };
      }),
  };
  (window as unknown as { __sceneReady: boolean }).__sceneReady = true;

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", onResize);
    ui.remove();
    for (const pg of pages) pg.geo.dispose();
    spineCoverGeo.dispose();
    hollowGeo.dispose();
    headbandGeo.dispose();
    renderer.dispose();
  };
}