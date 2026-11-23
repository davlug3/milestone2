# Decisions

- Units: meters.
- Coordinate convention: X width, Y height, Z depth. Spine along Y.
- Renderer: Three.js WebGLRenderer / WebGL 2.
- Physics: custom PBD/XPBD for the active page.
- Simulation timestep: fixed 1/120 second initially.
- Active dynamic pages: one initially.
- Final shot duration: 25 seconds.
- Final animation: deterministic and cacheable.
- Build system: Vite (no existing build system in repo at start).
- Language: TypeScript (strict).
- Folder layout: `src/app`, `src/config`, `src/book`, `src/paper`, `src/physics`, `src/animation`, `src/rendering`, `src/assets`.