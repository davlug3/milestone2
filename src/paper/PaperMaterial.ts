import * as THREE from "three";

/**
 * Paper material with restrained, physically based appearance (PLAN.md 6.3).
 *
 * Warm off-white, high roughness, low metal, no clearcoat. A subtle procedural
 * grain provides a faint bump so the surface isn't perfectly flat under grazing
 * light. Front/back can differ later; for now one material is used for the
 * whole thin shell.
 */
export function createPaperMaterial(
  options: { color?: number; roughness?: number } = {},
): THREE.MeshStandardMaterial {
  const grain = makeGrainTexture(256);

  return new THREE.MeshStandardMaterial({
    color: options.color ?? 0xf4efe4,
    roughness: options.roughness ?? 0.92,
    metalness: 0.0,
    bumpMap: grain,
    bumpScale: 0.0008,
    // No clearcoat / plastic look.
  });
}

/**
 * Small deterministic fiber/grain texture used as a bump map.
 * Values are mid-grey with fine noise so bump detail is subtle.
 */
function makeGrainTexture(size: number): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  // Deterministic hash noise (no per-frame RNG).
  const rand = (x: number, y: number): number => {
    const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return n - Math.floor(n);
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Fine grain + faint horizontal fiber bias.
      const fine = rand(x, y);
      const fiber = rand(Math.floor(x / 8), y);
      const v = 128 + (fine - 0.5) * 40 + (fiber - 0.5) * 16;
      const c = Math.max(0, Math.min(255, v));
      const i = (y * size + x) * 4;
      data[i] = c;
      data[i + 1] = c;
      data[i + 2] = c;
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  // Mipmapped trilinear filtering: a fine grain sampled with nearest filtering
  // under minification produces strong moire bands across the page.
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}