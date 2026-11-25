/**
 * A coarse 2D heightfield over the book's local XZ area, used as an
 * approximate collision surface for turning pages.
 *
 * The active page samples `heightAt(x, z)` to know the top surface height of
 * everything below it (right page block, opened front cover, and previously
 * landed pages). When a page settles, `bakeSheet()` splats its top surface into
 * the grid so the next page rests on the real landed shape (no interpenetration).
 *
 * Local coordinate frame matches the sheet sim: x from -1.5W (left fore-edge)
 * to +0.5W (right fore-edge), z from -H/2..H/2. Resolution is configurable.
 */
export class Heightfield {
  private readonly nx: number;
  private readonly nz: number;
  private readonly x0: number;
  private readonly x1: number;
  private readonly z0: number;
  private readonly z1: number;
  private readonly data: Float32Array;

  constructor(options: {
    width: number; // page width W
    height: number; // page height H
    nx?: number;
    nz?: number;
    paddingX?: number;
  }) {
    const { width: W, height: H } = options;
    this.nx = options.nx ?? 64;
    this.nz = options.nz ?? 64;
    // Local x spans both sides: left fore-edge (-1.5W) to right fore-edge (+0.5W).
    const pad = Math.max(0, options.paddingX ?? 0);
    this.x0 = -1.5 * W - pad;
    this.x1 = 0.5 * W + pad;
    this.z0 = -H / 2;
    this.z1 = H / 2;
    this.data = new Float32Array(this.nx * this.nz);
  }

  private gx(x: number): number {
    return ((x - this.x0) / (this.x1 - this.x0)) * (this.nx - 1);
  }
  private gz(z: number): number {
    return ((z - this.z0) / (this.z1 - this.z0)) * (this.nz - 1);
  }

  /** Reset every cell to a base height. */
  reset(base: number): void {
    this.data.fill(base);
  }

  /** Fill every cell using a height function of local (x, z). */
  setBase(fn: (x: number, z: number) => number): void {
    for (let iz = 0; iz < this.nz; iz++) {
      const z = this.z0 + (iz / (this.nz - 1)) * (this.z1 - this.z0);
      for (let ix = 0; ix < this.nx; ix++) {
        const x = this.x0 + (ix / (this.nx - 1)) * (this.x1 - this.x0);
        this.data[iz * this.nx + ix] = fn(x, z);
      }
    }
  }

  /** Raise the height in a small brush around (x,z) to at least y. */
  splat(x: number, z: number, y: number, radius = 1): void {
    const cx = this.gx(x);
    const cz = this.gz(z);
    const r = Math.max(0, Math.round(radius));
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        const ix = Math.round(cx) + dx;
        const iz = Math.round(cz) + dz;
        if (ix < 0 || ix >= this.nx || iz < 0 || iz >= this.nz) continue;
        const idx = iz * this.nx + ix;
        if (y > this.data[idx]) this.data[idx] = y;
      }
    }
  }

  /** Bilinear sample of the surface height at local (x,z). */
  heightAt(x: number, z: number): number {
    let fx = this.gx(x);
    let fz = this.gz(z);
    fx = fx < 0 ? 0 : fx > this.nx - 1 ? this.nx - 1 : fx;
    fz = fz < 0 ? 0 : fz > this.nz - 1 ? this.nz - 1 : fz;
    const x0 = Math.floor(fx);
    const z0 = Math.floor(fz);
    const x1 = Math.min(x0 + 1, this.nx - 1);
    const z1 = Math.min(z0 + 1, this.nz - 1);
    const tx = fx - x0;
    const tz = fz - z0;
    const d = this.data;
    const h00 = d[z0 * this.nx + x0];
    const h10 = d[z0 * this.nx + x1];
    const h01 = d[z1 * this.nx + x0];
    const h11 = d[z1 * this.nx + x1];
    const a = h00 + (h10 - h00) * tx;
    const b = h01 + (h11 - h01) * tx;
    return a + (b - a) * tz;
  }

  /**
   * Bake a sheet's top surface into the field. `positions` is a flat xyz array
   * (local sim coords) and `count` is the number of particles. `top` is the
   * half-thickness offset to add so the next page rests on top of this one.
   */
  bakeSheet(positions: ArrayLike<number>, count: number, top: number): void {
    for (let i = 0; i < count; i++) {
      const x = positions[i * 3];
      const y = positions[i * 3 + 1];
      const z = positions[i * 3 + 2];
      this.splat(x, z, y + top, 1);
    }
  }
}