"""
Analytic page model for the Blender book project.

Pure Python (no bpy) so the shapes can be validated and unit-tested before
Blender is involved. The model is an approximation of the WebGL demo's XPBD
page turn: the fore-edge follows the same arc, the spine edge moves to its own
gutter binding point, and the landed sheet is flat at its stack height with a
curved gutter.

World units are metres. X = width, Y = up, Z = book height.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import List, Sequence, Tuple

Vec3 = Tuple[float, float, float]
Vec2 = Tuple[float, float]

# --- Book dimensions (mirror src/config/bookConfig.ts + the demo) ----------
W = 0.24
H = 0.31
CT = 0.0025
PBT = 0.022
BLOCK_TOP = CT + PBT
SHEET_VSTEP = 0.0003
NUM_TURNS = 8
NUM_STATIC = 7
NUM_SHEETS = NUM_TURNS + NUM_STATIC
REST_BASE = BLOCK_TOP + 0.0004

# Open-cover collision floor.
LINING_TOP = CT * 1.1
BOARD_TOP = CT
SHELL_HALF = 0.000125
COVER_GAP = 0.00005
COVER_FLOOR = LINING_TOP + SHELL_HALF + COVER_GAP
LAND_BASE = COVER_FLOOR + 0.0002
LAND_STEP = 0.0008

# Curved gutter.
LINING_INSET = 0.015
GUTTER_HALF = W * LINING_INSET
BLOCK_INNER_X = 0.005
BLOCK_ROUND_R = 0.0025
STATIC_INNER_X = BLOCK_INNER_X + BLOCK_ROUND_R

# Page grid.
COLS = 25
ROWS = 33

# Motion.
LIFT_SCALE = 0.6
LEAD = 0.04
LIFT_VAR = 0.06
GUTTER_BLEND = 0.06  # fraction of page width used by the gutter curve

# Timeline.
FPS = 30
COVER_START = 0.6
COVER_END = 2.8
FIRST_TURN = 3.7
TURN_DUR = 2.5
SETTLE_DUR = 0.5
TURN_GAP = TURN_DUR + SETTLE_DUR + 0.3
DURATION = FIRST_TURN + NUM_TURNS * TURN_GAP + 0.5


def clamp01(x: float) -> float:
    return 0.0 if x < 0.0 else 1.0 if x > 1.0 else x


def smootherstep(x: float) -> float:
    x = clamp01(x)
    return x * x * x * (x * (x * 6.0 - 15.0) + 10.0)


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


# --- Gutter curve ---------------------------------------------------------

def gutter_surface_y(world_x: float, u: float = 1.0) -> float:
    """Top surface of the gutter hollow at world x (metres)."""
    s = clamp01((world_x + GUTTER_HALF) / (2.0 * GUTTER_HALF))
    dip = LINING_TOP - BOARD_TOP
    return LINING_TOP - dip * math.sin(math.pi * s) * smootherstep(u)


def gutter_particle_floor_y(world_x: float, u: float = 1.0) -> float:
    """Particle-centre floor on the gutter (mid-surface + half shell + gap)."""
    return gutter_surface_y(world_x, u) + SHELL_HALF + COVER_GAP


def binding(k: int, count: int = NUM_TURNS) -> Vec2:
    """World (x, y) gutter binding point for sheet k."""
    s = (k + 0.5) / count if count > 1 else 0.5
    x = -GUTTER_HALF + 2.0 * GUTTER_HALF * s
    return (x, gutter_particle_floor_y(x, 1.0))


def rest_y(k: int) -> float:
    return REST_BASE + (NUM_SHEETS - 1 - k) * SHEET_VSTEP


def land_y(k: int) -> float:
    return LAND_BASE + k * LAND_STEP


# --- Cover hinge ----------------------------------------------------------

OPEN_CENTER_Y = CT / 2
CLOSED_CENTER_Y = rest_y(0) + 0.0005 + CT / 2


def cover_pose(u: float) -> Tuple[float, float]:
    """Return (angle, hinge_y) for the front cover at opening progress u."""
    angle = math.pi * smootherstep(u)
    drop = smootherstep(clamp01((clamp01(u) - 0.55) / 0.45))
    hinge_y = lerp(CLOSED_CENTER_Y, OPEN_CENTER_Y, drop)
    return angle, hinge_y


# --- Curve helpers --------------------------------------------------------

def _bezier2(s: float, p0: Vec2, p1: Vec2, p2: Vec2) -> Vec2:
    a = (1.0 - s) * (1.0 - s)
    b = 2.0 * (1.0 - s) * s
    c = s * s
    return (a * p0[0] + b * p1[0] + c * p2[0], a * p0[1] + b * p1[1] + c * p2[1])


def _bezier2_length(p0: Vec2, p1: Vec2, p2: Vec2, n: int = 24) -> float:
    total = 0.0
    prev = p0
    for i in range(1, n + 1):
        p = _bezier2(i / n, p0, p1, p2)
        total += math.hypot(p[0] - prev[0], p[1] - prev[1])
        prev = p
    return total


def _bezier3(s: float, p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2) -> Vec2:
    a = (1.0 - s) ** 3
    b = 3.0 * (1.0 - s) ** 2 * s
    c = 3.0 * (1.0 - s) * s * s
    d = s ** 3
    return (
        a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
        a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
    )


def _bezier3_length(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, n: int = 24) -> float:
    total = 0.0
    prev = p0
    for i in range(1, n + 1):
        p = _bezier3(i / n, p0, p1, p2, p3)
        total += math.hypot(p[0] - prev[0], p[1] - prev[1])
        prev = p
    return total


def _solve_arch_height3(p0: Vec2, p3: Vec2, target_len: float) -> float:
    """Height of the cubic control points so the curve length ~= target_len."""
    chord = math.hypot(p3[0] - p0[0], p3[1] - p0[1])
    if chord >= target_len - 1e-9:
        return 0.0
    dx = p3[0] - p0[0]
    dy = p3[1] - p0[1]
    nx, ny = -dy, dx
    nl = math.hypot(nx, ny) or 1.0
    nx, ny = nx / nl, ny / nl
    if ny < 0.0:
        nx, ny = -nx, -ny
    lo, hi = 0.0, 2.0 * target_len
    for _ in range(20):
        a = (lo + hi) * 0.5
        c1 = (p0[0] + dx / 3.0 + nx * a * 0.45, p0[1] + dy / 3.0 + ny * a * 0.45)
        c2 = (p0[0] + 2.0 * dx / 3.0 + nx * a * 1.35, p0[1] + 2.0 * dy / 3.0 + ny * a * 1.35)
        if _bezier3_length(p0, c1, c2, p3) < target_len:
            lo = a
        else:
            hi = a
    return (lo + hi) * 0.5


def _solve_arch_height(p0: Vec2, p2: Vec2, target_len: float) -> float:
    """Height of the Bezier control point so the curve length ~= target_len."""
    chord = math.hypot(p2[0] - p0[0], p2[1] - p0[1])
    if chord >= target_len - 1e-9:
        return 0.0
    dx = p2[0] - p0[0]
    dy = p2[1] - p0[1]
    nx, ny = -dy, dx
    nl = math.hypot(nx, ny) or 1.0
    nx, ny = nx / nl, ny / nl
    if ny < 0.0:
        nx, ny = -nx, -ny
    mid = ((p0[0] + p2[0]) * 0.5, (p0[1] + p2[1]) * 0.5)
    lo, hi = 0.0, 2.0 * target_len
    for _ in range(20):
        a = (lo + hi) * 0.5
        c = (mid[0] + nx * a, mid[1] + ny * a)
        if _bezier2_length(p0, c, p2) < target_len:
            lo = a
        else:
            hi = a
    return (lo + hi) * 0.5


# --- Page shape -----------------------------------------------------------

@dataclass
class PageSpec:
    k: int
    x_b: float
    y_b: float
    rest_y: float
    land_y: float


def page_spec(k: int) -> PageSpec:
    x_b, y_b = binding(k)
    return PageSpec(k=k, x_b=x_b, y_b=y_b, rest_y=rest_y(k), land_y=land_y(k))


def _centerline(spec: PageSpec, p: float, rz: float) -> Tuple[Vec2, Vec2, Vec2, Vec2, float]:
    """Return (spine S, fore-edge F, control C1, control C2, settle k)."""
    # Per-row phase lead/lift (2D curl).
    p_row = clamp01(p + LEAD * (rz - 0.5) * math.sin(math.pi * p))
    phi = math.pi * smootherstep(p_row)
    settle = smootherstep(clamp01((p_row - 0.5) / 0.5))

    # Spine edge: starts at the gutter (world x=0) and settles to its binding.
    s = (spec.x_b * settle, lerp(spec.rest_y, spec.y_b, settle))

    # Fore-edge: same arc as the WebGL controller, offset by the spine settle.
    f = (
        spec.x_b * settle + W * math.cos(phi),
        spec.rest_y
        + (spec.land_y - spec.rest_y) * (phi / math.pi)
        + W * LIFT_SCALE * math.sin(phi),
    )

    # Cubic control points: hug the chord near the spine, then bulge near the
    # fore-edge. This gives a tighter, more page-like curl than a symmetric
    # quadratic arch.
    arch = _solve_arch_height3(s, f, W)
    arch *= 1.0 + LIFT_VAR * (2.0 * rz - 1.0) ** 2
    dx = f[0] - s[0]
    dy = f[1] - s[1]
    nx, ny = -dy, dx
    nl = math.hypot(nx, ny) or 1.0
    nx, ny = nx / nl, ny / nl
    if ny < 0.0:
        nx, ny = -nx, -ny
    c1 = (s[0] + dx / 3.0 + nx * arch * 0.45, s[1] + dy / 3.0 + ny * arch * 0.45)
    c2 = (s[0] + 2.0 * dx / 3.0 + nx * arch * 1.35, s[1] + 2.0 * dy / 3.0 + ny * arch * 1.35)
    return s, f, c1, c2, settle


def _row_point(
    spec: PageSpec,
    s_param: float,
    s: Vec2,
    f: Vec2,
    c1: Vec2,
    c2: Vec2,
    settle: float,
    rz: float,
) -> Vec3:
    b = _bezier3(s_param, s, c1, c2, f)

    # Blend to a flat stack with a curved gutter as the sheet settles.
    # At p=1 this gives: flat at land_y for most of the width, curving down to
    # the binding point over the first GUTTER_BLEND of the page.
    if settle > 0.0:
        sg = GUTTER_BLEND
        if s_param < sg:
            t = smootherstep(s_param / sg)
            flat_y = lerp(spec.y_b, spec.land_y, t)
        else:
            flat_y = spec.land_y
        y = lerp(b[1], flat_y, settle)
    else:
        y = b[1]

    z = -H * 0.5 + rz * H
    return (b[0], y, z)


def page_point(spec: PageSpec, p: float, s_param: float, rz: float) -> Vec3:
    """World position of one page vertex at turn progress p."""
    s, f, c1, c2, settle = _centerline(spec, p, rz)
    return _row_point(spec, s_param, s, f, c1, c2, settle, rz)


def page_points(spec: PageSpec, p: float, cols: int = COLS, rows: int = ROWS) -> List[Vec3]:
    """Row-major (r * cols + c) world-space vertices for one page."""
    pts: List[Vec3] = []
    for r in range(rows):
        rz = r / (rows - 1)
        s, f, c1, c2, settle = _centerline(spec, p, rz)
        for col in range(cols):
            s_param = col / (cols - 1)
            pts.append(_row_point(spec, s_param, s, f, c1, c2, settle, rz))
    return pts


def key_progress_values(steps: int = 25) -> List[float]:
    """Progress values used for shape keys: 0.04 .. 1.0 inclusive."""
    if steps < 2:
        return [1.0]
    return [i / (steps - 1) for i in range(1, steps)]  # skip p=0 (Basis)


def turn_frames(k: int, fps: int = FPS) -> Tuple[int, int, int]:
    """Return (start_frame, end_frame, first_key_frame) for sheet k."""
    start = FIRST_TURN + k * TURN_GAP
    end = start + TURN_DUR
    f0 = 1 + int(round(start * fps))
    f1 = 1 + int(round(end * fps))
    return f0, f1, f0


def frame_for_time(t: float, fps: int = FPS) -> int:
    return 1 + int(round(t * fps))


if __name__ == "__main__":
    # Quick numeric sanity check (no Blender needed).
    bad = 0
    for k in range(NUM_TURNS):
        spec = page_spec(k)
        for pi in range(21):
            p = pi / 20
            pts = page_points(spec, p)
            for x, y, z in pts:
                if not (math.isfinite(x) and math.isfinite(y) and math.isfinite(z)):
                    bad += 1
                if y < -1e-6:
                    bad += 1
        first = page_points(spec, 0.0)[0]
        last = page_points(spec, 1.0)[0]
        print(
            f"page {k}: rest=({first[0]*1000:.2f},{first[1]*1000:.2f}) "
            f"land=({last[0]*1000:.2f},{last[1]*1000:.2f}) "
            f"binding=({spec.x_b*1000:.2f},{spec.y_b*1000:.2f}) "
            f"landY={spec.land_y*1000:.2f}"
        )
    print("BAD", bad)