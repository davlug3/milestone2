# AGENTS.md — Cross-Environment Development and Visual Validation Rules

These instructions apply to every coding agent working on this repository. Read this file before inspecting, editing, running, testing, previewing, or rendering the project.

## Overall AVP workspace contract

Read `../AGENTS.md` before project work. Canonical shared reference: https://drive.google.com/file/d/1UGj8oxuQaHVBQZUabvz4D0H0re0AJFM9/view . Keep Git repositories in GitHub, not Google Drive. All generated EXR, PNG, MP4 and other render deliverables go to `../rendered/<scene>/<preview-or-final>/<job-id>/`; internal caches remain in `renders/`. Use `JILP_RENDER_JOB` to repeat a job ID for resumable renders, or an explicit absolute `--output` under the shared render root. Never upload EXRs automatically. Existing outputs are preserved in place until references are checked.

The project may be developed from different environments on different days:

- **Termux on Android**, sometimes without a desktop session or a usable local browser.
- **A normal development computer**, such as Linux, macOS, or Windows with a browser and development tools.
- **A remote or containerized environment**, which may have a browser, but no physical display or GPU.
- **A constrained environment**, where only static checks are possible.

Do not assume that the environment is the same as the previous session. Detect the current environment at the start of each session and choose the best available validation method.

The project is a Three.js / WebGL cinematic book animation. Visual validation matters, but never pretend that a preview, screenshot, WebGL render, or simulation was successful unless it was actually run and inspected.

---

## 1. Mandatory operating principles

1. **Detect the environment first.** Do not assume Linux desktop, Android, Termux, X11, Wayland, GPU access, or browser availability.
2. **Prefer the simplest working route.** Use the tools already installed before attempting a complex workaround.
3. **Use normal browser tooling whenever available.** Prefer the project's normal development server and Playwright in a usable browser environment.
4. **Use Termux workarounds only when needed.** If preview or rendering is unavailable directly on Android/Termux, consider a Linux `proot-distro` environment with Xvfb and a browser.
5. **Do not assume proot provides GPU access.** It usually does not provide direct access to Android's GPU in the same way as a native desktop Linux session.
6. **Separate code validation from visual validation.** A passing TypeScript build does not prove that the scene looks correct.
7. **Never fabricate evidence.** Clearly report whether a screenshot was captured, whether WebGL initialized, whether the simulation ran, and whether the image was inspected.
8. **Do not install packages or modify the host environment without checking first.** Inspect what exists, explain what is missing, and use the least invasive installation route.
9. **Do not use `sudo` or assume root access.** Termux and proot environments often do not have normal host root privileges.
10. **Keep the app runnable.** Environment-specific preview scripts must not break the standard project workflow.
11. **Do not make platform-specific assumptions in application code.** Environment workarounds belong in scripts or documentation, not in the core Three.js scene.
12. **Preserve the existing project setup.** Inspect package scripts and installed versions before adding or replacing tooling.

---

## 2. Environment detection

At the beginning of a session, inspect the operating system and available commands.

Useful checks:

```sh
uname -a
pwd
printf 'PREFIX=%s\n' "${PREFIX:-}"
printf 'TERMUX_VERSION=%s\n' "${TERMUX_VERSION:-}"
printf 'DISPLAY=%s\n' "${DISPLAY:-}"
printf 'WAYLAND_DISPLAY=%s\n' "${WAYLAND_DISPLAY:-}"
printf 'CI=%s\n' "${CI:-}"
command -v node
command -v npm
command -v pnpm
command -v yarn
command -v chromium
command -v chromium-browser
command -v google-chrome
command -v playwright
command -v Xvfb
command -v proot-distro
```

These checks are clues, not proof. For example, `uname` may report an Android kernel inside a Linux container.

### 2.1 Identify Termux

Common indicators include:

- `PREFIX` points to a Termux path such as `/data/data/com.termux/files/usr`.
- `TERMUX_VERSION` is set.
- Commands are installed under the Termux prefix.
- The environment is Android or reports an Android kernel.

If Termux is detected, determine whether the session has:

- A native Android browser that can access the development server.
- Termux:X11 or another usable display.
- A working Node.js installation.
- A usable browser automation setup.
- `proot-distro`.
- Enough storage and memory for a Linux distribution and browser.

