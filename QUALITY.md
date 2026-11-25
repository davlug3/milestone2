# Rendering quality profiles

The master output format is **1920 × 1080 at 60 fps (16:9)**. Quality is independent of output dimensions. Higher resolutions are opt-in through the existing CLI width/height flags.

Both browser players expose a Quality dropdown. Changing it reloads the scene, since textures and GPU allocations are built at startup. Explicit URL selection (e.g. `?quality=ultra`) overrides device detection. Mobile auto-detection only picks a default; it never limits explicit desktop/ultra/offline selection.

| Profile | Preview spp / bounces | Cinema spp / bounces | Book print scale | Wood texture |
|---|---:|---:|---:|---:|
| Mobile | 48 / 4 | 96 / 5 | 0.5× | 512 |
| Desktop | 96 / 5 | 384 / 10 | 1× | 1024 |
| Ultra | 256 / 8 | 1024 / 16 | 2× | 2048 |
| Offline Cinema | 384 / 10 | 1536 / 20 | 2× | 2048 |

Offline export selects Offline Cinema by default. Book CLI defaults to 1536 samples and 20 bounces; slideshow defaults to raytrace with 1536 samples and uses the offline bounce setting. The CLI still permits explicit sample overrides. Existing scene geometry and physics are retained; full multi-page XPBD, denoising, and further high-resolution source assets are separate future upgrades. Texture upscaling cannot add detail absent in the original photos.

Higher presets may exceed device GPU memory. Use Mobile for constrained devices and choose Ultra or Offline Cinema explicitly on a capable workstation.
