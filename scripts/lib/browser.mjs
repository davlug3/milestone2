/**
 * Preview browser launcher for the visual-validation scripts.
 *
 * A hardware GPU should be used whenever the host/client exposes one. The
 * default Playwright "headless shell" bundle has no GPU access, so when a GPU
 * is detected we switch to the full Chromium build (new headless mode), which
 * can use ANGLE/EGL on the host. Otherwise we fall back to the headless shell
 * and software rendering, and say so in the output.
 *
 * Detection:
 *   - PREVIEW_GPU=1 / PREVIEW_GPU=0 forces the choice.
 *   - macOS / Windows: assumed to have a GPU.
 *   - Linux: requires a DRM render node (/dev/dri/renderD*). A card0 node alone
 *     is not enough for Chromium's GPU process.
 *
 * Extra Chromium flags can be supplied with PREVIEW_GPU_ARGS (space-separated).
 */
import { chromium } from "playwright";
import { existsSync, readdirSync } from "node:fs";

export function hasHardwareGpu() {
  const forced = process.env.PREVIEW_GPU;
  if (forced === "1") return true;
  if (forced === "0") return false;

  if (process.platform === "darwin" || process.platform === "win32") return true;

  try {
    if (!existsSync("/dev/dri")) return false;
    return readdirSync("/dev/dri").some((name) => name.startsWith("renderD"));
  } catch {
    return false;
  }
}

function extraArgs() {
  const raw = process.env.PREVIEW_GPU_ARGS ?? "";
  return raw.trim() ? raw.trim().split(/\s+/) : [];
}

/**
 * Launch Chromium, preferring the host GPU. Returns `{ browser, launch }`,
 * where launch is "gpu-preferred" (full Chromium, GPU flags) or "software"
 * (headless shell). The actual backend still has to be read from the page
 * (`readWebGL` + `isSoftwareRenderer`): a GPU-preferred launch can fall back to
 * SwiftShader on a host without a usable render node.
 */
export async function launchPreviewBrowser() {
  if (hasHardwareGpu()) {
    const args = ["--enable-gpu", "--ignore-gpu-blocklist", ...extraArgs()];
    try {
      const browser = await chromium.launch({
        headless: true,
        channel: "chromium",
        args,
      });
      return { browser, launch: "gpu-preferred", args };
    } catch (error) {
      console.warn(
        `GPU launch failed (${String(error).split("\n")[0]}); falling back to software`,
      );
    }
  }

  const args = extraArgs();
  const browser = await chromium.launch({ headless: true, args });
  return { browser, launch: "software", args };
}

/** Read the WebGL 2 capability and the backend actually in use. */
export async function readWebGL(page) {
  return page.evaluate(() => {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2");
    if (!gl) return { webgl2: false, renderer: null, vendor: null };
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    return {
      webgl2: true,
      renderer: ext
        ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL))
        : String(gl.getParameter(gl.RENDERER)),
      vendor: ext
        ? String(gl.getParameter(ext.UNMASKED_VENDOR_WEBGL))
        : String(gl.getParameter(gl.VENDOR)),
    };
  });
}

/** True when the reported renderer is a software rasteriser. */
export function isSoftwareRenderer(renderer) {
  return /swiftshader|llvmpipe|software|subzero/i.test(renderer ?? "");
}
