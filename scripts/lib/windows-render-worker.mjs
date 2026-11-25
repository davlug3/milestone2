// Windows-native Playwright worker. JSON lines over stdio; no cross-OS CDP.
import { chromium } from "playwright";
import { renderFrame } from "./render-progress.mjs";
import { createInterface } from "node:readline";
import { createServer } from "node:http";
import { createReadStream, statSync } from "node:fs";
import { resolve, extname, sep } from "node:path";
let browser,page,server;
const errors=[];
const mime={".html":"text/html",".js":"text/javascript",".css":"text/css",".jpg":"image/jpeg",".png":"image/png",".json":"application/json",".svg":"image/svg+xml"};
async function init({dist,exe,width,height,headless}){
  console.error("[worker] Starting Windows-local asset server");
  const root=resolve(dist);
  server=createServer((req,res)=>{
    try{
      const pathname=decodeURIComponent(new URL(req.url,"http://localhost").pathname);
      const file=resolve(root,"."+ (pathname==="/" ? "/index.html":pathname));
      if(!file.startsWith(root+sep)||!statSync(file).isFile()){res.writeHead(404).end();return;}
      res.writeHead(200,{"Content-Type":mime[extname(file)]??"application/octet-stream"});
      createReadStream(file).on("error",()=>res.destroy()).pipe(res);
    }catch{res.writeHead(404).end();}
  });
  await new Promise((ok,fail)=>{server.once("error",fail);server.listen(0,"127.0.0.1",ok);});
  console.error("[worker] Launching native browser ("+(headless?"headless":"headed")+")");
  browser=await chromium.launch({executablePath:exe,headless,args:["--enable-gpu","--ignore-gpu-blocklist","--use-angle=d3d11","--disable-background-timer-throttling","--disable-renderer-backgrounding","--disable-backgrounding-occluded-windows"]});
  page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
  page.on("pageerror",e=>errors.push(String(e)));
  page.on("console",m=>{if(m.type()==="error")console.error("Browser:",m.text());});
  console.error("[worker] Loading scene and page photos");
  await page.goto("http://127.0.0.1:"+server.address().port+"/?export",{waitUntil:"networkidle"});
  await page.waitForFunction(()=>window.__sceneReady===true,null,{timeout:60000});
  await page.waitForFunction(()=>{const p=window.__demo.photoStatus();return p.loadedFaces+p.failedFaces===p.totalFaces;},null,{timeout:60000});
  return page.evaluate(()=>({duration:window.__demo.duration,rate:window.__demo.playbackRate,gpu:window.__demo.gpu(),photos:window.__demo.photoStatus()}));
}
async function frame(args,id){
  if(errors.length)throw Error(errors.join("\n"));
  const png=await renderFrame(page,args,progress=>process.stdout.write(JSON.stringify({id,progress})+"\n"));
  if(errors.length)throw Error(errors.join("\n"));
  return png;
}
async function close(){await browser?.close();server?.close();}
const rl=createInterface({input:process.stdin,crlfDelay:Infinity});
try{
  for await(const line of rl){
    let id;
    try{
      const req=JSON.parse(line);id=req.id;
      const result=req.method==="init"?await init(req.args):req.method==="frame"?await frame(req.args,id):req.method==="close"?await close():(()=>{throw Error("Unknown method");})();
      process.stdout.write(JSON.stringify({id,result:result??null})+"\n");
      if(req.method==="close")break;
    }catch(e){process.stdout.write(JSON.stringify({id,error:String(e.stack??e)})+"\n");}
  }
}finally{await close();}
