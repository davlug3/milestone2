# HANDOFF

**For the next AI agent. Read this first.**

We are mid-way through adding **full case-binding anatomy** (rounded/backed text block, hollow spine, joint, endpapers, headbands, spine throw-up) to both the Three.js demo and the Blender project. The Three.js side has a first pass compiled and rendered; the Blender side is **not started**.

---

## 1. Project state

### Repository

- Path: `/home/dave/milestone2`
- Branch: `main`
- Last commit: `38eea9d` — Make the book thicker (22 mm page block) in Three.js and Blender
- Working tree: **dirty**
  - `M src/book/materials.ts`
  - `M src/demo/bookDemoScene.ts`
  - `?? src/book/spineRig.ts`
  - `?? HANDOFF.md` (this file)

### Two deliverables

1. **Three.js / WebGL2 cinematic book demo**
   - Closed book → hinged cover opens → 8 page turns → 15 sheets, collision, curved gutter, thicker book.
   - First pass of full case-binding anatomy added (uncommitted).
2. **Blender 5.3 project**
   - Native scene generator, shape-key page turns, Cycles, `blender/book.blend`.
   - Still on the previous model: flat block + curved gutter + 22 mm block.
   - Full case-binding anatomy **not implemented yet**.

---

## 2. What was just done (Three.js, uncommitted)

### New file: `src/book/spineRig.ts`

Pure geometry helpers for the case binding:

- `SPINE_BULGE = 8 mm` — text-block round.
- `SHOULDER_W = 8 mm` — 45° backing shoulder.
- `SPINE_CONCAVE = 3 mm` — throw-up at full open.
- `SPINE_COVER_BULGE = 12 mm` — outside cover spine.
- `SPINE_COVER_T = 2.5 mm`.
- `HEADBAND_R = 1.5 mm`.
- `textBlockProfile(flex, dims, blockTop, yBot)` — closed/open XY profile:
  - convex spine arc when closed (`+8 mm`),
  - concave when open (`-3 mm`, throw-up),
  - **shoulder at the BOTTOM** of the text block (this was moved from the top after a visual issue),
  - flat top, fore-edge, bottom.
- `textBlockGeometry(flex, ...)` — extruded profile for morph targets.
- `spineCoverArc(u, ...)` / `spineCoverGeometry(...)` / `updateSpineCoverGeometry(...)` — curved cover-spine ribbon from the back cover’s lower edge to the front cover’s hinge edge.
- `headbandGeometry(...)`.

### Modified: `src/demo/bookDemoScene.ts`

- Imports `spineRig`.
- Replaces the old rounded box block with:
  - `blockWidth = W - 0.004` (4 mm fore-edge square),
  - `textBlockGeometry(0)` + `textBlockGeometry(1)` as a **morph target**,
  - `rightBlock.morphTargetInfluences[0]` driven by `smootherstep(u)`.
- Replaces the old gutter plinth with the **spine cover ribbon** (`spine-cover`).
- Adds **headbands** at `z = ±(H/2 - 1.5 mm)`, `x = 2.5 mm`, `y = blockTop`, rotated to lie along X.
- Static sheets now start at `STATIC_INNER_X` and use `blockWidth`.
- Heightfield base:
  - `blockTop` for `BLOCK_INNER_X ≤ worldX ≤ blockWidth`,
  - gutter particle floor for `|worldX| ≤ GUTTER_HALF`,
  - cover floor elsewhere.
- `updateCover(t)`:
  - sets `rightBlock.morphTargetInfluences[0] = smootherstep(u)`,
  - calls `updateSpineCover(u)`.
- Camera unchanged so far: `(0.03, 0.52, 0.72)` looking at `(0, 0.03, 0)`.

### Modified: `src/book/materials.ts`

- `spine` material is now `DoubleSide`.
- Added `headband` material (muted red `0x7a2e2a`).

### Build status

- `npm run build` — **PASS** (after the latest profile change).
- Last visual check:
  - `t=0`: rounded spine back is visible on the left; closed book reads as a hardcover.
  - `t=30`: left page fan and right block visible; **gutter is still very dark** and reads as a void.
  - `t=2.8` and intermediate cover frames were not re-inspected after moving the shoulder to the bottom.

