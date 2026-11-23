/**
 * Environment preview / visual-validation script (development only).
 *
 * Starts a Vite preview server, opens the app in headless Chromium via
 * Playwright, checks that WebGL 2 initializes, captures a screenshot, and
 * reports console errors. Configurable via environment variables.
 *
 * This is a validation aid. It does not change application behavior.
 */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const WIDTH = Number(process.env.PREVIEW_WIDTH ?? 1280);
const HEIGHT = Number(process.env.PREVIEW_HEIGHT ?? 800);
const OUTPUT_DIR = process.env.PREVIEW_OUTPUT_DIR ?? "screenshots";
const PORT = Number(process.env.PREVIEW_PORT ?? 4173);
const URL = process.env.PREVIEW_URL ?? `http://127.0.0.1:${PORT}`;
const SHOT = process.env.PREVIEW_SHOT ?? "00-initial";

mkdirSync(OUTPUT_DIR, { recursive: true });

async function startServer() {
  const server = spawn(
    "npx",
    ["vite", "preview", "--port", String(PORT), "--host", "127.0.0.1"],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  // Wait for the server to respond.
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(URL);
      if (res.ok) return server;
    } catch {
      /* not up yet */
    }
    await sleep(250);
  }
  throw new Error(`Preview server did not start at ${URL}`);
}

async function main() {
  const server = await startServer();
  const browser = await chromium.launch();
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

  // WebGL 2 capability check inside the page.
  const webgl = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    const gl2 = canvas.getContext("webgl2");
    if (gl2) {
      const dbg = gl2.getExtension("WEBGL_debug_renderer_info");
      const renderer = dbg
        ? gl2.getParameter(dbg.UNMASKED_RENDERER_WEBGL)
        : "unknown";
      return { webgl2: true, renderer };
    }
    return { webgl2: false, renderer: null };
  });

  // Wait for the app's scene-ready signal.
  await page.waitForFunction(
    () => window.__sceneReady === true,
    { timeout: 10000 },
  );
  await sleep(800); // allow fonts/first frames to settle

  const outPath = `${OUTPUT_DIR}/${SHOT}.png`;
  await page.screenshot({ path: outPath });

  console.log("WebGL2:", webgl.webgl2, "| renderer:", webgl.renderer);
  console.log("Screenshot:", outPath);
  console.log("Console errors:", consoleErrors.length);
  consoleErrors.forEach((e) => console.log("  ERR:", e));
  console.log("Failed requests:", failedRequests.length);
  failedRequests.forEach((r) => console.log("  REQ:", r));

  await browser.close();
  server.kill("SIGTERM");

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