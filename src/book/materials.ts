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

  const coverInner = new THREE.MeshStandardMaterial({
    color: 0xd9cbb2, // warm endpaper / inner lining
    roughness: 0.95,
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
  });

  return { cover, coverInner, paper, paperEdge, spine };
}

export type BookMaterials = ReturnType<typeof createBookMaterials>;