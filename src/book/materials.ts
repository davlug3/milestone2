import * as THREE from "three";

/**
 * Shared, restrained materials for the book.
 *
 * Kept simple for Milestone 1 (flat colors, physically based). Photographic
 * page textures and fine paper grain arrive in later milestones.
 */
export function createBookMaterials() {
  const cover = new THREE.MeshStandardMaterial({
    color: 0x1c2733, // deep desaturated blue-grey cloth
    roughness: 0.82,
    metalness: 0.0,
  });

  // Endpaper (pastedown + flyleaf). Slightly deeper than the paper so the
  // pastedown reads as a different stock from the text block.
  const endpaper = new THREE.MeshStandardMaterial({
    color: 0xcdbfa4, // warm stone / oatmeal
    roughness: 0.96,
    metalness: 0.0,
  });

  // The crease along the hinge of a pastedown: a shade darker, low sheen.
  const endpaperHinge = new THREE.MeshStandardMaterial({
    color: 0xb3a488,
    roughness: 0.94,
    metalness: 0.0,
  });

  const paper = new THREE.MeshStandardMaterial({
    color: 0xf4efe4, // warm off-white paper
    roughness: 0.92,
    metalness: 0.0,
  });

  const paperEdge = new THREE.MeshStandardMaterial({
    color: 0xe6dcc8, // slightly darker cut paper edge
    roughness: 0.95,
    metalness: 0.0,
  });

  const spine = new THREE.MeshStandardMaterial({
    color: 0x16202a, // darker spine cloth
    roughness: 0.78,
    metalness: 0.0,
    // The spine is a thin closed shell; double-sided keeps the head/tail caps
    // and grazing silhouettes solid.
    side: THREE.DoubleSide,
  });

  return { cover, endpaper, endpaperHinge, paper, paperEdge, spine };
}

export type BookMaterials = ReturnType<typeof createBookMaterials>;