### Not done / unverified on Three.js

- Full visual pass of the cover opening (`t=1.2–2.6`) after the latest profile change.
- Gutter polish: the text block’s concave spine / shoulder is still too dark. It may need:
  - a stronger gutter fill light,
  - a lighter spine/fillet material,
  - moving the key light,
  - or a cream fillet at the block’s inner edge.
- Page/block interpenetration is not covered by the headless tests (they test page-to-page and page-to-cover only). Visually check the gutter during the turn.
- Endpaper hinge strips and joint grooves are **not added yet**.
- The morph target assumes the closed/open profiles have identical vertex counts. If you change the profile point count, keep both profiles identical.
- The `blockWidth` change (fore-edge square) may need matching updates in the static sheets and any page-block collision assumptions.

---

## 3. Blender state

### Current files

- `blender/page_model.py` — pure-Python analytic page model:
  - `PBT = 0.022` (22 mm block),
  - curved gutter binding,
  - cubic-Bezier page curl,
  - cover pose,
  - `check_model.py` validation passes.
- `blender/build_book.py` — scene generator:
  - covers, beveled page block with rounded inner-top edge, low gutter plinth,
  - 7 static sheets + 8 shape-keyed turning sheets,
  - Cycles, camera, lights, materials.
- `blender/book.blend` — current generated scene (previous model).
- `blender/README.md` — build/preview instructions.

### Not done

- Full case-binding anatomy:
  - rounded/backed text block,
  - hollow spine cover,
  - joint,
  - endpapers,
  - headbands,
  - spine throw-up.
- The Blender scene still uses the flat block + low plinth.

### Blender commands

Blender is **not installed system-wide**. A user-space build is at:

```sh
/tmp/opencode/blender/blender-5.3.0-linux-x64/blender
```

If `/tmp` was cleared, re-download Blender 5.3.0 Linux x64.

Build + previews:

```sh
/tmp/opencode/blender/blender-5.3.0-linux-x64/blender -b -P blender/build_book.py -- \
  --out blender/book.blend --preview --preview-dir blender/renders --samples 16
```

Validate page math:

```sh
python3 blender/check_model.py
```

---

## 4. Three.js commands

```sh
npm run build
npm run test:sim
npm run test:cover
npm run test:twopage
npm run test:page
```

Preview:

- `http://127.0.0.1:5181/` may already be running (`vite preview` on `dist`).
- If not:

```sh
npm run build
npm run preview -- --port 5181 --host 127.0.0.1
```

- `npm run dev` is blocked by `ENOSPC` inotify watches on this machine; use `vite preview`.

Automation API:

```js
__demo.seek(5.9)
__demo.play()
__demo.pause()
__demo.cover()
__demo.pageBounds()
```

---

## 5. Key constants

### Three.js

- `W = 0.24`, `H = 0.31`, `CT = 0.0025`.
- `PBT = 0.022` (22 mm block).
- `blockTop = 0.0245` (24.5 mm).
- `restBase = blockTop + 0.0004 = 0.0249`.
- `restY` for sheet 0 ≈ `0.0291` (29.1 mm).
- `landBase ≈ 0.003125`, `landStep = 0.0008`.
- Cover: `0.6–2.8 s` (2.2 s), turns from `3.7 s`, 2.5 s each, 0.5 s settle, 0.3 s gap.
- Gutter: `LINING_INSET = 0.015`, `GUTTER_HALF = 3.6 mm`.
- `BLOCK_INNER_X = 0.005`, `blockWidth = W - 0.004 = 0.236`.

### Spine rig

- `SPINE_BULGE = 0.008`.
- `SHOULDER_W = 0.008`.
- `SPINE_CONCAVE = 0.003`.
- `SPINE_COVER_BULGE = 0.012`.
- `SPINE_COVER_T = 0.0025`.
- `HEADBAND_R = 0.0015`.

### Blender

