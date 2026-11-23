# Cinematic Hardcover Book Animation --- Production Plan

**Project type:** Real-time 3D scene and deterministic cinematic
animation\
**Target duration:** 25 seconds (configurable from 20--30 seconds)\
**Rendering:** Three.js `WebGLRenderer` / WebGL 2\
**Language:** TypeScript\
**Primary goal:** A photorealistic hardcover photography book opens,
several real 3D pages turn with believable paper deformation, and the
camera slowly pushes in and tilts down.

------------------------------------------------------------------------

## 0. Instructions for the coding agent

This plan is deliberately written for small, inexpensive, or weaker
coding models. Follow it literally. Do not attempt the whole project in
one response or one coding task.

### 0.1 Operating rules

1.  **Inspect before editing.** First list the repository files, read
    `package.json`, inspect the current app entry point, and identify
    the build and test commands.
2.  **Do not assume the repository is empty.** Preserve existing
    conventions and working code.
3.  **Work in small milestones.** Implement only the current milestone.
    Do not jump ahead.
4.  **One objective per task.** Avoid broad requests such as "build the
    whole book simulation."
5.  **Keep changes small.** Prefer a few focused files over a large
    rewrite.
6.  **Do not invent APIs.** Check the installed Three.js version and its
    actual TypeScript types before using an API.
7.  **Compile after each meaningful change.** Run the available
    typecheck/build/test commands and fix errors before continuing.
8.  **Do not hide errors.** Never silence TypeScript errors with `any`,
    `@ts-ignore`, empty catch blocks, or fake return values unless a
    documented, temporary reason is approved.
9.  **Do not add dependencies casually.** Explain why a new dependency
    is needed and prefer native Three.js or small local implementations.
10. **Keep a working scene at all times.** Each milestone must leave the
    project runnable.
11. **Use deterministic animation.** The same time input must produce
    the same scene state. Avoid relying on uncontrolled wall-clock
    timing for the final shot.
12. **Document decisions.** Update `PROGRESS.md` and `DECISIONS.md` at
    the end of every milestone.
13. **Do not claim physical accuracy without tests.** Describe
    approximations honestly.
14. **Ask only when blocked by a real ambiguity.** Otherwise choose the
    simplest sensible default and record it.
15. **Never replace the required WebGL renderer with WebGPU.**

### 0.2 Required response format after every task

The agent must report:

-   **Completed:** exact work performed.
-   **Files changed:** list of files.
-   **Validation:** commands run and whether they passed.
-   **Known limitations:** what is still approximate or broken.
-   **Next task:** one small, specific task from this plan.

If validation fails, fix the failure before reporting completion. Do not
start the next milestone with a broken build.

### 0.3 Model-friendly task protocol

For each task:

1.  Read this plan and the relevant source files.
2.  Restate the task in one sentence.
3.  Identify the smallest file set that must change.
4.  Implement only that task.
5.  Run validation.
6.  Summarize the result.
7.  Stop and wait for the next task.

Do not ask the model to remember large amounts of context. Keep
`PROGRESS.md`, `DECISIONS.md`, and this plan concise and current so a
fresh model session can resume.

------------------------------------------------------------------------

## 1. Product definition

### 1.1 Final visual

A premium hardcover photography/art book sits on a dark, understated
studio surface. The shot begins with the book closed or nearly closed.
The front cover slowly opens. Several individual pages lift, flex, arch
over the gutter, fall onto the opposite stack, and settle. The pages
show temporary placeholder photographs. The final composition holds on
an attractive open spread.

The result should feel like a close-up product film of a real physical
object.

### 1.2 Non-goals

Do not build these unless explicitly requested later:

-   An interactive e-reader.
-   A full book authoring tool.
-   A general-purpose cloth simulator.
-   A complete industrial bookbinding simulator.
-   A physically exact finite-element paper solver.
-   A 100-page fully dynamic collision simulation.
-   A complex user interface for editing the shot.

The objective is one carefully art-directed, repeatable cinematic shot.

### 1.3 Visual priorities

In descending order:

1.  Convincing page bending and turning.
2.  Believable book block, spine, and cover relationship.
3.  Correct page thickness and layered page edges.
4.  Realistic contact, shadows, and page settling.
5.  Photographic page content that deforms with the paper.
6.  Cinematic lighting and camera motion.
7.  Performance and code elegance.

A visually convincing controlled approximation is better than a
theoretically ambitious simulation that looks unstable.

------------------------------------------------------------------------

## 2. Research and physical reference

Complete this research before choosing final simulation parameters. Save
useful findings and reference links in `docs/research.md`.

### 2.1 Book construction to represent

Use a sewn hardcover photography book as the reference construction.

A real hardcover book commonly contains:

