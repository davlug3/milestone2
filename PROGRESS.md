# Progress

Current milestone: 5 (demo + page-turn realism v4)
Last completed task: Closed-book start fix + heightfield collision + 2D curl
Current blocker: inotify watch limit blocks `npm run dev` (use `vite preview`)
Build status: PASS (tsc + vite build)
Test status: PASS (sim 8/8, page metrics stretch 1.11x dihedral 35deg penetration 0, demo 0 errors, t=0 closed)

## Completed

- [x] Milestone 0 — Repository inspection and setup
- [x] Milestone 1 — Static book block
- [x] Milestone 2 — One deformable test sheet
- [x] Milestone 3 — Bending and thickness
- [x] Milestone 4 — One guided page turn
- [~] Animated demo (play button): closed book -> cover opens -> 3 page turns
- [~] Page-turn realism v4: closed-book start, heightfield collision, 2D curl (lead+liftVar)
- [ ] Milestone 5 — Integrate page with book
- [ ] Milestone 6 — Cover, spine, and endpapers
- [ ] Milestone 7 — Photographic page design
- [ ] Milestone 8 — Full shot timeline and camera
- [ ] Milestone 9 — Final materials, lighting, and render
- [ ] Milestone 10 — Optimization and final validation

## Next task

Continue Milestone 5 — Integrate page with book: bind the demo pages to the actual book binding region (reuse book block geometry), add page-to-stack and page-to-cover collision, and refine the cover/spine coupling. Then proceed to Milestone 6 (cover/spine/endpaper mechanics).