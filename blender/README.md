# Blender book project

A native Blender reconstruction of the WebGL cinematic book demo: hardcover
book, curved gutter, 15 sheets, and an approximate procedural page turn.

Everything is generated from Python — no external assets, no simulation bake.

## Requirements

- Blender 5.3 (tested with `blender-5.3.0-linux-x64`).
- No other dependencies.

## Build the scene

```sh
blender -b -P blender/build_book.py -- --out blender/book.blend
```

Options:

```sh
--out PATH          output .blend (default blender/book.blend)
--preview           render preview frames after building
--preview-dir PATH  preview output dir (default blender/renders)
--width / --height  render resolution (default 1920x1080)
--samples N         Cycles samples (default 32)
--key-steps N       page shape-key count (default 25)
```

Render previews:

```sh
blender -b -P blender/build_book.py -- --out blender/book.blend --preview --samples 16
```

Open `blender/book.blend` in Blender and press Render. The scene is set to
Cycles, 30 fps, frames 1–919.

## What is in the scene

- **Covers** — beveled boards with inner lining. The front cover is parented to
  a hinge empty at the spine and keyframed for the 2.2 s opening.
- **Page block** — set back 5 mm from the spine with a 2.5 mm rounded inner-top
  edge.
- **Gutter plinth** — a solid whose top follows the gutter curve; a shape key
  flattens it when the book is closed and dips it as the cover opens.
- **Sheets** — 7 static sheets plus 8 shape-keyed turning sheets. Each turning
  sheet binds at its own point along the gutter, curls over, and lands on the
  left stack.
- **Studio** — dark floor, 42° camera, sun key plus fill/rim/gutter fill.
- **Materials** — Principled BSDF cloth, endpaper, paper, page edge; subtle
  procedural paper bump.

## Timeline

- 30 fps, frame 1 = t 0.
- Cover: 0.6–2.8 s.
- Page turns: first at 3.7 s, 2.5 s each, 0.5 s settle, 0.3 s gap.
- Total: ~30.6 s (frame 919).

## Files

- `blender/page_model.py` — pure-Python analytic page shapes (no bpy).
- `blender/build_book.py` — Blender scene generator.
- `blender/check_model.py` — pure-Python validation of the page model.
- `blender/book.blend` — generated scene.
- `blender/renders/` — preview renders (ignored by git).

## Validate the page model

```sh
python3 blender/check_model.py
```

Checks the rest shape, gutter binding, landed fore-edge, flat landed stack,
finite/above-table particles, centerline length, and right-block clearance.

## Notes

- The page turn is an **approximation**: a cubic-Bezier curl driven by shape
  keys, not the WebGL XPBD simulation. It is deterministic and editable, but
  it does not reproduce the exact solver output.
- Cycles is used instead of EEVEE because EEVEE Next shows a per-quad shading
  grid on the large flat page surfaces in this scene.
- The gutter dip is bounded by the cover board/lining geometry (0.25 mm); the
  visible curve comes mainly from the sheets rising from their gutter binding
  points to the stack.