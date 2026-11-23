/**
 * Capture the animated book demo at several timeline points via the
 * window.__demo automation API. Development validation aid.
 *
 * Usage: node scripts/preview-demo.mjs
 */
import {
  isSoftwareRenderer,
  launchPreviewBrowser,
  readWebGL,
} from "./lib/browser.mjs";
import { startPreviewServer, stopPreviewServer } from "./lib/server.mjs";
import { mkdirSync } from "node:fs";

const PORT = Number(process.env.PREVIEW_PORT ?? 4310);
const URL = process.env.PREVIEW_URL ?? `http://127.0.0.1:${PORT}/`;
const OUTPUT_DIR = process.env.PREVIEW_OUTPUT_DIR ?? "screenshots";
const TIMES = (process.env.DEMO_TIMES ?? "0,2,4,5.5,7,9.5,12,13.5")
  .split(",")
  .map((s) => Number(s.trim()));

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

  const gl = await readWebGL(page);
  const appGpu = await page.evaluate(() => window.__demo.gpu?.() ?? null);
  const backend = isSoftwareRenderer(gl.renderer) ? "software" : "hardware";
  console.log(
    `browser: ${launch} (backend: ${backend}) | WebGL2: ${gl.webgl2} | renderer: ${gl.renderer}`,
  );
  if (appGpu) console.log(`app renderer: ${appGpu.renderer} (${appGpu.vendor})`);

  for (const t of TIMES) {
    await page.evaluate((tt) => window.__demo.seek(tt), t);
    await page.waitForTimeout(150);
    const out = `${OUTPUT_DIR}/demo-t${t}.png`;
    await page.screenshot({ path: out });
    console.log(`t=${t}s -> ${out}`);
  }

  const duration = await page.evaluate(() => window.__demo.duration);
  console.log("demo duration:", duration);
  console.log("console errors:", errors.length);
  errors.forEach((e) => console.log("  ERR:", e));

  await browser.close();
  stopPreviewServer(server);
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