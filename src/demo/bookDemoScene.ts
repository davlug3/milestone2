import * as THREE from "three";
import { StudioTracer, PhysicalCamera, type RenderMode } from "../rendering/studioTracer";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { cameraVerticalFov, cinematicCameraPose, CAMERA_SENSOR_W_MM, CAMERA_FOCAL_MM } from "../rendering/cinematicCamera";
import { BOOK_DIMENSIONS } from "../config/bookConfig";
import { createBookMaterials } from "../book/materials";
import { createCover } from "../book/cover";
import { addStudioLighting } from "../rendering/lighting";
import { createStudioTable } from "../rendering/studioTable";
import { createClothTexture } from "../rendering/surfaceTextures";
import { PaperSimulation } from "../physics/PaperSimulation";
import { TurnHandoff } from "../physics/TurnHandoff";
import { RenderPose, PLAYBACK_RATE } from "../physics/RenderPose";
import { bindingLoad, bindingLift } from "../book/bindingFlex";
import { ThickSheetGeometry } from "../paper/ThickSheetGeometry";
import { createPagePrints } from "../paper/PagePrints";
import { createParticle } from "../physics/Particle";
import { PageTurnController } from "../animation/PageTurnController";
import { Heightfield } from "../physics/Heightfield";
import { clamp01, smootherstep } from "../animation/easing";
import {
  HINGE_DROP_START,
  coverPose,
  openCoverSurface,
} from "../book/coverRig";
import {
  BIND_RAMP,
  spineClothTopY,
  spinePlaneEdges,
  spinePlaneY,
} from "../book/spineBinding";
import {
  TEXT_BLOCK_THICKNESS,
  TEXT_BLOCK_TURNS,
  TEXT_SHEET_THICKNESS,
  textRoot,
  textStackY,
  textPageY,
  textPageFloor,
} from "../book/textBlockBinding";
import {
  headbandGeometry,
  spineCoverGeometry,
  updateSpineCoverGeometry,
} from "../book/spineRig";

/**
 * Animated hardcover book demo with a play/pause button.
 *
 * All configured sheets are represented individually. Only the first eight
 * are simulated; the other sheets use lightweight procedural profiles. The
 * full material spine unfolds as a constant-length arc, independent of the
 * hardcover's outer spine. No solid page wedge remains.
 *
 * Playback is deterministic in an absolute timeline `time` (seconds).
 */

const W = BOOK_DIMENSIONS.width;
const H = BOOK_DIMENSIONS.height;
const CT = BOOK_DIMENSIONS.coverThickness;
const PBT = TEXT_BLOCK_THICKNESS;
// Case spine panel width: the closed book thickness. Open, it lies flat
// between the boards, so the open book is 2 * width + SPINE_PANEL_W long.
const SPINE_PANEL_W = 2 * CT + PBT;
// How far the spine cloth turns in onto the boards' outer faces (hides the
// board bevel at the hinge, so the case reads as one continuous surface).
const SPINE_TURN_IN = 0.003;
const NUM_SHEETS = BOOK_DIMENSIONS.sheetCount;
const NUM_TURNS = Math.min(TEXT_BLOCK_TURNS, NUM_SHEETS - 1);
const NUM_STATIC = NUM_SHEETS - NUM_TURNS;

const FIXED_DT = 1 / 120;


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
  handoff: TurnHandoff;
  renderPose: RenderPose;
  window: TurnWindow;
  stepped: number;
  maxSteps: number;
  restY: number;
  index: number;
  landY: number;
  baked: boolean;
  /** Last `stepped` value at which the GPU geometry was refreshed. */
  geoStep: number;
}