-   Front and back rigid boards.
-   Cover material wrapped around the boards.
-   A spine piece and flexible hinge areas.
-   A book block made from folded signatures.
-   Sewing or another binding method joining signatures.
-   Endpapers joining the book block to the case.
-   Spine lining and adhesive.
-   Optional headbands at the top and bottom of the spine.

Do not model the entire book as two cover boxes joined by one rigid
hinge.

### 2.2 Important physical behavior

Observe reference videos and photographs. Record:

-   How the cover opens and how the spine changes shape.
-   How the book block rises or rounds near the gutter.
-   How pages fan near the fore-edge.
-   How the page root stays connected while the free edge moves.
-   How a page bends differently across its width and height.
-   How a page arches, flutters slightly, lands, and settles.
-   How page stacks compress and shift during opening.
-   How printed images follow the surface without floating.

Paper has bending stiffness and some resistance to in-plane stretching.
Paper grain direction affects stiffness. The simulation should
approximate these effects, not pretend paper is a weightless plane.

### 2.3 Research references

Use these sources as starting points. Check the original paper or
documentation before implementing an algorithm.

-   Chicago Manual of Style, book production and binding:
    https://www.chicagomanualofstyle.org/help-tools/production-technologies.html
-   Müller et al., *Position Based Dynamics* (2006):
    https://doi.org/10.2312/PE/vriphys/vriphys06/071-080
-   Macklin, Müller, Chentanez, *XPBD: Position-Based Simulation of
    Compliant Constrained Dynamics* (2016):
    https://doi.org/10.1145/2994258.2994272
-   Three.js WebGLRenderer documentation:
    https://threejs.org/docs/pages/WebGLRenderer.html
-   Three.js BufferGeometry documentation:
    https://threejs.org/docs/pages/BufferGeometry.html
-   Three.js documentation: https://threejs.org/docs/

Research page-turning-specific methods such as mass-spring sheets,
geometric page-turn models, and thin-shell simulation. Do not copy an
algorithm without understanding its inputs, limitations, and coordinate
conventions.

### 2.4 Research deliverable

`docs/research.md` must include:

-   Book construction diagram or written component breakdown.
-   At least 5 visual references, with source URLs and a note about what
    each reference demonstrates.
-   Chosen page representation.
-   Chosen solver approach and why.
-   Known limitations.
-   Initial dimensions and material assumptions.

Do not spend days researching. Time-box research, then build a test
sheet and validate the approach visually.

------------------------------------------------------------------------

## 3. Initial dimensions and units

Use meters internally. This keeps gravity and dimensions easy to reason
about.

Suggested starting book dimensions:

  Property                               Initial value
  --------------------------------- ------------------
  Width                                        0.240 m
  Height                                       0.310 m
  Closed book thickness                        0.035 m
  Cover board thickness                       0.0025 m
  Nominal paper thickness                    0.00010 m
  Page count represented visually       60--100 sheets
  Open angle                          160--180 degrees

These are art-direction starting values, not universal book
specifications. Make dimensions configurable in one place.

### 3.1 Coordinate convention

Choose and document one coordinate system. Recommended:

-   X: book width, left to right.
-   Y: book height, bottom to top.
-   Z: book depth / thickness.
-   Book center near world origin.
-   Spine along the Y axis.
-   Fore-edge opposite the spine.
-   Gravity along negative Y in world space, unless a different world
    convention is already established.

Be consistent. Do not mix local and world coordinates in physics code
without explicit conversion.

------------------------------------------------------------------------

## 4. Technical architecture

### 4.1 Required stack

-   TypeScript.
-   Three.js.
-   `THREE.WebGLRenderer`.
-   WebGL 2.
-   Vite or the repository's existing build system.
-   Native Three.js geometry and materials.
-   A small custom PBD/XPBD solver for the active page.

Do not use WebGPU. Do not add a large physics framework before proving
it is necessary.

### 4.2 Suggested folder structure

Adapt to the existing repository instead of forcing this structure if
the project already has a good layout.

``` text
src/
  app/
    main.ts
    createScene.ts
    createRenderer.ts
    animationLoop.ts
  config/
    bookConfig.ts
    renderConfig.ts
    shotConfig.ts
  book/
    Book.ts
    BookBlock.ts
    BookCover.ts
    Spine.ts
    Hinge.ts
    Signature.ts
    Endpaper.ts
    createBook.ts
  paper/
    PaperSheet.ts
    PaperGeometry.ts
    PaperMaterial.ts
    PaperTexture.ts
    PageMeshUpdater.ts
  physics/
    Particle.ts
    DistanceConstraint.ts
    BendingConstraint.ts
    AttachmentConstraint.ts
    CollisionConstraint.ts
    XPBDSolver.ts
    PaperSimulation.ts
  animation/
    ShotTimeline.ts
    BookOpeningAnimation.ts
    PageTurnAnimation.ts
    CameraAnimation.ts
    easing.ts
  rendering/
    lighting.ts
    materials.ts
    postProcessing.ts
  assets/
    photographs/
    textures/
public/
  ...
docs/
  research.md
  simulation.md
PROGRESS.md
DECISIONS.md
```

