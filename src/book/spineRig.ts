import * as THREE from "three";
import type { BookDimensions } from "../config/bookConfig";
import { clamp01, smootherstep } from "../animation/easing";
import { HINGE_DROP_START, coverPose } from "./coverRig";

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

interface SpineShellSample {
  outer: Pt2;
  inner: Pt2;
}

/**
 * Sample the spine shell's C cross-section.
 *
 * The shell is a board-thick strip connecting the back board's hinge face
 * (world x=0, y 0..CT) to the front board's hinge face. Its centreline runs
 * from the back face centre (0, CT/2) to the front hinge centre (hingeX,
 * hingeY); a sine bulge along the chord's outward normal gives the closed
 * wrap-around, and the bulge eases to zero as the spine panel flattens open.
 * Outer/inner points are offset +/-CT/2 along the section normal, so the end
 * caps land flush on the boards' hinge faces.
 */
function spineShellSamples(
  u: number,
  dims: BookDimensions,
  closedCenterY: number,
  openCenterY: number,
  hingeTravel = 0,
  turnIn = 0,
  n = 16,
): SpineShellSample[] {
  const t = clamp01(u);
  const pose = coverPose(
    t,
    closedCenterY,
    openCenterY,
    HINGE_DROP_START,
    hingeTravel,
  );
  const ct = dims.coverThickness;
  const half = ct * 0.5;
  // Centreline endpoints: back hinge centre -> front hinge centre.
  const c0x = 0;
  const c0y = half;
  const c1x = pose.hingeX;
  const c1y = pose.hingeY;
  const dx = c1x - c0x;
  const dy = c1y - c0y;
  const len = Math.hypot(dx, dy);
  // Outward normal: left of the back->front chord (-x when closed, -y when
  // open-flat). Falls back to -x for a degenerate chord.
  const nx = len > 1e-9 ? -dy / len : -1;
  const ny = len > 1e-9 ? dx / len : 0;
  // Closed: 12 mm bow around the block. Open: flat panel (no bow).
  const bulge = SPINE_COVER_BULGE * (1 - smootherstep(t));

  const out: SpineShellSample[] = [];
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    const cx = c0x + dx * k + nx * bulge * Math.sin(Math.PI * k);
    const cy = c0y + dy * k + ny * bulge * Math.sin(Math.PI * k);
    // Section normal from the actual centreline tangent, so the thickness
    // stays perpendicular to the curved shell rather than the chord.
    let tx: number;
    let ty: number;
    if (i === 0) {
      tx = dx + nx * bulge * Math.PI;
      ty = dy + ny * bulge * Math.PI;
    } else if (i === n) {
      tx = dx - nx * bulge * Math.PI;
      ty = dy - ny * bulge * Math.PI;
    } else {
      const kPrev = (i - 1) / n;
      const kNext = (i + 1) / n;
      const px = c0x + dx * kPrev + nx * bulge * Math.sin(Math.PI * kPrev);
      const py = c0y + dy * kPrev + ny * bulge * Math.sin(Math.PI * kPrev);
      const nxp = c0x + dx * kNext + nx * bulge * Math.sin(Math.PI * kNext);
      const nyp = c0y + dy * kNext + ny * bulge * Math.sin(Math.PI * kNext);
      tx = nxp - px;
      ty = nyp - py;
    }
    const tlen = Math.hypot(tx, ty) || 1;
    const snx = -ty / tlen;
    const sny = tx / tlen;
    out.push({
      outer: { x: cx + snx * half, y: cy + sny * half },
      inner: { x: cx - snx * half, y: cy - sny * half },
    });
  }
  // The spine cloth turns in onto the boards' OUTER faces: the outer ring
  // continues `turnIn` past the hinge, flush with the board surface (a hair
  // proud, so it hides the board's bevel without z-fighting). The inner ring
  // stops just inside the hinge faces. This keeps the case continuous and
  // removes the exposed hinge-face step.
  const eps = 0.0001;
  const lift = 0.0001;
  out[0].outer = { x: turnIn, y: lift };
  out[0].inner = { x: eps, y: ct };
  const sinA = Math.sin(pose.angle);
  const cosA = Math.cos(pose.angle);
  // Front board local frame: +Y = outer face (up closed, down open), +X =
  // into the board. Rotate the turn-in and hinge points into world space.
  const outerTurnY = half + lift;
  out[n].outer = {
    x: pose.hingeX + turnIn * cosA - outerTurnY * sinA,
    y: pose.hingeY + turnIn * sinA + outerTurnY * cosA,
  };
  out[n].inner = {
    x: pose.hingeX + eps * cosA + half * sinA,
    y: pose.hingeY + eps * sinA - half * cosA,
  };
  return out;
}

