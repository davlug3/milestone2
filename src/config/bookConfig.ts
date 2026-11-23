/**
 * Book dimensions and construction constants (meters).
 *
 * Single source of truth for the physical book. All values are art-direction
 * starting points, not universal specifications. See PLAN.md section 3.
 *
 * Coordinate convention (world space, see DECISIONS.md):
 *   X = book width   (spine at x=0, fore-edges at ±width/2 when open)
 *   Y = world up     (book thickness; book rests on ground at y=0)
 *   Z = book height  (head-to-tail, the 0.31 m dimension)
 * The open book lies flat on the XZ plane. The spine runs along Z at x=0.
 * Covers face up (+Y); pages stack along Y. Gravity is -Y.
 *
 * Note: PLAN.md section 3.1 lists "Y height, Z depth, spine along Y". That
 * convention describes an upright book and conflicts with "gravity along -Y"
 * for a book lying on a surface. We use the flat-on-table convention above,
 * which is consistent with gravity -Y and the cinematic top-down shot.
 */

export interface BookDimensions {
  /** Page block width (spine to fore-edge), meters. */
  readonly width: number;
  /** Page block height (head to tail), meters. */
  readonly height: number;
  /** Closed book thickness (both covers + page block), meters. */
  readonly closedThickness: number;
  /** Rigid cover board thickness, meters. */
  readonly coverThickness: number;
  /** Nominal single paper sheet thickness, meters. */
  readonly paperThickness: number;
  /** Number of visually represented sheets in the stack. */
  readonly sheetCount: number;
  /** Small gap between cover board and page block (hinge clearance), meters. */
  readonly hingeGap: number;
}

export const BOOK_DIMENSIONS: BookDimensions = {
  width: 0.24,
  height: 0.31,
  closedThickness: 0.035,
  coverThickness: 0.0025,
  paperThickness: 0.0001,
  sheetCount: 72,
  hingeGap: 0.0008,
};

/**
 * Derived measurements used across the book modules.
 * Kept here so geometry code and physics code agree on the same numbers.
 */
export function deriveBookMetrics(d: BookDimensions) {
  // The page block (text block) is the closed thickness minus the two covers
  // and the two hinge gaps. In the closed book all sheets span this thickness.
  const pageBlockThickness =
    d.closedThickness - 2 * d.coverThickness - 2 * d.hingeGap;
  const sheetThickness = pageBlockThickness / d.sheetCount;
  // When the book is open flat, pages pile on each side: ~half the block each.
  return {
    pageBlockThickness,
    halfBlockThickness: pageBlockThickness / 2,
    sheetThickness,
  };
}