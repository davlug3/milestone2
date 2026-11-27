# Archive slideshow

20 configured photographs; 50 seconds; centered zoom and depth-aware 2D warp. Beauty-only PNG output.

Generate cached depth maps after staging photos:
```sh
node scripts/site-photos.mjs
.cache/depth/venv/bin/python scripts/archive-depth.py --model .cache/depth/model-base.onnx --size 770 --ensemble --output depth-hq
```

The local Python environment requires onnxruntime, numpy and pillow; model weights are downloaded separately from onnx-community/depth-anything-v2-base (onnx/model.onnx). Generated maps and model weights are deliberately excluded from Git. The scene requires a complete set of matching maps. Rebuild after generating maps. Preview /slideshow2d/, production npm run render:realtime -- --scene slideshow2d.
