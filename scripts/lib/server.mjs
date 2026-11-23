/**
 * Preview server helper for the visual-validation scripts.
 *
 * Spawns Vite directly (not through `npx`) so the handle we keep is the real
 * server process and killing it actually frees the port. `--strictPort` makes a
 * busy port fail loudly instead of silently serving on another port while the
 * script fetches a stale server — that caused 404s for rebuilt assets.
 */
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const VITE_BIN = fileURLToPath(
  new URL("../../node_modules/vite/bin/vite.js", import.meta.url),
);

export async function startPreviewServer({ url, port }) {
  const server = spawn(
    process.execPath,
    [
      VITE_BIN,
      "preview",
      "--port",
      String(port),
      "--host",
      "127.0.0.1",
      "--strictPort",
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );

  let stderr = "";
  server.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  for (let i = 0; i < 80; i++) {
    if (server.exitCode !== null) {
      throw new Error(
        `preview server exited (${server.exitCode}): ${stderr.trim()}`,
      );
    }
    try {
      const res = await fetch(url);
      if (res.ok) return server;
    } catch {
      /* not up yet */
    }
    await sleep(250);
  }
  server.kill("SIGKILL");
  throw new Error(`preview server did not start at ${url}`);
}

export function stopPreviewServer(server) {
  if (server && server.exitCode === null) server.kill("SIGKILL");
}
