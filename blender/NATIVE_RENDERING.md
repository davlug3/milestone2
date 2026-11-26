# Native Cycles backend

Use `npm run render -- --scene slideshow --engine cycles --duration 1 --samples 64 --frames-only` for a short OptiX test. Four 3D scenes support geometry caches. Stats remains Canvas2D. Defaults: 96 samples, 0.02 adaptive threshold, 8 bounces, OptiX denoising, persistent data. Native Windows Blender is discovered under WSL; alternatively set BLENDER_PATH. Use --device CUDA or CPU explicitly if desired. 

For multilayer HDR output: `npm run render -- --scene floating --engine cycles --format EXR --frames-only`. EXR includes actual Cycles direct/indirect diffuse and glossy passes, depth, normals, emission and object index. Multilayer EXR sequences are the default for native Cycles; `--format PNG` selects PNG/video output. Geometry cache and frames are reusable with matching settings; use --no-build to avoid rebuilding a known current site-dist.

Geometry, visibility, camera, mapped materials and animated light positions are exported. Light power conversion and world lighting are approximate; browser fog, bloom and post-processing are not reproduced. Motion blur, Cryptomatte, RTXPT and ThreeRT integration are not implemented. Run a short render on the RTX GPU to validate material fidelity and performance before production. Compare the logged seconds per frame against the browser renderer at the same resolution and timeline positions.

When explicitly selecting PNG, all supported native passes are emitted by default with 16-bit PNG output in separate folders under `<output stem>.png-passes`; beauty is in the root. Use `--passes beauty` for beauty only. Existing EXR output and cache directories are retained. Technical encoding is documented in passes.json; unavailable sockets are reported. PNG clamps HDR lighting and encodes signed normals/positions and numeric IDs; EXR remains preferable for exact float compositing. Blender 5.x compositor API is used, with fallback for earlier versions. No additional path tracing per pass.

## Performance presets and benchmarks
Default cinema is unchanged (96 samples). Use --preset fast-production for 48 samples, adaptive minimum 8, threshold .03 and 6 bounces. Draft and master are also supported. --samples/--bounces/--noise/--min-samples override presets. --exr-codec ZIP or PIZ is lossless. Use a separate --output when changing settings, retaining --cache and --reuse-cache. Example:

`npm run render -- --scene floating --engine cycles --preset fast-production --reuse-cache --cache renders/floating-cycles.cache --output renders/floating-fast.mp4`

`npm run benchmark:cycles -- --scene floating --frames 0,1,60,61,120,121`

Benchmark uses existing geometry, isolated output dirs, matched frames and reports render+write time (excluding first warmup frame from average). Compare corresponding images and consecutive frames for temporal noise before adopting a preset. Do not benchmark concurrently with a production GPU job. Incremental object and light assignments skip unchanged values; dynamic mesh normals are cleared once. Binary caches and mesh instancing remain future work.
