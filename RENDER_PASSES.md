# Render passes

Book, tabletop and hanging gallery share a Render pass selector. Beauty retains the existing renderer and its quality controls. Auxiliary passes are rasterized from the same animated geometry and camera, without depth-of-field blur:

- Diffuse/base color: unlit material color and color maps.
- View-space normals: RGB-encoded surface orientation (geometry normals).
- Linear depth: grayscale camera-axis distance, 0 m black to 10 m white; background white. 8-bit PNG, not metric EXR.
- Object ID: discrete mesh-level colors, with JSON mapping available from passIds(). Not Cryptomatte.
- Subject mask: white book/photo geometry, black environment, respecting occlusion.
- Clay lighting: neutral diffuse material under existing lights and shadows; not an additive lighting AOV.
- Emission: emissive material color/map, display-range approximation.

Save pass PNG exports the current preview resolution. Use the unified CLI for synchronized 1920x1080/60 fps sequences. Stats provides composite, background, foreground, typography and accent plus chroma. Typography and accent are alpha PNG layers. True indirect/direct/specular/shadow AOVs and EXR are not yet implemented.
