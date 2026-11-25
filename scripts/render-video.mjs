import { spawnSync, execFileSync } from "node:child_process";
import { mkdirSync, existsSync, readFileSync, writeFileSync, renameSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import { chromium } from "playwright";
import { launchPreviewBrowser, isSoftwareRenderer } from "./lib/browser.mjs";
import { startPreviewServer, stopPreviewServer } from "./lib/server.mjs";
import { parseArgs } from "node:util";
import { createHash } from "node:crypto";

const {values:o}=parseArgs({options:{
  width:{type:"string",default:"1920"},height:{type:"string",default:"1080"},
  fps:{type:"string",default:"60"},samples:{type:"string",default:"384"},bounces:{type:"string",default:"10"},
  output:{type:"string",default:"renders/final.mp4"},frames:{type:"string"},
  start:{type:"string",default:"0"},duration:{type:"string"},port:{type:"string",default:"4319"},
  "allow-software":{type:"boolean",default:false},headless:{type:"boolean",default:false},
  "frames-only":{type:"boolean",default:false},help:{type:"boolean",default:false}
}});
if(o.help){console.log("npm run render:video -- [--width 1920 --height 1080 --fps 60 --samples 384 --bounces 10 --output renders/final.mp4 --start 0 --duration seconds --frames folder --headless --allow-software --frames-only]");process.exit(0);}
function positive(s,name){const n=Number(s);if(!Number.isInteger(n)||n<1)throw Error("Invalid "+name);return n;}
const width=positive(o.width,"width"),height=positive(o.height,"height"),fps=positive(o.fps,"fps"),samples=positive(o.samples,"samples"),bounces=positive(o.bounces,"bounces"),port=positive(o.port,"port");
if(width%2||height%2)throw Error("MP4 requires even width and height");
const start=Number(o.start),requested=o.duration===undefined?null:Number(o.duration);
if(!Number.isFinite(start)||start<0||requested!==null&&(!Number.isFinite(requested)||requested<=0))throw Error("Invalid start/duration");
const output=resolve(o.output),dir=resolve(o.frames??output.replace(/\.mp4$/i,"")+".frames");
function available(bin){return spawnSync(bin,["-version"],{stdio:"ignore"}).status===0;}
const ffmpeg=process.env.FFMPEG_PATH || (available("ffmpeg")?"ffmpeg":available("ffmpeg.exe")?"ffmpeg.exe":null);
if(!o["frames-only"]&&!ffmpeg)throw Error("Install FFmpeg or set FFMPEG_PATH");
function encodePath(p){return ffmpeg?.toLowerCase().endsWith(".exe")&&process.platform==="linux"?execFileSync("wslpath",["-w",p],{encoding:"utf8"}).trim():p;}
function run(bin,args){const r=spawnSync(bin,args,{stdio:"inherit"});if(r.status!==0)throw Error(bin+" failed ("+r.status+")");}
function frameName(i){return "frame-"+String(i).padStart(6,"0")+".png";}
function validPng(p){try{const b=readFileSync(p);return b.length>33&&b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&b.readUInt32BE(16)===width&&b.readUInt32BE(20)===height&&b.subarray(-8,-4).toString()==="IEND";}catch{return false;}}
const url="http://127.0.0.1:"+port+"/";
let server,browser;
try{
  run(process.execPath,["node_modules/vite/bin/vite.js","build"]);
  server=await startPreviewServer({url,port});
  browser=o.headless?(await launchPreviewBrowser()).browser:await chromium.launch({headless:false,channel:"chromium",args:["--enable-gpu","--ignore-gpu-blocklist","--disable-background-timer-throttling","--disable-renderer-backgrounding",...(process.env.PREVIEW_GPU_ARGS??"").trim().split(/\s+/).filter(Boolean)]});
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
  const errors=[];
  page.on("pageerror",e=>errors.push(String(e)));
  page.on("console",m=>{if(m.type()==="error")console.error("Browser:",m.text());});
  await page.goto(url+"?export",{waitUntil:"networkidle"});
  await page.waitForFunction(()=>window.__sceneReady===true,null,{timeout:60000});
  await page.waitForFunction(()=>{const p=window.__demo.photoStatus();return p.loadedFaces+p.failedFaces===p.totalFaces;},null,{timeout:60000});
  const info=await page.evaluate(()=>({duration:window.__demo.duration,rate:window.__demo.playbackRate,gpu:window.__demo.gpu(),photos:window.__demo.photoStatus()}));
  console.log("GPU:",info.gpu.renderer);
  if(info.photos.failedFaces)throw Error("Missing page photos; run npm run photos:download");
  if(isSoftwareRenderer(info.gpu.renderer)&&!o["allow-software"])throw Error("Software GPU detected; use a hardware GPU or explicitly pass --allow-software");
  const duration=Math.min(requested??Infinity,info.duration/info.rate-start);
  if(duration<=0)throw Error("Start is beyond timeline");
  const count=Math.ceil(duration*fps);
  mkdirSync(dir,{recursive:true});
  const buildHash=createHash("sha256").update(readFileSync("dist/index.html")).digest("hex");
  const config={width,height,fps,samples,bounces,start,duration,count,rate:info.rate,buildHash};
  const manifest=join(dir,"manifest.json");
  if(existsSync(manifest)&&JSON.stringify(JSON.parse(readFileSync(manifest,"utf8")))!==JSON.stringify(config))throw Error("Frame directory settings changed. Choose a new --frames directory.");
  writeFileSync(manifest,JSON.stringify(config,null,2));
  console.log(count+" frames | "+width+"x"+height+" | "+fps+" fps | "+samples+" spp");
  for(let i=0;i<count;i++){
    const file=join(dir,frameName(i));
    if(validPng(file)){console.log("Resume "+(i+1)+"/"+count);continue;}
    if(errors.length)throw Error(errors.join("\n"));
    const time=Math.min(info.duration,(start+i/fps)*info.rate);
    await page.evaluate(({time,samples,bounces})=>window.__demo.exportFrame(time,samples,bounces),{time,samples,bounces});
    await page.waitForFunction(()=>{const r=window.__demo.renderStatus();return r.error||r.mode!=="cinematic"||r.samples>=r.target;},null,{timeout:0,polling:100});
    const status=await page.evaluate(()=>window.__demo.renderStatus());
    if(status.error||status.mode!=="cinematic")throw Error("Ray tracing failed: "+status.error);
    const png=await page.evaluate(()=>window.__demo.captureFrame());
    writeFileSync(file+".tmp",Buffer.from(png.split(",")[1],"base64"));
    if(!validPng(file+".tmp"))throw Error("Invalid frame "+i);
    renameSync(file+".tmp",file);
    console.log("Rendered "+(i+1)+"/"+count+" | t="+time.toFixed(3));
  }
  if(!o["frames-only"]){
    mkdirSync(resolve(output,".."),{recursive:true});
    const tmp=output.replace(/\.mp4$/i,"")+".partial.mp4";
    run(ffmpeg,["-y","-framerate",String(fps),"-start_number","0","-i",encodePath(join(dir,"frame-%06d.png")),"-frames:v",String(count),"-c:v","libx264","-preset","slow","-crf","15","-pix_fmt","yuv420p","-movflags","+faststart",encodePath(tmp)]);
    renameSync(tmp,output);
    console.log("Video: "+output+" ("+statSync(output).size+" bytes)");
  }
}finally{await browser?.close();stopPreviewServer(server);}
