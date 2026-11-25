import { chromium } from "playwright";
import {createServer} from "node:http";
import {createReadStream,statSync} from "node:fs";
import {resolve,extname,sep} from "node:path";
import {createInterface} from "node:readline";
const root=resolve("dist"),types={".html":"text/html",".js":"text/javascript",".css":"text/css",".json":"application/json",".jpg":"image/jpeg",".jpeg":"image/jpeg",".png":"image/png",".svg":"image/svg+xml",".webp":"image/webp",".avif":"image/avif"};
const server=createServer((req,res)=>{try{const path=decodeURIComponent(new URL(req.url,"http://localhost").pathname),file=resolve(root,"."+(path==="/" ? "/index.html":path));if(!file.startsWith(root+sep)||!statSync(file).isFile())throw Error();res.writeHead(200,{"Content-Type":types[extname(file).toLowerCase()]??"application/octet-stream"});createReadStream(file).on("error",()=>res.destroy()).pipe(res);}catch{res.writeHead(404).end();}});
let browser,page;
async function init(a){
 await new Promise((ok,fail)=>{server.once("error",fail);server.listen(0,"127.0.0.1",ok);});
 browser=await chromium.launch({headless:!a.headed,...(a.exe?{executablePath:a.exe}:{}),args:["--enable-gpu","--ignore-gpu-blocklist","--disable-background-timer-throttling","--disable-renderer-backgrounding",...(process.platform==="win32"?["--use-angle=d3d11"]:["--enable-unsafe-swiftshader"])]});
 page=await browser.newPage({viewport:{width:a.width,height:a.height},deviceScaleFactor:1});
 page.on("pageerror",e=>console.error("[browser]",e));await page.goto("http://127.0.0.1:"+server.address().port+"/?export",{waitUntil:"networkidle"});
 await page.waitForFunction(()=>window.__slideshow||window.__slideshowError,null,{timeout:60000});
 return page.evaluate(()=>{if(window.__slideshowError)throw Error(window.__slideshowError);return {duration:window.__slideshow.duration,count:window.__slideshow.count,gpu:window.__slideshow.gpu()};});
}
try{for await(const line of createInterface({input:process.stdin,crlfDelay:Infinity})){let id;try{const req=JSON.parse(line);id=req.id;let result;if(req.method==="init")result=await init(req.args);else if(req.method==="frame")result=await page.evaluate(t=>window.__slideshow.capture(t),req.args.time);else if(req.method==="close")break;else throw Error("Unknown method");process.stdout.write(JSON.stringify({id,result})+"\n");}catch(e){process.stdout.write(JSON.stringify({id,error:String(e.stack??e)})+"\n");}}}finally{await browser?.close();server.close();}
