import {readdirSync,writeFileSync,mkdirSync,readFileSync,existsSync,renameSync,statSync,copyFileSync} from "node:fs";
import {join} from "node:path";
import {createHash} from "node:crypto";
import {spawnSync} from "node:child_process";
const dir="public/photos",cache="public/photo-cache";mkdirSync(dir,{recursive:true});mkdirSync(cache,{recursive:true});
const config=JSON.parse(readFileSync("slideshow.config.json","utf8"));
for(const k of ["interval","flight","settle","hold","width","depth","thickness"])if(k in config&&(!Number.isFinite(config[k])||config[k]<=0))throw Error("Invalid "+k);
if((config.interval??2)<(config.flight??.64)+(config.settle??.62))throw Error("interval must allow each print to settle");
const list=()=>readdirSync(dir).filter(x=>/\.(jpe?g|png|webp|avif)$/i.test(x)).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
const p=config.photos??{source:"picsum",count:8,seed:"tabletop",width:1600,height:1100};
const count=p.count??8;
if(!Number.isInteger(count)||count<1||count>100)throw Error("photos.count must be 1–100");
let urls=[];
if(p.source==="urls"){if(!Array.isArray(p.urls)||!p.urls.length)throw Error("photos.urls must be a nonempty array");urls=p.urls;}
else if(p.source==="picsum")urls=Array.from({length:count},(_,i)=>"https://picsum.photos/seed/"+encodeURIComponent((p.seed??"tabletop")+"-"+i)+"/"+(p.width??1600)+"/"+(p.height??1100));
else if(p.source!=="local")throw Error("Unknown photos.source");
async function fetchPhoto(url){
 const u=new URL(url);if(!["https:","http:"].includes(u.protocol))throw Error("Only HTTP(S) photos supported");
 const key=createHash("sha256").update(url).digest("hex").slice(0,24);
 const existing=readdirSync(cache).find(x=>x.startsWith(key+".")&&!x.endsWith(".tmp"));
 if(existing&&!process.argv.includes("--refresh")&&statSync(join(cache,existing)).size>0)return "./photo-cache/"+existing;
 const response=await fetch(url,{signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error("HTTP "+response.status);
 const ext={"image/jpeg":"jpg","image/png":"png","image/webp":"webp","image/avif":"avif"}[response.headers.get("content-type")?.split(";")[0]];
 if(!ext)throw Error("Unsupported image type");
 const data=Buffer.from(await response.arrayBuffer());if(!data.length||data.length>30*1024*1024)throw Error("Invalid photo size");
 const name=key+"."+ext;writeFileSync(join(cache,name+".tmp"),data);renameSync(join(cache,name+".tmp"),join(cache,name));
 return "./photo-cache/"+name;
}
const names=list();let photos=names.map(x=>"./photos/"+encodeURIComponent(x));
if(!photos.length&&urls.length){
 const result=await Promise.allSettled(urls.map(fetchPhoto));photos=result.filter(x=>x.status==="fulfilled").map(x=>x.value);
 result.forEach((x,i)=>{if(x.status==="rejected")console.warn("[photos] "+urls[i]+": "+x.reason);});
 if(photos.length!==urls.length)console.warn("[photos] Some downloads failed; using available cached/downloaded photos");
}
if(!photos.length){photos=Array.from({length:6},(_,i)=>"./demo/"+(i+1)+".svg");console.warn("[photos] No photographs available; bundled illustration fallback");}
writeFileSync("public/slides.json",JSON.stringify({photos,config},null,2));
console.log("[photos]",photos.length,"ready");