Do not assume all Termux installations have these capabilities.

### 2.2 Identify a normal development environment

A normal development environment may have:

- A desktop browser.
- A display server.
- Playwright and its browser binaries.
- Hardware-accelerated WebGL.
- A local development server.

When these are available, use the normal workflow. Do not introduce proot or Xvfb unnecessarily.

### 2.3 Record the environment

At the beginning of work, briefly report:

- Environment type.
- Node/package-manager versions.
- Available browser and Playwright status.
- Display status.
- WebGL/GPU availability if known.
- Chosen preview/validation route.

Do not print large environment dumps. Include only relevant information.

---

## 3. Validation priority order

Choose the first viable option in this order:

### Option A — Normal browser + Playwright (preferred)

Use this when a normal development machine or working browser automation environment is available.

1. Install dependencies only if required by the existing project.
2. Start the normal development server.
3. Open the app using Playwright.
4. Wait for the scene to initialize.
5. Capture screenshots at useful camera/time positions.
6. Check browser console errors and failed network requests.
7. Inspect the screenshots rather than merely confirming that files exist.

Use the project's existing Playwright setup if present. If it is absent, first inspect whether adding Playwright is justified and compatible with the repository.

### Option B — Browser available, but no desktop display

Use headless Playwright if its browser can launch in the current environment.

A headless browser does not necessarily require Xvfb. Try the normal headless browser route first.

If WebGL is unavailable or the browser cannot launch, continue to Option C.

### Option C — Termux with proot-distro + Xvfb

Use this route when all of the following are true:

- The current environment is Termux/Android or another constrained Linux shell.
- A direct preview/render route is unavailable.
- A screenshot is still valuable and reasonably achievable.
- `proot-distro` is available or can be installed with user approval.

The recommended fallback is:

1. Use `proot-distro` to enter a Linux distribution.
2. Install or use a compatible Node.js runtime and browser inside that distribution.
3. Run the app's development server.
4. Start Xvfb to provide a virtual X display if the selected browser needs one.
5. Launch Chromium or another compatible browser.
6. Use Playwright where possible to navigate and capture screenshots.
7. Inspect the screenshot and report any rendering limitations.

**Important:** Xvfb provides a virtual display. It does not provide a physical GPU, hardware acceleration, or guaranteed WebGL support.

### Option D — Static checks only

If browser rendering cannot be made to work:

- Run TypeScript checks.
- Run linting.
- Run unit tests.
- Run the production build.
- Validate deterministic simulation logic with non-rendering tests where possible.
- Report that visual validation was not performed.

Do not claim the scene is visually correct based only on a successful build.

---

## 4. Termux and Android workflow

### 4.1 General Termux rules

Termux is not a conventional desktop Linux distribution. Its package paths, libc environment, process behavior, and graphics access differ from desktop Linux.

Before attempting browser setup:

1. Check available Termux packages and installed commands.
2. Check available storage and memory.
3. Check whether the Android device already has a browser that can access the dev server.
4. Check whether Termux:X11 is installed and configured.
5. Check whether the project can be tested with Node.js directly.

Prefer running the development server natively in Termux and opening it in an Android browser if that works. This is usually simpler than running a full Linux desktop browser inside proot.

Use a local address and port appropriate to the environment. Do not assume `localhost` is reachable from another device. If testing from a separate Android browser, confirm the server bind address and network accessibility.

### 4.2 When to use proot-distro

Use `proot-distro` as a fallback for Linux userland tools that are difficult or unavailable in native Termux.

A typical setup flow is:

```sh
# Run in Termux, only if proot-distro is not already installed.
pkg install proot-distro

# Inspect available distributions before choosing one.
proot-distro list

# Install a suitable distribution only when needed.
proot-distro install debian

# Enter the distribution.
proot-distro login debian
```

Do not blindly rerun installation commands if the distribution is already installed.

Inside the Linux distribution, inspect first:

```sh
cat /etc/os-release
command -v node
command -v npm
command -v chromium
command -v chromium-browser
command -v Xvfb
command -v playwright
```

Then install only missing dependencies using that distribution's package manager.

For Debian-based distributions, packages may include:

```sh
apt update
apt install -y xvfb chromium
```

