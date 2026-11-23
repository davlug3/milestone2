import * as THREE from "three";
import { BOOK_DIMENSIONS } from "../config/bookConfig";
import { createBookMaterials } from "../book/materials";
import { createCover } from "../book/cover";
import { addStudioLighting } from "../rendering/lighting";
import { PaperSimulation } from "../physics/PaperSimulation";
import { ThickSheetGeometry } from "../paper/ThickSheetGeometry";
import { createPaperMaterial } from "../paper/PaperMaterial";
import { PageTurnController } from "../animation/PageTurnController";
import { smootherstep, clamp01 } from "../animation/easing";

/**
 * Animated book demo with a play/pause button.
 *
 * Starts as a CLOSED hardcover book on the right (back cover + page block +
 * turning pages, all under the closed front cover; nothing on the left). On
 * Play:
 *   1. the front cover swings open to the left
 *   2. three deformable pages turn right->left and settle on the opened cover
 *
 * Realism notes:
 *  - The WHOLE fore-edge is driven along a smooth arc (not a single corner).
 *  - Per-row phase lead twists the sheet so it curls in 2D (width + height),
 *    not as a uniform cylinder.
 *  - Long-range bending links distribute curvature (smooth curl, no crease).
 *  - A heightfield collision (tall right stack, low left) keeps the page from
 *    penetrating the book or other pages; the page lands on the left stack.
 *  - The spine strip top is below the page rest plane so pages never intersect
 *    the binding.
 *
 * Playback is deterministic in an absolute timeline `time` (seconds); physics
 * is stepped to match, so seeking and playing agree.
 */

const W = BOOK_DIMENSIONS.width;
const H = BOOK_DIMENSIONS.height;
const CT = BOOK_DIMENSIONS.coverThickness;
const PBT = 0.012; // page block thickness
const NUM_TURNS = 3;

const FIXED_DT = 1 / 120;
const blockTop = CT + PBT; // right stack top

interface TurnWindow {
  start: number;
  dur: number;
  settle: number;
}

const TIMELINE = {
  coverStart: 0.6,
  coverEnd: 3.2,
  turns: [
    { start: 3.8, dur: 2.6, settle: 0.9 },
    { start: 7.0, dur: 2.6, settle: 0.9 },
    { start: 10.2, dur: 2.6, settle: 0.9 },
  ] as TurnWindow[],
  end: 13.8,
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
  camera.position.set(0.03, 0.5, 0.68);
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

  // --- Book parts (closed on the right; gutter at x=0) ---------------------
  const materials = createBookMaterials();

  // Back cover (bottom, right side).
  const backCover = createCover(BOOK_DIMENSIONS, materials, "back");
  backCover.position.set(W / 2, CT / 2, 0);
  scene.add(backCover);

  // Right page block (the unturned pages).
  const rightBlock = new THREE.Mesh(
    new THREE.BoxGeometry(W * 0.96, PBT, H * 0.97),
    materials.paperEdge,
  );
  rightBlock.position.set(W / 2, CT + PBT / 2, 0);
  rightBlock.castShadow = true;
  rightBlock.receiveShadow = true;
  scene.add(rightBlock);

  // Spine strip at the gutter (x=0). Top kept at block-top height so it never
  // pokes into the turning pages.
  const spine = new THREE.Mesh(
    new THREE.BoxGeometry(0.006, blockTop, H),
    materials.spine,
  );
  spine.position.set(0, blockTop / 2, 0);
  spine.castShadow = true;
  scene.add(spine);

  // --- Front cover (closed on the right, opens to the left) ----------------
  const restBase = blockTop + 0.0005; // bottom turning page rest height
  const pageVStep = 0.0004;
  const topTurningPageY = restBase + (NUM_TURNS - 1) * pageVStep + 0.0003;
  const coverBottom = topTurningPageY + 0.0004;
  const closedTopY = coverBottom + CT / 2;

  const frontCover = createCover(BOOK_DIMENSIONS, materials, "front");
  const closedPos = new THREE.Vector3(W / 2, closedTopY, 0);
  const openPos = new THREE.Vector3(-W / 2, CT / 2, 0); // open flat on the left
  const closedQuat = new THREE.Quaternion();
  const openQuat = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 0, 1),
    Math.PI,
  );
  frontCover.position.copy(closedPos);
  frontCover.quaternion.copy(closedQuat);
  scene.add(frontCover);

  // --- Turning pages -------------------------------------------------------
  const cols = 25;
  const rows = 33;
  const pages: PageInstance[] = [];

  for (let i = 0; i < NUM_TURNS; i++) {
    const win = TIMELINE.turns[i];
    // Page 0 (turns first) starts on top (highest).
    const pageRestY = restBase + (NUM_TURNS - 1 - i) * pageVStep;
    const landY = CT + 0.0003 + i * 0.0005; // destination stack top (grows)

    // Heightfield collision: tall right stack, low left stack.
    const groundHeight = (x: number, _z: number): number => {
      if (x >= 0) return blockTop; // right stack + gutter
      return landY; // left side (open cover + already-turned pages)
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
      plane: "xz",
      groundHeight,
    });
    for (const p of sim.particles) p.y = p.py = pageRestY;

    // Pin the spine edge (c=0) at the gutter height.
    for (let r = 0; r < rows; r++) sim.pin(r * cols + 0);

    const foreEdgeIndices: number[] = [];
    for (let r = 0; r < rows; r++) foreEdgeIndices.push(r * cols + (cols - 1));

    const controller = new PageTurnController({
      foreEdgeIndices,
      gutterX: -W / 2,
      restY: pageRestY,
      landY,
      width: W,
      duration: win.dur,
      liftScale: 0.6,
      lead: 0.04, // 2D twist: head/tail lead differently
      liftVar: 0.06, // 2D dome: head/tail edges curl a touch more than center
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
    pages.push({
      sim,
      geo,
      mesh,
      controller,
      window: win,
      stepped: 0,
      maxSteps,
      restY: pageRestY,
      landY,
    });
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
    pg.sim.reset();
    for (const p of pg.sim.particles) p.y = p.py = pg.restY;
    pg.controller.setProgress(0);
    pg.controller.apply(pg.sim.particles);
    pg.geo.update(pg.sim.particles);
  }

  function seek(t: number): void {
    time = Math.max(0, Math.min(t, TIMELINE.end));
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
      pg.geo.update(pg.sim.particles);
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