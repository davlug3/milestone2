// One public origin, six Vite dev servers (HMR preserved through the proxy).
import {createServer as createHttpServer,request as httpRequest} from "node:http";
import {createServer as createViteServer} from "vite";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {spawnSync} from "node:child_process";
import {statsConfigPlugin} from "./lib/stats-config.mjs";
import {handleStatus} from "../tools/status/server.mjs";
import {handleEditor} from "../tools/photo-editor/server.mjs";
import {parseArgs} from "node:util";
const {values}=parseArgs({options:{host:{type:"string",default:"localhost"},port:{type:"string",default:"5173"}},allowPositionals:false});
const startPort=Number(values.port);if(!Number.isInteger(startPort)||startPort<1||startPort>65535)throw Error("Invalid port");
const MAX_PORT_TRIES=100;
const root=process.cwd(),names=["book","slideshow","stats","clothesline","floating","earth","title","slideshow2d","photowall"],servers=new Map();
const preparation=spawnSync(process.execPath,["scripts/site-photos.mjs"],{cwd:root,stdio:"inherit"});if(preparation.status!==0)throw Error("Photo preparation failed");
const home=()=>readFileSync(resolve(root,"site/index.html"),"utf8");
const nav='<a id="site-home" href="/" style="position:fixed;z-index:100;top:12px;left:12px;background:#151515bb;color:#eee;text-decoration:none;padding:9px 13px;border-radius:9px;font:14px system-ui">← Presentations</a><script>if(new URLSearchParams(location.search).has("export")||new URLSearchParams(location.search).has("geometry-export"))document.getElementById("site-home").hidden=true;</script>';
const server=createHttpServer((req,res)=>{
 const url=new URL(req.url,"http://localhost"),name=url.pathname.split("/")[1];
 if(name==="status"){void handleStatus(req,res).catch(()=>{if(!res.headersSent)res.writeHead(500);res.end()});return;}
 if(name==="editor"){void handleEditor(req,res);return;}
 if(url.pathname==="/"||url.pathname==="/index.html"){res.setHeader("Content-Type","text/html; charset=utf-8");res.end(home().replace("</main>",'<div style="margin-top:24px"><a href="/editor/" style="color:#c7ae8e">Edit scene photos &amp; statistics →</a> · <a href="/status/" style="color:#c7ae8e">Render operations →</a></div></main>'));return;}
 if(names.includes(name)&&url.pathname==="/"+name){res.writeHead(302,{Location:"/"+name+"/"+url.search});res.end();return;}
 const vite=servers.get(name);if(!vite){res.writeHead(404);res.end("Not found");return;}
 const upstream=vite.httpServer.address().port;
 const proxy=httpRequest({hostname:"127.0.0.1",port:upstream,path:req.url,method:req.method,headers:{...req.headers,host:"127.0.0.1:"+upstream}},r=>{res.writeHead(r.statusCode,r.headers);r.pipe(res);});proxy.on("error",e=>{if(!res.headersSent)res.writeHead(502);res.end(e.message);});req.pipe(proxy);
});
try{
 // Bind the public origin first, stepping past ports that are already in use.
 let port=startPort;
 for(let attempt=0;attempt<MAX_PORT_TRIES;attempt++){
  try{
   await new Promise((ok,reject)=>{
    const onError=e=>{server.removeListener("error",onError);reject(e);};
    server.once("error",onError);
    server.listen(port,values.host,()=>{server.removeListener("error",onError);ok();});
   });
   break;
  }catch(e){
   if(e.code!=="EADDRINUSE")throw e;
   if(port===65535||attempt===MAX_PORT_TRIES-1)throw Error("No free port found between "+startPort+" and "+port+" (try --port)");
   port++;
  }
 }
 // Each Vite server starts from the public port and increments past it, so all six are distinct.
 for(const name of names){
  const vite=await createViteServer({root:name==="book"?root:resolve(root,name),base:"/"+name+"/",cacheDir:resolve(root,"node_modules/.vite-scenes",name),plugins:[...(name==="stats"?[statsConfigPlugin(resolve(root,"photos.config.jsonc"))]:[]),{name:"local-presentation-navigation",transformIndexHtml(html){return html.replace("</body>",nav+"</body>");}}],server:{host:"127.0.0.1",port,strictPort:false,hmr:{clientPort:port,path:"hmr"},fs:{allow:[root]}},configFile:false,appType:"mpa"});
  await vite.listen();servers.set(name,vite);
 }
 // WebSocket upgrades are forwarded to the scene's own Vite HMR server.
 server.on("upgrade",(req,socket,head)=>{
  const name=new URL(req.url,"http://localhost").pathname.split("/")[1],vite=servers.get(name);if(!vite){socket.destroy();return;}
  const proxy=httpRequest({hostname:"127.0.0.1",port:vite.httpServer.address().port,path:req.url,method:req.method,headers:req.headers});
  proxy.on("upgrade",(response,upstream,buffer)=>{let header="HTTP/1.1 "+response.statusCode+" "+response.statusMessage+"\r\n";for(let i=0;i<response.rawHeaders.length;i+=2)header+=response.rawHeaders[i]+": "+response.rawHeaders[i+1]+"\r\n";socket.write(header+"\r\n");if(buffer.length)socket.write(buffer);if(head.length)upstream.write(head);upstream.pipe(socket);socket.pipe(upstream);upstream.on("error",()=>socket.destroy());socket.on("error",()=>upstream.destroy());});proxy.on("error",()=>socket.destroy());proxy.end();
 });
 console.log("Milestone2 presentations: http://"+values.host+":"+port+"/");
}catch(e){if(server.listening)server.close();await Promise.allSettled([...servers.values()].map(v=>v.close()));throw e;}
let closing=false;async function close(){if(closing)return;closing=true;if(server.listening)server.close();await Promise.allSettled([...servers.values()].map(v=>v.close()));process.exit(0);}process.on("SIGINT",close);process.on("SIGTERM",close);
