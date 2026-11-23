# Progress

Current milestone: 5 (demo + page-turn realism v2)
Last completed task: Page-turn realism v2 (long-range bend, curl, spine/shadow fixes)
Current blocker: inotify watch limit blocks `npm run dev` (use `vite preview`)
Build status: PASS (tsc + vite build)
Test status: PASS (sim 8/8, page metrics dihedral 29deg curl 7.9cm penetration 0, demo 0 errors)

## Completed

- [x] Milestone 0 — Repository inspection and setup
- [x] Milestone 1 — Static book block
- [x] Milestone 2 — One deformable test sheet
- [x] Milestone 3 — Bending and thickness
- [x] Milestone 4 — One guided page turn
- [~] Animated demo (play button): closed book -> cover opens -> 3 page turns
- [~] Page-turn realism v2: long-range bending curl, spine strip fix, shadow bias, collision ground
- [ ] Milestone 5 — Integrate page with book
- [ ] Milestone 6 — Cover, spine, and endpapers
- [ ] Milestone 7 — Photographic page design
- [ ] Milestone 8 — Full shot timeline and camera
- [ ] Milestone 9 — Final materials, lighting, and render
- [ ] Milestone 10 — Optimization and final validation

## Next task

Continue Milestone 5 — Integrate page with book: bind the demo pages to the actual book binding region (reuse book block geometry), add page-to-stack and page-to-cover collision, and refine the cover/spine coupling. Then proceed to Milestone 6 (cover/spine/endpaper mechanics).