These package names and availability vary by distribution and release. Check package availability before assuming the commands will work. Do not install a second browser if a compatible browser already exists.

Node.js and Playwright may need a separate installation strategy. Prefer the repository's supported Node version and package manager. Avoid mixing Termux-installed Node modules with proot-installed Node modules because native modules and library paths may be incompatible.

### 4.3 Accessing the project from proot

The project may live in Termux storage while the browser runs inside proot.

Before assuming a path is visible:

- Check whether the project directory is mounted or accessible inside the distribution.
- Use Termux shared storage setup only when needed.
- Do not move, copy, or overwrite the project without a reason.
- Avoid editing the same working tree through two environments at once.

If the project is not accessible inside proot, choose one deliberate approach:

1. Use an existing shared/mounted path.
2. Make a temporary copy for preview only.
3. Run the dev server in Termux and connect the proot browser to the server if networking allows.

Never silently work on a stale copy and report that the main project was tested.

### 4.4 Xvfb usage

Xvfb is a virtual X server. It can provide a display for browser processes that require an X display.

A typical example:

```sh
Xvfb :99 -screen 0 1280x800x24 &
export DISPLAY=:99
```

Check whether the display is already running before starting another one. Avoid assuming display `:99` is free.

Then launch the browser or Playwright in that environment.

For example, a browser may be launched with:

```sh
chromium \
  --no-sandbox \
  --disable-dev-shm-usage \
  --window-size=1280,800 \
  http://127.0.0.1:5173
```

Use `--no-sandbox` only when the environment requires it, such as certain proot/container configurations. It weakens browser isolation and should not be used casually on a normal desktop.

Xvfb itself does not capture screenshots. Use Playwright or the browser's screenshot capability to capture the page.

### 4.5 WebGL limitations under proot/Xvfb

This project uses Three.js WebGL. A browser may start successfully while WebGL is unavailable or limited.

Possible causes:

- No GPU device is exposed to proot.
- The browser cannot access Android's graphics stack.
- Mesa software rendering libraries are missing.
- Chromium disables WebGL due to its environment.
- The selected browser build has incompatible libraries.
- Xvfb supplies a display but no accelerated graphics device.

If hardware WebGL is unavailable, a software renderer such as Mesa llvmpipe may work if the required libraries and browser support are installed. This can be slow, especially for deformable geometry and post-processing.

**Do not assume software WebGL is available. Test it.**

A screenshot with a blank canvas, WebGL error, or fallback background is not a successful scene preview.

### 4.6 Browser flags and software rendering

Browser flags vary by Chromium version and security configuration. Do not copy a long list of flags blindly.

If needed, test a minimal set of flags one at a time. For constrained environments, common candidates include:

- `--no-sandbox` — only if required by proot/container restrictions.
- `--disable-dev-shm-usage` — useful when shared memory is constrained.
- `--enable-webgl` — requests WebGL where supported.
- `--use-gl=angle` or a Mesa/software backend — only if supported by the installed browser build.
- `--disable-gpu` — **not** a general solution for WebGL scenes; it may disable the graphics path needed by the project.

Do not claim a particular flag enables WebGL without checking the browser's actual behavior.

If the browser exposes `chrome://gpu`, inspect its graphics feature status when possible. Also inspect the page's WebGL initialization errors.

### 4.7 Termux fallback limitations

If the proot/Xvfb browser can only render a static or low-resolution scene:

- Use it to verify layout, basic geometry, camera framing, and obvious visual errors.
- Reduce preview resolution and simulation complexity.
- Disable expensive post-processing for preview only.
- Keep the final scene configuration unchanged.
- Label the result as a constrained software-rendered preview.

Do not use a slow software-rendered preview as a performance benchmark for the target desktop environment.

---

## 5. Normal Playwright workflow

When Playwright is available, use it as the default automated visual-validation tool.

### 5.1 Before running

Inspect:

- `package.json`.
- Existing Playwright configuration.
- Existing test scripts.
- Browser binaries installed for Playwright.
- Dev server command and port.
- How the app signals that the Three.js scene is ready.

Do not invent an npm script if the repository already has one.

### 5.2 Recommended visual test behavior

A useful Playwright visual test should:

