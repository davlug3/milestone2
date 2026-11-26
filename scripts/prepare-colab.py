"""Prepare a portable Colab job from a completed geometry cache."""
import argparse, json, hashlib, shutil
from pathlib import Path

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("cache",type=Path)
    p.add_argument("job",type=Path,help="New job folder (e.g. synced Google Drive)")
    p.add_argument("--samples",type=int,default=32)
    p.add_argument("--first",type=int,default=0)
    p.add_argument("--last",type=int,help="Inclusive cache-frame index; defaults to last frame")
    p.add_argument("--passes",choices=["all","beauty"],default="all")
    a=p.parse_args()
    meta=json.loads((a.cache/"manifest.json").read_text())
    count=meta["count"]; settings=meta["settings"]
    last=count-1 if a.last is None else a.last
    if not (0<=a.first<=last<count and 1<=a.samples<=4096):p.error("Invalid frame range or samples")
    files=[a.cache/"manifest.json",a.cache/"scene.json.gz"]+[a.cache/f"frame-{i:06d}.json.gz" for i in range(count)]
    for f in files:
        if not f.is_file():p.error(f"Missing {f}")
    import sys
    root=Path(__file__).resolve().parents[1]
    sys.path.insert(0,str(root/"blender"))
    from binary_cache import read_cache
    scene=read_cache(a.cache/"scene.json.gz")
    if not scene.get("meshes") or not scene.get("materials"):p.error("Empty scene export; fix before rendering")
    if settings["scene"]=="floating" and len(scene["materials"])<=1:p.error("Floating cache has only one material; validate/fix asset export first")
    a.job.mkdir(parents=True,exist_ok=False)
    dest=a.job/"cache";dest.mkdir()
    hashes={}
    for f in files:
        shutil.copy2(f,dest/f.name)
        with f.open("rb") as stream:hashes[f.name]=hashlib.file_digest(stream,"sha256").hexdigest()
    manifest=dict(version=1,scene=settings["scene"],width=settings["width"],height=settings["height"],fps=meta["fps"],samples=a.samples,first=a.first,last=last,passes=a.passes,device="CUDA",format="EXR",noise=.03,bounces=6,min_samples=8,diffuse=4,glossy=4,codec="ZIP",hashes=hashes)
    (a.job/"job.json").write_text(json.dumps(manifest,indent=2)+"\n")
    print("Ready:",a.job,"frames",a.first,"through",last)
if __name__=="__main__":main()
