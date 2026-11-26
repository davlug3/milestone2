# Native Cycles backend

Use `npm run render -- --scene slideshow --engine cycles --duration 1 --samples 64 --frames-only` for a short OptiX test. Four 3D scenes support geometry caches. Stats remains Canvas2D. Defaults: 96 samples, 0.02 adaptive threshold, 8 bounces, OptiX denoising, persistent data. Native Windows Blender is discovered under WSL; alternatively set BLENDER_PATH. Use --device CUDA or CPU explicitly if desired. 

For multilayer HDR output: `npm run render -- --scene floating --engine cycles --format EXR --frames-only`. EXR includes actual Cycles direct/indirect diffuse and glossy passes, depth, normals, emission and object index. PNG video is the default. Geometry cache and frames are reusable with matching settings; use --no-build to avoid rebuilding a known current site-dist.

Geometry, visibility, camera, mapped materials and animated light positions are exported. Light power conversion and world lighting are approximate; browser fog, bloom and post-processing are not reproduced. Motion blur, Cryptomatte, RTXPT and ThreeRT integration are not implemented. Run a short render on the RTX GPU to validate material fidelity and performance before production. Compare the logged seconds per frame against the browser renderer at the same resolution and timeline positions.
