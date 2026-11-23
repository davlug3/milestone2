# Progress

Current milestone: 5 (demo + page-turn realism v5)
Last completed task: 15-sheet persistent book, page-to-page collision, shadow-acne root-cause fix
Current blocker: inotify watch limit blocks `npm run dev` (use `vite preview`)
Build status: PASS (tsc + vite build)
Test status: PASS (sim, page metrics stretch 1.11x dihedral 35deg penetration 0, 8-page stacking 0mm interpenetration, demo 0 errors)
Visual inspection: PASS (frames inspected at t=0/3.5/4.3/5/5.8/6.6/10/20/30; closed start, pages persist, no shadow acne)

## Completed

- [x] Milestone 0 — Repository inspection and setup
- [x] Milestone 1 — Static book block
- [x] Milestone 2 — One deformable test sheet
- [x] Milestone 3 — Bending and thickness
- [x] Milestone 4 — One guided page turn
- [~] Animated demo (play button): closed book -> cover opens -> 8 page turns (15 sheets)
- [~] Page-turn realism v4: closed-book start, heightfield collision, 2D curl (lead+liftVar)
- [~] Page-turn realism v5: 15 persistent sheets, page-to-page collision (baked heightfield), shadow-acne fix (inverted shell normals), right-stack collision floor
- [ ] Milestone 5 — Integrate page with book
- [ ] Milestone 6 — Cover, spine, and endpapers
- [ ] Milestone 7 — Photographic page design
- [ ] Milestone 8 — Full shot timeline and camera
- [ ] Milestone 9 — Final materials, lighting, and render
- [ ] Milestone 10 — Optimization and final validation

## Next task

Continue Milestone 5 — Integrate page with book: bind the demo pages to the actual book binding region (reuse book block geometry), and refine the cover/spine coupling. Remaining page-turn polish: the fore-edge follows a full semicircle, so it stays high until the last ~15% of the turn and then drops quickly; the spine edge stays pinned at the right-stack height so landed pages ramp up steeply near the gutter. A future pass could (a) finish the horizontal sweep at ~80% progress and settle earlier, and (b) drive the spine edge down toward the left stack, or use a prescribed 2D curl surface. Then proceed to Milestone 6 (cover/spine/endpaper mechanics).