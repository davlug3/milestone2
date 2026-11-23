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
 * A closed hardcover book rests on a studio surface. Pressing Play runs a
 * deterministic timeline:
 *   closed -> front cover swings open -> three deformable pages turn and stack
 *   on the left.
 *
 * Pages use the real PBD solver (PaperSimulation + PageTurnController); only
 * one page is dynamic at a time. The cover is a rigid board animated with a
 * quaternion slerp (covers are rigid in reality; only pages must deform).
 *
 * Playback is driven by an absolute timeline `time` (seconds). Physics is
 * stepped to match `time` via per-page step counters, so seeking and playing
 * produce the same result (deterministic).
 */

const W = BOOK_DIMENSIONS.width;
const H = BOOK_DIMENSIONS.height;
const CT = BOOK_DIMENSIONS.coverThickness;
const PBT = 0.012; // page block thickness for the demo (kept short so gutter is low)

const FIXED_DT = 1 / 120;

interface TurnWindow {
  start: number;
  dur: number;
  settle: number;
}

const TIMELINE = {
  coverStart: 0.6,
  coverEnd: 3.4,
  turns: [
    { start: 3.9, dur: 2.4, settle: 0.6 },
    { start: 7.0, dur: 2.4, settle: 0.6 },
    { start: 10.1, dur: 2.4, settle: 0.6 },
  ] as TurnWindow[],
  end: 13.5,
};

interface PageInstance {
  sim: PaperSimulation;
  geo: ThickSheetGeometry;
  mesh: THREE.Mesh;
  controller: PageTurnController;
  corner: import("../physics/Particle").Particle;
  window: TurnWindow;
  stepped: number;
  maxSteps: number;
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
  camera.position.set(0.06, 0.5, 0.62);
  camera.lookAt(0, 0.04, 0);

  addStudioLighting(scene);
  // Extra soft key aimed at the gutter so turning pages read clearly.
  const pageKey = new THREE.DirectionalLight(0xffffff, 0.8);
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

  // --- Book parts ----------------------------------------------------------
  const materials = createBookMaterials();
  const closedTopY = CT + PBT + CT / 2;

  // Back cover (bottom, on the right side).
  const backCover = createCover(BOOK_DIMENSIONS, materials, "back");
  backCover.position.set(W / 2, CT / 2, 0);
  scene.add(backCover);

  // Page block on the right (static representation of the unturned pages).
  const pageBlock = new THREE.Mesh(
    new THREE.BoxGeometry(W * 0.96, PBT, H * 0.97),
    materials.paperEdge,
  );
  pageBlock.position.set(W / 2, CT + PBT / 2, 0);
  pageBlock.castShadow = true;
  pageBlock.receiveShadow = true;
  scene.add(pageBlock);

  // A few thin sheets on top of the block for a layered look.
  for (let i = 0; i < 4; i++) {
    const sheet = new THREE.Mesh(
      new THREE.BoxGeometry(W * 0.96, 0.0004, H * 0.97),
      i % 2 === 0 ? materials.paper : materials.paperEdge,
    );
    sheet.position.set(
      W / 2,
      CT + PBT + 0.0004 * (i + 0.5),
      0,
    );
    sheet.receiveShadow = true;
    scene.add(sheet);
  }

  // Spine (thin strip at the gutter, x=0).
  const spine = new THREE.Mesh(
    new THREE.BoxGeometry(0.006, CT + PBT + CT, H),
    materials.spine,
  );
  spine.position.set(0, (CT + PBT + CT) / 2, 0);
  spine.castShadow = true;
  scene.add(spine);

  // Front cover (animated rigid board).
  const frontCover = createCover(BOOK_DIMENSIONS, materials, "front");
  const closedPos = new THREE.Vector3(W / 2, closedTopY, 0);
  const openPos = new THREE.Vector3(-W / 2, CT / 2 + 0.0006, 0);
  const closedQuat = new THREE.Quaternion(); // identity
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
  const restY = CT + PBT + 0.0016;
  const pages: PageInstance[] = [];

  for (let i = 0; i < TIMELINE.turns.length; i++) {
    const win = TIMELINE.turns[i];
    const pageRestY = restY + i * 0.0009;
    const sim = new PaperSimulation({
      cols,
      rows,
      width: W,
      height: H,
      dt: FIXED_DT,
      iterations: 8,
      bendStiffness: 0.4,
      plane: "xz",
      groundY: 0.0012 + i * 0.0006,
    });
    for (const p of sim.particles) p.y = p.py = pageRestY;

    // Pin the spine edge (c=0) to the gutter.
    for (let r = 0; r < rows; r++) sim.pin(r * cols + 0);

    const cornerIndex = 0 * cols + (cols - 1);
    const corner = sim.particles[cornerIndex];
    const controller = new PageTurnController({
      cornerIndex,
      cornerRest: { x: corner.x, y: pageRestY, z: corner.z },
      corner: { x: 1, z: -1 },
      liftHeight: 0.13,
      travelX: -2 * W, // full flip: fore-edge swings from right to left
      duration: win.dur,
      flutter: 0.004,
    });
    controller.update(0);
    controller.apply(corner);

    const geo = new ThickSheetGeometry(cols, rows, 0.00025);
    const material = createPaperMaterial();
    material.side = THREE.DoubleSide;
    const mesh = new THREE.Mesh(geo.geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    // Offset so the pinned spine edge sits at the gutter (x=0).
    mesh.position.x = W / 2;
    scene.add(mesh);
    geo.update(sim.particles);

    const maxSteps = Math.ceil((win.dur + win.settle) / FIXED_DT);
    pages.push({ sim, geo, mesh, controller, corner, window: win, stepped: 0, maxSteps });
  }

  // --- UI (play / pause button + time label) -------------------------------
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
    if (next && time >= TIMELINE.end) seek(0); // replay from start if at end
    playing = next;
    button.textContent = playing ? "❚❚ Pause" : "▶ Play";
  }

  function seek(t: number): void {
    time = Math.max(0, Math.min(t, TIMELINE.end));
    // Reset all pages to their initial state, then fast-forward deterministically.
    for (const pg of pages) {
      pg.stepped = 0;
      pg.sim.reset();
      for (const p of pg.sim.particles) p.y = p.py = restY;
      // re-pin spine edge (reset keeps pin flags, but ensure positions)
      pg.controller.update(0);
      pg.controller.apply(pg.corner);
      pg.geo.update(pg.sim.particles);
    }
    stepPagesTo(time);
    updateCover(time);
  }

  function stepPagesTo(t: number): void {
    for (const pg of pages) {
      const target = Math.max(
        0,
        Math.min(pg.maxSteps, Math.floor((t - pg.window.start) / FIXED_DT)),
      );
      // Catch up fully to the target. `seek` may jump far (needs many steps),
      // while live playback advances only a few steps per frame, so the loop
      // cost is bounded by how far time moved.
      while (pg.stepped < target) {
        const local = pg.stepped * FIXED_DT;
        const progress = clamp01(local / pg.window.dur);
        pg.controller.update(progress);
        pg.controller.apply(pg.corner);
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
    // Position lerp + vertical arc so the cover swings up and over.
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
      // Advance in fixed steps for determinism.
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

  // Expose a small debug/automation API.
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