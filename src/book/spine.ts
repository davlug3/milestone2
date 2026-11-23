import * as THREE from "three";
import type { BookDimensions } from "../config/bookConfig";
import type { BookMaterials } from "./materials";

/**
 * Curved spine strip bridging the front and back covers along the left edge.
 *
 * Local frame matches the book: spine runs along Z (the height dimension) at
 * the left edge (x = -width/2). The cross-section is an arc in the XY plane
 * that bulges outward (-X) and connects the bottom cover to the top cover.
 *
 * For Milestone 1 this is a static curved surface. Procedural deformation
 * driven by the cover angle arrives in Milestone 6.
 */
export function createSpine(
  dims: BookDimensions,
  materials: BookMaterials,
): THREE.Mesh {
  const arcSegments = 24;
  const heightSegments = 8;

  const x0 = -dims.width / 2;
  const y0 = dims.closedThickness / 2;
  const halfT = dims.closedThickness / 2;
  // How far the spine bows outward from the cover edge.
  const spineDepth = dims.coverThickness * 1.6;
  const z0 = -dims.height / 2;

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let j = 0; j <= heightSegments; j++) {
    const v = j / heightSegments;
    const z = z0 + v * dims.height;
    for (let i = 0; i <= arcSegments; i++) {
      const t = -Math.PI / 2 + (i / arcSegments) * Math.PI;
      const x = x0 - spineDepth * Math.cos(t);
      const y = y0 + halfT * Math.sin(t);
      positions.push(x, y, z);
      uvs.push(i / arcSegments, v);
    }
  }

  const stride = arcSegments + 1;
  for (let j = 0; j < heightSegments; j++) {
    for (let i = 0; i < arcSegments; i++) {
      const a = j * stride + i;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, materials.spine);
  mesh.name = "spine";
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}