1. Open the development URL.
2. Wait for the app shell.
3. Wait for the Three.js renderer/canvas.
4. Wait for an explicit scene-ready signal if the app provides one.
5. Allow fonts and textures to load.
6. Set a known viewport size.
7. Set a known animation time or use a deterministic test mode.
8. Capture a screenshot.
9. Check console errors and failed requests.
10. Save screenshots to a predictable ignored output directory.

Do not use arbitrary long sleeps as the only readiness check. Prefer an explicit readiness flag or a meaningful canvas/scene condition. If a delay is required for texture loading, explain why.

### 5.3 Recommended screenshot set

Capture at least these states when the relevant features exist:

| Screenshot | Purpose |
|---|---|
| `01-closed.png` | Initial book and camera framing |
| `02-opening.png` | Cover and spine mechanics |
| `03-page-lift.png` | Corner lift and initial bending |
| `04-page-arch.png` | Page deformation during the turn |
| `05-page-landing.png` | Contact and settling |
| `06-final-spread.png` | Final composition and printed photographs |

For a 25-second shot, use representative times such as:

- 0 seconds.
- 6 seconds.
- 9.5 seconds.
- 11 seconds.
- 14 seconds.
- 19 seconds.
- 24 seconds.

Adjust timestamps to match the actual timeline. Do not label a screenshot with a time that was not used.

### 5.4 Deterministic screenshot control

The application should ideally expose a development-only way to set the scene to an exact time, for example:

```ts
sceneController.setTime(10.5);
```

Or provide a URL query parameter in development mode, such as:

```text
?time=10.5
```

This is a project feature to implement only if it fits the current architecture. Do not expose unsafe debug controls in production.

A screenshot test should not depend on the wall-clock animation having started at exactly the right moment.

### 5.5 Screenshot inspection

After capturing screenshots:

- Open or otherwise inspect the actual image files.
- Check for blank canvas, loading state, clipping, broken textures, incorrect camera framing, and obvious geometry defects.
- Compare screenshots across milestones when useful.
- Report the exact screenshot paths.
- Do not report visual success if the image was not inspected.

A screenshot file existing on disk only proves that a file was written.

---

## 6. Project scripts and environment separation

If useful, add small scripts that make validation repeatable. Do not add them before inspecting the existing scripts.

Potential scripts:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:e2e": "playwright test"
  }
}
```

This is an example only. Adapt it to the actual project and installed tools.

Keep environment-specific commands outside the main app:

```text
scripts/
  check-environment.sh
  preview-playwright.sh
  preview-xvfb.sh
```

Only create a script if it saves repeated work and can be tested. Do not create scripts that assume a specific Android username, Termux prefix, proot distribution name, display number, or absolute home directory.

Use environment variables for configurable values:

- `PREVIEW_URL`
- `PREVIEW_WIDTH`
- `PREVIEW_HEIGHT`
- `PREVIEW_OUTPUT_DIR`
- `DISPLAY`
- `BROWSER_EXECUTABLE`

Provide safe defaults and validate inputs.

Do not commit screenshots, browser profiles, caches, generated simulation frames, or temporary files unless they are intentional project assets. Add output directories to `.gitignore` as appropriate.

---

## 7. WebGL and simulation validation

Visual validation must distinguish between these separate facts:

1. The browser launched.
2. The application loaded.
3. The Three.js canvas was created.
4. WebGL context creation succeeded.
5. Shaders compiled.
6. The book geometry rendered.
7. The physics simulation advanced.
8. The animation reached the requested time.
9. The screenshot was captured.
10. The screenshot was visually inspected.

Do not collapse these into one vague statement such as “the render works.”

### 7.1 WebGL checks

Where possible, check WebGL support in the browser:

```js
const canvas = document.createElement("canvas");
const gl =
  canvas.getContext("webgl2") ||
  canvas.getContext("webgl");

