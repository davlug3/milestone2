"""Bounded staging and crash-safe ProRes 422 chunks with 16-bit depth."""
import json, os, subprocess, struct
from pathlib import Path

def atomic_json(path, data):
    tmp=path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data,indent=2))
    os.replace(tmp,path)

class ProResOutput:
    def __init__(self,out,meta,a):
        self.out=out
        self.count=meta["count"]
        self.fps=meta["fps"]
        self.a=a
        self.chunks=out/"chunks"
        self.chunks.mkdir(exist_ok=True)
        self.depth=out/"depth"
        self.size=a.chunk_size
        self.valid=set()
        atomic_json(out/"depth-metadata.json",{"near_m":0,"far_m":a.depth_far,"encoding":"uint16 grayscale, black near, white far or no hit","fps":self.fps,"width":a.width,"height":a.height,"frames":self.count,"formula":"distance_m = code / 65535 * far_m"})
        for start in range(0,self.count,self.size):
            marker=self.marker(start)
            if marker.exists():
                d=json.loads(marker.read_text())
                if d != self.spec(start) or not self.check(start):
                    raise RuntimeError("Invalid committed chunk: "+str(marker))
                self.valid.add(start)
                self.cleanup(start)
    def spec(self,start):
        return {"start":start,"count":min(self.size,self.count-start),"fps":self.fps,"width":self.a.width,"height":self.a.height,"codec":"prores","profile":"Standard","pixel_format":"yuv422p10le"}
    def movie(self,start):
        return self.chunks/("chunk-%06d.mov"%start)
    def marker(self,start):
        return self.movie(start).with_suffix(".json")
    def indices(self,start):
        return range(start,start+self.spec(start)["count"])
    def png(self,i):
        return self.out/("frame-%06d.png"%i)
    def depth_ok(self,i):
        p=self.depth/("frame-%06d.png"%i)
        try:
            with p.open("rb") as f:h=f.read(29)
            return h[:8]==b"\x89PNG\r\n\x1a\n" and struct.unpack(">II",h[16:24])==(self.a.width,self.a.height) and h[24:26]==bytes((16,0)) and p.stat().st_size>100
        except (OSError,struct.error):return False
    def probe(self,p,count):
        d=json.loads(subprocess.check_output([self.a.ffprobe,"-v","error","-select_streams","v:0","-show_entries","stream=codec_name,profile,pix_fmt,width,height,r_frame_rate,nb_frames","-of","json",str(p)]))
        s=d["streams"][0]
        return s["codec_name"]=="prores" and s["profile"]=="Standard" and s["pix_fmt"]=="yuv422p10le" and int(s["width"])==self.a.width and int(s["height"])==self.a.height and s["r_frame_rate"]==str(self.fps)+"/1" and int(s["nb_frames"])==count
    def check(self,start):
        return self.movie(start).exists() and self.probe(self.movie(start),self.spec(start)["count"]) and all(self.depth_ok(i) for i in self.indices(start))
    def cleanup(self,start):
        for i in self.indices(start):self.png(i).unlink(missing_ok=True)
    def done(self,i):
        return i//self.size*self.size in self.valid or (self.png(i).exists() and self.png(i).stat().st_size>100 and self.depth_ok(i))
    def flush(self,start):
        if start in self.valid:return
        if not all(self.done(i) for i in self.indices(start)):return
        tmp=self.movie(start).with_suffix(".partial.mov")
        subprocess.run([self.a.ffmpeg,"-hide_banner","-loglevel","error","-y","-framerate",str(self.fps),"-start_number",str(start),"-i",str(self.out/"frame-%06d.png"),"-frames:v",str(self.spec(start)["count"]),"-vf","scale=out_color_matrix=bt709:out_range=tv,format=yuv422p10le","-c:v","prores_ks","-profile:v","2","-color_primaries","bt709","-color_trc","iec61966-2-1","-colorspace","bt709","-color_range","tv",str(tmp)],check=True)
        if not self.probe(tmp,self.spec(start)["count"]):raise RuntimeError("Invalid encoded chunk")
        os.replace(tmp,self.movie(start))
        atomic_json(self.marker(start),self.spec(start))
        self.valid.add(start)
        self.cleanup(start)
        print("[prores] Committed chunk",start,flush=True)
    def finish(self):
        for start in range(0,self.count,self.size):self.flush(start)
        if len(self.valid)!=(self.count+self.size-1)//self.size:raise RuntimeError("Incomplete ProRes output")
        # Keep chunks as the canonical media; avoid duplicating the whole scene.
        atomic_json(self.out/"media.json",{"fps":self.fps,"count":self.count,"chunks":[{"file":str(self.movie(s).relative_to(self.out)).replace(os.sep,"/"),**self.spec(s)} for s in sorted(self.valid)],"depth":"depth/frame-%06d.png"})
