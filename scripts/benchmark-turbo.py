"""Compare production Turbo with isolated candidate settings; never touch production output."""
import argparse, json, os, shutil, subprocess, sys, tempfile, time, statistics
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
VARIANTS={
    "baseline":dict(samples=12,bounces=3,noise=.10,min_samples=4,diffuse=2,glossy=2,compression=None),
    "fast-png":dict(samples=12,bounces=3,noise=.10,min_samples=4,diffuse=2,glossy=2,compression=0),
    "turbo-v2":dict(samples=8,bounces=3,noise=.15,min_samples=2,diffuse=1,glossy=2,compression=0),
}
def replace_once(source, old, new):
    if source.count(old)!=1:raise RuntimeError("Renderer revision does not match benchmark patch: "+old)
    return source.replace(old,new,1)
def variant_renderer(source,settings,denoiser):
    # Benchmark beauty and Z as in production, but sparse frames must not go
    # through the full-scene ProRes writer, which requires contiguous chunks.
    source=replace_once(source,'if a.prores:scene.view_layers[0].use_pass_z=True','scene.view_layers[0].use_pass_z=True')
    source=replace_once(source,'outputs=png_pass_outputs(scene,out,a.prores,a.depth_far) if a.prores or (a.format=="PNG" and a.passes=="all") else {}','outputs=png_pass_outputs(scene,out,True,a.depth_far)')
    if denoiser=="oidn":
        source=replace_once(source,'scene.cycles.denoiser="OPTIX" if a.device=="OPTIX" else "OPENIMAGEDENOISE"','scene.cycles.denoiser="OPENIMAGEDENOISE"\n    scene.cycles.denoising_use_gpu=True')
    if settings["compression"] is not None:
        source=replace_once(source,'scene.render.image_settings.color_depth="16"\n    if a.passes',f'scene.render.image_settings.color_depth="16"\n        scene.render.image_settings.compression={settings["compression"]}\n    if a.passes')
        source=replace_once(source,'node.format.compression=15',f'node.format.compression={settings["compression"]}')
    compile(source,"benchmark-renderer","exec")
    return source
def frames_for(count,n):
    # Six contiguous bursts capture motion and amortize startup costs.
    if count<1 or n<1:raise ValueError("Positive frame count required")
    n=min(count,n);groups=min(6,n);chosen=set()
    for g in range(groups):
        length=n//groups+(g<n%groups)
        start=round(g*(count-length)/max(1,groups-1))
        chosen.update(range(start,start+length))
    for i in range(count):
        if len(chosen)>=n:break
        chosen.add(i)
    return sorted(chosen)
def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--blender",required=True)
    p.add_argument("--cache",type=Path,required=True,action="append",help="Repeat for each scene cache")
    p.add_argument("--output",type=Path,required=True,help="New benchmark directory outside production renders")
    p.add_argument("--frames",type=int,default=30)
    p.add_argument("--device",choices=["OPTIX","CUDA","CPU"],default="OPTIX")
    p.add_argument("--denoiser",choices=["native","oidn"],default="native")
    p.add_argument("--variant",choices=list(VARIANTS),action="append")
    a=p.parse_args()
    out=a.output.resolve()
    if out.exists():raise RuntimeError("Choose a new benchmark output directory")
    if any(part.lower()=="rendered" for part in out.parts):raise RuntimeError("Do not benchmark inside production rendered directory")
    out.mkdir(parents=True)
    reports=[]
    original=(ROOT/"blender/render_cache.py").read_text()
    for idx,cache in enumerate(a.cache):
        cache=cache.resolve()
        meta=json.loads((cache/"manifest.json").read_text())
        scene=meta["settings"]["scene"]
        count=meta["count"]
        frames=frames_for(count,a.frames)
        for name in a.variant or VARIANTS:
            settings=VARIANTS[name]
            dest=out/f"{idx:02d}-{scene}"/name
            dest.mkdir(parents=True)
            # Isolate the script and texture writes; use a private cache copy.
            private_cache=dest/"cache"
            shutil.copytree(cache,private_cache)
            worker=dest/"worker"
            shutil.copytree(ROOT/"blender",worker,ignore=shutil.ignore_patterns("__pycache__"))
            (worker/"render_cache.py").write_text(variant_renderer(original,settings,a.denoiser))
            media=dest/"frames"
            cmd=[a.blender,"-b","--factory-startup","--python-exit-code","1","-P",str(worker/"render_cache.py"),"--","--cache",str(private_cache),"--output",str(media),"--format","PNG","--passes","beauty","--device",a.device,"--width",str(meta["settings"]["width"]),"--height",str(meta["settings"]["height"]),"--benchmark-frames",",".join(map(str,frames))]
            for k,v in settings.items():
                if k!="compression":cmd.extend(["--"+k.replace("_","-"),str(v)])
            start=time.monotonic()
            with (dest/"blender.log").open("w") as log:
                subprocess.run(cmd,stdout=log,stderr=subprocess.STDOUT,check=True)
            elapsed=time.monotonic()-start
            metrics=json.loads((media/"benchmark.json").read_text())["frames"]
            if sorted(x["frame"] for x in metrics)!=frames:raise RuntimeError("Benchmark coverage mismatch")
            # Exclude first rendered frame from steady-state median only.
            steady=metrics[1:] or metrics
            report=dict(scene=scene,variant=name,settings=settings,device=a.device,denoiser=a.denoiser,frames=frames,wall_seconds=elapsed,median_render_write_seconds=statistics.median(x["renderAndWriteSeconds"] for x in steady),mean_update_seconds=statistics.mean(x["updateSeconds"] for x in steady),mean_cache_read_seconds=statistics.mean(x["cacheReadSeconds"] for x in steady),beauty_bytes=sum(x["bytes"] for x in metrics))
            reports.append(report)
            (out/"report.json").write_text(json.dumps(reports,indent=2))
            print(json.dumps(report),flush=True)
            # Only remove the benchmark-owned cache copy after successful run.
            shutil.rmtree(private_cache)
    print("Inspect matched images and contiguous bursts for noise/flicker before promoting a preset.")
if __name__=="__main__":main()
