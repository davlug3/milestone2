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
import { smootherstep, clamp01 } from "../animation/easing";

/**
 * Animated hardcover book demo with a play/pause button.
 *
 * A CLOSED book (~15 visible sheets) rests on the right. On Play:
 *   1. the front cover swings open to the left
 *   2. 8 sheets turn right->left one at a time, accumulating on the opened
 *      cover, while 7 sheets remain on the right
 *
 * Realism / stability:
 *  - The whole FORE-EDGE is driven along a smooth 2D arc (per-row lead + lift
 *    variation), so the page curls in both directions, not as a cylinder.
 *  - Long-range bending links distribute curvature (smooth curl, no crease).
 *  - Page-to-page collision via a heightfield: a shared Heightfield stores the
 *    top surface of everything below. Each landed sheet is baked into it (outer
 *    region only, leaving the gutter free so pages fan naturally). The active
 *    sheet collides against this, so it rests on the pages below it.
 *  - Per-sheet spine heights are offset so pages don't coincide at the gutter.
 *
 * Playback is deterministic in an absolute timeline `time` (seconds).
 */

const W = BOOK_DIMENSIONS.width;
const H = BOOK_DIMENSIONS.height;
const CT = BOOK_DIMENSIONS.coverThickness;
const PBT = 0.012;
const NUM_TURNS = 8;
const NUM_STATIC = 7;
const NUM_SHEETS = NUM_TURNS + NUM_STATIC;

const FIXED_DT = 1 / 120;
const blockTop = CT + PBT;
const sheetVStep = 0.0003; // right-stack spacing (exaggerated for visibility)
const restBase = blockTop + 0.0004;
const landBase = CT + 0.0004;
// Must exceed the bake clearance (0.0006) so each page lands just above the
// surface of the pages already stacked below it.
const landStep = 0.0008;

const TURN_DUR = 2.5;
const SETTLE_DUR = 0.5;

interface TurnWindow {
  start: number;
  dur: number;
  settle: number;
}

const COVER_START = 0.6;
const COVER_END = 3.2;
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
  const renderer = new THREE.WebGLRenderer({ antialias: true });
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

  const rightBlock = new THREE.Mesh(
    new THREE.BoxGeometry(W * 0.96, PBT, H * 0.97),
    materials.paperEdge,
  );
  rightBlock.position.set(W / 2, CT + PBT / 2, 0);
  rightBlock.castShadow = true;
  rightBlock.receiveShadow = true;
  scene.add(rightBlock);

  // Static (never-turning) sheets: simple thin boxes, below the turning group.
  const sheetGeo = new THREE.BoxGeometry(W * 0.96, sheetVStep * 0.9, H * 0.97);
  for (let i = 0; i < NUM_STATIC; i++) {
    const sheetIndex = NUM_TURNS + i; // 8..14
    const y = restBase + (NUM_SHEETS - 1 - sheetIndex) * sheetVStep;
    const m = new THREE.Mesh(sheetGeo, i % 2 === 0 ? materials.paper : materials.paperEdge);
    m.position.set(W / 2, y, 0);
    m.receiveShadow = true;
    scene.add(m);
  }

  // Spine strip at the gutter (top at block-top so it never pokes into pages).
  const spine = new THREE.Mesh(
    new THREE.BoxGeometry(0.006, blockTop, H),
    materials.spine,
  );
  spine.position.set(0, blockTop / 2, 0);
  spine.castShadow = true;
  scene.add(spine);

  // Front cover (closed on right, opens to left).
  const topSheetY = restBase + (NUM_SHEETS - 1) * sheetVStep;
  const coverBottom = topSheetY + 0.0005;
  const closedTopY = coverBottom + CT / 2;
  const frontCover = createCover(BOOK_DIMENSIONS, materials, "front");
  const closedPos = new THREE.Vector3(W / 2, closedTopY, 0);
  const openPos = new THREE.Vector3(-W / 2, CT / 2, 0);
  const closedQuat = new THREE.Quaternion();
  const openQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI);
  frontCover.position.copy(closedPos);
  frontCover.quaternion.copy(closedQuat);
  scene.add(frontCover);

  // --- Heightfield (shared collision surface) ------------------------------
  const heightfield = new Heightfield({ width: W, height: H, nx: 110, nz: 110 });
  const gutterX = -W / 2; // local x of the spine
  const bakeMinX = gutterX - 0.04; // leave a 4cm gutter strip free (natural fan)
  function resetHeightfield(): void {
    heightfield.setBase((x) => (x >= gutterX ? blockTop : CT));
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

    // Top of whatever is directly beneath this sheet on the right (the next
    // sheet down, or the top static sheet). Keeps a waiting/turning page from
    // sagging into the stack it rests on.
    const belowRestY = restBase + (NUM_SHEETS - 1 - (k + 1)) * sheetVStep;
    const groundHeight = (x: number, z: number): number =>
      x >= gutterX
        ? Math.max(belowRestY, heightfield.heightAt(x, z))
        : heightfield.heightAt(x, z);

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
    for (const p of sim.particles) p.y = p.py = restY;
    for (let r = 0; r < rows; r++) sim.pin(r * cols + 0); // pin spine edge

    const foreEdgeIndices: number[] = [];
    for (let r = 0; r < rows; r++) foreEdgeIndices.push(r * cols + (cols - 1));

    const controller = new PageTurnController({
      foreEdgeIndices,
      gutterX,
      restY,
      landY,
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
    const material = createPaperMaterial();
    material.side = THREE.DoubleSide;
    const mesh = new THREE.Mesh(geo.geometry, material);
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
    const p = smootherstep(
      clamp01((t - TIMELINE.coverStart) / (TIMELINE.coverEnd - TIMELINE.coverStart)),
    );
    frontCover.position.lerpVectors(closedPos, openPos, p);
    frontCover.position.y += Math.sin(Math.PI * p) * 0.09;
    frontCover.quaternion.slerpQuaternions(closedQuat, openQuat, p);
  }

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
        return { stepped: pg.stepped, minX, maxX, minY, maxY, minZ, maxZ };
      }),
  };
  (window as unknown as { __sceneReady: boolean }).__sceneReady = true;

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", onResize);
    ui.remove();
    for (const pg of pages) pg.geo.dispose();
    renderer.dispose();
  };
}