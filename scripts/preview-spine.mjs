/**
 * Milestone 6 visual validation: spine + endpaper close-ups.
 *
 * Captures the closed spine, the opening sequence, and the opened gutter from
 * camera positions chosen to reveal the case mechanics. Development aid only;
 * the app's own camera is untouched.
 *
 * Usage: node scripts/preview-spine.mjs
 */
import {
  isSoftwareRenderer,
  launchPreviewBrowser,
  readWebGL,
} from "./lib/browser.mjs";
import { startPreviewServer, stopPreviewServer } from "./lib/server.mjs";
import { mkdirSync } from "node:fs";

const PORT = Number(process.env.PREVIEW_PORT ?? 4311);
const URL = process.env.PREVIEW_URL ?? `http://127.0.0.1:${PORT}/`;
const OUTPUT_DIR = process.env.PREVIEW_OUTPUT_DIR ?? "screenshots/m6";

const SHOTS = [
  {
    name: "01-closed-spine",
    t: 0,
    camera: [-0.34, 0.09, 0.25],
    lookAt: [-0.02, 0.02, 0],
  },
  {
    name: "02-closed-front",
    t: 0,
    camera: [0.03, 0.24, 0.52],
    lookAt: [0, 0.03, 0],
  },
  {
    name: "03-opening-spine",
    t: 1.4,
    camera: [-0.36, 0.11, 0.26],
    lookAt: [-0.02, 0.02, 0],
  },
  {
    name: "04-opening-side",
    t: 2.0,
    camera: [-0.02, 0.12, 0.38],
    lookAt: [0, 0.02, 0],
  },
  {
    name: "05-open-gutter",
    t: 3.0,
    camera: [-0.10, 0.14, 0.24],
    lookAt: [-0.02, 0.01, 0],
  },
  {
    name: "06-open-spine-left",
    t: 3.0,
    camera: [-0.32, 0.08, 0.22],
    lookAt: [-0.02, 0.01, 0],
  },
  {
    name: "07-flyleaf-lift",
    t: 4.1,
    camera: [0.06, 0.22, 0.34],
    lookAt: [0, 0.03, 0],
  },
  {
    name: "08-flyleaf-landed",
    t: 6.2,
    camera: [-0.06, 0.20, 0.32],
    lookAt: [-0.05, 0.01, 0],
  },
];

mkdirSync(OUTPUT_DIR, { recursive: true });

async function main() {
  const server = await startPreviewServer({ url: URL, port: PORT });
  const { browser, launch } = await launchPreviewBrowser();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__sceneReady === true, { timeout: 10000 });

  const webgl = await readWebGL(page);
  const webgl2 = webgl.webgl2;
  const backend = isSoftwareRenderer(webgl.renderer) ? "software" : "hardware";
  console.log(
    `browser: ${launch} (backend: ${backend}) | WebGL 2: ${webgl2} | renderer: ${webgl.renderer}`,
  );

  for (const shot of SHOTS) {
    await page.evaluate(
      ({ t, camera, lookAt }) => {
        window.__demo.camera(camera, lookAt);
        window.__demo.seek(t);
      },
      shot,
    );
    await page.waitForTimeout(200);
    const out = `${OUTPUT_DIR}/${shot.name}.png`;
    await page.screenshot({ path: out });
    const spine = await page.evaluate(() => window.__demo.spine());
    console.log(
      `${shot.name} t=${shot.t}s -> ${out} ` +
        `spine[x ${(spine.minX * 1000).toFixed(2)}..${(spine.maxX * 1000).toFixed(2)} ` +
        `y ${(spine.minY * 1000).toFixed(2)}..${(spine.maxY * 1000).toFixed(2)} ` +
        `bulge ${(spine.protrusion * 1000).toFixed(2)}mm]`,
    );
  }

  console.log("console errors:", errors.length);
  errors.forEach((e) => console.log("  ERR:", e));
  await browser.close();
  stopPreviewServer(server);
  if (!webgl2) {
    console.error("FAIL: WebGL 2 unavailable");
    process.exit(1);
  }
  if (errors.length > 0) {
    console.error("FAIL: console errors present");
    process.exit(1);
  }
  console.log("PASS");
  process.exit(0);
}

main().catch((e) => {
  console.error("FAIL:", e);
  process.exit(1);
});
