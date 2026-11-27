import {projectOutput} from "./lib/project-output.mjs";
import {spawnSync} from "node:child_process";
import {readFileSync,mkdirSync,existsSync} from "node:fs";
import {resolve,join} from "node:path";
import {parseArgs} from "node:util";
const {values:o}=parseArgs({options:{scene:{type:"string",default:"floating"},cache:{type:"string"},frames:{type:"string",default:"0,1,60,61,120,121"},output:{type:"string"},presets:{type:"string",default:"cinema,fast-production"},codec:{type:"string",default:"ZIP"}}});
const cache=resolve(o.cache??"renders/"+o.scene+"-cycles.cache"),meta=JSON.parse(readFileSync(join(cache,"manifest.json"),"utf8")),s=meta.settings;
if(s.scene!==o.scene)throw Error("Cache scene mismatch");
const root=projectOutput(o.scene,o.output,{kind:"preview",file:"benchmark"});mkdirSync(root,{recursive:true});
const results=[];
for(const preset of o.presets.split(",")){
 const output=join(root,preset+".mp4");
 const args=["scripts/render-blender.mjs","--scene",o.scene,"--preset",preset,"--reuse-cache","--cache",cache,"--output",output,"--style",s.style,"--width",String(s.width),"--height",String(s.height),"--fps",String(s.fps),"--start",String(s.start),"--benchmark-frames",o.frames,"--exr-codec",o.codec];
 if(s.duration!==null)args.push("--duration",String(s.duration));
 const result=spawnSync(process.execPath,args,{stdio:"inherit",env:process.env});if(result.status!==0)throw Error("Benchmark failed: "+preset);
 const report=JSON.parse(readFileSync(output.replace(/\.mp4$/,"")+".frames/benchmark.json","utf8"));
 const steady=report.frames.slice(1);const measured=steady.length?steady:report.frames;
 results.push({preset,meanSeconds:measured.reduce((n,f)=>n+f.renderAndWriteSeconds,0)/measured.length,meanUpdateSeconds:measured.reduce((n,f)=>n+f.updateSeconds,0)/measured.length,meanCacheReadSeconds:measured.reduce((n,f)=>n+(f.cacheReadSeconds??0),0)/measured.length,meanBytes:measured.reduce((n,f)=>n+f.bytes,0)/measured.length,frames:report.frames.length});
}
console.table(results);console.log("Inspect corresponding EXR frames for visual quality:",root);
