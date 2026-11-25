import { BOOK_DIMENSIONS } from "../src/config/bookConfig";
import { sheetBinding, openingRightSheetY, BINDING_PITCH } from "../src/book/spineBinding";

const count = 15;
for (let k = 0; k < count; k++) {
  const root = sheetBinding(BOOK_DIMENSIONS, k, count);
  const closed = sheetBinding(BOOK_DIMENSIONS, k, count, 0);
  if (closed.x !== 0) throw new Error("Closed root off the spine");
  if (k > 0) {
    const prev = sheetBinding(BOOK_DIMENSIONS, k - 1, count);
    if (Math.abs(root.x - prev.x - BINDING_PITCH) > 1e-9) throw new Error("Incorrect root pitch");
  }
  for (let i = 0; i <= 100; i++) {
    const u = i / 100;
    const p = sheetBinding(BOOK_DIMENSIONS, k, count, u);
    const y = openingRightSheetY(0, BOOK_DIMENSIONS, k, count, 0.03, u);
    if (!Number.isFinite(p.x + p.y) || Math.abs(y - p.y) > 1e-9) throw new Error("Opening profile disconnected");
    if (k > 0) {
      const prev = sheetBinding(BOOK_DIMENSIONS, k - 1, count, u);
      if (Math.hypot(p.x - prev.x, p.y - prev.y) < 0.00025) throw new Error("Adjacent attachment lines overlap");
    }
  }
}
console.log("PASS: all 15 sheets retain distinct material attachments during opening");
