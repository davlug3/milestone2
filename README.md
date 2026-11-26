# Milestone 2

Five cinematic scenes: Book Flip, Slideshow, Clothesline, Floating Memories, and Stats.

## Development

Install the project's dependencies with `npm ci` in the root and in `slideshow/`. Use `npm run dev` for development and `npm run build:site` for the combined production build. See [local development](LOCAL_DEVELOPMENT.md) and [rendering](RENDERING.md).

## GPU rendering on WSL2 (verified 2026-11-26)

Tested on Ubuntu 26.04.1 LTS under WSL2 (kernel 6.6.114.1), with an NVIDIA GeForce RTX 3060 (12 GB), Windows-provided NVIDIA driver 610.57.01, Node 24.16.0 and npm 11.13.0.

### Diagnosis

- `nvidia-smi -L` reported the RTX 3060; `/dev/dxg` and `/usr/lib/wsl/lib/libcuda.so.1` were present.
- A direct CUDA driver API probe returned `CUDA_SUCCESS` from `cuInit(0)`, one GPU from `cuDeviceGetCount`, and driver API version 13030 (CUDA 13.3). Missing `nvcc` was not a blocker.
- Ubuntu's `/usr/bin/blender` (5.0.1, system Python 3.14.4) initially lacked NumPy; even after resolving NumPy, its CUDA device enumeration returned only the CPU, and OptiX was not an available device type.
- NumPy 2.5.5 was installed into an isolated directory (`~/.local/share/milestone2/python-deps`) and successfully imported with `PYTHONPATH` and Blender's `--python-use-system-env` flag. The system Python was not modified. This workaround is not required for the official binary used below.
- The official Blender 5.0.1 Linux build enumerated the RTX 3060 as a CUDA device and successfully rendered EXRs on it. OptiX still reports initialization error 7804; use CUDA for now.

Do not install a Linux NVIDIA kernel driver inside WSL to fix this issue. WSL uses the Windows host driver. No driver or system configuration changes were necessary.

### Reproduce the diagnosis

```bash
nvidia-smi -L
ls -l /dev/dxg /usr/lib/wsl/lib/libcuda.so.1
python3 - <<'PY'
import ctypes as c
d = c.CDLL("libcuda.so.1")
r = d.cuInit(0)
n = c.c_int()
print("cuInit:", r)
print("cuDeviceGetCount:", d.cuDeviceGetCount(c.byref(n)), n.value)
PY
```

### Install official Blender alongside the system package

```bash
mkdir -p "$HOME/.local/opt"
cd "$HOME/.local/opt"
base=https://download.blender.org/release/Blender5.0
curl -fL --retry 3 -o blender-5.0.1-linux-x64.tar.xz "$base/blender-5.0.1-linux-x64.tar.xz"
curl -fsSL "$base/blender-5.0.1.sha256" | grep 'blender-5.0.1-linux-x64.tar.xz$' | sha256sum -c - && tar -xJf blender-5.0.1-linux-x64.tar.xz
export BLENDER_PATH="$HOME/.local/opt/blender-5.0.1-linux-x64/blender"
"$BLENDER_PATH" -b --python-expr 'import bpy; p=bpy.context.preferences.addons["cycles"].preferences; p.compute_device_type="CUDA"; p.refresh_devices(); print([(d.name,d.type) for d in p.devices])'
```

Expected device list includes `('NVIDIA GeForce RTX 3060', 'CUDA')`. The official archive checksum was verified in the tested installation. The distribution package remains installed and unchanged.

### One-frame EXR samples

From the repository root, after building the site:

```bash
npm run build:site
export BLENDER_PATH="$HOME/.local/opt/blender-5.0.1-linux-x64/blender"
for scene in book slideshow clothesline floating; do
  t=2
  if [ "$scene" = book ]; then t=5.9; fi
  npm run render -- --scene "$scene" --engine cycles --device CUDA \
    --no-build --format EXR --frames-only --width 1920 --height 1080 \
    --samples 96 --start "$t" --duration 0.01 \
    --cache "renders/samples/$scene.cache" \
    --output "renders/samples/$scene-cuda.mp4" || break
done
```

At the default 60 fps, a duration of 0.01 seconds exports one frame. The `.mp4` argument supplies the output stem; the actual output is `renders/samples/<scene>-cuda.frames/frame-000000.exr` (multilayer EXR, not video). Use a new cache/output path when changing settings; do not blindly reuse invalid caches. Run jobs sequentially to avoid contention. For shells with short command timeouts, run the job in a persistent terminal or detach it with nohup and redirect logs; check process status and logs before retrying.

### Verified sample results

| Scene | EXR size (bytes) | Render time (s) | Status |
| --- | ---: | ---: | --- |
| Book | 117,530,291 | 15.07 | File generated; 271 meshes, 193 materials |
| Slideshow | 438,977 | 12.70 | Invalid scene export: zero meshes/materials |
| Clothesline | 112,327,452 | 11.76 | File generated; 410 meshes, 26 materials |
| Floating | 4,982,793 | 7.30 | File generated; 144 meshes, only one material; inspect for missing assets |
| Stats | — | — | Pending: Canvas2D, not native Cycles |

All four native jobs logged the RTX 3060 as the CUDA device. No EXR has been visually inspected yet; file existence and render completion do not establish visual correctness. Slideshow needs its geometry exporter fixed before rerendering; Floating needs asset/material validation. Stats requires a separate still capture and EXR conversion; converting an SDR canvas image does not recover HDR information.

Local log: `renders/samples/render-official.log`. Samples use the current sample photographs. Generated caches, frames and logs are local artifacts, not intended for Git.

## More documentation

- [Native Cycles rendering, presets, caches and passes](blender/NATIVE_RENDERING.md)
- [Blender project](blender/README.md)
- [Render passes](RENDER_PASSES.md)
- [Stats compositing](stats/COMPOSITING.md)
- [Slideshow](slideshow/README.md)
