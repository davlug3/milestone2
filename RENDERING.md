# Unified local rendering

From the repository root after npm ci (and npm ci in slideshow for the standalone tabletop exporter):

```sh
npm run render -- --scene book
npm run render -- --scene slideshow --mode raster
npm run render -- --scene clothesline --samples 384
npm run render -- --scene floating --mode raster --duration 3
npm run render -- --scene stats --layer separate
npm run render -- --scene floating --passes albedo,normal,depth,mask
```

Default output is 1920x1080 at 60 fps. Book and tabletop use their original standalone build and Windows/WSL worker paths. Statistics, clothesline, floating, and auxiliary pass exports automatically build site-dist. Use --no-build to reuse site-dist for those exporters only. Existing scripts and their scene-specific options remain unchanged. The newer site exporters use the local Playwright Chromium, not the native Windows worker. Install Chromium and FFmpeg if needed. The unified command does not require npm run dev. Use --help to see examples. Beauty output and auxiliary passes are separate workflows; the pass exporter does not export ray-traced beauty. 
