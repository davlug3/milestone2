import { chromium } from "playwright";
import { spawn, execFileSync } from "node:child_process";
import { existsSync, readFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

export function isWSL(){
  return process.platform==="linux" && (Boolean(process.env.WSL_DISTRO_NAME) || /microsoft/i.test(readFileSync("/proc/version","utf8")));
}

export async function launchWindowsChrome({headless=false}={}){
  const exe=process.env.WINDOWS_CHROME_PATH || [
    "/mnt/c/Program Files/Google/Chrome/Application/chrome.exe",
    "/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "/mnt/c/Program Files/Microsoft/Edge/Application/msedge.exe"
  ].find(existsSync);
  if(!exe)throw Error("Native Windows Chrome/Edge not found. Set WINDOWS_CHROME_PATH to its WSL path.");
  // Dedicated temporary Windows profile; never use the user's regular browser profile.
  const temp=execFileSync("cmd.exe",["/d","/c","echo","%TEMP%"],{encoding:"utf8",stdio:["ignore","pipe","ignore"]}).trim();
  const tempLinux=execFileSync("wslpath",["-u",temp],{encoding:"utf8"}).trim();
  const profile=mkdtempSync(join(tempLinux,"book-render-"));
  const profileWin=execFileSync("wslpath",["-w",profile],{encoding:"utf8"}).trim();
  const args=[
    "--user-data-dir="+profileWin,"--remote-debugging-port=0",
    "--remote-debugging-address=127.0.0.1","--no-first-run","--no-default-browser-check",
    "--enable-gpu","--ignore-gpu-blocklist","--use-angle=d3d11",
    "--disable-background-timer-throttling","--disable-renderer-backgrounding","--disable-backgrounding-occluded-windows",
    ...(headless?["--headless=new"]:[]),"about:blank"
  ];
  const child=spawn(exe,args,{stdio:"ignore"});
  let launchError=null;
  child.on("error",e=>{launchError=e;});
  let browser;
  try{
    const marker=join(profile,"DevToolsActivePort");
    for(let i=0;i<120;i++){
      if(launchError)throw launchError;
      if(existsSync(marker)){
        const port=Number(readFileSync(marker,"utf8").split(/\r?\n/)[0]);
        // WSL2 NAT commonly cannot reach Windows localhost directly. A
        // Windows-local PowerShell bridge is not needed when mirrored networking
        // is enabled; otherwise use Windows host IP if Chrome accepts it.
        try{browser=await chromium.connectOverCDP("http://127.0.0.1:"+port,{timeout:1500});break;}catch{}
        // CDP is loopback-only. Run a tiny local relay on Windows via Node
        // only if provided explicitly; never expose remote debugging publicly.
      }
      await sleep(250);
    }
    if(!browser)throw Error("Cannot connect to Windows Chrome CDP from WSL. Enable WSL mirrored networking or use the Windows-local render runner.");
    return {browser,cleanup:async()=>{await browser.close().catch(()=>{});child.kill();await sleep(500);try{rmSync(profile,{recursive:true,force:true});}catch{}}};
  }catch(e){child.kill();throw e;}
}
