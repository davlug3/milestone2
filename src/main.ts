import * as THREE from "three";

/**
 * Milestone 0 — Minimal WebGL scene.
 *
 * Purpose: prove that a Three.js WebGLRenderer (WebGL 2) scene runs, renders
 * a frame, and exposes a deterministic "scene ready" signal for later
 * Playwright visual validation. No book geometry or physics yet.
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
container.appendChild(renderer.domElement);

// --- Scene & camera ---------------------------------------------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a0a);

const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.01,
  100,
);
camera.position.set(0.4, 0.3, 0.6);
camera.lookAt(0, 0, 0);

// --- Placeholder geometry (temporary, not the book) ------------------------
const geometry = new THREE.BoxGeometry(0.24, 0.31, 0.035);
const material = new THREE.MeshStandardMaterial({
  color: 0xcccccc,
  roughness: 0.9,
  metalness: 0.0,
});
const mesh = new THREE.Mesh(geometry, material);
scene.add(mesh);

// --- Lighting (temporary) ---------------------------------------------------
const keyLight = new THREE.DirectionalLight(0xffffff, 2.0);
keyLight.position.set(0.5, 0.8, 0.5);
scene.add(keyLight);

const ambient = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambient);

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
// Marks that the renderer initialized and the first frame is scheduled.
(window as unknown as { __sceneReady: boolean }).__sceneReady = true;