import * as THREE from "three";
import type { Particle } from "../physics/Particle";

/**
 * Builds and updates the render geometry for a rectangular sheet grid.
 *
 * Creates a BufferGeometry with a position attribute (one vertex per particle),
 * a static UV attribute, and triangle indices. `update()` copies particle
 * positions into the buffer each frame and recomputes normals.
 *
 * Vertex ordering matches the simulation grid: index = row * cols + col.
 */
export class PageGeometry {
  public readonly geometry: THREE.BufferGeometry;
  private readonly positionAttr: THREE.BufferAttribute;

  constructor(cols: number, rows: number) {
    const vertexCount = cols * rows;
    const positions = new Float32Array(vertexCount * 3);
    const uvs = new Float32Array(vertexCount * 2);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        uvs[i * 2] = c / (cols - 1);
        uvs[i * 2 + 1] = r / (rows - 1);
      }
    }

    const indices: number[] = [];
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const a = r * cols + c;
        const b = a + 1;
        const d = (r + 1) * cols + c;
        const e = d + 1;
        indices.push(a, d, b, b, d, e);
      }
    }

    const geo = new THREE.BufferGeometry();
    this.positionAttr = new THREE.BufferAttribute(positions, 3);
    this.positionAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute("position", this.positionAttr);
    geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    this.geometry = geo;
  }

  /** Copy particle positions into the geometry buffer and refresh normals. */
  update(particles: Particle[]): void {
    const arr = this.positionAttr.array as Float32Array;
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      arr[i * 3] = p.x;
      arr[i * 3 + 1] = p.y;
      arr[i * 3 + 2] = p.z;
    }
    this.positionAttr.needsUpdate = true;
    this.geometry.computeVertexNormals();
    // Keep bounding sphere valid for frustum culling as the sheet deforms.
    this.geometry.computeBoundingSphere();
  }

  dispose(): void {
    this.geometry.dispose();
  }
}