### 4.3 Module responsibilities

Keep responsibilities narrow:

-   `Book`: owns book parts and exposes update methods.
-   `BookCover`: creates a rigid cover mesh.
-   `Spine`: creates and updates the visible spine.
-   `BookBlock`: manages the page stack and signatures.
-   `PaperSheet`: owns one page's simulation data and mesh.
-   `XPBDSolver`: solves particles and constraints; it must not import
    Three.js rendering classes.
-   `PaperSimulation`: coordinates one page's physics.
-   `PageTurnAnimation`: supplies time-varying targets to the
    simulation.
-   `ShotTimeline`: maps shot time to animation controls.
-   `CameraAnimation`: computes camera pose from shot time.
-   `createScene`: assembles scene objects but should not contain
    physics algorithms.

The physics layer should use plain vectors/arrays where practical.
Rendering code converts simulation positions into Three.js geometry
attributes.

------------------------------------------------------------------------

## 5. Book model

### 5.1 Cover boards

Create front and back covers as rigid meshes with:

-   Correct board thickness.
-   Slightly rounded or beveled edges.
-   Separate outer cover material.
-   Inner lining material.
-   A small visible gap near the hinge.
-   No unrealistic sharp razor-thin edges.

The covers should rotate around hinge axes near the spine. Do not use a
single pivot through the center of the book.

### 5.2 Spine

Create a spine surface that visually bridges the covers and the book
block.

The spine needs:

-   A curved cross-section.
-   A cloth or paper covering material.
-   Flexible end transitions near both covers.
-   A connection to the book block.
-   A shape that changes as the covers open.

Start with a controlled procedural deformation driven by the cover angle
and book-block shape. Do not build a full spine finite-element solver.

### 5.3 Signatures and book block

A sewn book is assembled from folded signatures. Model the book block in
a way that communicates this construction.

Recommended visual strategy:

-   Group pages into signature-like bundles.
-   Give each bundle a subtle folded/root region.
-   Use small visible variations at the spine where appropriate.
-   Keep the external fore-edge layered and irregular by a tiny amount.
-   Keep all page roots connected to a common binding region.

For the first version, signatures may be mostly static groups with
controlled offsets. The active page must still be a real deformable
sheet.

Do not fully simulate every sheet in a 100-sheet book. That is
unnecessary for this shot and will create a difficult collision problem.

### 5.4 Endpapers and binding details

Create front and rear endpapers as thicker folded sheets. They connect
the inside cover to the book block.

Add spine lining, cloth, and headband details only after the main book
opens correctly. These are secondary details and must not delay the page
simulation.

### 5.5 Layered page stack

The page stack must read as many sheets, not one white solid block.

Use a practical hybrid:

-   A manageable number of visible page meshes or thin page layers.
-   Small controlled offsets and slight edge variation.
-   Several individually deformable pages used in the shot.
-   A stable stack representation for inactive pages.

If performance is poor, reduce inactive-page geometry first. Do not
reduce the active page's visible deformation until profiling proves
necessary.

------------------------------------------------------------------------

## 6. Paper geometry and materials

### 6.1 Active page geometry

An active page is a rectangular subdivided surface represented by a grid
of simulation particles.

Initial grid resolution:

  Setting                                           Initial value
  ------------------ --------------------------------------------
  Columns                                                      25
  Rows                                                         40
  Particles                                                 1,000
  Structural links              Horizontal and vertical neighbors
  Shear links                                 Both cell diagonals
  Bending links        Two-step neighbors or dihedral constraints

Start with a low-resolution test sheet. Increase resolution only after
the solver is stable.

Use `THREE.BufferGeometry` with a position attribute, UV attribute, and
triangle indices. Update the position attribute from simulation
positions. Recompute normals when needed, but profile this operation.

### 6.2 Page thickness

A flat single-sided surface is not sufficient for close-up shots.

Recommended progression:

1.  First make a stable deforming mid-surface.
2.  Add front and back render surfaces offset along the computed normal
    by half the paper thickness.
3.  Add a narrow edge surface around the perimeter.
4.  Ensure front and back surfaces do not z-fight.
5.  Check the sheet at grazing camera angles.

Do not create thickness by scaling the whole page mesh along a fixed
world axis. Thickness must follow the deformed surface normal.

A physically exact volumetric paper mesh is not required. A thin-shell
representation is acceptable if it looks correct at the final camera
distance.

### 6.3 Paper material

Use a restrained, physically based paper appearance:

