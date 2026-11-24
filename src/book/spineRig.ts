import * as THREE from "three";
import type { BookDimensions } from "../config/bookConfig";
import { clamp01, smootherstep } from "../animation/easing";

/**
 * Case-binding anatomy helpers.
 *
 * A hardcover text block is rounded and backed:
 *   - the spine is a convex arc (the "round"),
 *   - the outer leaves flare into ~45 degree shoulders that carry the boards,
 *   - the boards sit outside the text block with a joint gap.
 *
 * When the book opens, the text block's spine "throws up": the round flattens
 * and can go slightly concave, while the cover spine stays convex. The hollow
 * is the gap between the two.
 *
 * Coordinates are world metres: X = width (spine at x=0), Y = up, Z = height.
 */

export const SPINE_BULGE = 0.008; // text-block round (8 mm)
export const SHOULDER_W = 0.008; // backing shoulder width (8 mm)
export const SPINE_CONCAVE = 0.003; // text-block throw-up at full open (3 mm)
export const SPINE_COVER_BULGE = 0.012; // cover spine outside the text block
export const SPINE_COVER_T = 0.0025; // cover board/spine thickness
export const HEADBAND_R = 0.0015;

export interface Pt2 {
  x: number;
  y: number;
}

/** Closed/open text-block profile (world XY), including the rounded spine. */
export function textBlockProfile(
  flex: number,
  dims: BookDimensions,
  blockTop: number,
  yBot: number,
  shoulderW: number = SHOULDER_W,
): Pt2[] {
  const t = clamp01(flex);
  // +SPINE_BULGE when closed, -SPINE_CONCAVE when open (concave throw-up).
  const bulge = SPINE_BULGE * (1 - t) - SPINE_CONCAVE * t;
  // The shoulder is at the BOTTOM of the text block, where it meets the
  // board; the spine itself stays exposed above it (no top overhang).
  const yShoulder = yBot + shoulderW;
  const pts: Pt2[] = [];
  const N = 14;
  for (let i = 0; i <= N; i++) {
    const k = i / N;
    pts.push({
      x: -bulge * Math.sin(Math.PI * k),
      y: yShoulder + (blockTop - yShoulder) * k,
    });
  }
  // Flat top (front cover sits here), fore-edge, bottom, and the 45 degree
  // shoulder back to the spine's bottom.
  pts.push({ x: dims.width, y: blockTop });
  pts.push({ x: dims.width, y: yBot });
  pts.push({ x: shoulderW, y: yBot });
  return pts;
}

/** Extruded text-block geometry for a given flex (0 = closed, 1 = open). */
export function textBlockGeometry(
  flex: number,
  dims: BookDimensions,
  blockTop: number,
  depth: number,
): THREE.ExtrudeGeometry {
  const pts = textBlockProfile(flex, dims, blockTop, dims.coverThickness);
  const shape = new THREE.Shape();
  shape.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i].x, pts[i].y);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
    steps: 1,
    curveSegments: 1,
  });
  geo.translate(0, 0, -depth / 2);
  return geo;
}

/** Cover-spine arc from the back cover edge to the front cover edge. */
export function spineCoverArc(
  u: number,
  dims: BookDimensions,
  closedCenterY: number,
  openCenterY: number,
): Pt2[] {
  const t = clamp01(u);
  const drop = smootherstep(clamp01((t - 0.55) / 0.45));
  const hingeY = closedCenterY + (openCenterY - closedCenterY) * drop;
  // Back cover bottom edge -> front cover top edge at the hinge.
  const y0 = 0;
  const y1 = hingeY + dims.coverThickness / 2;
  const bulge =
    SPINE_COVER_BULGE * (1 - smootherstep(t)) +
    (SPINE_COVER_T * 0.5) * smootherstep(t);
  const pts: Pt2[] = [];
  const N = 16;
  for (let i = 0; i <= N; i++) {
    const k = i / N;
    pts.push({
      x: -bulge * Math.sin(Math.PI * k),
      y: y0 + (y1 - y0) * k,
    });
  }
  return pts;
}

/** Ribbon geometry for the cover spine (two z ends). */
export function spineCoverGeometry(
  u: number,
  dims: BookDimensions,
  closedCenterY: number,
  openCenterY: number,
): THREE.BufferGeometry {
  const pts = spineCoverArc(u, dims, closedCenterY, openCenterY);
  const z0 = -dims.height / 2;
  const z1 = dims.height / 2;
  const n = pts.length;
  const positions = new Float32Array(n * 2 * 3);
  for (let i = 0; i < n; i++) {
    positions[i * 6 + 0] = pts[i].x;
    positions[i * 6 + 1] = pts[i].y;
    positions[i * 6 + 2] = z0;
    positions[(n + i) * 3 + 0] = pts[i].x;
    positions[(n + i) * 3 + 1] = pts[i].y;
    positions[(n + i) * 3 + 2] = z1;
  }
  const indices: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const a = i;
    const b = i + 1;
    const c = n + i;
    const d = n + i + 1;
    indices.push(a, c, d, a, d, b);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/** Update an existing cover-spine ribbon for a new opening progress. */
export function updateSpineCoverGeometry(
  geo: THREE.BufferGeometry,
  u: number,
  dims: BookDimensions,
  closedCenterY: number,
  openCenterY: number,
): void {
  const pts = spineCoverArc(u, dims, closedCenterY, openCenterY);
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  const n = pts.length;
  const z0 = -dims.height / 2;
  const z1 = dims.height / 2;
  for (let i = 0; i < n; i++) {
    pos.setXYZ(i, pts[i].x, pts[i].y, z0);
    pos.setXYZ(n + i, pts[i].x, pts[i].y, z1);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
}

/** Cylinder used for a headband at one end of the spine. */
export function headbandGeometry(radius: number = HEADBAND_R, length = 0.005): THREE.CylinderGeometry {
  return new THREE.CylinderGeometry(radius, radius, length, 10, 1, true);
}