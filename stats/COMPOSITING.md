# Statistics compositing

The layer menu in /stats/ switches between Full composite, Background only, Transparent overlay, and Green-screen overlay. Transparency is shown against a checkerboard in the browser; the checkerboard is CSS only and is not written into PNG exports. Save PNG exports the current layer at 1920 × 1080.

For animated manual compositing, run:

    npm run build:site
    npm run render:stats -- --layer separate

This writes synchronized 1080p60 background MP4 and foreground ProRes 4444 MOV (with alpha), plus corresponding PNG sequences. Place the foreground above any background in your editor, aligned at the same first frame. Use --frames-only for lossless PNG sequences without video encoding. Use --layer chroma for a green-screen alternative, or --layer foreground to export only the alpha overlay. Use --data path/to/data.json to render a custom dataset; browser local edits are not automatically read by the CLI.

Foreground includes all text, accents, slide counter, and progress indicator. Background includes only the decorative gradient and animated contours.

## Optional falling-photo background
Choose Falling photos from the background dropdown. The existing tabletop scene is rendered in real time and driven by the statistics timeline, including when seeking. It holds its final frame if the statistics run longer. A darkening/vignette treatment is applied only to the background layer; transparent foreground remains independent. For synchronized exports use `npm run render:stats -- --background tabletop --layer separate`. The tabletop pass currently uses the existing raster renderer, not accumulated path tracing.
