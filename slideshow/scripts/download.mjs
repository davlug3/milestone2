import {mkdirSync,writeFileSync} from "node:fs";
const ids=[10,11,15,16,17,18,19,20,28,29,31,33];mkdirSync("public/photos",{recursive:true});
for(const [i,id] of ids.entries()){const r=await fetch("https://picsum.photos/id/"+id+"/1200/800",{signal:AbortSignal.timeout(30000)});if(!r.ok||!r.headers.get("content-type")?.startsWith("image/"))throw Error("Photo download failed: "+id);writeFileSync("public/photos/"+String(i+1).padStart(2,"0")+".jpg",Buffer.from(await r.arrayBuffer()));console.log("Downloaded",i+1,"/",ids.length);}
