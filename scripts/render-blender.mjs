import { spawnSync, execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync, readFileSync, renameSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { gzipSync } from "node:zlib";
import { parseArgs } from "node:util";
import { createHash } from "node:crypto";
import { chromium } from "playwright";
import { startPreviewServer, stopPreviewServer } from "./lib/server.mjs";
import { isWSL } from "./lib/windows-browser.mjs";
const {values:o}=parseArgs({options:{
  width:{type:"string",default:"1920"},height:{type:"string",default:"1080"},fps:{type:"string",default:"60"},
  samples:{type:"string",default:"128"},bounces:{type:"string",default:"8"},noise:{type:"string",default:"0.01"},
  device:{type:"string",default:"OPTIX"},start:{type:"string",default:"0"},duration:{type:"string"},
  output:{type:"string",default:"renders/blender-final.mp4"},cache:{type:"string"},
  "export-only":{type:"boolean",default:false},"frames-only":{type:"boolean",default:false},help:{type:"boolean",default:false}
}});
if(o.help){console.log("npm run render:blender -- [--width 1920 --height 1080 --fps 60 --samples 128 --noise 0.01 --bounces 8 --device OPTIX|CUDA|CPU --start seconds --duration seconds --output renders/blender-final.mp4 --cache folder --export-only --frames-only]");process.exit(0);}
const num=(k)=>{const v=Number(o[k]);if(!Number.isInteger(v)||v<=0)throw Error("Invalid "+k);return v;};
const width=num("width"),height=num("height"),fps=num("fps"),samples=num("samples"),bounces=num("bounces"),noise=Number(o.noise),start=Number(o.start),duration=o.duration===undefined?null:Number(o.duration);
if(width%2||height%2||!(noise>0&&noise<=1)||!Number.isFinite(start)||start<0||duration!==null&&!(duration>0)||!["OPTIX","CUDA","CPU"].includes(o.device))throw Error("Invalid render settings");
const output=resolve(o.output),cache=resolve(o.cache??output.replace(/\.mp4$/i,"")+".cache"),frames=output.replace(/\.mp4$/i,"")+".frames";
function run(bin,args){const r=spawnSync(bin,args,{stdio:"inherit"});if(r.error)throw r.error;if(r.status!==0)throw Error(bin+" failed: "+r.status);}
const available=bin=>spawnSync(bin,["--version"],{stdio:"ignore"}).status===0;
let blender=process.env.BLENDER_PATH;
if(!blender&&isWSL()){
  const root="/mnt/c/Program Files/Blender Foundation";
  if(existsSync(root))blender=readdirSync(root).sort().reverse().map(n=>join(root,n,"blender.exe")).find(existsSync);
}
blender??="blender";
if(!o["export-only"]&&!available(blender))throw Error("Blender not found. Set BLENDER_PATH to the executable.");
const ffmpeg=process.env.FFMPEG_PATH??["ffmpeg","ffmpeg.exe","/mnt/c/msys64/mingw64/bin/ffmpeg.exe"].find(x=>spawnSync(x,["-version"],{stdio:"ignore"}).status===0);
if(!o["export-only"]&&!o["frames-only"]&&!ffmpeg)throw Error("FFmpeg not found");
const nativePath=(bin,p)=>isWSL()&&bin.toLowerCase().endsWith(".exe")?execFileSync("wslpath",["-w",p],{encoding:"utf8"}).trim():p;
function save(path,data){writeFileSync(path+".tmp",gzipSync(JSON.stringify(data)));renameSync(path+".tmp",path);}
run(process.execPath,["node_modules/vite/bin/vite.js","build"]);
const buildHash=createHash("sha256").update(readFileSync("dist/index.html")).digest("hex");
const settings={width,height,fps,start,duration,buildHash};
mkdirSync(cache,{recursive:true});
const manifest=join(cache,"manifest.json");
if(existsSync(manifest)){
  const old=JSON.parse(readFileSync(manifest,"utf8"));
  if(JSON.stringify(old.settings)!==JSON.stringify(settings))throw Error("Cache settings changed; choose another --cache");
  console.log("[export] Reusing completed geometry cache");
}else{
  let server,browser;
  try{
    const url="http://127.0.0.1:4321/";
    server=await startPreviewServer({url,port:4321});
    browser=await chromium.launch({headless:true,args:["--enable-unsafe-swiftshader"]});
    const page=await browser.newPage({viewport:{width:Math.round(720*width/height),height:720}});
    page.on("pageerror",e=>console.error("[browser]",e));
    await page.goto(url+"?geometry-export",{waitUntil:"networkidle"});
    await page.waitForFunction(()=>window.__sceneReady===true,null,{timeout:60000});
    await page.waitForFunction(()=>{const p=window.__demo.photoStatus();return p.loadedFaces+p.failedFaces===p.totalFaces;},null,{timeout:60000});
    const info=await page.evaluate(()=>({duration:window.__demo.duration,rate:window.__demo.playbackRate,photos:window.__demo.photoStatus()}));
    if(info.photos.failedFaces)throw Error("Run npm run photos:download");
    const seconds=Math.min(duration??Infinity,info.duration/info.rate-start),count=Math.ceil(seconds*fps);
    if(count<=0)throw Error("Start beyond timeline");
    console.log("[export] Exporting static mesh topology, materials and textures");
    save(join(cache,"scene.json.gz"),await page.evaluate(()=>window.__demo.blenderSetup()));
    for(let i=0;i<count;i++){
      const t=Math.min(info.duration,(start+i/fps)*info.rate);
      save(join(cache,"frame-"+String(i).padStart(6,"0")+".json.gz"),await page.evaluate(t=>window.__demo.blenderFrame(t),t));
      if(i%30===0||i===count-1)console.log("[export]",i+1,"/",count,"frames");
    }
    writeFileSync(manifest,JSON.stringify({settings,count,fps},null,2));
  }finally{await browser?.close();stopPreviewServer(server);}
}
if(!o["export-only"]){
  const config=JSON.stringify({settings,samples,bounces,noise,device:o.device});
  mkdirSync(frames,{recursive:true});const marker=join(frames,"settings.json");
  if(existsSync(marker)&&readFileSync(marker,"utf8")!==config)throw Error("Render settings changed; choose another output");
  writeFileSync(marker,config);
  console.log("[render] Blender:",blender,"device:",o.device);
  run(blender,["-b","--factory-startup","--python-exit-code","1","-P",nativePath(blender,resolve("blender/render_cache.py")),"--","--cache",nativePath(blender,cache),"--output",nativePath(blender,frames),"--width",String(width),"--height",String(height),"--samples",String(samples),"--noise",String(noise),"--bounces",String(bounces),"--device",o.device]);
  if(!o["frames-only"]){
    const temp=output.replace(/\.mp4$/i,"")+".partial.mp4";
    run(ffmpeg,["-y","-framerate",String(fps),"-start_number","0","-i",nativePath(ffmpeg,join(frames,"frame-%06d.png")),"-frames:v",String(JSON.parse(readFileSync(manifest)).count),"-c:v","libx264","-preset","slow","-crf","15","-pix_fmt","yuv420p","-movflags","+faststart",nativePath(ffmpeg,temp)]);
    renameSync(temp,output);console.log("[render] Video:",output);
  }
}
