"""Pack a complete scene and exact renderer snapshot for interactive Colab."""
import argparse, hashlib, json, tarfile
from pathlib import Path
import sys
p=argparse.ArgumentParser(description=__doc__)
p.add_argument("cache",type=Path);p.add_argument("job",type=Path)
a=p.parse_args()
root=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root/"blender"))
from binary_cache import read_cache
meta=json.loads((a.cache/"manifest.json").read_text())
s=meta["settings"];n=meta["count"]
assert (s["width"],s["height"],s["fps"],s["start"],s["duration"])==(1920,1080,24,0,None)
scene=read_cache(a.cache/"scene.json.gz")
assert scene["meshes"] and len(scene["materials"])>1
a.job.mkdir(parents=True,exist_ok=False)
bundle=a.job/"input.tar"
with tarfile.open(bundle,"w") as tar:
 for name in ["manifest.json","scene.json.gz"]+[f"frame-{i:06d}.json.gz" for i in range(n)]:
  tar.add(a.cache/name,arcname="cache/"+name,recursive=False)
 for name in ["render_cache.py","binary_cache.py","cache_utils.py","prores_output.py"]:
  tar.add(root/"blender"/name,arcname="blender/"+name,recursive=False)
with bundle.open("rb") as f: digest=hashlib.file_digest(f,"sha256").hexdigest()
cfg=dict(version=2,scene=s["scene"],buildHash=s["buildHash"],count=n,width=1920,height=1080,fps=24,samples=12,bounces=3,noise=.1,min_samples=4,diffuse=2,glossy=2,chunk_size=240,depth_far=10,sha256=digest)
(a.job/"job.json").write_text(json.dumps(cfg,indent=2))
print("Ready",a.job,n,"frames",len(scene["meshes"]),"meshes",bundle.stat().st_size,"bytes")
