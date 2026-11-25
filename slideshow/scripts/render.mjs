import {spawn,spawnSync,execFileSync} from "node:child_process";
import {mkdirSync,existsSync,readFileSync,writeFileSync,renameSync,cpSync,copyFileSync,mkdtempSync,rmSync,readdirSync} from "node:fs";
import {resolve,join} from "node:path";
import {createInterface} from "node:readline";
import {parseArgs} from "node:util";
import {createHash} from "node:crypto";
const {values:o}=parseArgs({options:{width:{type:"string",default:"1920"},height:{type:"string",default:"1080"},fps:{type:"string",default:"60"},duration:{type:"string"},output:{type:"string",default:"renders/slideshow.mp4"},mode:{type:"string",default:"raster"},samples:{type:"string",default:"32"},headed:{type:"boolean",default:false},headless:{type:"boolean",default:false},"frames-only":{type:"boolean",default:false},help:{type:"boolean",default:false}}});
if(o.help){console.log("npm run render:video -- [--width 1920 --height 1080 --fps 60 --duration seconds --output renders/slideshow.mp4 --mode raster|raytrace --samples 32 --headed|--headless --frames-only]");process.exit(0);}
const integer=k=>{const n=Number(o[k]);if(!Number.isInteger(n)||n<1)throw Error("Invalid "+k);return n;};
const width=integer("width"),height=integer("height"),fps=integer("fps"),requested=o.duration===undefined?Infinity:Number(o.duration);
const samples=integer("samples");if(!["raster","raytrace"].includes(o.mode))throw Error("Invalid mode");
if(width%2||height%2||!(requested>0)||o.headed&&o.headless)throw Error("Invalid render settings");
const wsl=process.platform==="linux"&&(/microsoft/i.test(readFileSync("/proc/version","utf8"))||!!process.env.WSL_DISTRO_NAME);
const winPath=p=>execFileSync("wslpath",["-w",p],{encoding:"utf8"}).trim();
const ffmpeg=process.env.FFMPEG_PATH??["ffmpeg","ffmpeg.exe","/mnt/c/msys64/mingw64/bin/ffmpeg.exe"].find(x=>spawnSync(x,["-version"],{stdio:"ignore"}).status===0);
if(!o["frames-only"]&&!ffmpeg)throw Error("Install FFmpeg or set FFMPEG_PATH");
const pathFor=(exe,p)=>wsl&&exe.toLowerCase().endsWith(".exe")?winPath(p):p;
function run(bin,args){const r=spawnSync(bin,args,{stdio:"inherit"});if(r.error)throw r.error;if(r.status!==0)throw Error(bin+" failed: "+r.status);}
run(process.execPath,["scripts/photos.mjs"]);run(process.execPath,["node_modules/vite/bin/vite.js","build"]);
const output=resolve(o.output),dir=output.replace(/\.mp4$/i,"")+".frames";mkdirSync(dir,{recursive:true});
let temp,child,rl,seq=0,closed=false;const pending=new Map();
function rejectAll(e){for(const p of pending.values())p.reject(e);pending.clear();}
function request(method,args={}){return new Promise((resolve,reject)=>{if(closed)return reject(Error("Browser worker closed"));const id=++seq;pending.set(id,{resolve,reject});child.stdin.write(JSON.stringify({id,method,args})+"\n");});}
function hashDir(dir,h){for(const f of readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const p=join(dir,f.name);h.update(f.name);if(f.isDirectory())hashDir(p,h);else h.update(readFileSync(p));}return h;}
function validPng(p){try{const b=readFileSync(p);return b.length>33&&b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&b.readUInt32BE(16)===width&&b.readUInt32BE(20)===height&&b.subarray(-8,-4).toString()==="IEND";}catch{return false;}}
try{
 let node=process.execPath,script=resolve("scripts/browser-worker.mjs"),cwd=process.cwd(),exe;
 if(wsl&&!process.env.SLIDESHOW_LINUX_BROWSER){
  node=process.env.WINDOWS_NODE_PATH??["/mnt/c/nvm4w/nodejs/node.exe","/mnt/c/Program Files/nodejs/node.exe"].find(existsSync)??"node.exe";
  const chrome=process.env.WINDOWS_CHROME_PATH??["/mnt/c/Program Files/Google/Chrome/Application/chrome.exe","/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(existsSync);
  if(!chrome)throw Error("Windows Chrome not found; set WINDOWS_CHROME_PATH or SLIDESHOW_LINUX_BROWSER=1");
  exe=winPath(chrome);const tmp=execFileSync("/mnt/c/Windows/System32/cmd.exe",["/d","/c","echo","%TEMP%"],{encoding:"utf8",stdio:["ignore","pipe","ignore"]}).trim();
  temp=mkdtempSync(join(execFileSync("wslpath",["-u",tmp],{encoding:"utf8"}).trim(),"slideshow-"));
  console.log("[render] Preparing native Windows worker");
  for(const name of ["playwright","playwright-core"])cpSync(resolve("node_modules",name),join(temp,"node_modules",name),{recursive:true,dereference:true});
  cpSync(resolve("dist"),join(temp,"dist"),{recursive:true});copyFileSync(script,join(temp,"worker.mjs"));script=winPath(join(temp,"worker.mjs"));cwd=temp;
 }
 child=spawn(node,[script],{cwd,stdio:["pipe","pipe","inherit"]});child.on("error",rejectAll);child.on("exit",code=>{closed=true;rejectAll(Error("Worker exited: "+code));});child.stdin.on("error",rejectAll);
 rl=createInterface({input:child.stdout,crlfDelay:Infinity});rl.on("line",line=>{try{const r=JSON.parse(line),p=pending.get(r.id);if(!p)return;if(r.progress){console.log("[render]",r.progress);return;}pending.delete(r.id);r.error?p.reject(Error(r.error)):p.resolve(r.result);}catch(e){rejectAll(e);}});
 console.log("[render] Launching",o.headed?"headed":"headless","browser");
 const info=await request("init",{width,height,headed:o.headed,exe});const count=Math.ceil(Math.min(info.duration,requested)*fps);
 const config=JSON.stringify({width,height,fps,count,mode:o.mode,samples,hash:hashDir("dist",createHash("sha256")).digest("hex")});
 const manifest=join(dir,"manifest.json");if(existsSync(manifest)&&readFileSync(manifest,"utf8")!==config)throw Error("Frame settings changed; choose a new --output");
 writeFileSync(manifest,config);console.log("[render]",info.gpu,"|",count,"frames |",width+"x"+height,"|",fps,"fps");
 const start=Date.now();let done=0;
 for(let i=0;i<count;i++){const path=join(dir,"frame-"+String(i).padStart(6,"0")+".png");if(validPng(path))continue;const png=await request("frame",{time:i/fps,mode:o.mode,samples,index:i+1,count});writeFileSync(path+".tmp",Buffer.from(png.split(",")[1],"base64"));if(!validPng(path+".tmp"))throw Error("Invalid PNG at frame "+i);renameSync(path+".tmp",path);done++;if(i===0||i%30===0||i===count-1){const elapsed=(Date.now()-start)/1000;console.log("[render]",i+1,"/",count,"|",elapsed.toFixed(1)+"s | ETA",((count-i-1)*elapsed/done/60).toFixed(1)+"m");}}
 if(!o["frames-only"]){const partial=output.replace(/\.mp4$/i,"")+".partial.mp4";console.log("[render] Encoding MP4");run(ffmpeg,["-y","-framerate",String(fps),"-i",pathFor(ffmpeg,join(dir,"frame-%06d.png")),"-frames:v",String(count),"-c:v","libx264","-crf","16","-preset","medium","-pix_fmt","yuv420p","-movflags","+faststart",pathFor(ffmpeg,partial)]);renameSync(partial,output);console.log("[render] Complete:",output);}
}finally{if(child&&!closed){child.stdin.end();await Promise.race([new Promise(ok=>child.once("exit",ok)),new Promise(ok=>setTimeout(ok,3000))]);if(child.exitCode===null)child.kill();}rl?.close();if(temp)try{rmSync(temp,{recursive:true,force:true});}catch{}}
