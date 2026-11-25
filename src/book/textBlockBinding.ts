import type { BookDimensions } from "../config/bookConfig";
import { clamp01, smootherstep } from "../animation/easing";
import { HINGE_DROP_START } from "./coverRig";
import { SHELL_HALF, CONTACT_GAP, spinePlaneY } from "./spineBinding";

/** Shared full text-block model: one material root per configured sheet. */
export const TEXT_BLOCK_THICKNESS = 0.022;
export const TEXT_BLOCK_PITCH = (dims: BookDimensions) => TEXT_BLOCK_THICKNESS / dims.sheetCount;
export const TEXT_SHEET_THICKNESS = 2 * SHELL_HALF;
export const TEXT_BLOCK_TURNS = 8;
const OPEN_BEND = 0.65; // radians of curvature over the entire spine

export function textStackY(dims: BookDimensions, index: number): number {
  return spinePlaneY(dims) + (dims.sheetCount - 1 - index) * TEXT_BLOCK_PITCH(dims);
}

/**
 * Integrate the tangent of a circular arc of constant material length.
 * Closed: all roots are vertically spaced along the actual book thickness.
 * Open: the arc bends across the gutter, with the last/back sheet anchored
 * at the back board hinge. Root coordinates are absolute book-local XY.
 */
export function textRoot(dims: BookDimensions, index: number, u = 1): { x: number; y: number } {
  if (!Number.isInteger(index) || index < 0 || index >= dims.sheetCount) {
    throw new RangeError("Invalid text-block sheet index");
  }
  const length = (dims.sheetCount - 1) * TEXT_BLOCK_PITCH(dims);
  const t = dims.sheetCount > 1 ? (dims.sheetCount - 1 - index) / (dims.sheetCount - 1) : 0;
  const k = smootherstep(clamp01((u - HINGE_DROP_START) / (1 - HINGE_DROP_START)));
  const a = k * (Math.PI / 2 - OPEN_BEND / 2);
  const b = k * OPEN_BEND;
  const base = spinePlaneY(dims);
  if (b < 1e-8) return { x: 0, y: base + length * t };
  // Stable half-angle form avoids subtracting nearly equal cosines.
  const chord = 2 * length * Math.sin(b * t / 2) / b;
  return { x: -chord * Math.sin(a + b * t / 2), y: base + chord * Math.cos(a + b * t / 2) };
}

/** A rising, ordered departure profile; lower leaves have shorter ramps.
 * All inactive pages are represented explicitly, not by a wedge. */
export function textPageY(dims: BookDimensions, index: number, localX: number, u = 1): number {
  const root = textRoot(dims, index, u);
  const stack = textStackY(dims, index);
  const rise = Math.max(0, stack - root.y);
  if (rise < 1e-10) return root.y;
  const t = clamp01(localX * 3 / (2 * rise));
  return root.y + rise * t * (2 - t);
}

/** Surface of the actual next sheet; the cover/cloth floor replaces the wedge. */
export function textPageFloor(dims: BookDimensions, index: number, x: number, floor: number): number {
  const next = index + 1;
  if (next >= dims.sheetCount) return floor;
  const root = textRoot(dims, next);
  if (x < root.x || x > root.x + dims.width) return floor;
  return Math.max(floor, textPageY(dims, next, x - root.x) + TEXT_SHEET_THICKNESS);
}

export function textCoverFloor(dims: BookDimensions): number {
  return dims.coverThickness * 1.1 + SHELL_HALF + CONTACT_GAP;
}
