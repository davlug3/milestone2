# Archive photo wall

108 configured archive photos, 22-second shot. Full-frame 36 mm sensor width, 70 mm lens, fixed 17-degree horizontal oblique angle and 6-degree downward tilt. Constant Z distance and slow XY tracking.

Paper surfaces use a deterministic reduced-coordinate damped bending mode at 120 Hz, cached for arbitrary timeline seeks. Projected AABB overlap and conservative swept Z bounds establish ordered clearance before animation. This is a lightweight collision-prevention scheme, not a full cloth/contact solver. It conservatively separates overlapping prints rather than simulating friction or inter-sheet impacts. Pins and XY footprints remain static. Shadows update during animation.

Preview: npm run dev, /photowall/.
Production: npm run render:realtime -- --scene photowall
Default 1920x1080, 24 fps, 528 frames; PNG beauty only.
Generated photos and render outputs are not tracked.