-   Warm off-white base color.
-   High roughness.
-   Very subtle fiber or grain texture.
-   Very subtle normal/bump detail.
-   Low or no metallic value.
-   No plastic-like clearcoat.
-   Slightly different front/back printed textures.

Use correct texture color-space settings. Color photographs should be
configured as sRGB color textures. Non-color data maps should use the
appropriate non-color space.

### 6.4 Photograph printing

Use placeholder photographs as page textures, not floating planes.

Each page can have:

-   Full-bleed image.
-   Image with white border.
-   Two-image editorial layout.
-   Image plus small caption.
-   Blank or lightly printed reverse side.

Create a reusable texture generator or static image assets. Keep image
layout separate from the physics.

The UV coordinates must remain attached to the page material coordinates
while vertices deform. This ensures the photograph bends with the paper.

Use a few distinct placeholder photographs with consistent visual
quality. Avoid random image changes during the animation.

------------------------------------------------------------------------

## 7. Paper simulation

### 7.1 Solver choice

Implement a small Position-Based Dynamics solver, preferably XPBD-style
compliance for stretch and bending constraints.

Why this choice:

-   Stable for controlled real-time deformation.
-   Directly supports attachment and collision constraints.
-   Easy to art-direct with animated targets.
-   Simpler to debug than a full finite-element solver.
-   Suitable for one or a few active sheets.

Important: XPBD does not automatically make the simulation physically
exact. It improves stiffness control and solver behavior. Material
parameters still require visual calibration.

### 7.2 Particle state

Each particle should contain:

-   Current position.
-   Previous position or velocity.
-   Predicted position.
-   Inverse mass.
-   Fixed/pinned flag if needed.

Use typed arrays if practical, but begin with readable code. Optimize
only after profiling.

### 7.3 Constraint types

Implement in this order:

1.  **Structural constraints:** preserve horizontal and vertical
    neighbor distances.
2.  **Shear constraints:** preserve diagonal distances and resist
    in-plane skew.
3.  **Bending constraints:** resist excessive curvature. Start with
    distance-based second-neighbor constraints for simplicity; consider
    dihedral bending later if needed.
4.  **Attachment constraints:** keep the page root attached to the
    binding region.
5.  **Target constraints:** allow an animated handle to guide the free
    corner or edge.
6.  **Collision constraints:** keep the active page from passing through
    the book block or cover.

Each constraint must have a clear rest value and configurable
compliance/stiffness.

### 7.4 Simulation step

Use a fixed timestep, initially 1/120 second. Use a bounded accumulator
so slow frames do not create an unlimited backlog.

A typical simulation step:

1.  Save previous positions.
2.  Apply gravity and external forces.
3.  Predict particle positions.
4.  Reset XPBD multipliers for the current time step where required by
    the formulation.
5.  Solve structural constraints.
6.  Solve shear constraints.
7.  Solve bending constraints.
8.  Solve binding/attachment constraints.
9.  Solve collision constraints.
10. Repeat constraint passes for a fixed iteration count.
11. Reconstruct velocities from corrected positions.
12. Apply controlled damping.
13. Update render geometry.

Start with 4--8 solver iterations and profile. Increase only when the
visual test demonstrates a need.

### 7.5 Material direction

Paper grain can be approximated by using different stiffness/compliance
values along the two primary sheet directions.

Expose two parameters:

-   `stiffnessAlongGrain`
-   `stiffnessAcrossGrain`

Do not claim the grain direction is physically correct unless it is
mapped consistently to the sheet's local axes.

### 7.6 Collision strategy

Collision is a major source of complexity. Implement in layers:

**First version:** - Active page versus simple book-block collision
surface. - Active page versus cover collision. - Basic page-to-page
collision against the immediately adjacent resting page.

**Later improvement:** - Self-collision within the active page. - More
accurate contact between neighboring sheets. - Better friction and
sliding.

Use a small collision thickness/clearance to avoid visible z-fighting.
Avoid all-pairs collision between every page. Do not attempt full
self-collision until the basic page turn works.

### 7.7 Determinism

The solver must be reproducible:

-   Fixed timestep.
-   Fixed iteration count.
-   Seeded any procedural variation.
-   No random values generated per rendered frame.
-   Page-turn controls derived from absolute shot time or recorded
    simulation input.
-   A reset method that returns the simulation to a known initial state.

For final rendering, support baking or recording simulation frames to a
cache. The same cache must reproduce the same animation.

------------------------------------------------------------------------

## 8. Page-turn controller

### 8.1 Do not rotate a rigid page

A page turn must be driven by the simulated sheet. Do not animate a
single rotation pivot and call it realistic.

Use a controller that provides a time-varying target to one corner or a
small region of the free edge. The solver calculates the remaining
deformation.

### 8.2 Page-turn stages

A single page turn should have these stages:

