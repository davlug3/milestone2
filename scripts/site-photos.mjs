import {mkdir,writeFile,readFile,copyFile,rename,rm} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {createHash} from 'node:crypto';
import {resolvePhotos} from './lib/photo-config.mjs';
const scenes=['book','slideshow','clothesline','floating'];
const collections=Object.fromEntries(await Promise.all(scenes.map(async s=>[s,await resolvePhotos(resolve('photos.config.jsonc'),s)])));
const fallback=collections.book.length?collections.book:scenes.flatMap(s=>collections[s]).filter((v,i,a)=>a.indexOf(v)===i);
if(!fallback.length)throw Error('Configure at least one real photo; dummy photos are disabled.');
const config=JSON.parse(await readFile('slideshow/slideshow.config.json','utf8'));
async function atomic(file,data){const temp=file+'.'+process.pid+'.tmp';try{await writeFile(temp,data);await rename(temp,file)}finally{await rm(temp,{force:true})}}
async function stage(files,dest,prefix){
 await mkdir(dest,{recursive:true});
 const names=[];
 for(const source of files){
  const data=await readFile(source);const name=createHash('sha256').update(data).digest('hex')+extname(source).toLowerCase();
  await atomic(resolve(dest,name),data);names.push(prefix+name);
 }
 return names;
}
const book=await stage(collections.book.length?collections.book:fallback,resolve('public/page-photos/configured'),'configured/');
await atomic(resolve('public/page-photos/manifest.json'),JSON.stringify({photos:book}));
console.log('[site photos] book',book.length);
for(const s of scenes.slice(1)){
 const files=collections[s].length?collections[s]:fallback.slice(0,s==='slideshow'?(config.photos?.count??8):24);
 const photos=await stage(files,resolve('slideshow/public/configured-photos',s),'./configured-photos/'+s+'/');
 await atomic(resolve('slideshow/public',s==='slideshow'?'slides.json':s+'-photos.json'),JSON.stringify({photos,config},null,2));
 console.log('[site photos]',s,photos.length,collections[s].length?'configured':'real-photo fallback');
}
