import * as THREE from "three";
import { BOOK_DIMENSIONS, type BookDimensions } from "../config/bookConfig";
import { createBookMaterials } from "./materials";
import { createCover } from "./cover";
import { createSpine } from "./spine";
import { createPageStack } from "./pageStack";

/**
 * Assemble a static closed hardcover book.
 *
 * Layout (closed, resting flat on the ground at y=0):
 *   back cover  : bottom, centered at y = coverThickness/2
 *   page stack  : on top of back cover, rising through the page block
 *   front cover : on top of the page stack
 *   spine       : left edge (x = -width/2), bridging both covers
 *
 * The whole group can be repositioned/rotated by the caller (animation).
 * All child meshes use world-aligned dimensions: X width, Y thickness/up,
 * Z height (head-to-tail).
 */
export function createBook(
  dims: BookDimensions = BOOK_DIMENSIONS,
): THREE.Group {
  const materials = createBookMaterials();
  const book = new THREE.Group();
  book.name = "book";

  const { coverThickness, closedThickness } = dims;

  // Back cover (bottom).
  const backCover = createCover(dims, materials, "back");
  backCover.position.y = coverThickness / 2;
  book.add(backCover);

  // Page stack sits on the inside face of the back cover.
  const pageStack = createPageStack(dims, materials);
  pageStack.position.y = coverThickness;
  book.add(pageStack);

  // Front cover (top). Sits above the page block.
  const frontCover = createCover(dims, materials, "front");
  frontCover.position.y = closedThickness - coverThickness / 2;
  book.add(frontCover);

  // Spine bridging the covers on the left edge.
  const spine = createSpine(dims, materials);
  book.add(spine);

  // Center the closed book vertically so it rests with its back cover near y=0.
  book.userData.dimensions = dims;
  book.userData.materials = materials;

  return book;
}