- `page_model.py` mirrors the above (`PBT = 0.022`, gutter, cover).
- The Blender block is still a flat block with a rounded inner-top edge, not the new profile.

---

## 6. Suggested next steps

### A. Finish Three.js case-binding polish

1. Inspect the cover opening after the shoulder-at-bottom change:
   - `t = 1.2, 1.6, 2.0, 2.4, 2.8`.
   - Look for morph artifacts, page/block clipping, and whether the spine cover reads as a continuous spine.
2. Fix the dark gutter:
   - Increase `gutterFill` or add a second fill aimed into the gutter.
   - Consider a cream `gutter fillet` at the text block’s inner edge, or lighten the spine material.
   - Check whether the text block’s concave spine is visible or hidden by the right block’s top/shoulder.
3. Check page/block interpenetration visually at `t = 4.6–6.2` and `t = 30`.
4. Add the remaining anatomy details:
   - endpaper hinge strips on the covers,
   - joint groove strips at the cover/spine seam,
   - verify headband placement/color.
5. Re-run all tests and build.

### B. Implement full case-binding in Blender

1. Extend `blender/page_model.py` with:
   - `SPINE_BULGE`, `SHOULDER_W`, `SPINE_CONCAVE`, `SPINE_COVER_BULGE`, `SPINE_COVER_T`, `HEADBAND_R`.
   - `textBlockProfile(flex)` (same as Three.js).
   - `spineCoverArc(u)` / ribbon points.
2. Extend `blender/build_book.py`:
   - text block as an extruded profile with **shape keys** `Closed` / `Open` (throw-up).
   - spine cover ribbon with shape keys or per-frame vertex update.
   - headbands (cylinders), endpaper hinge strips, joint strips.
   - keep the existing page rig.
3. Rebuild:
   - `blender -b -P blender/build_book.py -- --out blender/book.blend --preview --samples 16`.
4. Inspect Cycles previews at `t = 0, 1.6, 2.8, 5.9, 30`.
5. Update `blender/README.md`, `PROGRESS.md`, `DECISIONS.md`.

### C. Docs / commit

- Update `PROGRESS.md` / `DECISIONS.md` with the full case-binding work.
- Commit and push when a stable checkpoint is reached.

---

## 7. Warnings / gotchas

- **Blender/Eevee:** EEVEE Next shows a per-quad shading grid on the large flat pages. Use **Cycles**.
- **Blender path:** `/tmp/opencode/blender/...` is temporary; re-download if missing.
- **Three.js dev server:** `npm run dev` hits `ENOSPC` inotify limits; use `npm run preview`.
- **Morph target:** `textBlockGeometry(0)` and `textBlockGeometry(1)` must have identical vertex counts. Keep the profile point count fixed.
- **Page block collision:** the new text block’s shoulder is at the bottom; the heightfield base still uses `blockTop` from `BLOCK_INNER_X` to `blockWidth`. This is conservative, but visually check the page near the gutter.
- **Camera:** the closed book now has a spine bulge to `x ≈ -12 mm`; the camera may need a small left shift or a wider view.
- **Tooling note:** the `edit` tool was malfunctioning in the previous session (only `path` was passed). The previous agent used Python scripts for replacements. Use the normal `edit`/`write` tools if they work now; otherwise use Python.

---

## 8. Quick status snapshot

- Three.js build: **PASS**.
- Three.js tests (`sim`, `cover`, `twopage`, `page`): **PASS** (last run before the latest profile change; re-run to be safe).
- Three.js visual: **PARTIAL** — rounded spine visible at `t=0`; gutter still dark at `t=30`; intermediate cover frames not re-inspected.
- Blender `check_model.py`: **PASS**.
- Blender build/preview: **PASS** for the previous model; full case-binding **NOT STARTED**.
- Git: `main` at `38eea9d`; Three.js case-binding changes uncommitted; `HANDOFF.md` uncommitted.

**Start by reading `src/book/spineRig.ts` and the static-book section of `src/demo/bookDemoScene.ts`, then re-render `t = 1.6` and `t = 30`.**