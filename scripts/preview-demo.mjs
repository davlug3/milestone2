/**
 * Capture the animated book demo at several timeline points via the
 * window.__demo automation API. Development validation aid.
 *
 * Usage: node scripts/preview-demo.mjs
 */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const PORT = Number(process.env.PREVIEW_PORT ?? 4310);
const URL = process.env.PREVIEW_URL ?? `http://127.0.0.1:${PORT}/`;
const OUTPUT_DIR = process.env.PREVIEW_OUTPUT_DIR ?? "screenshots";
const TIMES = (process.env.DEMO_TIMES ?? "0,2,4,5.5,7,9.5,12,13.5")
  .split(",")
  .map((s) => Number(s.trim()));

mkdirSync(OUTPUT_DIR, { recursive: true });

async function startServer() {
  const server = spawn(
    "npx",
    ["vite", "preview", "--port", String(PORT), "--host", "127.0.0.1"],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(URL);
      if (res.ok) return server;
    } catch {
      /* not up */
    }
    await sleep(250);
  }
  throw new Error(`preview server did not start at ${URL}`);
}

async function main() {
  const server = await startServer();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__sceneReady === true, { timeout: 10000 });

  for (const t of TIMES) {
    await page.evaluate((tt) => window.__demo.seek(tt), t);
    await sleep(150);
    const out = `${OUTPUT_DIR}/demo-t${t}.png`;
    await page.screenshot({ path: out });
    console.log(`t=${t}s -> ${out}`);
  }

  const duration = await page.evaluate(() => window.__demo.duration);
  console.log("demo duration:", duration);
  console.log("console errors:", errors.length);
  errors.forEach((e) => console.log("  ERR:", e));

  await browser.close();
  server.kill("SIGTERM");
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