import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {createReadStream,statSync,mkdirSync,writeFileSync,renameSync,existsSync} from 'node:fs';
import {resolve,extname,sep,join} from 'node:path';
import {floatTiff,readFloatTiff} from './float-tiff.mjs';
const {root,output,exe,scenes,width,height,fps,duration,headless}=JSON.parse(process.argv[2]);
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.avif':'image/avif'};
const server=createServer((req,res)=>{try{let p=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(p.endsWith('/'))p+='index.html';const f=resolve(root,'.'+p);if(!f.startsWith(root+sep)||!statSync(f).isFile())throw Error();res.writeHead(200,{'Content-Type':types[extname(f)]||'application/octet-stream'});createReadStream(f).on('error',()=>res.destroy()).pipe(res);}catch{res.writeHead(404).end();}});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
let browser;
function save(path,data){writeFileSync(path+'.tmp',data);renameSync(path+'.tmp',path);}
try{
 browser=await chromium.launch({executablePath:exe,headless,args:['--enable-gpu','--ignore-gpu-blocklist','--use-angle=d3d11','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']});
 for(const scene of scenes){
  const canvas2d=scene==='slideshow2d',beautyOnly=scene==='title'||scene==='photowall'||canvas2d,vectorMode=scene==='earth',pass=vectorMode?'vectors':'depth';const dest=output[scene];if(existsSync(dest))throw Error('Output already exists: '+dest);mkdirSync(join(dest,'beauty'),{recursive:true});if(!beautyOnly)mkdirSync(join(dest,pass),{recursive:true});
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});page.on('pageerror',e=>console.error('[browser]',e.message));
  const api=scene==='book'?'__demo':'__'+scene;
  await page.goto('http://127.0.0.1:'+server.address().port+'/'+scene+'/?export&quality=high&style=luxury',{waitUntil:'networkidle',timeout:120000});
  await page.waitForFunction(api=>typeof window[api]?.captureProduction==='function',api,{timeout:120000});
  if(scene==='book')await page.waitForFunction(()=>{const p=window.__demo.photoStatus();return p.loadedFaces+p.failedFaces>=p.totalFaces&&window.__demo.simulationCache().ready;},null,{timeout:180000});
  const info=canvas2d?await page.evaluate(api=>({duration:window[api].duration,gpu:'Canvas 2D',float:false}),api):await page.evaluate(api=>{const gl=document.querySelector('canvas').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return {duration:window[api].duration,gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),float:!!gl.getExtension('EXT_color_buffer_float')};},api);
  if(!canvas2d&&((!beautyOnly&&!info.float)||/swiftshader|llvmpipe|software raster|basic render driver|warp/i.test(info.gpu)))throw Error('Hardware float32 GPU required: '+JSON.stringify(info));
  const count=Math.ceil(Math.min(info.duration,duration??info.duration)*fps);if(!Number.isFinite(count)||count<1)throw Error('Invalid duration');
  console.log('[realtime]',scene,info.gpu,count,'frames');
  const start=performance.now();let near,far,depthSamples;
  for(let i=0;i<count;i++){
   const result=await page.evaluate(({api,t,dt})=>window[api].captureProduction(t,dt),{api,t:i/fps,dt:1/fps});
   const {beauty}=result,depth=result[pass];
   if(!beautyOnly){
   if(depth.width!==width||depth.height!==height)throw Error('Wrong framebuffer size');
   const raw=Buffer.from(depth.base64,'base64'),channels=vectorMode?3:1;if(raw.length!==width*height*4*channels)throw Error('Missing float pixels');
   near=depth.near;far=depth.far;depthSamples=depth.samples;
   if(depthSamples!==1)throw Error('Expected single-sample data pass');
   let hits=0,min=Infinity,max=-Infinity;
   for(let j=0;j<raw.length;j+=channels*4){
    const x=raw.readFloatLE(j);
    if(!Number.isFinite(x))throw Error('Invalid float sample');
    if(vectorMode){const y=raw.readFloatLE(j+4),valid=raw.readFloatLE(j+8);if(!Number.isFinite(y)||![0,1].includes(valid))throw Error('Invalid motion vector');if(valid){hits++;min=Math.min(min,x,y);max=Math.max(max,x,y);}}
    else{if(x<0)throw Error('Invalid depth');if(x>0){hits++;min=Math.min(min,x);max=Math.max(max,x);}}
   }
   if(!hits||(!vectorMode&&max<=min))throw Error('Empty or constant data pass');
   const file=floatTiff(raw,width,height,channels);
   if(i===0||i===count-1){const decoded=readFloatTiff(file);if(!decoded.raw.equals(raw)||decoded.channels!==channels)throw Error('Float TIFF roundtrip mismatch');console.log('['+pass+']',scene,i,'range',min,max,'hits',hits,'bytes',file.length);}
   save(join(dest,pass,'frame-'+String(i).padStart(6,'0')+'.tif'),file);
   }
   const png=Buffer.from(beauty.split(',')[1],'base64');
   if(png.length<33||png.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||png.toString('ascii',12,16)!=='IHDR'||png.readUInt32BE(16)!==width||png.readUInt32BE(20)!==height||png[24]!==8||![2,6].includes(png[25]))throw Error('Invalid beauty PNG');
   save(join(dest,'beauty','frame-'+String(i).padStart(6,'0')+'.png'),png);
   if(i===0||i%24===23||i===count-1)console.log('[realtime]',scene,i+1,'/',count,'seconds/frame',((performance.now()-start)/1000/(i+1)).toFixed(3));
  }
  save(join(dest,'media.json'),JSON.stringify({scene,engine:canvas2d?'canvas-2d':'webgl-raster',gpu:info.gpu,width,height,fps,count,passes:beautyOnly?['beauty']:['beauty',pass],beauty:{file:'beauty/frame-%06d.png',format:'PNG',bitDepth:8,color:'sRGB'},...(beautyOnly?{}:vectorMode?{vectors:{file:'vectors/frame-%06d.tif',format:'TIFF',sampleFormat:'IEEE float32',channels:3,compression:'Deflate',units:'pixels/frame',direction:'forward',channelMeaning:['signed X right','signed Y down','validity'],surface:'opaque Earth geometry only',antialias:{method:'none',samples:1}}}:{depth:{file:'depth/frame-%06d.tif',format:'TIFF',sampleFormat:'IEEE float32',channels:1,compression:'Deflate',units:'meters',meaning:'linear camera-space axial Z',noHit:0,near,far,antialias:{method:'none',samples:depthSamples}}}),secondsPerFrame:(performance.now()-start)/1000/count},null,2));
  console.log('[realtime] VERIFIED',scene,dest);await page.close();
 }
}finally{await browser?.close();server.close();}
