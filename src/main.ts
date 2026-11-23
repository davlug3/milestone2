import * as THREE from "three";
import { createBook } from "./book/createBook";
import { addStudioLighting } from "./rendering/lighting";

/**
 * Milestone 1 — Static book block.
 *
 * A closed hardcover book (two covers, spine, layered page stack) rests on a
 * dark studio surface under basic three-point lighting. Camera is framed
 * three-quarter on the book. No physics or animation yet.
 */

const container = document.getElementById("app") ?? document.body;

// --- Renderer ---------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

// --- Scene & camera ---------------------------------------------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0b0d);

const camera = new THREE.PerspectiveCamera(
  42,
  window.innerWidth / window.innerHeight,
  0.01,
  100,
);
// Three-quarter view looking slightly down at the book resting on the ground.
// A low-ish elevation reveals the fore-edge page stack and the spine.
camera.position.set(0.46, 0.20, 0.46);
camera.lookAt(0, 0.018, 0);

// --- Ground studio surface --------------------------------------------------
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(8, 8),
  new THREE.MeshStandardMaterial({
    color: 0x111317,
    roughness: 0.95,
    metalness: 0.0,
  }),
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = 0;
ground.receiveShadow = true;
scene.add(ground);

// --- Book -------------------------------------------------------------------
const book = createBook();
scene.add(book);

// --- Lighting ---------------------------------------------------------------
addStudioLighting(scene);

// --- Resize handling --------------------------------------------------------
function onResize(): void {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}
window.addEventListener("resize", onResize);

// --- Render loop ------------------------------------------------------------
function render(): void {
  requestAnimationFrame(render);
  renderer.render(scene, camera);
}
render();

// --- Scene-ready signal (for visual validation tooling) ---------------------
(window as unknown as { __sceneReady: boolean }).__sceneReady = true;