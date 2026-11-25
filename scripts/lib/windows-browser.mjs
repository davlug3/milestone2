import { spawn, execFileSync } from "node:child_process";
import { existsSync, readFileSync, mkdtempSync, rmSync, cpSync, copyFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";

export function isWSL(){
  return process.platform==="linux" && (Boolean(process.env.WSL_DISTRO_NAME) || /microsoft/i.test(readFileSync("/proc/version","utf8")));
}
const winPath=p=>execFileSync("wslpath",["-w",p],{encoding:"utf8"}).trim();
export async function launchWindowsWorker({width,height,headless,verbose=false}){
  const exe=process.env.WINDOWS_CHROME_PATH || [
    "/mnt/c/Program Files/Google/Chrome/Application/chrome.exe",
    "/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "/mnt/c/Program Files/Microsoft/Edge/Application/msedge.exe"
  ].find(existsSync);
  const node=process.env.WINDOWS_NODE_PATH || [
    "/mnt/c/nvm4w/nodejs/node.exe","/mnt/c/Program Files/nodejs/node.exe"
  ].find(existsSync) || "node.exe";
  if(!exe)throw Error("Native Windows Chrome/Edge not found. Set WINDOWS_CHROME_PATH to its WSL path.");
  const temp=execFileSync("/mnt/c/Windows/System32/cmd.exe",["/d","/c","echo","%TEMP%"],{encoding:"utf8",stdio:["ignore","pipe","ignore"]}).trim();
  const root=mkdtempSync(join(execFileSync("wslpath",["-u",temp],{encoding:"utf8"}).trim(),"book-render-"));
  // Copy the pure-JS Playwright packages to a native Windows directory so
  // Node and Chrome need neither UNC module resolution nor WSL networking.
  let child,rl;
  const pending=new Map();
  let next=0,closed=false;
  function rejectAll(e){for(const p of pending.values())p.reject(e);pending.clear();}
  const cleanup=async()=>{
    if(!closed&&child){
      closed=true;
      child.stdin.end();
      await Promise.race([new Promise(ok=>child.once("exit",ok)),new Promise(ok=>setTimeout(ok,3000))]);
      if(child.exitCode===null)child.kill();
    }
    rl?.close();
    try{rmSync(root,{recursive:true,force:true});}catch{}
  };
  try{
    console.log("[render] Preparing Windows worker and copying assets");
    cpSync(resolve("node_modules/playwright"),join(root,"node_modules/playwright"),{recursive:true,dereference:true});
    cpSync(resolve("node_modules/playwright-core"),join(root,"node_modules/playwright-core"),{recursive:true,dereference:true});
    cpSync(resolve("dist"),join(root,"dist"),{recursive:true});
    copyFileSync(resolve("scripts/lib/windows-render-worker.mjs"),join(root,"worker.mjs"));
    copyFileSync(resolve("scripts/lib/render-progress.mjs"),join(root,"render-progress.mjs"));
    if(verbose)console.log("[render] Windows node:",node,"browser:",exe);
    child=spawn(node,[winPath(join(root,"worker.mjs"))],{cwd:root,stdio:["pipe","pipe","inherit"]});
    child.on("error",rejectAll);
    child.on("exit",(code)=>{closed=true;rejectAll(Error("Windows worker exited: "+code));});
    child.stdin.on("error",rejectAll);
    rl=createInterface({input:child.stdout,crlfDelay:Infinity});
    rl.on("line",line=>{
      try{const r=JSON.parse(line),p=pending.get(r.id);if(!p)return;if(r.progress){p.report?.(r.progress);return;}pending.delete(r.id);if(r.error)p.reject(Error(r.error));else p.resolve(r.result);}
      catch(e){rejectAll(e);}
    });
    const request=(method,args={},report)=>new Promise((resolve,reject)=>{
      if(closed){reject(Error("Windows worker closed"));return;}
      const id=++next;pending.set(id,{resolve,reject,report});
      child.stdin.write(JSON.stringify({id,method,args})+"\n");
    });
    const info=await request("init",{dist:winPath(join(root,"dist")),exe:winPath(exe),width,height,headless});
    return {info,frame:(args,report)=>request("frame",args,report),cleanup};
  }catch(e){await cleanup();throw e;}
}
