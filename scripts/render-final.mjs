import {spawnSync} from "node:child_process";
import {existsSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {parseArgs} from "node:util";
import {isWSL} from "./lib/windows-browser.mjs";

const root=fileURLToPath(new URL("../",import.meta.url));
const {values}=parseArgs({options:{help:{type:"boolean"},format:{type:"string",default:"prores"},"chunk-size":{type:"string",default:"240"},"depth-far":{type:"string",default:"10"},preset:{type:"string",default:"fast-production"},scene:{type:"string",multiple:true},"dry-run":{type:"boolean"},"no-build":{type:"boolean"}}});
const supported=["book","slideshow","clothesline","floating"];
const scenes=values.scene??supported;
if(values.help){
 console.log("npm run render:final -- [--scene book] [--preset turbo|fast-production] [--dry-run] [--no-build]\nRenders full scenes sequentially: 1080p24, Cycles OptiX, fast-production, ProRes 422 + 16-bit depth PNG (default); --format EXR restores DWAA essential passes.\nBLENDER_PATH and JILP_RENDER_JOB can be overridden through environment variables.");
 process.exit(0);
}
if(!["prores","EXR"].includes(values.format))throw Error("Choose prores or EXR");
if(!["turbo","fast-production"].includes(values.preset))throw Error("Choose turbo or fast-production");
if(scenes.some(s=>!supported.includes(s))||new Set(scenes).size!==scenes.length)throw Error("Select unique scenes: "+supported.join(", "));
const windowsBlender="/mnt/c/Users/iHOMS-DAVE/Documents/blender-5.3.0-windows-x64/blender.exe";
const env={...process.env,JILP_RENDER_JOB:process.env.JILP_RENDER_JOB??"final-"+values.format.toLowerCase()+"-"+new Date().toISOString().replace(/[:.]/g,"-")};
if(!env.BLENDER_PATH&&isWSL()&&existsSync(windowsBlender))env.BLENDER_PATH=windowsBlender;
console.log("[final] Job:",env.JILP_RENDER_JOB,"Blender:",env.BLENDER_PATH??"auto-detect","Scenes:",scenes.join(", "));
function run(script,args=[]){
 console.log("[final]",process.execPath,script,...args);
 if(values["dry-run"])return;
 const r=spawnSync(process.execPath,[script,...args],{cwd:root,env,stdio:"inherit"});
 if(r.error)throw r.error;
 if(r.status!==0)throw Error(script+" failed: "+(r.signal??r.status));
}
if(!values["no-build"])run("scripts/build-site.mjs");
for(const scene of scenes)run("scripts/render-scene.mjs",["--scene",scene,"--engine","cycles","--device","OPTIX","--width","1920","--height","1080","--fps","24","--preset",values.preset,"--format",values.format,...(values.format==="prores"?["--chunk-size",values["chunk-size"],"--depth-far",values["depth-far"]]:["--exr-codec","DWAA","--passes","essential"]),"--frames-only","--no-build"]);
