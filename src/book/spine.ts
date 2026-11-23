import * as THREE from "three";
import type { BookDimensions } from "../config/bookConfig";
import type { BookMaterials } from "./materials";
import {
  type SpinePose,
  spineBounds,
  spineCrossSection,
  spineNormal,
  spineProtrusion,
} from "./spineRig";

/**
 * Deformable spine shell.
 *
 * The cross-section comes from `spineRig` (a quadratic Bezier from the back
 * board's edge to the front board's outer hinge corner). This module gives it
 * thickness (cloth + board) and a Z extent, and rebuilds the vertices as the
 * cover opens so the spine visibly rounds when closed and tucks into the
 * spine hollow when open.
 *
 * A closed book's spine is a rounded bar; a rigid rectangular bar is the
 * failure mode this exists to avoid.
 */

export interface SpineRigOptions {
  /** World X of the spine (back-board edge). Default 0 (demo frame). */
  originX?: number;
  /** Cross-section samples along the arc. */
  arcSegments?: number;
  /** Rows along the book height. */
  zSegments?: number;
  /** Shell thickness (m). */
  thickness?: number;
}

export interface SpineRig {
  mesh: THREE.Mesh;
  update(pose: SpinePose): void;
  /** Current world-space bounds of the shell (validation/debug aid). */
  bounds(): { minX: number; maxX: number; minY: number; maxY: number };
  /** Visible bulge depth (m) at the last applied pose. */
  protrusion(): number;
}

export function createSpineRig(
  dims: BookDimensions,
  materials: BookMaterials,
  options: SpineRigOptions = {},
): SpineRig {
  const originX = options.originX ?? 0;
  const arcSegments = options.arcSegments ?? 24;
  const zSegments = options.zSegments ?? 6;
  const halfThickness = (options.thickness ?? 0.0008) * 0.5;

  const cols = arcSegments + 1;
  const rows = zSegments + 1;
  const vertsPerRow = cols * 2; // outer layer + inner layer
  const vertexCount = rows * vertsPerRow;

  const positions = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const indices: number[] = [];

  // Static index buffer / UVs (positions are rewritten on update).
  for (let j = 0; j < rows; j++) {
    const v = j / zSegments;
    for (let layer = 0; layer < 2; layer++) {
      for (let i = 0; i < cols; i++) {
        const idx = j * vertsPerRow + layer * cols + i;
        uvs[idx * 2] = i / arcSegments;
        uvs[idx * 2 + 1] = v;
      }
    }
  }

  const outer = (j: number, i: number) => j * vertsPerRow + i;
  const inner = (j: number, i: number) => j * vertsPerRow + cols + i;

  for (let j = 0; j < zSegments; j++) {
    for (let i = 0; i < arcSegments; i++) {
      const a = outer(j, i);
      const b = outer(j, i + 1);
      const c = outer(j + 1, i + 1);
      const d = outer(j + 1, i);
      indices.push(a, d, b, b, d, c);

      const ai = inner(j, i);
      const bi = inner(j, i + 1);
      const ci = inner(j + 1, i + 1);
      const di = inner(j + 1, i);
      indices.push(ai, bi, di, bi, ci, di);
    }
  }

  // Close the four boundaries (back edge, front edge, head, tail).
  for (let j = 0; j < zSegments; j++) {
    // back attachment edge (i = 0)
    const a = outer(j, 0);
    const b = outer(j + 1, 0);
    const ai = inner(j, 0);
    const bi = inner(j + 1, 0);
    indices.push(a, ai, b, b, ai, bi);

    // front attachment edge (i = arcSegments)
    const e = outer(j, arcSegments);
    const f = outer(j + 1, arcSegments);
    const ei = inner(j, arcSegments);
    const fi = inner(j + 1, arcSegments);
    indices.push(e, f, ei, f, fi, ei);
  }
  for (let i = 0; i < arcSegments; i++) {
    // tail cap (j = 0)
    const a = outer(0, i);
    const b = outer(0, i + 1);
    const ai = inner(0, i);
    const bi = inner(0, i + 1);
    indices.push(a, b, ai, b, bi, ai);

    // head cap (j = zSegments)
    const e = outer(zSegments, i);
    const f = outer(zSegments, i + 1);
    const ei = inner(zSegments, i);
    const fi = inner(zSegments, i + 1);
    indices.push(e, ei, f, f, ei, fi);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(indices);

  const material = materials.spine;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "spine";
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const z0 = -dims.height / 2;
  const z1 = dims.height / 2;
  let lastProtrusion = 0;
  let lastPose: SpinePose = { u: 0, hingeY: dims.coverThickness, angle: 0 };

  function update(pose: SpinePose): void {
    lastPose = pose;
    // Cache the cross-section and its normals for this pose.
    const section = spineCrossSection(dims, pose, cols, originX);
    const normals: { x: number; y: number }[] = [];
    for (let i = 0; i < cols; i++) {
      normals.push(spineNormal(dims, pose, i / arcSegments, originX));
    }

    for (let j = 0; j < rows; j++) {
      const z = z0 + (j / zSegments) * (z1 - z0);
      for (let i = 0; i < cols; i++) {
        const p = section[i];
        const n = normals[i];
        const o = j * vertsPerRow + i;
        const v = j * vertsPerRow + cols + i;
        positions[o * 3] = p.x + n.x * halfThickness;
        positions[o * 3 + 1] = p.y + n.y * halfThickness;
        positions[o * 3 + 2] = z;
        positions[v * 3] = p.x - n.x * halfThickness;
        positions[v * 3 + 1] = p.y - n.y * halfThickness;
        positions[v * 3 + 2] = z;
      }
    }

    lastProtrusion = spineProtrusion(dims, pose.u);
    (geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    geometry.computeBoundingBox();
  }

  return {
    mesh,
    update,
    bounds() {
      const section = spineCrossSection(dims, lastPose, cols, originX);
      return spineBounds(section);
    },
    protrusion() {
      return lastProtrusion;
    },
  };
}

/**
 * Static closed-book spine for the Milestone 1 scene.
 *
 * Uses the same curved cross-section at u = 0, with the spine at the book's
 * left edge. The book group is centred on x = 0 with width `dims.width`, so
 * the back-board edge sits at -width/2.
 */
export function createSpine(
  dims: BookDimensions,
  materials: BookMaterials,
): THREE.Mesh {
  const rig = createSpineRig(dims, materials, { originX: -dims.width / 2 });
  rig.update({
    u: 0,
    hingeY: dims.closedThickness - dims.coverThickness / 2,
    angle: 0,
  });
  return rig.mesh;
}
