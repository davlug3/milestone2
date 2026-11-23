import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { BookDimensions } from "../config/bookConfig";
import type { BookMaterials } from "./materials";

/**
 * A rigid hardcover board.
 *
 * Local geometry is centered at the origin with dimensions (width, thickness,
 * height) so it maps onto world (X, Y, Z). Beveled edges avoid a razor-thin
 * silhouette at grazing angles.
 */
export function createCover(
  dims: BookDimensions,
  materials: BookMaterials,
  side: "front" | "back",
): THREE.Group {
  const group = new THREE.Group();
  group.name = `cover-${side}`;

  const bevel = Math.min(0.0006, dims.coverThickness * 0.3);

  const board = new THREE.Mesh(
    new RoundedBoxGeometry(
      dims.width,
      dims.coverThickness,
      dims.height,
      2,
      bevel,
    ),
    materials.cover,
  );
  board.castShadow = true;
  board.receiveShadow = true;
  group.add(board);

  // Thin inner lining on the interior face only (not visible on a closed book
  // from the outside). Front cover's inside faces down (-Y); back cover's inside
  // faces up (+Y) so it shows when the cover is open.
  const lining = new THREE.Mesh(
    new THREE.BoxGeometry(
      dims.width * 0.97,
      dims.coverThickness * 0.2,
      dims.height * 0.97,
    ),
    materials.coverInner,
  );
  const liningOffset = dims.coverThickness * 0.5;
  lining.position.y = side === "front" ? -liningOffset : liningOffset;
  lining.receiveShadow = true;
  group.add(lining);

  return group;
}