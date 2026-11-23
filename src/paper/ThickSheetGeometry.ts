import * as THREE from "three";
import type { Particle } from "../physics/Particle";

/**
 * Thin-shell render geometry for a rectangular sheet grid.
 *
 * Builds a closed thin shell:
 *   - front surface  (particles offset +normal * halfThickness)
 *   - back surface   (particles offset -normal * halfThickness)
 *   - perimeter edge strip joining the two surfaces around the border
 *
 * The mid-surface normals are computed from the deformed grid so thickness
 * follows the surface normal (PLAN.md section 6.2). The whole shell is one
 * BufferGeometry with position/normal/uv/index, updated from particles each
 * frame. UVs are per-surface; the edge strip uses a simple strip UV.
 *
 * Vertex layout (per frame, recomputed positions):
 *   front grid : rows*cols verts, idx f(i) = i
 *   back grid  : rows*cols verts, idx b(i) = N + i
 *   edge loop  : perimeter verts in order, 2 per perimeter point (front/back)
 */
export class ThickSheetGeometry {
  public readonly geometry: THREE.BufferGeometry;
  private readonly cols: number;
  private readonly rows: number;
  private readonly half: number; // half paper thickness
  private readonly positionAttr: THREE.BufferAttribute;

  private readonly gridCount: number;
  /** Perimeter loop: particle indices in order around the border. */
  private readonly loop: number[] = [];
  private readonly edgeStart: number; // first edge vertex index

