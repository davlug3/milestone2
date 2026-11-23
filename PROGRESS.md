# Progress

Current milestone: 5 (demo + page-turn realism v8: curved gutter, per-page binding) + Blender project
Last completed task: Curved gutter (plinth + rounded right block) with each sheet bound at its own gutter point
Current blocker: inotify watch limit blocks `npm run dev` (use `vite preview`)
Build status: PASS (tsc + vite build)
Test status: PASS (sim, page metrics stretch 1.15x dihedral 29.8deg penetration 0, 8-page stacking 0mm interpenetration, cover + curved gutter PASS, demo 0 errors)
Visual inspection: PASS (frames inspected at t=0/1.6/2.4/2.8/4.6/5.0/5.6/5.9/6.2/8/10/30 plus gutter close-ups; curved gutter fan visible, pages bind at distinct gutter points, no clipping)

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
- [ ] Milestone 5 — Integrate page with book
- [ ] Milestone 6 — Cover, spine, and endpapers
- [ ] Milestone 7 — Photographic page design
- [ ] Milestone 8 — Full shot timeline and camera
- [ ] Milestone 9 — Final materials, lighting, and render
- [ ] Milestone 10 — Optimization and final validation

## Next task

Continue Milestone 5 — Integrate page with book: bind the demo pages to the actual book binding region (reuse book block geometry), and refine the cover/spine coupling. Remaining page-turn polish: the fore-edge follows a full semicircle, so it stays high until the last ~15% of the turn and then drops quickly; a future pass could finish the horizontal sweep at ~80% progress and settle earlier. Then proceed to Milestone 6 (cover/spine/endpaper mechanics).