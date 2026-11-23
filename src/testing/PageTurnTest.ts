import * as THREE from "three";
import { PaperSimulation } from "../physics/PaperSimulation";
import { ThickSheetGeometry } from "../paper/ThickSheetGeometry";
import { createPaperMaterial } from "../paper/PaperMaterial";
import { PageTurnController } from "../animation/PageTurnController";

/**
 * Test scene: one guided page turn over a simple book block.
 *
 * A sheet lies flat in the XZ plane. The entire spine edge (c=0) is pinned to
 * the gutter. The whole FORE-EDGE (c=cols-1) is driven by a PageTurnController
 * along a semicircular arc of radius = page width about the gutter, producing a
 * smooth developable curl (no sharp cone fold). After the sweep the fore-edge
 * is held at its final rest position so the page settles on the left.
 *
 * The page is NOT rotated rigidly: only the fore-edge is guided; constraints,
 * bending, gravity, and the ground compute the rest of the shape.
 *
 * Reached via `?test=page-turn`. Supports `?t=<seconds>` to freeze at a given
 * time for deterministic screenshots.
 */
export function startPageTurnTest(
  container: HTMLElement,
  options?: { freezeTime?: number },
): () => void {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0b0d);

  const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.01,
    100,
  );
  camera.position.set(0.05, 0.42, 0.5);
  camera.lookAt(0, 0.02, 0);

  // Lighting.
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const key = new THREE.DirectionalLight(0xffffff, 1.7);
  key.position.set(-0.3, 0.7, 0.4);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xdfe8ff, 0.5);
  fill.position.set(0.5, 0.3, -0.3);
  scene.add(fill);

  // Sheet dimensions: page lies flat. Width (X) = turn direction, height (Z).
  const cols = 25;
  const rows = 33;
  const width = 0.24;
  const height = 0.3;
  const restY = 0.05; // rest height above the ground (matches metrics harness)
  const turnDuration = 2.6;
  const settleDuration = 1.2;
  const totalDuration = turnDuration + settleDuration;

  const sim = new PaperSimulation({
    cols,
    rows,
    width,
    height,
    dt: 1 / 120,
    iterations: 12,
    bendStiffness: 1.0,
    longRangeBend: true,
    plane: "xz",
    groundY: restY - 0.004,
  });
  for (const p of sim.particles) p.y = p.py = restY;

  // Pin the spine edge (c=0) to the gutter.
  for (let r = 0; r < rows; r++) sim.pin(r * cols + 0);

  // Fore-edge indices (c = cols-1).
  const foreEdgeIndices: number[] = [];
  for (let r = 0; r < rows; r++) foreEdgeIndices.push(r * cols + (cols - 1));

  const controller = new PageTurnController({
    foreEdgeIndices,
    gutterX: -width / 2,
    restY,
    landY: restY - 0.004,
    width, // arc radius = page width
    duration: turnDuration,
    liftScale: 0.6, // < 1 => real curl
    lead: 0.04,
    liftVar: 0.06,
    rows,
  });
  controller.seedZ(sim.particles);
  controller.setProgress(0);
  controller.apply(sim.particles);

  // Geometry + material.
  const geo = new ThickSheetGeometry(cols, rows, 0.00025);
  const material = createPaperMaterial();
  material.side = THREE.DoubleSide;
  const mesh = new THREE.Mesh(geo.geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.position.x = width / 2; // put gutter at world x=0
  scene.add(mesh);

  // Ground / destination surface (near rest height so the page settles gently).
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.95 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = restY - 0.004;
  ground.receiveShadow = true;
  scene.add(ground);

  geo.update(sim.particles);

  // Deterministic freeze support: simulate to freezeTime then hold.
  let simTime = 0;
  const step = 1 / 120;
  function advanceTo(t: number): void {
    const targetSteps = Math.round(t / step);
    while (simTime < targetSteps - 1e-6) {
      simTime += step;
      const progress = Math.min(simTime / turnDuration, 1);
      controller.setProgress(progress);
      controller.apply(sim.particles);
      sim.step();
    }
    geo.update(sim.particles);
  }

  if (options?.freezeTime !== undefined) {
    advanceTo(Math.min(options.freezeTime, totalDuration));
  }

  let last = performance.now();
  let acc = 0;
  let raf = 0;

  function frame(now: number): void {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    if (options?.freezeTime === undefined) {
      acc += dt;
      let steps = 0;
      while (acc >= step && steps < 8) {
        simTime += step;
        const progress = Math.min(simTime / turnDuration, 1);
        controller.setProgress(progress);
        controller.apply(sim.particles);
        sim.step();
        acc -= step;
        steps++;
      }
      geo.update(sim.particles);
    }
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

  (window as unknown as { __sceneReady: boolean }).__sceneReady = true;

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", onResize);
    geo.dispose();
    renderer.dispose();
  };
}