import * as THREE from "three";
import { PaperSimulation } from "../physics/PaperSimulation";
import { PageGeometry } from "../paper/PageGeometry";

/**
 * Test scene: one deformable sheet under gravity.
 *
 * A grid sheet starts flat, pinned along its top edge, and sags under gravity.
 * Used to validate integration, structural/shear constraints, UV stability,
 * and determinism. Reached via `?test=paper-drop`.
 *
 * Returns a cleanup function.
 */
export function startPaperDropTest(container: HTMLElement): () => void {
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
  camera.position.set(0, 0, 0.6);
  camera.lookAt(0, 0, 0);

  // Lighting.
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(0.3, 0.5, 0.6);
  scene.add(key);

  // Sheet: 0.2 x 0.28 m, moderate grid.
  const cols = 25;
  const rows = 33;
  const sim = new PaperSimulation({
    cols,
    rows,
    width: 0.2,
    height: 0.28,
    dt: 1 / 120,
    iterations: 8,
  });

  // Pin the entire top row (r = rows-1) so the sheet hangs.
  for (let c = 0; c < cols; c++) {
    sim.pin((rows - 1) * cols + c);
  }

  const pageGeo = new PageGeometry(cols, rows);
  const material = new THREE.MeshStandardMaterial({
    color: 0xf4efe4,
    roughness: 0.92,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(pageGeo.geometry, material);
  mesh.castShadow = true;
  scene.add(mesh);
  pageGeo.update(sim.particles);

  // Fixed-timestep accumulator.
  let last = performance.now();
  let acc = 0;
  const step = 1 / 120;

  function frame(now: number): void {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    acc += dt;
    let steps = 0;
    while (acc >= step && steps < 8) {
      sim.step();
      acc -= step;
      steps++;
    }
    pageGeo.update(sim.particles);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }
  let raf = requestAnimationFrame(frame);

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
    pageGeo.dispose();
    renderer.dispose();
  };
}