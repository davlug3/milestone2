import * as THREE from "three";

/**
 * Restrained studio lighting for Milestone 1.
 *
 * Large soft key from upper-left/front, gentle fill opposite, and a subtle rim
 * to reveal edges. Tuned for a dark, quiet studio so the book stays the focus.
 * Refined in Milestone 9 with environment lighting and shadows tuning.
 */
export function addStudioLighting(scene: THREE.Scene): void {
  // Soft key light.
  const key = new THREE.DirectionalLight(0xfff4e6, 2.4);
  key.position.set(-0.6, 0.9, 0.5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 0.01;
  key.shadow.camera.far = 4;
  key.shadow.camera.left = -0.5;
  key.shadow.camera.right = 0.5;
  key.shadow.camera.top = 0.5;
  key.shadow.camera.bottom = -0.5;
  key.shadow.bias = -0.0005;
  // normalBias offsets shadow lookups along the surface normal to suppress
  // shadow acne (the dark triangular self-shadowing on thin, curved pages).
  key.shadow.normalBias = 0.0015;
  scene.add(key);

  // Gentle fill from the opposite side.
  const fill = new THREE.DirectionalLight(0xdfe8ff, 0.7);
  fill.position.set(0.7, 0.4, -0.3);
  scene.add(fill);

  // Subtle rim from behind to separate page edges from the background.
  const rim = new THREE.DirectionalLight(0xffffff, 0.5);
  rim.position.set(0.1, 0.3, -0.8);
  scene.add(rim);

  // Low ambient so shadows aren't pure black.
  const ambient = new THREE.AmbientLight(0xffffff, 0.25);
  scene.add(ambient);
}