console.log("WebGL available:", Boolean(gl));
```

The project specifically targets WebGL 2, so WebGL 1 support alone does not satisfy the target.

Also check for:

- WebGL context creation errors.
- Shader compilation errors.
- Renderer initialization errors.
- Missing textures.
- Failed asset requests.
- Context loss.

### 7.2 Simulation checks

When visual simulation is too slow or unavailable, test the solver without rendering.

Examples:

- Verify a pinned page root remains fixed.
- Verify gravity moves free particles downward.
- Verify structural constraints limit stretching.
- Verify bending constraints resist sharp folds.
- Verify positions remain finite (no `NaN` or `Infinity`).
- Verify reset returns the same initial state.
- Verify a fixed sequence produces repeatable positions.

Keep these tests small and deterministic. They are not substitutes for a final visual page-turn inspection, but they provide useful evidence when graphics are unavailable.

### 7.3 Performance measurements

Do not compare performance across unrelated environments.

A Termux/proot software-rendered frame rate is not representative of desktop GPU performance. Record:

- Environment.
- Browser.
- Rendering backend if known.
- Viewport and resolution.
- Active page mesh resolution.
- Solver iterations and timestep.
- Whether post-processing was enabled.

Only compare like with like.

---

## 8. Safety and host-environment hygiene

1. Do not run broad destructive commands.
2. Do not delete project files or caches without checking what they contain.
3. Do not overwrite user configuration.
4. Do not change Android system settings.
5. Do not assume root access.
6. Do not install untrusted browser binaries or shell scripts.
7. Prefer official package repositories and project lockfiles.
8. Do not expose local development servers to public interfaces unless explicitly needed.
9. Bind the dev server to loopback by default. If LAN access is needed for an Android browser, explain the network exposure and use the narrowest suitable binding.
10. Do not disable browser security features on a normal development machine to work around a test issue.
11. Keep browser automation profiles and cookies isolated from the user's personal browser profile.
12. Never store credentials or tokens in screenshots, logs, or committed files.

When a package installation or system change is necessary, first report what is missing and why. If the environment requires user approval, wait for it.

---

## 9. Reporting requirements

At the end of every development session, include a short environment and validation report:

```text
Environment:
- OS/runtime:
- Termux/proot:
- Node/package manager:
- Browser:
- Playwright:
- Display/Xvfb:
- WebGL 2:

Validation:
- Typecheck:
- Unit tests:
- Build:
- Browser launch:
- Scene initialized:
- Simulation advanced:
- Screenshot captured:
- Screenshot inspected:

Artifacts:
- Screenshot paths:
- Logs or test output:

Limitations:
- Any unavailable graphics feature:
- Any software-rendering fallback:
- Any test not performed:

Next action:
- One specific next task.
```

Use these status values:

- `PASS` — actually ran and passed.
- `FAIL` — ran and failed.
- `NOT RUN` — not attempted.
- `UNAVAILABLE` — cannot run in the current environment.
- `PARTIAL` — some part worked, but the full check did not.

Do not mark a check as `PASS` based on an assumption.

---

## 10. Quick decision tree

```text
Start session
    |
    v
Detect environment and inspect tools
    |
    v
Can normal browser + Playwright run?
    | yes
    +----> Use normal Playwright preview and screenshots
    |
    no
    v
Can headless browser run without a display?
    | yes
    +----> Use headless Playwright
    |
    no
    v
Are we on Termux/Android and is proot-distro usable?
    | yes
    +----> Use Linux proot + Xvfb + browser
    |          |
    |          v
    |      Does WebGL 2 initialize?
    |          | yes
    |          +----> Run preview and capture screenshots
    |          |
    |          no
    |          +----> Try verified software-rendering route
    |                     |
    |                     v
    |                 Does it work?
    |                     | yes
    |                     +----> Capture constrained preview
    |                     |
    |                     no
    |                     +----> Static checks and solver tests
    |
    no
    v
Run static checks and non-rendering simulation tests
    |
    v
Report visual validation as NOT RUN / UNAVAILABLE
```

---

## 11. Definition of done for environment validation

A task that changes visual behavior is not fully visually validated until:

- The app was opened in a real browser process.
- The required WebGL version initialized.
- The scene reached the intended state.
- The relevant screenshot was captured.
- The screenshot was inspected.
- Any rendering limitations were reported.

If the current environment cannot meet these requirements, complete the strongest available static and simulation checks, report the limitation accurately, and leave the project in a state that can be visually validated later on a more capable development machine.

**Core rule: adapt the validation method to the environment; never adapt the truth of the validation report to make the result look successful.**
