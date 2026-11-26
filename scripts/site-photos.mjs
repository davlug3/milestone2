import {mkdir,writeFile,readFile,readdir,copyFile,rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {resolve,extname} from 'node:path';
import {resolvePhotos} from './lib/photo-config.mjs';
const scenes=['book','slideshow','clothesline','floating'];
const collections=Object.fromEntries(await Promise.all(scenes.map(async scene=>[scene,await resolvePhotos(resolve('photos.config.jsonc'),scene)])));
const bookDest=resolve('public/page-photos/configured');
const slideDest=resolve('slideshow/public/configured-photos');
for(const dest of [bookDest,slideDest])await rm(dest,{recursive:true,force:true});
async function stage(files,dest,prefix){
 await mkdir(dest,{recursive:true});
 const names=[];
 for(const [i,source] of files.entries()){
  const name=String(i+1).padStart(5,'0')+extname(source).toLowerCase();
  await copyFile(source,resolve(dest,name));names.push(prefix+name);
 }
 return names;
}
const ids=[10,11,15,16,17,18,19,20,28,29,31,33,37,43,49,57,61,65,73,77,83,84,88,94];
const dir=resolve('public/page-photos');await mkdir(dir,{recursive:true});
const valid=b=>b.length>4&&b[0]===255&&b[1]===216&&b.at(-2)===255&&b.at(-1)===217;
if(!collections.book.length||scenes.slice(1).some(scene=>!collections[scene].length))await Promise.all(ids.map(async id=>{
 const path=resolve(dir,id+'.jpg');
 if(valid(await readFile(path).catch(()=>Buffer.alloc(0))))return;
 try{const r=await fetch('https://picsum.photos/id/'+id+'/640/480',{signal:AbortSignal.timeout(18000)});if(!r.ok)throw Error('HTTP '+r.status);const b=Buffer.from(await r.arrayBuffer());if(!valid(b))throw Error('Invalid JPEG');await writeFile(path,b);}catch(e){console.warn('[site photos]',id,e.message);}
}));
const names=(await readdir(dir)).filter(n=>/^\d+\.jpg$/.test(n));
const bookPhotos=collections.book.length?await stage(collections.book,bookDest,'configured/'):ids.map(id=>id+'.jpg').filter(n=>names.includes(n));
await writeFile(resolve(dir,'manifest.json'),JSON.stringify({photos:bookPhotos}));
if(scenes.slice(1).some(scene=>!collections[scene].length)){
const r=spawnSync(process.execPath,['scripts/photos.mjs'],{cwd:resolve('slideshow'),stdio:'inherit'});if(r.error||r.status!==0)throw Error('Slideshow photo preparation failed');
const file=resolve('slideshow/public/slides.json');
const manifest=JSON.parse(await readFile(file,'utf8'));
// Use the same book photo collection when no local slideshow photos override it.
const local=(await readdir('slideshow/public/photos')).some(n=>/\.(jpe?g|png|webp|avif)$/i.test(n));
if(!local&&names.length){const dest=resolve('slideshow/public/shared-photos');await mkdir(dest,{recursive:true});const chosen=ids.map(id=>id+'.jpg').filter(n=>names.includes(n)).slice(0,manifest.config.photos?.count??8);for(const n of chosen)await copyFile(resolve(dir,n),resolve(dest,n));manifest.photos=chosen.map(n=>'./shared-photos/'+n);await writeFile(file,JSON.stringify(manifest,null,2));}
}
const config=JSON.parse(await readFile('slideshow/slideshow.config.json','utf8'));
const fallback=scenes.slice(1).some(scene=>!collections[scene].length)?JSON.parse(await readFile('slideshow/public/slides.json','utf8')).photos:[];
for(const scene of scenes.slice(1)){
 const photos=collections[scene].length?await stage(collections[scene],resolve(slideDest,scene),'./configured-photos/'+scene+'/'):fallback;
 const filename=scene==='slideshow'?'slides.json':scene+'-photos.json';
 await writeFile(resolve('slideshow/public',filename),JSON.stringify({photos,config},null,2));
 console.log('[site photos]',scene,photos.length);
}
console.log('[site photos] book',bookPhotos.length);
