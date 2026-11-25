# Tabletop slideshow

Independent Node.js / Vite / Three.js / Playwright project. No imports from the parent book project. A fixed overhead perspective camera gently drifts while physical-looking photographic prints fly in, rotate, land with a small bounce, slide and settle on a walnut table. The deterministic analytic 2.5D motion is deliberately lightweight; it is not a rigid-body collision solver.

## Start

```sh
cd slideshow
npm install
npx playwright install chromium
npm run dev
```

Open the printed Vite URL. Six bundled landscape **illustrations** serve as placeholders until you supply real photos. Put JPG, PNG, WebP or AVIF files in `public/photos/` (numeric filename order), or run `npm run photos:download` for sample photos from Picsum. The manifest is regenerated on dev/build/export; restart dev after changing photos. Configure interval, flight, settle, final hold, seed and print dimensions in `slideshow.config.json`.

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

The renderer uses raster PBR and shadow maps rather than expensive per-frame ray tracing. Print overlap uses approximate layers; real collision, paper flex, motion blur and audio are not implemented.
