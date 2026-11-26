import { spawnSync, execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync, readFileSync, renameSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { gzipSync } from "node:zlib";
import { parseArgs } from "node:util";
import { createHash } from "node:crypto";
import { chromium } from "playwright";
import {createServer} from "node:http";
import {extname,sep} from "node:path";
import { isWSL } from "./lib/windows-browser.mjs";
const {values:o}=parseArgs({options:{
  scene:{type:"string",default:"book"},style:{type:"string",default:"luxury"},format:{type:"string",default:"PNG"},"no-build":{type:"boolean",default:false},"reuse-cache":{type:"boolean",default:false},width:{type:"string",default:"1920"},height:{type:"string",default:"1080"},fps:{type:"string",default:"60"},
  samples:{type:"string",default:"96"},bounces:{type:"string",default:"8"},noise:{type:"string",default:"0.02"},
  device:{type:"string",default:"OPTIX"},start:{type:"string",default:"0"},duration:{type:"string"},
  output:{type:"string",default:"renders/blender-final.mp4"},cache:{type:"string"},
  "export-only":{type:"boolean",default:false},"frames-only":{type:"boolean",default:false},help:{type:"boolean",default:false}
}});
if(o.help){console.log("npm run render:blender -- [--scene book|slideshow|clothesline|floating --style luxury|classic --format PNG|EXR --no-build --reuse-cache --width 1920 --height 1080 --fps 60 --samples 96 --noise 0.02 --bounces 8 --device OPTIX|CUDA|CPU --start seconds --duration seconds --output renders/blender-final.mp4 --cache folder --export-only --frames-only]");process.exit(0);}
const num=(k)=>{const v=Number(o[k]);if(!Number.isInteger(v)||v<=0)throw Error("Invalid "+k);return v;};
const apis={book:"__demo",slideshow:"__slideshow",clothesline:"__clothesline",floating:"__floating"},api=apis[o.scene];if(!api||!["luxury","classic"].includes(o.style)||!["PNG","EXR"].includes(o.format))throw Error("Invalid scene/style/format");if(o.format==="EXR"&&!o["frames-only"]&&!o["export-only"])throw Error("EXR requires --frames-only");
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
if(!o["no-build"]&&!o["reuse-cache"])run(process.execPath,["scripts/build-site.mjs"]);
const root=resolve("site-dist");
function hashDir(dir,h){for(const item of readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const p=join(dir,item.name);h.update(item.name);if(item.isDirectory())hashDir(p,h);else h.update(readFileSync(p));}return h;}
const buildHash=o["reuse-cache"]?null:hashDir(root,createHash("sha256")).digest("hex");
const settings={scene:o.scene,style:o.style,width,height,fps,start,duration,buildHash};
mkdirSync(cache,{recursive:true});
const manifest=join(cache,"manifest.json");
if(existsSync(manifest)){
  const old=JSON.parse(readFileSync(manifest,"utf8"));
  const differences=Object.keys(settings).filter(k=>old.settings?.[k]!==settings[k]&&!(k==="buildHash"&&o["reuse-cache"]));
  if(differences.length)throw Error("Cache settings changed: "+differences.map(k=>k+" (cached "+JSON.stringify(old.settings?.[k])+", requested "+JSON.stringify(settings[k])+")").join(", ")+"; choose another --cache");
  if(!Number.isInteger(old.count)||old.count<1||old.fps!==fps||!existsSync(join(cache,"scene.json.gz")))throw Error("Invalid geometry cache manifest or missing scene");
  for(let i=0;i<old.count;i++)if(!existsSync(join(cache,"frame-"+String(i).padStart(6,"0")+".json.gz")))throw Error("Incomplete geometry cache at frame "+i);
  if(o["reuse-cache"]){settings.buildHash=old.settings.buildHash;console.warn("[export] Explicit cache reuse: using saved geometry, not current source assets");}
  console.log("[export] Reusing completed geometry cache");
}else{
  if(o["reuse-cache"])throw Error("--reuse-cache requires an existing completed cache: "+cache);
  let server,browser;
  try{
    const types={".html":"text/html",".js":"text/javascript",".css":"text/css",".json":"application/json",".jpg":"image/jpeg",".jpeg":"image/jpeg",".png":"image/png",".webp":"image/webp",".svg":"image/svg+xml",".avif":"image/avif"};
    server=createServer((req,res)=>{try{let p=decodeURIComponent(new URL(req.url,"http://localhost").pathname);if(p.endsWith("/"))p+="index.html";const f=resolve(root,"."+p);if(!f.startsWith(root+sep))throw Error();res.writeHead(200,{"Content-Type":types[extname(f)]||"application/octet-stream"}).end(readFileSync(f));}catch{res.writeHead(404).end();}});await new Promise(ok=>server.listen(0,"127.0.0.1",ok));const url="http://127.0.0.1:"+server.address().port+"/"+o.scene+"/";
    browser=await chromium.launch({headless:true,args:["--enable-unsafe-swiftshader"]});
    const page=await browser.newPage({viewport:{width:Math.round(720*width/height),height:720}});
    page.on("pageerror",e=>console.error("[browser]",e));
    await page.goto(url+"?geometry-export&export&quality=offline&style="+o.style,{waitUntil:"networkidle"});
    await page.waitForFunction(api=>!!window[api],api,{timeout:120000});
    if(o.scene==="book")await page.waitForFunction(()=>{const p=window.__demo.photoStatus();return p.loadedFaces+p.failedFaces===p.totalFaces;},null,{timeout:60000});
    const info=await page.evaluate(api=>({duration:window[api].duration,rate:window[api].playbackRate??1,photos:window[api].photoStatus?.()}),api);
    if(info.photos?.failedFaces)throw Error("Run npm run photos:download");
    const seconds=Math.min(duration??Infinity,info.duration/info.rate-start),count=Math.ceil(seconds*fps);
    if(count<=0)throw Error("Start beyond timeline");
    console.log("[export] Exporting static mesh topology, materials and textures");
    save(join(cache,"scene.json.gz"),await page.evaluate(api=>window[api].blenderSetup(),api));
    for(let i=0;i<count;i++){
      const t=Math.min(info.duration,(start+i/fps)*info.rate);
      save(join(cache,"frame-"+String(i).padStart(6,"0")+".json.gz"),await page.evaluate(({api,t})=>window[api].blenderFrame(t),{api,t}));
      if(i%30===0||i===count-1)console.log("[export]",i+1,"/",count,"frames");
    }
    writeFileSync(manifest,JSON.stringify({settings,count,fps},null,2));
  }finally{await browser?.close();server?.close();}
}
if(!o["export-only"]){
  const config=JSON.stringify({settings,samples,bounces,noise,format:o.format,device:o.device});
  mkdirSync(frames,{recursive:true});const marker=join(frames,"settings.json");
  if(existsSync(marker)&&readFileSync(marker,"utf8")!==config)throw Error("Render settings changed; choose another output");
  writeFileSync(marker,config);
  console.log("[render] Blender:",blender,"device:",o.device);
  run(blender,["-b","--factory-startup","--python-exit-code","1","-P",nativePath(blender,resolve("blender/render_cache.py")),"--","--cache",nativePath(blender,cache),"--output",nativePath(blender,frames),"--width",String(width),"--height",String(height),"--samples",String(samples),"--noise",String(noise),"--bounces",String(bounces),"--device",o.device,"--format",o.format]);
  if(!o["frames-only"]){
    const temp=output.replace(/\.mp4$/i,"")+".partial.mp4";
    run(ffmpeg,["-y","-framerate",String(fps),"-start_number","0","-i",nativePath(ffmpeg,join(frames,"frame-%06d.png")),"-frames:v",String(JSON.parse(readFileSync(manifest)).count),"-c:v","libx264","-preset","slow","-crf","15","-pix_fmt","yuv420p","-movflags","+faststart",nativePath(ffmpeg,temp)]);
    renameSync(temp,output);console.log("[render] Video:",output);
  }
}
