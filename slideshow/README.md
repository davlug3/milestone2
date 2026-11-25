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

Raster PBR is the default. Select Ray-traced in the preview to progressively render the paused pose, or use `npm run render:video -- --mode raytrace --samples 32` for final output. Ray tracing is slower and has no denoiser yet. Prints use thin, closed deformable shells with seeded curl, folded corners, wrinkles, airborne flutter and damped bending/torsion after impact. Contact samples the table and earlier settled prints to avoid sampled underside penetration. This is deterministic analytic modal dynamics, not a full rigid-body/cloth solver; continuous triangle collision, motion blur and audio are not implemented.

## Temporary Firebase Hosting preview (Spark only)

Create a project at https://console.firebase.google.com/ with the free Spark plan and no linked billing account. Use **Hosting**, not App Hosting. Enable Hosting if necessary. Authenticate locally with `npx --yes firebase-tools login --no-localhost` (or `login` in a desktop browser). Then run:

```sh
npm run deploy:preview -- YOUR_SPARK_PROJECT_ID --confirm-spark
````

The command rebuilds the slideshow and deploys only static files to a seven-day preview channel named slideshow. The CLI prints the public HTTPS URL. Repeat the command to update the same channel. The confirmation flag is a manual attestation, not an automatic billing-plan check. Do not attach billing or upgrade to Blaze. Review the photo files before deploying: anyone with the preview URL can access them, and Vite copies public assets into dist. No live-channel deployment, Cloud Run, Functions, or GPU instance is used. Rendering takes place on the visitor's device.
