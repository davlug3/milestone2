import { BOOK_DIMENSIONS as dims } from "../src/config/bookConfig";
import { textRoot, textStackY, textPageY, TEXT_BLOCK_PITCH, TEXT_SHEET_THICKNESS } from "../src/book/textBlockBinding";

const n = dims.sheetCount;
const pitch = TEXT_BLOCK_PITCH(dims);
let worstGap = Infinity;
for (let step = 0; step <= 100; step++) {
  const u = step / 100;
  for (let k = 0; k < n; k++) {
    const r = textRoot(dims, k, u);
    if (!Number.isFinite(r.x + r.y)) throw new Error("Nonfinite binding");
    if (Math.abs(textPageY(dims, k, 0, u) - r.y) > 1e-9) throw new Error("Detached leaf");
    if (step === 0 && (r.x !== 0 || Math.abs(r.y - textStackY(dims, k)) > 1e-9)) throw new Error("Closed stack misaligned");
    if (k === n - 1) {
      if (Math.abs(r.x) > 1e-9 || Math.abs(r.y - textStackY(dims, k)) > 1e-9) throw new Error("Back leaf moved");
      continue;
    }
    const next = textRoot(dims, k + 1, u);
    if (Math.abs(Math.hypot(next.x - r.x, next.y - r.y) - pitch) > 1e-7) throw new Error("Binding material stretched");
    for (let j = 0; j <= 160; j++) {
      const x = next.x + (r.x + dims.width - next.x) * j / 160;
      const gap = textPageY(dims, k, x - r.x, u) - textPageY(dims, k + 1, x - next.x, u);
      worstGap = Math.min(worstGap, gap);
      if (gap < TEXT_SHEET_THICKNESS - 1e-8) throw new Error(`Adjacent leaves overlap: ${k} at u=${u}`);
    }
  }
}
const first = textRoot(dims, 0);
const middle = textRoot(dims, Math.floor(n / 2));
const back = textRoot(dims, n - 1);
const span = back.x - first.x;
const crown = middle.y - back.y;
if (span < 0.019 || crown < 0.0015) throw new Error("Binding deformation too small");
console.log(`PASS: ${n} individual leaves; span=${(span * 1000).toFixed(2)}mm, crown=${(crown * 1000).toFixed(2)}mm, minimum profile gap=${(worstGap * 1000).toFixed(3)}mm`);
