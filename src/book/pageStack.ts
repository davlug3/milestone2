import * as THREE from "three";
import {
  type BookDimensions,
  deriveBookMetrics,
} from "../config/bookConfig";
import type { BookMaterials } from "./materials";

/**
 * Layered page block that reads as many individual sheets.
 *
 * For Milestone 1 this is a static stack of thin sheets. Each sheet is a thin
 * box spanning the page area, stacked along +Y from the back cover upward.
 * A tiny deterministic per-sheet offset/rotation keeps the fore-edge irregular
 * so it reads as paper, not a solid white block.
 *
 * The active deformable sheet arrives in Milestone 2+. The inactive sheets stay
 * a cheap static representation (see PLAN.md section 5.5).
 */
export function createPageStack(
  dims: BookDimensions,
  materials: BookMaterials,
): THREE.Group {
  const group = new THREE.Group();
  group.name = "page-stack";

  const { halfBlockThickness, sheetThickness } = deriveBookMetrics(dims);

  // Page area is slightly inset from the cover edges.
  const pageWidth = dims.width * 0.96;
  const pageDepth = dims.height * 0.97;

  // Deterministic pseudo-random in [0,1) from an index (no per-frame RNG).
  const rand = (i: number, salt: number): number => {
    const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
    return x - Math.floor(x);
  };

  const sheetGeo = new THREE.BoxGeometry(pageWidth, sheetThickness, pageDepth);

  for (let i = 0; i < dims.sheetCount; i++) {
    const sheet = new THREE.Mesh(sheetGeo, i % 2 === 0 ? materials.paper : materials.paperEdge);
    // Base position: stack from the back cover upward to mid-thickness.
    const y = dims.coverThickness + sheetThickness * (i + 0.5);

    // Subtle irregularity at the fore-edge / head so the stack isn't perfect.
    const jitterX = (rand(i, 1) - 0.5) * sheetThickness * 0.6;
    const jitterZ = (rand(i, 2) - 0.5) * sheetThickness * 0.6;
    const yaw = (rand(i, 3) - 0.5) * 0.004;

    sheet.position.set(jitterX, y, jitterZ);
    sheet.rotation.y = yaw;
    sheet.castShadow = false;
    sheet.receiveShadow = true;
    group.add(sheet);
  }

  // Keep the reference so future milestones can find the top sheet.
  group.userData.halfBlockThickness = halfBlockThickness;
  return group;
}