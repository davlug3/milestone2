import {chromium} from "playwright";
import {spawnSync} from "node:child_process";
import {createServer} from "node:http";
import {readFileSync,writeFileSync,mkdirSync,statSync} from "node:fs";
import {resolve,extname,sep,dirname} from "node:path";
import {parseArgs} from "node:util";
const {values:o}=parseArgs({options:{data:{type:"string",default:"stats/src/data.json"},output:{type:"string",default:"renders/stats.mp4"},frames:{type:"string",default:"renders/stats-frames"},layer:{type:"string",default:"composite"},"frames-only":{type:"boolean",default:false},help:{type:"boolean",default:false}}});
if(o.help){console.log("npm run render:stats -- [--data stats/src/data.json --output renders/stats.mp4 --frames renders/stats-frames --layer composite|background|foreground|chroma|separate --frames-only]");process.exit(0);}
if(!["composite","background","foreground","chroma","separate"].includes(o.layer))throw Error("Invalid layer");
const root=resolve("site-dist");if(!statSync(root).isDirectory())throw Error("Run npm run build:site first.");
const types={".html":"text/html",".js":"text/javascript",".css":"text/css",".json":"application/json"};
const server=createServer((req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,"http://localhost").pathname),file=resolve(root,"."+ (pathname.endsWith("/")?pathname+"index.html":pathname));if(!file.startsWith(root+sep))throw Error();res.writeHead(200,{"Content-Type":types[extname(file)]||"application/octet-stream"}).end(readFileSync(file));}catch{res.writeHead(404).end();}});
await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
let browser;try{
 browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
 await page.goto("http://127.0.0.1:"+server.address().port+"/stats/?export",{waitUntil:"networkidle"});await page.waitForFunction(()=>window.__stats);
 await page.evaluate(data=>window.__stats.setData(data),JSON.parse(readFileSync(o.data,"utf8")));
 const duration=await page.evaluate(()=>window.__stats.duration),count=Math.ceil(duration*60);
 const passes=o.layer==="separate"?["background","foreground"]:[o.layer];
 for(const pass of passes){
  const frames=resolve(o.frames,pass);mkdirSync(frames,{recursive:true});
  await page.evaluate(pass=>window.__stats.setLayer(pass),pass);
  for(let i=0;i<count;i++){
   const png=await page.evaluate(t=>window.__stats.capture(t),i/60);
   writeFileSync(resolve(frames,"frame-"+String(i).padStart(6,"0")+".png"),Buffer.from(png.split(",")[1],"base64"));
   if(i%60===0)console.log(pass+" frame "+(i+1)+"/"+count);
  }
  if(o["frames-only"])continue;
  const alpha=pass==="foreground",base=o.output.replace(/\.[^/.]+$/,"");
  const output=alpha?base+"-foreground.mov":pass==="composite"?o.output:base+"-"+pass+".mp4";
  mkdirSync(dirname(resolve(output)),{recursive:true});
  const codec=alpha?["-c:v","prores_ks","-profile:v","4","-pix_fmt","yuva444p10le","-alpha_bits","16"]:["-c:v","libx264","-pix_fmt","yuv420p"];
  const result=spawnSync("ffmpeg",["-y","-framerate","60","-i",resolve(frames,"frame-%06d.png"),"-frames:v",String(count),...codec,output],{stdio:"inherit"});
  if(result.status!==0)throw Error("FFmpeg failed; PNG frames retained in "+frames);
 }
}finally{await browser?.close();server.close();}