1.  **Preparation:** the page remains resting on the stack.
2.  **Corner lift:** one outer corner begins to rise.
3.  **Peel:** the lifted region grows and the page separates
    progressively.
4.  **Arch:** the page forms a smooth curved shape over the gutter.
5.  **Crossing:** the page passes the centerline.
6.  **Fall:** gravity carries the free portion toward the opposite
    stack.
7.  **Contact:** the sheet contacts the destination stack.
8.  **Settle:** small motion decays until the page rests.

Use smooth easing for the guide target, but let gravity and the solver
produce the actual sheet shape.

### 8.3 Controller parameters

Expose:

-   Start time.
-   Duration.
-   Lift corner.
-   Lift height.
-   Turn direction.
-   Target landing side.
-   Guide path.
-   Damping multiplier.
-   Optional small flutter amplitude.

Keep the defaults conservative. The page should not flap like a flag.

### 8.4 Multiple turns

Do not start several turns simultaneously in the first implementation.

First make one turn look excellent. Then sequence additional pages with
slightly different durations and target paths.

For each turn:

-   Select the next page in the stack.
-   Initialize it in its resting shape.
-   Run its turn.
-   Confirm it has landed.
-   Update the stack ordering.
-   Start the next turn.

Only one page should be high-resolution and fully dynamic at a time in
the first production version. A second page may become active near a
transition only if profiling supports it.

------------------------------------------------------------------------

## 9. Book opening and binding mechanics

### 9.1 Cover hinge

Use separate front and back cover pivots close to the spine. The covers
are rigid bodies for this shot.

Animate the front cover through a controlled angle curve. The cover
should not pass through the page block.

### 9.2 Spine response

The spine should respond to cover angle and book-block opening.

Start with a procedural spine deformation:

-   Closed book: spine has a compact curved profile.
-   Opening: spine widens/changes curvature.
-   Open book: spine has a natural rounded or relaxed profile.

Use a few control points or a simple deformable strip. Keep the spine
visually connected to both covers and book block.

### 9.3 Book block response

The page stack should change shape as the book opens:

-   Slightly rounded near the gutter.
-   Slightly fanned near the fore-edge.
-   Stable at the spine.
-   No sudden discontinuities between page groups.

Use a controlled procedural deformation for inactive pages. The active
page uses the physics solver.

### 9.4 Binding details

After the main mechanics work, add:

-   Endpaper folds.
-   Spine lining.
-   Cloth texture.
-   Headbands.
-   Small glue/hinge transitions.

Do not let these decorative details become a reason to postpone the core
animation.

------------------------------------------------------------------------

## 10. Cinematic sequence

Target duration: 25 seconds. Keep the timeline configurable.

  -----------------------------------------------------------------------
  Time                                Action
  ----------------------------------- -----------------------------------
  0--4 s                              Establishing shot. Book closed or
                                      almost closed. Slow camera push
                                      begins.

  4--8 s                              Front cover opens. Spine and book
                                      block respond.

  8--12 s                             First page lifts, arches, crosses,
                                      lands, and settles.

  12--17 s                            Second page turns at a different
                                      natural pace.

  17--21 s                            One or two more pages turn and
                                      settle.

  21--25 s                            Final open spread. Camera completes
                                      move and holds.
  -----------------------------------------------------------------------

The animation must be deterministic and scrub-able by time. Avoid an
animation that only works when played continuously from page load.

### 10.1 Camera

Suggested starting point:

-   Perspective camera.
-   50--65 mm full-frame-equivalent look.
-   Three-quarter view.
-   Slow push-in of roughly 10--15% over the shot.
-   Gradual downward tilt of roughly 10--15 degrees.
-   Focus target near the active page and final spread.

These are visual starting points. Tune by previewing the actual scene.

Use a camera path or keyframed pose interpolation. Avoid abrupt
movement. The camera should complement the page action, not compete with
it.

### 10.2 Lighting

Use a restrained studio setup:

-   Large soft key light from upper-left/front.
-   Gentle fill from the opposite side.
-   Rim light to reveal page edges.
-   Environment illumination for natural reflections.
-   Contact shadow under the book.
-   Soft page-to-page shadows.

Avoid overexposed white pages, hard game-like shadows, and excessive
bloom.

### 10.3 Background and surface

Use a simple dark neutral studio surface. Add subtle roughness and fine
texture. Keep the background visually quiet so the book remains the
focus.

### 10.4 Post-processing

Add post-processing only after the raw render looks good.

Potential effects:

-   Ambient occlusion/contact shadow.
-   Subtle depth of field.
-   Very subtle bloom.
-   Gentle film grain.
-   Color grading.

Do not stack effects blindly. Each effect must improve the shot in a
comparison render. Preserve page detail and photographic clarity.

------------------------------------------------------------------------

## 11. Rendering and performance

### 11.1 Renderer requirements