export function startBookDemo(container: HTMLElement): () => void {
  // --- Renderer / scene / camera ------------------------------------------
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    preserveDrawingBuffer: new URLSearchParams(location.search).has('export'),
    // Prefer the discrete/high-performance GPU when the client has one. This
    // is only a hint: browsers without a usable GPU fall back automatically.
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(new URLSearchParams(location.search).has('export') ? 1 : Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.78;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0c0d10);
  scene.fog = new THREE.Fog(0x0c0d10, 1.15, 3.2);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.04);
  room.dispose();
  pmrem.dispose();
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.16;

  // Full-frame 35mm prime; fit the full sensor gate to the viewport.
  const aspect = window.innerWidth / window.innerHeight;
  const camera = new PhysicalCamera(cameraVerticalFov(aspect), aspect, 0.01, 100);
  camera.filmGauge = CAMERA_SENSOR_W_MM;
  camera.fStop = 4.5;
  camera.apertureBlades = 6;
  camera.apertureRotation = 0.15;
  const trace = new StudioTracer(renderer, scene, camera);
  let manualCamera = false;
  function updateCamera(t: number): void {
    if (manualCamera) return;
    const pose = cinematicCameraPose(t, TIMELINE.end);
    camera.position.set(...pose.position);
    camera.lookAt(...pose.target);
    camera.focusDistance = camera.position.distanceTo(new THREE.Vector3(...pose.target));
  }
  updateCamera(0);

  addStudioLighting(scene);
  const disposeTable = createStudioTable(scene);

  // --- Static book parts (closed on the right; gutter at x=0) --------------
  const materials = createBookMaterials();
  const clothTexture = createClothTexture();
  materials.cover.bumpMap = clothTexture;
  materials.cover.bumpScale = 0.00012;
  materials.endpaper.bumpMap = clothTexture;
  materials.endpaper.bumpScale = 0.00004;
  const prints = createPagePrints(materials.paperEdge, renderer.capabilities.getMaxAnisotropy());

  const backCover = createCover(BOOK_DIMENSIONS, materials, "back");
  backCover.position.set(W / 2, CT / 2, 0);
  scene.add(backCover);

  // Every leaf, including the bottom/back leaf, has its own geometry.
  const topSheetY = textStackY(BOOK_DIMENSIONS, 0);
  const coverBottom = topSheetY + 0.0005;
  const closedCenterY = coverBottom + CT / 2;
  const boundBlock = new THREE.Group();
  boundBlock.name = "bound-text-block";
  scene.add(boundBlock);

  const staticSheetGeo = (index: number, u: number, existing?: ThickSheetGeometry): ThickSheetGeometry => {
    // Same material groups and material-coordinate UVs as the turning shells.
    const segments = 48;
    const shell = existing ?? new ThickSheetGeometry(segments + 1, 2, TEXT_SHEET_THICKNESS);
    const particles = [];
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c <= segments; c++) {
        const x = W * c / segments;
        particles.push(createParticle(x, textPageY(BOOK_DIMENSIONS, index, x, u), (r - 0.5) * H));
      }
    }
    shell.update(particles);
    return shell;
  };
  const staticSheets: { mesh: THREE.Mesh; index: number; shell: ThickSheetGeometry }[] = [];
  for (let i = 0; i < NUM_STATIC; i++) {
    const sheetIndex = NUM_TURNS + i;
    const isBackFlyleaf = sheetIndex === NUM_SHEETS - 1;
    const shell = staticSheetGeo(sheetIndex, 0);
    const m = new THREE.Mesh(
      shell.geometry,
      prints.sheet(sheetIndex),
    );
    m.name = isBackFlyleaf ? "back-flyleaf" : "static-sheet";
    m.receiveShadow = true;
    boundBlock.add(m);
    staticSheets.push({ mesh: m, index: sheetIndex, shell });
  }

  // Separate deforming text-block binding ribbon; not the outer case spine.
  const bindingGeo = new THREE.BufferGeometry();
  const bindingPositions = new Float32Array(NUM_SHEETS * 2 * 3);
  bindingGeo.setAttribute("position", new THREE.BufferAttribute(bindingPositions, 3));
  const bindingIndices: number[] = [];
  for (let i = 0; i < NUM_SHEETS - 1; i++) {
    const a = i * 2;
    bindingIndices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  bindingGeo.setIndex(bindingIndices);
  const bindingMaterial = materials.spineCloth.clone();
  const bindingUVs = new Float32Array(NUM_SHEETS * 2 * 2);
  for (let i=0;i<NUM_SHEETS;i++) for (let j=0;j<2;j++) {
    bindingUVs[(i*2+j)*2] = i / (NUM_SHEETS-1);
    bindingUVs[(i*2+j)*2+1] = j * 12;
  }
  bindingGeo.setAttribute('uv', new THREE.BufferAttribute(bindingUVs, 2));
  bindingMaterial.bumpMap = clothTexture;
  bindingMaterial.bumpScale = 0.00008;
  bindingMaterial.side = THREE.DoubleSide;
  const bindingMesh = new THREE.Mesh(bindingGeo, bindingMaterial);
  bindingMesh.name = "distributed-text-block-binding";
  bindingMesh.receiveShadow = true;
  boundBlock.add(bindingMesh);

  // The distributed cloth ribbon is the lining. Do not add a rigid slab
  // overlapping the cover hinges.
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

  // Headbands: short cords lying ACROSS the spine at the head and tail ends of
  // the binding line. The text block now covers the whole spine panel, so they
  // sit just beyond the head/tail of the sheets (z) instead of inside them,
  // where they would cut through the pages.
  const headbandGeo = headbandGeometry(0.0009, 0.008);
  const headbands: THREE.Mesh[] = [];
  for (const z of [-H / 2 - 0.0012, H / 2 + 0.0012]) {
    const hb = new THREE.Mesh(headbandGeo, materials.headband);
    hb.rotation.z = Math.PI / 2; // cylinder axis along X
    hb.position.set(0, SPINE_CLOTH_Y + 0.0006, z);
    headbands.push(hb);
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
  const heightfield = new Heightfield({ width: W, height: H, nx: 120, nz: 110, paddingX: SPINE_PANEL_W });
  const gutterX = -W / 2; // local x of the spine
  // The right-hand stack starts at the spine (x = 0). Pages there must stay
  // above the sheet below them.
  const bakeMinX = gutterX - 0.04; // leave a 4cm gutter strip free (natural fan)
  function resetHeightfield(): void {
    heightfield.reset(COVER_FLOOR_Y);
  }
  resetHeightfield();

  // --- Turning sheets ------------------------------------------------------
  const cols = 25;
  const rows = 33;
  const pages: PageInstance[] = [];

  for (let k = 0; k < NUM_TURNS; k++) {
    const win = TIMELINE.turns[k];
    const restY = textStackY(BOOK_DIMENSIONS, k);
    const landY = landBase + k * landStep; // first turned lands lowest

    // Surface of whatever is directly beneath this sheet on the right (the next
    // sheet down, or the top static sheet). The sheet below is itself bound on
    // the spine plane, so its surface is a ramp, not a flat height. Clamp a
    // shell thickness above it so the turning page cannot lie flush with it.
    const root = textRoot(BOOK_DIMENSIONS, k);
    const groundHeight = (x: number, z: number): number =>
      Math.max(heightfield.heightAt(x, z), textPageFloor(BOOK_DIMENSIONS, k, x + W / 2, COVER_FLOOR_Y));

    const sim = new PaperSimulation({
      cols,
      rows,
      width: W,
      height: H,
      dt: FIXED_DT,
      iterations: 12,
      bendStiffness: 1.2,
      longRangeBend: true,
      bendSpans: [3, 4, 5, 6], // longer links => stiffer, smoother sheet
      plane: "xz",
      groundHeight,
    });
    // The sheet is bound on the spine plane: its inner edge starts at the
    // binding height for its place in the closed stack and ramps up to the
    // fore-edge stack height over BIND_RAMP.
    const spineRestY = root.y;
    for (const p of sim.particles) {
      const localX = p.x + W / 2;
      p.x = p.px = p.x + root.x;
      p.y = p.py = textPageY(BOOK_DIMENSIONS, k, localX);
    }

    const spineIndices: number[] = [];
    const foreEdgeIndices: number[] = [];
    for (let r = 0; r < rows; r++) {
      spineIndices.push(r * cols + 0);
      foreEdgeIndices.push(r * cols + (cols - 1));
    }

    // On the left the sheet binds at the front cover hinge; the first sheet
    // turned is the bottom of the left stack, so its fan index is k.
    const landSpineY = root.y;

    const controller = new PageTurnController({
      foreEdgeIndices,
      spineIndices,
      gutterX: gutterX + root.x,
      restY,
      spineRestY,
      landY,
      landSpineY,
      // Preserve both coordinates of the material attachment through the turn.
      spineTargetX: gutterX + root.x,
      landSpineStart: 0.5,
      width: W,
      duration: win.dur,
      liftScale: 0.45,
      lead: 0.03,
      liftVar: 0.03,
      rows,
    });
    controller.seedZ(sim.particles);
    controller.setProgress(0);
    controller.apply(sim.particles);

    const geo = new ThickSheetGeometry(cols, rows, 0.00025);
    const mesh = new THREE.Mesh(geo.geometry, prints.sheet(k));
    mesh.name =
      k === 0 ? "front-flyleaf" : `turning-page-${k}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.x = W / 2; // binding line at the group's x
    boundBlock.add(mesh);
    geo.update(sim.particles);

    const maxSteps = Math.ceil((win.dur + win.settle) / FIXED_DT);
    const handoff = new TurnHandoff();
    handoff.capture(sim.particles);
    const renderPose = new RenderPose();
    renderPose.reset(sim.particles);
    pages.push({ sim, geo, mesh, controller, handoff, renderPose, window: win, stepped: 0, maxSteps, restY, index: k, landY, baked: false, geoStep: -1 });
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
    <select class="demo-render" aria-label="Render mode"><option value="real-time">Real-time</option><option value="ray-traced">Ray-traced preview</option><option value="cinematic">Cinematic</option></select>
    <span class="demo-samples" aria-live="polite"></span>
  `;
  document.body.appendChild(ui);
  const button = ui.querySelector(".demo-play") as HTMLButtonElement;
  const timeLabel = ui.querySelector(".demo-time") as HTMLSpanElement;
  const modeSelect = ui.querySelector(".demo-render") as HTMLSelectElement;
  const sampleLabel = ui.querySelector(".demo-samples") as HTMLSpanElement;
  let photoRevision = -1;
  function setRenderMode(mode: RenderMode) {
    if (!["real-time","ray-traced","cinematic"].includes(mode)) return;
    setPlaying(false);
    trace.setMode(mode);
    modeSelect.value=mode;
  }
  modeSelect.addEventListener("change",()=>setRenderMode(modeSelect.value as RenderMode));

  // --- Playback state ------------------------------------------------------
  let time = 0;
  let playing = false;
  let last = performance.now();
  let raf = 0;

  function setPlaying(next: boolean): void {
    if (next && time >= TIMELINE.end) seek(0);
    playing = next;
    button.textContent = playing ? "❚❚ Pause" : "▶ Play";
  }

  function poseUnturned(pg: PageInstance, u: number): void {
    const root = textRoot(BOOK_DIMENSIONS, pg.index, u);
    pg.sim.reset();
    for (const p of pg.sim.particles) {
      const localX = p.x + W / 2;
      p.x = p.px = p.x + root.x;
      p.y = p.py = textPageY(BOOK_DIMENSIONS, pg.index, localX, u);
    }
    // Pin the simulation's actual open attachment before it starts stepping.
    if (u === 1) {
      pg.controller.setProgress(0);
      pg.controller.apply(pg.sim.particles);
    }
    pg.handoff.capture(pg.sim.particles);
    pg.renderPose.reset(pg.sim.particles);
    pg.geo.update(pg.sim.particles);
    flexBases.delete(pg.geo.geometry);
    pg.geoStep = pg.stepped;
  }

  function resetPage(pg: PageInstance): void {
    pg.stepped = 0;
    pg.baked = false;
    poseUnturned(pg, 1);
  }

  function seek(t: number): void {
    time = Math.max(0, Math.min(t, TIMELINE.end));
    resetHeightfield();
    for (const pg of pages) resetPage(pg);
    stepPagesTo(time);
    lastBindingU = -1;
    updateCover(time);
    updateCamera(time);
    trace.invalidate();
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
        pg.renderPose.capture(pg.sim.particles);
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
      // Draw between the two most recent solver states, one fixed tick behind.
      const moving = pg.stepped > 0 && pg.stepped < pg.maxSteps;
      if (moving || pg.stepped !== pg.geoStep) {
        const elapsed = Math.max(0, t - pg.window.start);
        const alpha = moving ? clamp01(elapsed / FIXED_DT - pg.stepped) : 1;
        const display = pg.renderPose.sample(pg.sim.particles, alpha);
        pg.geo.update(pg.handoff.pose(display, Math.max(0, (pg.stepped - 1 + alpha) * FIXED_DT)));
        flexBases.delete(pg.geo.geometry);
        pg.geoStep = pg.stepped;
      }
    }
  }

  const flexBases = new WeakMap<THREE.BufferGeometry, Float32Array>();
  const flexLoads = new WeakMap<THREE.BufferGeometry, number>();
  function flexGeometry(mesh: THREE.Mesh, load: number): void {
    const geo = mesh.geometry;
    const attr = geo.getAttribute("position") as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    let base = flexBases.get(geo);
    if (base && flexLoads.get(geo) === load) return;
    if (!base) { base = arr.slice(); flexBases.set(geo, base); }
    flexLoads.set(geo, load);
    for (let i = 0; i < arr.length; i += 3) {
      arr[i + 1] = base[i + 1] + bindingLift(base[i] + mesh.position.x, SPINE_PANEL_W, load);
    }
    attr.needsUpdate = true;
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
  }
  let lastBindingU = -1;
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
    // The text block slides to the open binding line at the end of the cover
    // swing (u > 0.8, after the spine strip has flattened) and stays there.
    // The back attachment stays fixed in world space throughout opening.
    boundBlock.position.x = 0;
    if (u !== lastBindingU) {
      for (const pg of pages) if (pg.stepped === 0) poseUnturned(pg, u);
      for (const entry of staticSheets) {
        const root = textRoot(BOOK_DIMENSIONS, entry.index, u);
        staticSheetGeo(entry.index, u, entry.shell);
        flexBases.delete(entry.mesh.geometry);
        entry.mesh.position.x = root.x;
      }
      for (let i = 0; i < NUM_SHEETS; i++) {
        const root = textRoot(BOOK_DIMENSIONS, i, u);
        for (let j = 0; j < 2; j++) {
          const offset = (i * 2 + j) * 3;
          bindingPositions[offset] = root.x;
          bindingPositions[offset + 1] = root.y - PAGE_SHELL_HALF;
          bindingPositions[offset + 2] = (j - 0.5) * H;
        }
      }
      flexBases.delete(bindingGeo);
      bindingGeo.getAttribute("position").needsUpdate = true;
      bindingGeo.computeVertexNormals();
      bindingGeo.computeBoundingSphere();
      const frontRoot = textRoot(BOOK_DIMENSIONS, 0, u);
      for (const hb of headbands) {
        hb.position.x = frontRoot.x;
        hb.position.y = frontRoot.y;
      }
      lastBindingU = u;
    }
    // Existing opening arc remains active through the cover swing. The extra
    // elastic crown ramps in only near fully open, avoiding the moving board.
    const load = bindingLoad(t, u, TIMELINE.turns) * smootherstep(clamp01((u - 0.95) / 0.05));
    for (const pg of pages) flexGeometry(pg.mesh, load);
    for (const entry of staticSheets) flexGeometry(entry.mesh, load);
    flexGeometry(bindingMesh, load);
    const frontRoot = textRoot(BOOK_DIMENSIONS, 0, u);
    for (const hb of headbands) {
      hb.position.y = frontRoot.y + bindingLift(frontRoot.x, SPINE_PANEL_W, load);
    }
    updateSpineCover(u);
  }
  updateCover(0);

  button.addEventListener("click", () => setPlaying(!playing));

  // --- Main loop -----------------------------------------------------------
  function frame(now: number): void {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    if (playing && (trace.mode !== 'cinematic' || trace.complete)) {
      time += (trace.mode === 'cinematic' ? 1/60 : dt) * PLAYBACK_RATE;
      if (time >= TIMELINE.end) {
        time = TIMELINE.end;
        setPlaying(false);
      }
      stepPagesTo(time);
      updateCover(time);
      updateCamera(time);
      trace.invalidate();
    }

    timeLabel.textContent = `${time.toFixed(1)}s`;
    const photoState=prints.status();
    const revision=photoState.loadedFaces+photoState.failedFaces;
    if(revision!==photoRevision){photoRevision=revision;trace.invalidate();}
    trace.draw(playing && trace.mode==="ray-traced");
    modeSelect.value=trace.mode;
    sampleLabel.textContent=trace.error ? "Ray tracing unavailable: "+trace.error :
      trace.mode==="real-time" ? "" : playing && trace.mode==="ray-traced" ? "Raster playback · pause to trace" :
      Math.floor(trace.samples)+" / "+trace.goal+" samples";
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  function onResize(): void {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.fov = cameraVerticalFov(camera.aspect);
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    trace.invalidate();
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
    playbackRate: PLAYBACK_RATE,
    photoStatus: prints.status,
    setRenderMode,
    exportFrame: (t: number, samples: number, bounces: number) => {
      if (!new URLSearchParams(location.search).has('export')) throw Error('Export mode required');
      setPlaying(false);
      trace.setExportQuality(samples,bounces);
      if (trace.mode !== 'cinematic') setRenderMode('cinematic');
      if (t < time) seek(t);
      else {
        time = Math.min(t,TIMELINE.end);
        stepPagesTo(time); updateCover(time); updateCamera(time); trace.invalidate();
      }
    },
    captureFrame: () => {
      if (trace.mode !== 'cinematic' || !trace.complete || trace.error) throw Error('Frame not ready');
      return renderer.domElement.toDataURL('image/png');
    },
    renderStatus: () => ({mode:trace.mode,samples:trace.samples,target:trace.goal,error:trace.error}),
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
      trace.invalidate();
    },
    /** Debug aid: place the camera for close-up validation shots. */
    camera: (
      position: [number, number, number],
      lookAt: [number, number, number],
    ) => {
      manualCamera = true;
      camera.position.set(...position);
      camera.lookAt(lookAt[0], lookAt[1], lookAt[2]);
      camera.focusDistance=camera.position.distanceTo(new THREE.Vector3(...lookAt));
      trace.invalidate();
    },
    cinematicCamera: () => { manualCamera = false; updateCamera(time); trace.invalidate(); },
    cameraStatus: () => ({ focalLength: CAMERA_FOCAL_MM, sensor: [36,24], fov: camera.fov, position: camera.position.toArray(), manual: manualCamera }),
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
        bindingLineX: boundBlock.position.x,
        sheetCount: NUM_SHEETS,
        bindings: Array.from({ length: NUM_SHEETS }, (_, k) => ({
          index: k,
          current: (() => {
            const root = textRoot(BOOK_DIMENSIONS, k, u);
            const load = bindingLoad(time, u, TIMELINE.turns) * smootherstep(clamp01((u - 0.95) / 0.05));
            return { x: root.x, y: root.y + bindingLift(root.x, SPINE_PANEL_W, load) };
          })(),
          right: textRoot(BOOK_DIMENSIONS, k),
          left: textRoot(BOOK_DIMENSIONS, k),
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
          const wx = p.x + W / 2 + boundBlock.position.x; // world x
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
          spineX: spine.x + W / 2 + boundBlock.position.x,
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
    bindingGeo.dispose();
    bindingMaterial.dispose();
    for (const entry of staticSheets) entry.mesh.geometry.dispose();
    spineCoverGeo.dispose();
    headbandGeo.dispose();
    prints.dispose();
    disposeTable();
    clothTexture.dispose();
    scene.environment = null;
    trace.dispose();
    environment.dispose();
    renderer.dispose();
  };
}