function buildSpineShellGeometry(samples: SpineShellSample[], z0: number, z1: number): THREE.BufferGeometry {
  const n = samples.length;
  // Layout: 4 rings of n verts each: [outer@z0, outer@z1, inner@z1, inner@z0]
  // This gives outer face, inner face, and z caps as quad strips; end caps are
  // two extra quads.
  const ring = n;
  const positions = new Float32Array(ring * 4 * 3);
  const pushRing = (base: number, key: "outer" | "inner", z: number) => {
    for (let i = 0; i < n; i++) {
      const p = samples[i][key];
      const o = (base + i) * 3;
      positions[o] = p.x;
      positions[o + 1] = p.y;
      positions[o + 2] = z;
    }
  };
  pushRing(0 * ring, "outer", z0);
  pushRing(1 * ring, "outer", z1);
  pushRing(2 * ring, "inner", z1);
  pushRing(3 * ring, "inner", z0);

  const indices: number[] = [];
  const quad = (a: number, b: number, c: number, d: number) => {
    indices.push(a, b, c, a, c, d);
  };
  // Outer surface (z0->z1, along increasing arc).
  for (let i = 0; i < n - 1; i++) {
    quad(0 * ring + i, 0 * ring + i + 1, 1 * ring + i + 1, 1 * ring + i);
  }
  // Inner surface (z1->z0, reverse arc so normal faces inward/hollow).
  for (let i = 0; i < n - 1; i++) {
    quad(2 * ring + i, 2 * ring + i + 1, 3 * ring + i + 1, 3 * ring + i);
  }
  // z0 cap (head): outer -> inner, reverse arc.
  for (let i = 0; i < n - 1; i++) {
    quad(0 * ring + i + 1, 0 * ring + i, 3 * ring + i, 3 * ring + i + 1);
  }
  // z1 cap (tail): outer -> inner, forward arc.
  for (let i = 0; i < n - 1; i++) {
    quad(1 * ring + i, 1 * ring + i + 1, 2 * ring + i + 1, 2 * ring + i);
  }
  // Back end cap (i=0): inner@z0, inner@z1, outer@z1, outer@z0.
  quad(3 * ring + 0, 2 * ring + 0, 1 * ring + 0, 0 * ring + 0);
  // Front end cap (i=n-1): outer@z0, outer@z1, inner@z1, inner@z0.
  const e = n - 1;
  quad(0 * ring + e, 1 * ring + e, 2 * ring + e, 3 * ring + e);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/** Cover-spine arc (outer surface, world XY) for compatibility/inspection. */
export function spineCoverArc(
  u: number,
  dims: BookDimensions,
  closedCenterY: number,
  openCenterY: number,
  hingeTravel = 0,
  turnIn = 0,
): Pt2[] {
  return spineShellSamples(
    u,
    dims,
    closedCenterY,
    openCenterY,
    hingeTravel,
    turnIn,
  ).map((s) => s.outer);
}

/** Solid C-section spine shell geometry (outer + inner + caps). */
export function spineCoverGeometry(
  u: number,
  dims: BookDimensions,
  closedCenterY: number,
  openCenterY: number,
  hingeTravel = 0,
  turnIn = 0,
): THREE.BufferGeometry {
  const samples = spineShellSamples(
    u,
    dims,
    closedCenterY,
    openCenterY,
    hingeTravel,
    turnIn,
  );
  return buildSpineShellGeometry(samples, -dims.height / 2, dims.height / 2);
}

/** Update an existing spine shell geometry in place (fixed topology). */
export function updateSpineCoverGeometry(
  geo: THREE.BufferGeometry,
  u: number,
  dims: BookDimensions,
  closedCenterY: number,
  openCenterY: number,
  hingeTravel = 0,
  turnIn = 0,
): void {
  const samples = spineShellSamples(
    u,
    dims,
    closedCenterY,
    openCenterY,
    hingeTravel,
    turnIn,
  );
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  const ring = samples.length;
  const z0 = -dims.height / 2;
  const z1 = dims.height / 2;
  const writeRing = (base: number, key: "outer" | "inner", z: number) => {
    for (let i = 0; i < ring; i++) {
      const p = samples[i][key];
      pos.setXYZ(base + i, p.x, p.y, z);
    }
  };
  writeRing(0 * ring, "outer", z0);
  writeRing(1 * ring, "outer", z1);
  writeRing(2 * ring, "inner", z1);
  writeRing(3 * ring, "inner", z0);
  pos.needsUpdate = true;
  geo.computeVertexNormals();
}

/** Cylinder used for a headband at one end of the spine. */
export function headbandGeometry(radius: number = HEADBAND_R, length = 0.005): THREE.CylinderGeometry {
  return new THREE.CylinderGeometry(radius, radius, length, 10, 1, true);
}