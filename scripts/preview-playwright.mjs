/**
 * Environment preview / visual-validation script (development only).
 *
 * Starts a Vite preview server, opens the app in headless Chromium via
 * Playwright, checks that WebGL 2 initializes, captures a screenshot, and
 * reports console errors. Configurable via environment variables.
 *
 * This is a validation aid. It does not change application behavior.
 */
import {
  isSoftwareRenderer,
  launchPreviewBrowser,
  readWebGL,
} from "./lib/browser.mjs";
import { startPreviewServer, stopPreviewServer } from "./lib/server.mjs";
import { mkdirSync } from "node:fs";

const WIDTH = Number(process.env.PREVIEW_WIDTH ?? 1280);
const HEIGHT = Number(process.env.PREVIEW_HEIGHT ?? 800);
const OUTPUT_DIR = process.env.PREVIEW_OUTPUT_DIR ?? "screenshots";
const PORT = Number(process.env.PREVIEW_PORT ?? 4173);
const URL = process.env.PREVIEW_URL ?? `http://127.0.0.1:${PORT}`;
const SHOT = process.env.PREVIEW_SHOT ?? "00-initial";

mkdirSync(OUTPUT_DIR, { recursive: true });

async function main() {
  const server = await startPreviewServer({ url: URL, port: PORT });
  const { browser, launch } = await launchPreviewBrowser();
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });

  const consoleErrors = [];
  const failedRequests = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("requestfailed", (req) => {
    failedRequests.push(`${req.url()} — ${req.failure()?.errorText}`);
  });

  await page.goto(URL, { waitUntil: "networkidle" });

  // WebGL 2 capability and the backend actually in use.
  const webgl = await readWebGL(page);

  // Wait for the app's scene-ready signal.
  // Wait for the app's scene-ready signal.
  await page.waitForFunction(
    () => window.__sceneReady === true,
    { timeout: 10000 },
  );
  await page.waitForTimeout(800); // allow fonts/first frames to settle

  const outPath = `${OUTPUT_DIR}/${SHOT}.png`;
  await page.screenshot({ path: outPath });

  const backend = isSoftwareRenderer(webgl.renderer) ? "software" : "hardware";
  console.log(
    `Browser: ${launch} (backend: ${backend}) | WebGL2: ${webgl.webgl2} | renderer: ${webgl.renderer}`,
  );
  console.log("Screenshot:", outPath);
  console.log("Console errors:", consoleErrors.length);
  consoleErrors.forEach((e) => console.log("  ERR:", e));
  console.log("Failed requests:", failedRequests.length);
  failedRequests.forEach((r) => console.log("  REQ:", r));

  await browser.close();
  stopPreviewServer(server);

  if (!webgl.webgl2) {
    console.error("FAIL: WebGL 2 not available");
    process.exit(1);
  }
  if (consoleErrors.length > 0 || failedRequests.length > 0) {
    console.error("FAIL: console/requests had errors");
    process.exit(1);
  }
  console.log("PASS: scene rendered with WebGL 2");
  process.exit(0);
}

main().catch((err) => {
  console.error("FAIL:", err);
  process.exit(1);
});