Use `THREE.WebGLRenderer` and WebGL 2. Configure:

-   Correct output color space.
-   AgX or ACES tone mapping, selected by visual comparison.
-   Shadow maps.
-   Antialiasing where supported.
-   Sensible pixel ratio cap.
-   Correct texture color spaces.
-   Anisotropic filtering where useful.

Check the actual installed Three.js version and its API. The official
renderer documentation states that `WebGLRenderer` uses WebGL 2.

### 11.2 Geometry update

Use `BufferGeometry` attributes for active page positions. Mark updated
attributes as needing upload. Recompute normals at a measured frequency
or use an efficient custom normal update.

Do not allocate new typed arrays or new geometries every frame. Reuse
buffers.

### 11.3 Performance tiers

**Development tier** - Low render resolution. - Low page grid
resolution. - Simple lighting. - Minimal post-processing. - Fast
preview.

**Final tier** - Higher page grid resolution. - Full texture
resolution. - Better shadow quality. - Carefully tuned
post-processing. - Deterministic simulation cache.

Use configuration flags to switch tiers.

### 11.4 Optimization order

If performance is poor, optimize in this order:

1.  Reduce inactive page geometry.
2.  Reduce shadow-map cost.
3.  Reduce post-processing resolution/effects.
4.  Reduce texture sizes for preview.
5.  Reduce active solver iterations only if quality remains acceptable.
6.  Reduce active page resolution only as a last resort.

Profile before optimizing. Do not guess.

------------------------------------------------------------------------

## 12. Implementation milestones

Complete milestones in order. Each milestone has a visible test and a
completion gate.

### Milestone 0 --- Repository inspection and setup

**Tasks** - Inspect the existing repository. - Identify framework,
scripts, Three.js version, and current entry point. - Run the existing
build. - Add or update `PROGRESS.md` and `DECISIONS.md`. - Confirm WebGL
2 rendering works.

**Acceptance** - Existing app still works. - A Three.js scene renders
using `WebGLRenderer`. - No unnecessary dependencies were added.

### Milestone 1 --- Static book block

**Tasks** - Create a configurable book dimension object. - Create
front/back covers. - Create a spine. - Create a layered page stack. -
Add a simple ground plane and camera. - Add basic studio lighting.

**Acceptance** - Book proportions look plausible from the intended
camera. - Page edges read as multiple sheets. - Covers have visible
thickness. - Scene runs without console errors.

### Milestone 2 --- One deformable test sheet

**Tasks** - Create a grid of particles. - Create a BufferGeometry with
matching vertices and UVs. - Implement structural and shear
constraints. - Add gravity and fixed timestep. - Update the geometry
from particle positions.

**Acceptance** - A test sheet bends under gravity. - The sheet does not
stretch excessively. - UVs remain stable. - Simulation is deterministic.

Do not proceed until the sheet behaves reliably.

### Milestone 3 --- Bending and thickness

**Tasks** - Add bending constraints. - Tune compliance. - Add front/back
surface representation. - Add perimeter edge geometry. - Add paper
material.

**Acceptance** - Sheet has visible thickness at grazing angles. -
Bending is smooth rather than sharply folded. - No obvious z-fighting. -
Sheet does not behave like rubber or rigid cardboard.

### Milestone 4 --- One guided page turn

**Tasks** - Add a corner/edge target controller. - Implement lift, peel,
arch, crossing, fall, and settle phases. - Add gravity and damping
tuning. - Add a simple landing surface.

**Acceptance** - One page turns without rigid-body rotation. - The page
remains attached at its root. - The page lands and settles. - The result
looks believable from the final camera angle.

This is the most important milestone. Spend time here.

### Milestone 5 --- Integrate page with book

**Tasks** - Attach page root to the book binding region. - Add simple
page-to-stack collision. - Add page-to-cover collision. - Add page stack
ordering. - Add a second page and repeat the turn.

**Acceptance** - Page roots do not detach. - No obvious page passes
through the cover or stack. - Two sequential page turns work. - The page
stack remains visually coherent.

### Milestone 6 --- Cover, spine, and endpapers

**Tasks** - Add cover hinge pivots. - Animate front cover opening. -
Make spine shape respond to opening. - Add endpapers. - Improve
book-block curvature.

**Acceptance** - Cover opens naturally. - Spine does not look like a
rigid rectangular bar. - Endpapers connect the case and book block
visually. - No major intersections occur.

### Milestone 7 --- Photographic page design

**Tasks** - Add placeholder photographs. - Create several page
layouts. - Apply textures to front/back page surfaces. - Add optional
captions and margins.

**Acceptance** - Photographs deform with the page. - No floating image
planes. - UV mapping remains correct throughout a turn. - Front and back
page content is correct.

### Milestone 8 --- Full shot timeline and camera

