"""
Pure-Python validation of the analytic page model (no Blender needed).

Run: python3 blender/check_model.py
"""

from __future__ import annotations

import math
import sys

import page_model as pm


def approx(a: float, b: float, eps: float = 1e-6) -> bool:
    return abs(a - b) <= eps


def centerline_length(pts, cols: int, rows: int, r: int) -> float:
    total = 0.0
    prev = pts[r * cols]
    for c in range(1, cols):
        p = pts[r * cols + c]
        total += math.hypot(p[0] - prev[0], p[1] - prev[1])
        prev = p
    return total


def main() -> int:
    failures = 0

    for k in range(pm.NUM_TURNS):
        spec = pm.page_spec(k)

        # p = 0 must be the flat rest shape.
        rest = pm.page_points(spec, 0.0)
        for r in range(pm.ROWS):
            rz = r / (pm.ROWS - 1)
            for c in range(pm.COLS):
                s = c / (pm.COLS - 1)
                x, y, z = rest[r * pm.COLS + c]
                if not approx(x, s * pm.W, 1e-9):
                    print(f"FAIL page {k} rest x {x} != {s*pm.W}")
                    failures += 1
                if not approx(y, spec.rest_y, 1e-9):
                    print(f"FAIL page {k} rest y {y} != {spec.rest_y}")
                    failures += 1
                if not approx(z, -pm.H / 2 + rz * pm.H, 1e-9):
                    print(f"FAIL page {k} rest z")
                    failures += 1

        # p = 1: spine at binding, fore-edge at land height.
        land = pm.page_points(spec, 1.0)
        spine = land[0]
        fore = land[pm.COLS - 1]
        if not approx(spine[0], spec.x_b, 1e-9) or not approx(spine[1], spec.y_b, 1e-9):
            print(f"FAIL page {k} spine {spine[:2]} != binding {(spec.x_b, spec.y_b)}")
            failures += 1
        if not approx(fore[0], spec.x_b - pm.W, 1e-6) or not approx(fore[1], spec.land_y, 1e-6):
            print(f"FAIL page {k} fore-edge {fore[:2]} != {(spec.x_b - pm.W, spec.land_y)}")
            failures += 1

        # The outer part of the landed page is flat at land_y.
        for r in range(pm.ROWS):
            for c in range(pm.COLS):
                s = c / (pm.COLS - 1)
                if s > 0.15:
                    y = land[r * pm.COLS + c][1]
                    if not approx(y, spec.land_y, 2e-4):
                        print(f"FAIL page {k} landed y {y} != {spec.land_y} at s={s}")
                        failures += 1

        # All intermediate shapes: finite, above the table, sane length.
        for pi in range(41):
            p = pi / 40
            pts = pm.page_points(spec, p)
            for x, y, z in pts:
                if not (math.isfinite(x) and math.isfinite(y) and math.isfinite(z)):
                    print(f"FAIL page {k} non-finite at p={p}")
                    failures += 1
                    break
                if y < -1e-6:
                    print(f"FAIL page {k} below table at p={p}: {y}")
                    failures += 1
                    break
            length = centerline_length(pts, pm.COLS, pm.ROWS, pm.ROWS // 2)
            # The gutter blend consumes a little width near the spine, so allow
            # some compression at the inner edge.
            if not (0.90 * pm.W <= length <= 1.12 * pm.W):
                print(f"FAIL page {k} centerline length {length:.4f} at p={p}")
                failures += 1

        # No right-block interpenetration: while the page is over the block
        # (world x >= BLOCK_INNER_X) it must be at or above the block top.
        for pi in range(41):
            p = pi / 40
            pts = pm.page_points(spec, p)
            for x, y, z in pts:
                if x >= pm.BLOCK_INNER_X and y < pm.BLOCK_TOP - 1e-4:
                    print(
                        f"FAIL page {k} block interpenetration at p={p}: "
                        f"x={x*1000:.1f}mm y={y*1000:.2f}mm"
                    )
                    failures += 1
                    break

        print(
            f"page {k}: spine=({spec.x_b*1000:+.2f},{spec.y_b*1000:.2f})mm "
            f"fore=({(spec.x_b-pm.W)*1000:+.1f},{spec.land_y*1000:.2f})mm "
            f"restY={spec.rest_y*1000:.2f}mm"
        )

    print("FAILURES", failures)
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())