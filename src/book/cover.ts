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

  // Pastedown: the glued-down half of the endpaper. Warm endpaper stock,
  // slightly inset from the board edges. Front cover's inside faces down
  // (-Y); back cover's inside faces up (+Y) so it shows when the cover opens.
  const lining = new THREE.Mesh(
    new THREE.BoxGeometry(
      dims.width * 0.97,
      dims.coverThickness * 0.2,
      dims.height * 0.97,
    ),
    materials.endpaper,
  );
  const liningOffset = dims.coverThickness * 0.5;
  const facing = side === "front" ? -1 : 1;
  lining.position.y = facing * liningOffset;
  lining.receiveShadow = true;
  group.add(lining);

  // Hinge crease: a narrow darker strip along the spine edge of the pastedown.
  // It marks where the endpaper folds into the joint, visually joining the
  // cover to the book block instead of leaving a bare lining panel.
  const creaseWidth = dims.width * 0.025;
  const creaseThickness = dims.coverThickness * 0.06;
  const crease = new THREE.Mesh(
    new THREE.BoxGeometry(creaseWidth, creaseThickness, dims.height * 0.92),
    materials.endpaperHinge,
  );
  crease.position.set(
    -dims.width / 2 + creaseWidth / 2,
    lining.position.y + facing * (dims.coverThickness * 0.1 + creaseThickness * 0.5),
    0,
  );
  crease.receiveShadow = true;
  group.add(crease);

  return group;
}
