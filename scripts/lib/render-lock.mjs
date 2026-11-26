import {openSync,closeSync,writeFileSync,readFileSync,unlinkSync} from "node:fs";
export function acquireRenderLock(path){
 let fd;
 try{fd=openSync(path,"wx");}catch(e){if(e.code==="EEXIST")throw Error("Another native render may be running. Check process and lock "+path);throw e;}
 try{writeFileSync(fd,JSON.stringify({pid:process.pid,started:new Date().toISOString()}));}finally{closeSync(fd);}
 let active=true;
 const release=()=>{if(active){active=false;try{unlinkSync(path);}catch(e){if(e.code!=="ENOENT")console.warn(e.message);}}};
 process.once("exit",release);
 return ()=>{process.removeListener("exit",release);release();};
}
