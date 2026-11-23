import * as THREE from "three";
import { PaperSimulation } from "../physics/PaperSimulation";
import { ThickSheetGeometry } from "../paper/ThickSheetGeometry";
import { createPaperMaterial } from "../paper/PaperMaterial";
import { PageTurnController } from "../animation/PageTurnController";

/**
 * Test scene: one guided page turn over a simple book block.
 *
 * A sheet lies flat in the XZ plane (spine at -X). The entire spine edge (c=0)
 * is pinned to the binding. One fore-edge corner is guided by a
 * PageTurnController through lift -> peel -> arch -> crossing -> fall -> settle.
 * A flat destination surface (ground at y=0) catches the page.
 *
 * The page is NOT rotated rigidly: only the corner pin is driven; constraints,
 * gravity, and the ground compute the rest.
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
  const width = 0.22;
  const height = 0.3;
  const restY = 0.004; // rest height of the page above the destination surface

  const sim = new PaperSimulation({
    cols,
    rows,
    width,
    height,
    dt: 1 / 120,
    iterations: 8,
    bendStiffness: 0.4,
    plane: "xz",
    groundY: 0.0,
  });
  // Lift the whole sheet to restY so it sits above the ground surface.
  for (const p of sim.particles) {
    p.y = p.py = restY;
  }

  // Pin the spine edge (c=0) to the binding.
  for (let r = 0; r < rows; r++) {
    sim.pin(r * cols + 0);
  }

  // Choose a fore-edge corner at (c=cols-1, r=0): x=+width/2, z=-height/2.
  const cornerIndex = 0 * cols + (cols - 1);
  const cornerParticle = sim.particles[cornerIndex];
  const turnDuration = 3.0;
  const controller = new PageTurnController({
    cornerIndex,
    cornerRest: { x: cornerParticle.x, y: restY, z: cornerParticle.z },
    corner: { x: 1, z: -1 },
    liftHeight: 0.09,
    travelX: -width, // move corner from +X to -X (over to destination side)
    duration: turnDuration,
    flutter: 0.004,
  });
  // Pin the corner to the controller.
  controller.update(0);
  controller.apply(cornerParticle);

  // Geometry + material.
  const geo = new ThickSheetGeometry(cols, rows, 0.00025);
  const material = createPaperMaterial();
  material.side = THREE.DoubleSide;
  const mesh = new THREE.Mesh(geo.geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);

  // Simple ground / destination surface.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.95 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0;
  ground.receiveShadow = true;
  scene.add(ground);

  // Optional destination stack (thin block on -X side).
  const stack = new THREE.Mesh(
    new THREE.BoxGeometry(width, restY, height),
    new THREE.MeshStandardMaterial({ color: 0xe6dcc8, roughness: 0.95 }),
  );
  stack.position.set(-width / 2 - width / 2, restY / 2, 0);
  stack.receiveShadow = true;
  scene.add(stack);

  geo.update(sim.particles);

  // Deterministic freeze support: simulate to freezeTime then hold.
  let simTime = 0;
  const step = 1 / 120;
  if (options?.freezeTime !== undefined) {
    const steps = Math.round(options.freezeTime / step);
    for (let i = 0; i < steps; i++) {
      simTime += step;
      const p = Math.min(simTime / turnDuration, 1);
      controller.update(p);
      controller.apply(cornerParticle);
      sim.step();
    }
    geo.update(sim.particles);
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
        const p = Math.min(simTime / turnDuration, 1);
        controller.update(p);
        controller.apply(cornerParticle);
        sim.step();
        acc -= step;
        steps++;
      }
    }
    geo.update(sim.particles);
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