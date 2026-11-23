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
- Folder layout: `src/app`, `src/config`, `src/book`, `src/paper`, `src/physics`, `src/animation`, `src/rendering`, `src/assets`.