  constructor(cols: number, rows: number, paperThickness: number) {
    this.cols = cols;
    this.rows = rows;
    this.half = paperThickness / 2;
    this.gridCount = cols * rows;

    const idx = (c: number, r: number): number => r * cols + c;

    // Perimeter loop, counter-clockwise, no duplicate closing vertex.
    const loop: number[] = [];
    for (let c = 0; c < cols; c++) loop.push(idx(c, 0)); // bottom edge
    for (let r = 1; r < rows; r++) loop.push(idx(cols - 1, r)); // right edge
    for (let c = cols - 2; c >= 0; c--) loop.push(idx(c, rows - 1)); // top
    for (let r = rows - 2; r >= 1; r--) loop.push(idx(0, r)); // left
    this.loop = loop;
    const loopLen = loop.length;

    this.edgeStart = this.gridCount * 2;
    const edgeVertCount = loopLen * 2; // front + back per perimeter point
    const totalVerts = this.gridCount * 2 + edgeVertCount;

    const positions = new Float32Array(totalVerts * 3);
    const uvs = new Float32Array(totalVerts * 2);

    // Front + back UVs (same chart for both surfaces).
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = idx(c, r);
        const u = c / (cols - 1);
        const v = r / (rows - 1);
        uvs[i * 2] = u;
        uvs[i * 2 + 1] = v;
        const bi = this.gridCount + i;
        uvs[bi * 2] = u;
        uvs[bi * 2 + 1] = v;
      }
    }
    // Edge strip UVs: u around the loop, v 0..1 across thickness.
    for (let k = 0; k < loopLen; k++) {
      const u = k / loopLen;
      const f = this.edgeStart + k * 2;
      const b = f + 1;
      uvs[f * 2] = u;
      uvs[f * 2 + 1] = 0;
      uvs[b * 2] = u;
      uvs[b * 2 + 1] = 1;
    }

    // Indices.
    const indices: number[] = [];
    // Front surface (CCW).
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const a = idx(c, r);
        const b = a + 1;
        const d = idx(c, r + 1);
        const e = d + 1;
        indices.push(a, d, b, b, d, e);
      }
    }
    // Back surface (reversed winding so it faces the other way).
    const off = this.gridCount;
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const a = off + idx(c, r);
        const b = a + 1;
        const d = off + idx(c, r + 1);
        const e = d + 1;
        indices.push(a, b, d, b, e, d);
      }
    }
    // Edge strip quads.
    for (let k = 0; k < loopLen; k++) {
      const k2 = (k + 1) % loopLen;
      const f0 = this.edgeStart + k * 2;
      const b0 = f0 + 1;
      const f1 = this.edgeStart + k2 * 2;
      const b1 = f1 + 1;
      indices.push(f0, b0, f1, f1, b0, b1);
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

  /** Recompute mid-surface normals from the deformed front grid. */
  private computeGridNormals(
    particles: Particle[],
    out: Float32Array,
  ): void {
    const { cols, rows, gridCount } = this;
    // Accumulate face normals into a per-vertex normal (area-weighted).
    out.fill(0);
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const i0 = r * cols + c;
        const i1 = i0 + 1;
        const i2 = (r + 1) * cols + c;
        const p0 = particles[i0];
        const p1 = particles[i1];
        const p2 = particles[i2];
        // Edge vectors.
        const e1x = p1.x - p0.x, e1y = p1.y - p0.y, e1z = p1.z - p0.z;
        const e2x = p2.x - p0.x, e2y = p2.y - p0.y, e2z = p2.z - p0.z;
        // Face normal = e2 x e1 (points +Y for a flat sheet in the XZ plane,
        // i.e. the same side as the rendered front surface). Using e1 x e2
        // would point the mid-surface normals down, flipping the shell and
        // making shadow normalBias offset into the page (full self-shadow).
        const nx = e2y * e1z - e2z * e1y;
        const ny = e2z * e1x - e2x * e1z;
        const nz = e2x * e1y - e2y * e1x;
        out[i0 * 3] += nx; out[i0 * 3 + 1] += ny; out[i0 * 3 + 2] += nz;
        out[i1 * 3] += nx; out[i1 * 3 + 1] += ny; out[i1 * 3 + 2] += nz;
        out[i2 * 3] += nx; out[i2 * 3 + 1] += ny; out[i2 * 3 + 2] += nz;
      }
    }
    // Normalize. Guard against zero-length.
    for (let i = 0; i < gridCount; i++) {
      const nx = out[i * 3], ny = out[i * 3 + 1], nz = out[i * 3 + 2];
      const len = Math.hypot(nx, ny, nz) || 1;
      out[i * 3] = nx / len;
      out[i * 3 + 1] = ny / len;
      out[i * 3 + 2] = nz / len;
    }
  }

  private normalBuf: Float32Array | null = null;

  /** Rebuild all shell positions from particles and refresh normals. */
  update(particles: Particle[]): void {
    const { gridCount, half } = this;
    const n = gridCount;
    if (!this.normalBuf || this.normalBuf.length !== n * 3) {
      this.normalBuf = new Float32Array(n * 3);
    }
    const normals = this.normalBuf;
    this.computeGridNormals(particles, normals);

    const arr = this.positionAttr.array as Float32Array;

    // Front (+half) and back (-half) surfaces.
    for (let i = 0; i < n; i++) {
      const p = particles[i];
      const nx = normals[i * 3], ny = normals[i * 3 + 1], nz = normals[i * 3 + 2];
      const f = i * 3;
      arr[f] = p.x + nx * half;
      arr[f + 1] = p.y + ny * half;
      arr[f + 2] = p.z + nz * half;
      const b = (gridCount + i) * 3;
      arr[b] = p.x - nx * half;
      arr[b + 1] = p.y - ny * half;
      arr[b + 2] = p.z - nz * half;
    }

    // Edge strip: connect front/back perimeter verts.
    const loopLen = this.loop.length;
    for (let k = 0; k < loopLen; k++) {
      const pi = this.loop[k];
      const p = particles[pi];
      const nx = normals[pi * 3], ny = normals[pi * 3 + 1], nz = normals[pi * 3 + 2];
      const f = (this.edgeStart + k * 2) * 3;
      arr[f] = p.x + nx * half;
      arr[f + 1] = p.y + ny * half;
      arr[f + 2] = p.z + nz * half;
      const b = f + 3;
      arr[b] = p.x - nx * half;
      arr[b + 1] = p.y - ny * half;
      arr[b + 2] = p.z - nz * half;
    }

    this.positionAttr.needsUpdate = true;
    this.geometry.computeVertexNormals();
    this.geometry.computeBoundingSphere();
  }

  dispose(): void {
    this.geometry.dispose();
  }
}