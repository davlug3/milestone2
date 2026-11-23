# Decisions

- Units: meters.
- Coordinate convention (world): X = book width, Y = world up (book thickness), Z = book height (head-to-tail). Spine runs along Z at x = -width/2. Open book lies on the XZ plane; gravity is -Y. This supersedes PLAN.md section 3.1, which described an upright book and conflicted with gravity -Y for a book on a surface.
- Renderer: Three.js WebGLRenderer / WebGL 2.
- Physics: custom PBD/XPBD for the active page.
- Simulation timestep: fixed 1/120 second initially.
- Active dynamic pages: one initially.
- Final shot duration: 25 seconds.
- Final animation: deterministic and cacheable.
- Build system: Vite (no existing build system in repo at start).
- Language: TypeScript (strict).
- Folder layout: `src/app`, `src/config`, `src/book`, `src/paper`, `src/physics`, `src/animation`, `src/rendering`, `src/testing`, `src/assets`.
- Bending: two-step neighbor distance constraints (soft, stiffness ~0.35), configurable via `bendStiffness`. Dihedral bending deferred.
- Paper thickness: thin-shell render (front/back offset along mid-surface normal + perimeter edge), default 0.25 mm visual.
- Sim tests run headless via `npm run test:sim` (esbuild bundle + node).
- Sheet topology supports two rest planes: 'xy' (vertical, drop tests) and 'xz' (flat, page turns).
- Page turn: kinematic corner pin driven by `PageTurnController` (lift/peel/arch/cross/fall/settle via eased target); never rigid rotation. Ground collision (y clamp) for landing.
- Test scenes selectable via `?test=paper-drop|paper-edge|page-turn`; `?t=<seconds>` freezes a page-turn frame for deterministic screenshots.