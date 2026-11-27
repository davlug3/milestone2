import {readdir,readFile,stat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import os from 'node:os';
const exec=promisify(execFile);
const DRIVE='1RnfccReUJn4sogtKYbkdYfZzLs7n35uM',COLAB='1qYdX-8ia0THTt0KFI5qzKBjt7xNJjA13';
const workspace=resolve(process.env.JILP_WORKSPACE||fileURLToPath(new URL('../../../',import.meta.url)));
const names=async p=>{try{return await readdir(p)}catch(e){if(e.code==='ENOENT')return [];throw e}};
const exists=async p=>{try{return (await stat(p)).size>0}catch{return false}};
const run=async(cmd,args)=>(await exec(cmd,args,{timeout:20000,maxBuffer:8*1024*1024,env:{...process.env,RCLONE_ASK_PASSWORD:'false'}})).stdout;
const remote=async(id,path)=>new Set((await run('rclone',['lsf','gdrive:'+path,'--drive-root-folder-id',id,'--files-only','--recursive','--contimeout','5s','--timeout','10s'])).split(/\r?\n/).filter(Boolean));
export function chunkCount(files,total,archive=false){
 let n=0;
 for(let i=0;i<total;i+=240){
  let p='chunks/chunk-'+String(i).padStart(6,'0'),count=Math.min(240,total-i);
  if(!files.has(p+'.json')||!files.has(p+'.mov'))continue;
  if(archive?!files.has(p+'.depth.tar'):!Array.from({length:count},(_,j)=>files.has('depth/frame-'+String(i+j).padStart(6,'0')+'.png')).every(Boolean))continue;
  n+=count;
 }
 return n;
}
async function localFiles(p){
 const files=new Set();
 for(const dir of ['chunks','depth'])for(const f of await names(join(p,dir)))if(await exists(join(p,dir,f)))files.add(dir+'/'+f);
 if(await exists(join(p,'media.json')))files.add('media.json');
 return files;
}
let driveCache={},driveAt=0;
async function cloud(map){
 if(Date.now()-driveAt<30000)return driveCache;
 const result={};
 await Promise.all(Object.entries(map.scenes).filter(([,s])=>s.extension==='mov').map(async ([name,s])=>{
  try{
   const isColab=name==='floating';
   const f=await remote(isColab?COLAB:DRIVE,isColab?'render.prores-archive':s.directory||'rendered/'+name+'/final/'+map.job+'/render.prores');
   result[name]={frames:chunkCount(f,s.count,isColab),files:f.size,complete:f.has('media.json'),observedAt:new Date().toISOString()};
  }catch{result[name]={...driveCache[name],error:'Drive listing unavailable',stale:true}}
 }));
 driveCache=result;driveAt=Date.now();return result;
}
async function heartbeat(){
 try{
  const h=JSON.parse(await run('rclone',['cat','gdrive:render-status.json','--drive-root-folder-id',COLAB,'--contimeout','5s','--timeout','10s']));
  const age=(Date.now()-Date.parse(h.updatedAt))/1000;
  if(!Number.isFinite(age)||age< -30||typeof h.rendered!=='number')throw Error();
  return {device:String(h.device).slice(0,80),updatedAt:h.updatedAt,age:Math.round(age),rendered:Math.max(0,Math.min(2420,Math.floor(h.rendered))),secondsPerFrame:Number(h.secondsPerFrame)||null,rendering:age<90&&h.rendering===true,stale:age>=90};
 }catch{return {stale:true,error:'No current Colab heartbeat'};}
}
export async function collect(){
 const map=JSON.parse(await readFile(join(workspace,'PROJECT FILES/Assembly/render-map.json'),'utf8'));
 const [c,h]=await Promise.all([cloud(map),heartbeat()]);
 const scenes=[];
 for(const [name,s] of Object.entries(map.scenes)){
  const path=join(workspace,s.directory||'rendered/'+name+'/final/'+map.job+'/render.prores');
  const f=s.extension==='mov'?await localFiles(path):new Set(await names(path));
  const local=s.extension==='mov'?chunkCount(f,s.count):[...f].filter(x=>/^frame-\d+\.png$/.test(x)).length;
  const backed=c[name]?.frames??null;
  const rendered=name==='floating'&&!h.stale?Math.max(local,backed??0,h.rendered):Math.max(local,backed??0);
  scenes.push({name,total:s.count,local,localFiles:f.size,rendered,cloud:backed,cloudFiles:c[name]?.files??null,cloudStale:c[name]?.stale??false,cloudObservedAt:c[name]?.observedAt??null,manifest:f.has('media.json'),cloudManifest:c[name]?.complete??false,kind:s.extension});
 }
 let syncing=null;
 try{const p=await run('ps',['-eo','args']);syncing=p.split('\n').some(x=>/^\s*(?:\S*\/)?rclone\s+(copy|copyto|sync|check|bisync)\b/.test(x))}catch{}
 return {updatedAt:new Date().toISOString(),device:os.hostname(),scenes,colab:h,syncing};
}
let pending,last,lastAt=0;
export async function snapshot(){
 if(last&&Date.now()-lastAt<10000)return last;
 if(!pending)pending=collect().then(x=>{last=x;lastAt=Date.now();return x}).finally(()=>{pending=null});
 return pending;
}
