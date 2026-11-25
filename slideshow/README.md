# Tabletop slideshow

Independent Node.js / Vite / Three.js / Playwright project. No imports from the parent book project. A fixed overhead perspective camera gently drifts while physical-looking photographic prints fly in, rotate, land with a small bounce, slide and settle on a walnut table. The deterministic analytic 2.5D motion is deliberately lightweight; it is not a rigid-body collision solver.

## Start

```sh
cd slideshow
npm install
npx playwright install chromium
npm run dev
```

Open the printed Vite URL. The default photo provider prefetches seeded Picsum photographs into `public/photo-cache/`. Local JPG, PNG, WebP or AVIF files in `public/photos/` override remote providers. Set `photos.source` to `urls` and supply `photos.urls` for your own dynamic list, or set `source` to `local` for offline-only use. Failed downloads fall back to bundled illustrations. Run `npm run photos:download` to refresh the cache. The manifest is regenerated on dev/build/export; restart dev after changing photos. Configure interval, flight, settle, final hold, seed and print dimensions in `slideshow.config.json`.

## Video

```sh
npm run render:video
npm run render:video -- --duration 3 --fps 30 --output renders/test.mp4
```

Default: **1920×1080, 60 FPS**, headless browser, H.264 MP4 at `renders/slideshow.mp4`. Requires FFmpeg on PATH or `FFMPEG_PATH`. WSL automatically uses native Windows Chrome and Node (override `WINDOWS_CHROME_PATH` / `WINDOWS_NODE_PATH`); set `SLIDESHOW_LINUX_BROWSER=1` to use WSL Chromium. No cross-WSL CDP port. `--headed` opens the browser; `--frames-only` skips encoding. Frames resume only with matching settings/assets.

```sh
npm test
npm run build
```

Raster PBR is the default. Select Ray-traced in the preview to progressively render the paused pose, or use `npm run render:video -- --mode raytrace --samples 32` for final output. Ray tracing is slower and has no denoiser yet. Print overlap uses approximate layers; real collision, paper flex, motion blur and audio are not implemented.