**Tasks** - Implement a 25-second absolute-time timeline. - Sequence
cover opening and page turns. - Add camera push-in and tilt. - Add final
hold. - Add reset and time-scrub controls for development.

**Acceptance** - Seeking to any time gives a reproducible pose. - Full
shot plays from beginning to end. - Camera movement is smooth. - Final
composition is deliberate.

### Milestone 9 --- Final materials, lighting, and render

**Tasks** - Improve cover material. - Improve paper texture. - Add
studio lighting. - Tune shadows and environment. - Add restrained
post-processing. - Create final render settings.

**Acceptance** - Book reads as a physical object. - Page edges have
convincing depth. - White paper retains detail. - Photographs remain
clear. - No distracting visual artifacts.

### Milestone 10 --- Optimization and final validation

**Tasks** - Profile CPU and GPU. - Check memory allocations. - Fix
geometry leaks and dispose unused resources. - Test target
browsers/devices. - Bake/cache the simulation if useful. - Render the
final shot at the target resolution and frame rate.

**Acceptance** - No critical console errors. - No visible page
detachment or severe interpenetration. - Animation is deterministic. -
Performance is acceptable for the target machine. - Final output is
reproducible.

------------------------------------------------------------------------

## 13. Test scenes and debugging tools

Create small test scenes rather than debugging everything in the final
shot.

Recommended test scenes:

1.  `PaperDropTest`: one sheet under gravity.
2.  `PaperBendTest`: sheet bent by a moving target.
3.  `PageTurnTest`: one guided turn over a simple book block.
4.  `PageCollisionTest`: one page landing on a stack.
5.  `BookOpeningTest`: covers, spine, and book block only.
6.  `FinalShot`: complete cinematic scene.

Add optional debug visualization:

-   Particle points.
-   Structural links.
-   Shear links.
-   Bending links.
-   Pinned particles.
-   Target handle.
-   Collision contacts.
-   Page local axes.
-   Spine control points.

Debug visualizations must be switchable off for final rendering.

------------------------------------------------------------------------

## 14. Acceptance checklist

The project is complete only when all required items pass.

### Geometry and construction

-   [ ] Hardcover front and back covers have thickness.
-   [ ] Spine is visibly connected to the covers and book block.
-   [ ] Book block reads as a layered stack.
-   [ ] Endpapers connect the covers and book block.
-   [ ] Active pages are actual 3D meshes.

### Paper simulation

-   [ ] Active page bends in 3D.
-   [ ] Page does not stretch excessively.
-   [ ] Page root remains attached.
-   [ ] Page has visible thickness.
-   [ ] Gravity affects the page.
-   [ ] Page lands and settles.
-   [ ] No major page/cover penetration.
-   [ ] Simulation is deterministic.

### Animation

-   [ ] Book opens gradually.
-   [ ] At least three individual page turns occur.
-   [ ] Turns have different natural timing.
-   [ ] Page motion includes lift, arch, fall, and settle.
-   [ ] Final open spread holds long enough to read visually.
-   [ ] Camera slowly pushes in.
-   [ ] Camera gradually tilts down.

### Visual quality

-   [ ] Paper is not plastic-looking.
-   [ ] Photographs are printed onto page surfaces.
-   [ ] Textures follow page deformation.
-   [ ] Page edges show layered thickness.
-   [ ] Lighting reveals the page curvature.
-   [ ] Shadows are soft and plausible.
-   [ ] Post-processing does not obscure detail.

### Engineering

-   [ ] Uses Three.js `WebGLRenderer`.
-   [ ] Uses WebGL 2, not WebGPU.
-   [ ] TypeScript build passes.
-   [ ] No uncontrolled per-frame allocations in the simulation loop.
-   [ ] Simulation and rendering are separated.
-   [ ] Shot can be reproduced from a time value or baked cache.
-   [ ] Setup and run instructions are documented.

------------------------------------------------------------------------

## 15. Known risks and fallback decisions

### Risk: full page collision is too expensive

**Fallback:** Use collision against a simplified book-block surface and
the immediately adjacent page. Keep inactive pages static or
procedurally arranged.

### Risk: XPBD solver becomes unstable

**Fallback:** Reduce the test to one sheet, verify integration and
constraint order, use a smaller fixed timestep, then add constraints one
at a time. Do not add more pages to hide the problem.

### Risk: page looks like cloth

**Fallback:** Increase bending resistance, reduce stretch, tune
grain-direction stiffness, reduce flutter, and compare against macro
references of paper.

### Risk: page looks too rigid

**Fallback:** Reduce bending resistance carefully, improve the target
path, and let more of the page respond to gravity. Do not solve this by
simply rotating the whole sheet.

### Risk: spine and binding take too long

**Fallback:** Use a procedural spine strip driven by cover angle and
book-block curvature. Keep page roots attached to a stable binding
curve. Document the approximation.

