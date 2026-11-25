# Progress

Current milestone: 6 (cover, spine, endpapers) — complete
Last completed task: Bound spine — pages attach to a cloth plane between the cover hinges; the plane's front edge follows the front cover hinge through the swing; text block is a wedge, cloth mull added, spine edge stays on the binding through the turn; binding plane is a visible ochre cloth slab with page-stock tabs showing every spine edge glued to it
Current blocker: none
Build status: PASS (tsc + vite build)
Test status: PASS (sim, page metrics stretch 1.14x dihedral 36.3deg penetration 0, 8-page stacking 0mm interpenetration, cover + C-shell bounds PASS, spine plane follows the front cover PASS, spine PASS, paper/spine clearance PASS, demo 0 errors)
Visual inspection: PARTIAL (closed, opening u=0.25/0.5/0.75/1.0, open front/gutter, mid-turn captured at 1200x900; the ochre binding cloth is visible as a continuous band between the covers in side-open.png and top-open.png; I cannot render images directly, so fine detail is user-verifiable at /tmp/opencode/probe/*.png)

## Completed

- [x] Milestone 0 — Repository inspection and setup
- [x] Milestone 1 — Static book block
- [x] Milestone 2 — One deformable test sheet
- [x] Milestone 3 — Bending and thickness
- [x] Milestone 4 — One guided page turn
- [~] Animated demo (play button): closed book -> cover opens -> 8 page turns (15 sheets)
- [~] Page-turn realism v4: closed-book start, heightfield collision, 2D curl (lead+liftVar)
- [~] Page-turn realism v5: 15 persistent sheets, page-to-page collision (baked heightfield), shadow-acne fix (inverted shell normals), right-stack collision floor
- [~] Page-turn realism v6: stiffer pages via long-range bending spans 3-6 (max fold 33.7deg -> 27.3deg; smoother curl, flatter stack)
- [~] Page-turn realism v7: hinged cover opening (2.2 s, no hop/clip) + page/cover collision (open-cover lining floor) + spine-edge settle + low spine plinth + `npm run test:cover`
- [~] Page-turn realism v8: curved gutter (plinth + rounded right block) + per-page gutter binding + each page curves up from the gutter to its stack + gutter-aware collision floor
- [x] Blender project (Option B): native Blender 5.3 scene generator, analytic shape-key page turn, Cycles studio, `blender/book.blend` + previews
- [x] Thicker book: page block 12 mm -> 22 mm (closed book ~27 mm) in Three.js and Blender; all tests pass
- [x] Milestone 6 — Cover, spine, and endpapers (animated spine rig + pastedowns/crease + front/back flyleaves + cloth joint at the gutter + `npm run test:spine`)
- [~] Milestone 5 — Integrate page with book (pages are bound to per-sheet gutter points and collide with the block/cover; kept as a living correctness item)
- [ ] Milestone 6 — Cover, spine, and endpapers
- [ ] Milestone 7 — Photographic page design
- [ ] Milestone 8 — Full shot timeline and camera
- [ ] Milestone 9 — Final materials, lighting, and render
- [ ] Milestone 10 — Optimization and final validation

## Next task

Milestone 7 — Photographic page design: placeholder photographs, several page layouts, textures on both faces of the turning sheets with correct UVs through deformation, restrained margins/captions. Keep textures on the simulated sheet (no floating image planes). Defer the fore-edge timing polish (finish the horizontal sweep at ~80% and settle earlier) until after milestone 7 so page imagery is validated on the current motion.