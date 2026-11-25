import {chromium} from "playwright";
import {spawnSync} from "node:child_process";
import {createServer} from "node:http";
import {readFileSync,writeFileSync,mkdirSync,statSync} from "node:fs";
import {resolve,extname,sep} from "node:path";
import {parseArgs} from "node:util";
const {values:o}=parseArgs({options:{data:{type:"string",default:"stats/src/data.json"},output:{type:"string",default:"renders/stats.mp4"},frames:{type:"string",default:"renders/stats-frames"},help:{type:"boolean",default:false}}});
if(o.help){console.log("npm run render:stats -- [--data stats/src/data.json --output renders/stats.mp4 --frames renders/stats-frames]");process.exit(0);}
const root=resolve("site-dist/stats");if(!statSync(root).isDirectory())throw Error("Run npm run build:site first.");
const types={".html":"text/html",".js":"text/javascript",".css":"text/css",".json":"application/json"};
const server=createServer((req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,"http://localhost").pathname),file=resolve(root,"."+ (pathname==="/"?"/index.html":pathname));if(!file.startsWith(root+sep))throw Error();res.writeHead(200,{"Content-Type":types[extname(file)]||"application/octet-stream"}).end(readFileSync(file));}catch{res.writeHead(404).end();}});
await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
let browser;try{
 browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
 await page.goto("http://127.0.0.1:"+server.address().port+"/?export",{waitUntil:"networkidle"});await page.waitForFunction(()=>window.__stats);
 await page.evaluate(data=>window.__stats.setData(data),JSON.parse(readFileSync(o.data,"utf8")));
 const duration=await page.evaluate(()=>window.__stats.duration),count=Math.ceil(duration*60);mkdirSync(o.frames,{recursive:true});
 for(let i=0;i<count;i++){const png=await page.evaluate(t=>window.__stats.capture(t),i/60);writeFileSync(resolve(o.frames,"frame-"+String(i).padStart(6,"0")+".png"),Buffer.from(png.split(",")[1],"base64"));if(i%60===0)console.log("Frame "+(i+1)+"/"+count);}
 const result=spawnSync("ffmpeg",["-y","-framerate","60","-i",resolve(o.frames,"frame-%06d.png"),"-frames:v",String(count),"-c:v","libx264","-pix_fmt","yuv420p",o.output],{stdio:"inherit"});if(result.status!==0)throw Error("FFmpeg failed; PNG frames retained.");
}finally{await browser?.close();server.close();}
