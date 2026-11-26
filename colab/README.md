# Colab overflow rendering

This is an interactive Colab Free notebook, not a background service. GPU allocation and runtime duration are not guaranteed. Manually start a GPU runtime and authorize Drive; do not use keep-alive workarounds.

## Local preparation

From the repository root with dependencies installed:

```bash
npm run render:blender -- --scene book --export-only --start 5.9 --duration 0.01 --cache renders/colab/book-test.cache
python3 scripts/prepare-colab.py renders/colab/book-test.cache renders/colab/book-test --samples 32
```

For full sequences omit start/duration or choose a longer interval. Cache export defaults to 1920x1080, 60 fps. The preparer copies the complete cache, hashes each file, and creates job.json. Frame ranges are inclusive, zero-based **cache indices**, not absolute animation frame numbers. Use --first and --last to assign a subset. A job directory must not already exist.

Upload the entire book-test directory to My Drive/Milestone2/jobs/ (or use an existing local Drive sync folder as the destination). The notebook does not require credentials in the repository. Local upload and result download are manual or via your existing Drive sync setup.

## Run on Colab

[Open notebook in Colab](https://colab.research.google.com/github/davlug3/milestone2/blob/main/colab/Milestone2_Render.ipynb)

Select a GPU runtime, set JOB to your Drive job directory, and Run all. The notebook installs checksum-verified official Blender 5.0.1, uses CUDA, verifies cache hashes, and invokes the existing native renderer. EXRs appear in the job's frames/ folder. After interruption, rerun with the same job and settings. The renderer skips finalized files and replays cache checkpoints; partial files are not considered completed. Use one worker per output folder and distinct folders for changed settings.

The default job uses 32 samples, adaptive sampling and multilayer EXR with ZIP compression. The renderer revision is pinned to the tested cache format. Do not mix caches from incompatible renderer revisions. The preparer rejects the observed empty slideshow export and suspicious one-material Floating cache; Stats is not a Cycles scene. Begin with one Book frame, compare timing and visual quality against local output, then scale up. Large caches and EXRs consume Drive quota and bandwidth.

The notebook has not yet been executed in Colab; GPU and end-to-end validation remain pending.