### Risk: too many pages reduce performance

**Fallback:** Only the active page is fully simulated. Represent the
rest as a static layered stack or low-cost deformed surfaces.

### Risk: final shot is not deterministic

**Fallback:** Make the simulation resettable and fixed-step. Record/bake
simulation states and replay them during final rendering.

### Risk: model attempts a giant rewrite

**Fallback:** Stop. Revert to the last working state if needed. Ask the
agent to inspect the current diff and implement only the next
milestone's smallest task.

------------------------------------------------------------------------

## 16. Recommended task prompts for weak/free coding models

Use one prompt at a time. Do not give the model the entire
implementation as one coding request.

### Prompt A --- Inspect the project

> Read `plan.md`. Do not modify files yet. Inspect the repository,
> package scripts, installed Three.js version, entry point, and current
> rendering setup. Report the existing architecture, the exact commands
> to run the project, and any risks. Recommend the smallest first
> change.

### Prompt B --- Create the minimal WebGL scene

> Implement only Milestone 0. Use the existing project conventions.
> Create or verify a minimal Three.js scene using `THREE.WebGLRenderer`
> and WebGL 2. Do not implement book geometry or physics. Run the build
> and report changed files and results.

### Prompt C --- Build the static book

> Implement only Milestone 1 from `plan.md`. Create a configurable
> hardcover book with two thick covers, a spine, and a layered page
> block. Use simple materials. Do not implement paper physics or
> animation. Run the build and report results.

### Prompt D --- Build one test sheet

> Implement only the particle grid and deformable BufferGeometry for one
> paper sheet. Add gravity and structural/shear constraints as specified
> in `plan.md`. Do not integrate it into the book yet. Add a small test
> scene. Validate the build.

### Prompt E --- Add bending and thickness

> Extend the existing test sheet only. Add bending constraints and a
> thin-shell visual representation with front, back, and edge surfaces.
> Do not rewrite the solver. Preserve current working behavior and run
> validation.

### Prompt F --- Implement one page turn

> Implement a guided turn for the existing simulated sheet. Use an
> animated target to lift a corner and guide the sheet through an arch.
> Gravity and constraints must determine the rest of the shape. Do not
> rotate the page as a rigid plane. Test the full lift, turn, landing,
> and settling sequence.

### Prompt G --- Integrate the page into the book

> Integrate the tested page simulation with the book block. Attach the
> page root to a stable binding region. Add only the simplest necessary
> collision against the book block and cover. Do not simulate every
> page. Preserve the isolated page test.

### Prompt H --- Add the cinematic timeline

> Implement the 25-second deterministic timeline in `plan.md`. Sequence
> the cover opening and at least three page turns. Animate the camera
> with a slow push-in and downward tilt. Ensure the scene can be
> evaluated at an arbitrary time value.

### Prompt I --- Polish the render

> Improve materials, studio lighting, shadows, and post-processing
> without changing the physics architecture. Use placeholder photographs
> mapped onto page surfaces. Keep the image natural and restrained.
> Compare before/after and run validation.

### Prompt J --- Final audit

> Audit the implementation against the acceptance checklist in
> `plan.md`. Do not add features. Identify actual failures, reproduce
> them, and fix the smallest issues first. Report passed and failed
> checklist items separately.

------------------------------------------------------------------------

## 17. Project tracking files

Maintain these files throughout development.

### `PROGRESS.md`

Keep it short:

``` markdown
# Progress

Current milestone: 0
Last completed task:
Current blocker:
Build status:
Test status:

## Completed
- [ ] Milestone 0
- [ ] Milestone 1
- [ ] Milestone 2
- [ ] Milestone 3
- [ ] Milestone 4
- [ ] Milestone 5
- [ ] Milestone 6
- [ ] Milestone 7
- [ ] Milestone 8
- [ ] Milestone 9
- [ ] Milestone 10

## Next task
One small actionable task.
```

### `DECISIONS.md`

Record only decisions that affect future work:

``` markdown
# Decisions

- Units: meters.
- Coordinate convention: X width, Y height, Z depth.
- Renderer: Three.js WebGLRenderer / WebGL 2.
- Physics: custom PBD/XPBD for active page.
- Simulation timestep: fixed 1/120 second initially.
- Active dynamic pages: one initially.
- Final shot duration: 25 seconds.
- Final animation: deterministic and cacheable.
```

Update values when decisions change. Do not leave contradictory old
decisions in the file.

------------------------------------------------------------------------

## 18. Definition of success

The final shot should convince a viewer that a real hardcover
photography book was filmed opening.

The most important proof is a paused frame during a page turn: the page
must have a believable curved 3D shape, remain attached at the binding,
show actual thickness at its edge, and carry its photograph texture
naturally across the deformation.

Build that one convincing page turn first. Everything else supports it.

