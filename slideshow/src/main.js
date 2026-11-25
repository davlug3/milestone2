import { frameLaunches } from "./frameLaunches.js";
import { loadingStage, loadingReady, loadingFailed } from "../../src/playback/loading.ts";
import { bindPreviewViewport, previewPixelRatio, fitVerticalFov } from "../../src/playback/viewport.ts";
import { TRACE_QUALITY } from "../../src/rendering/quality.ts";
import { PlaybackClock, createPlaybackControls } from "../../src/playback/transport.ts";
import * as THREE from "three";
import { PhysicalSpotLight, WebGLPathTracer, GradientEquirectTexture } from "three-gpu-pathtracer";
import { makeShots,pose,duration,cameraPose,random } from "./pose.js";
import { shapeFor,printTexture,createPhoto,placePhoto } from "./photoDeform.js";
const q=new URLSearchParams(location.search),exportMode=q.has("export");
if(exportMode)document.body.classList.add("export");
loadingStage("Initializing WebGL renderer…");
// Paint the HTML loading screen before building procedural textures.
async function boot(){
await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:exportMode,powerPreference:"high-performance"});
renderer.setPixelRatio(previewPixelRatio(exportMode));
renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.86;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color(0x1d150f);
const camera=new THREE.PerspectiveCamera(exportMode?40:fitVerticalFov(40,innerWidth/innerHeight),innerWidth/innerHeight,.02,8);
const key=new PhysicalSpotLight(0xffe3c7,3.6,4,Math.PI/3,.95,2);
key.radius=.48;key.position.set(-.55,.94,.30);key.target.position.set(0,0,0);key.castShadow=true;key.shadow.mapSize.set(2048,2048);
key.shadow.camera.near=.08;key.shadow.camera.far=3;key.shadow.radius=5;key.shadow.blurSamples=16;key.shadow.bias=-.00004;key.shadow.normalBias=.0003;scene.add(key,key.target);
const fill=new THREE.DirectionalLight(0xd8e5ff,.48);fill.position.set(.8,.85,-.6);scene.add(fill);
const rim=new THREE.DirectionalLight(0xffe8d0,.12);rim.position.set(.1,.6,-.8);scene.add(rim);
scene.add(new THREE.HemisphereLight(0xffecd8,0x66503e,.34));
const environment=new GradientEquirectTexture(128);environment.topColor.set(0x9ca8c4);environment.bottomColor.set(0x27190f);environment.update();
scene.environment=environment;scene.environmentIntensity=.27;
let tracer=null,mode="raster",traceDirty=true,traceError="",target=TRACE_QUALITY.preview.samples;

function setMode(value){mode=value;target=value==="cinematic"?TRACE_QUALITY.cinematic.samples:TRACE_QUALITY.preview.samples;controls.mode.value=value;traceDirty=true;traceError="";controls.samples.textContent="";}
function traceDraw(){
  if(!tracer){
    if(!renderer.extensions.has("EXT_color_buffer_float"))throw Error("GPU lacks float render targets");
    tracer=new WebGLPathTracer(renderer);tracer.textureSize.set(1024,1024);tracer.bounces=5;tracer.renderDelay=0;tracer.fadeDuration=0;tracer.minSamples=1;tracer.tiles.set(1,1);
  }
  if(traceDirty){const quality=mode==="cinematic"?TRACE_QUALITY.cinematic:TRACE_QUALITY.preview;tracer.bounces=quality.bounces;tracer.renderScale=exportMode?1:quality.scale;tracer.pausePathTracing=false;tracer.setScene(scene,camera);tracer.reset();traceDirty=false;tracer.renderSample();controls.setFrameProgress({phase:tracer.samples>=target?"Frame complete":tracer.samples>0?"Accumulating samples":"Preparing first sample",samples:tracer.samples,target});return;}
  tracer.pausePathTracing=tracer.samples>=target;tracer.renderSample();
  controls.setFrameProgress({phase:tracer.samples>=target?"Frame complete":tracer.samples>0?"Accumulating samples":"Preparing first sample",samples:tracer.samples,target});
}
function draw(){
  if(mode==="cinematic"||(mode==="raytrace"&&!playback.playing)){try{traceDraw();return;}catch(e){setMode("raster");traceError=String(e);controls.samples.textContent="Ray tracing failed: "+String(e);}}
  renderer.render(scene,camera);
  controls.setFrameProgress({phase:mode==="raytrace"?"Real-time playback · pause to trace":"Frame render · Real-time",ready:true});
}

function walnut(){
  const n=1024,c=document.createElement("canvas");c.width=c.height=n;const ctx=c.getContext("2d"),im=ctx.createImageData(n,n),r=random(91);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const plank=Math.floor(y/(n/5)),v=y/(n/5)-plank;
    const warp=4*Math.sin(x*.008+plank*2)+2*Math.sin(x*.021+y*.014);
    const grain=Math.sin(y*.32+warp)*.12+Math.sin(y*1.43+warp)*.045+(r()-.5)*.075;
    const seam=Math.min(v,1-v)<.008?.53:1;
    const t=(.84+grain+.12*Math.sin(plank*2.2)+.08*Math.sin(x*.004+y*.008))*seam;
    const i=(y*n+x)*4;im.data[i]=120*t;im.data[i+1]=77*t;im.data[i+2]=43*t;im.data[i+3]=255;
  }
  ctx.putImageData(im,0,0);const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=renderer.capabilities.getMaxAnisotropy();return tex;
}
const wood=walnut(),table=new THREE.Mesh(new THREE.PlaneGeometry(2.2,1.6),new THREE.MeshStandardMaterial({map:wood,color:new THREE.Color().setScalar(.82),roughness:.78}));
table.rotation.x=-Math.PI/2;table.receiveShadow=true;scene.add(table);
const loader=new THREE.TextureLoader(),cards=[];
const paper=new THREE.MeshPhysicalMaterial({color:0xf4eee3,roughness:.82,sheen:.08});
const edge=new THREE.MeshStandardMaterial({color:0xe1d8c9,roughness:.9});
let shots=[],total=0,clock=0;
const playback=new PlaybackClock(0);
const controls=createPlaybackControls({modes:[{value:"raster",label:"Real-time"},{value:"raytrace",label:"Ray-traced preview"},{value:"cinematic",label:"Cinematic"}],onToggle:()=>play(!playback.playing),onRestart:()=>{update(0);play(true);},onSeek:t=>{play(false);update(t);},onMode:m=>{play(false);setMode(m);draw();},hidden:exportMode});
controls.sync(playback);

function update(t,fromTick=false){
  clock=fromTick?playback.time:playback.seek(t);
  const p=cameraPose(clock);camera.position.set(p.x,p.y,p.z);camera.lookAt(p.targetX,0,p.targetZ);camera.rotateZ(p.roll);
  for(let i=0;i<cards.length;i++){
    const card=cards[i],s=pose(shots[i],clock);card.visible=s.visible;if(!s.visible)continue;
    placePhoto(card,s,shots[i],clock,cards.slice(0,i));
  }
  traceDirty=true;draw();controls.sync(playback);
}
function play(value){if(value&&clock>=total)update(0);playback.setPlaying(value);controls.sync(playback);}
function resizeScene(w,h){camera.aspect=w/h;camera.fov=exportMode?40:fitVerticalFov(40,camera.aspect);camera.updateProjectionMatrix();frameLaunches(shots,camera);renderer.setSize(w,h,false);update(clock);}
bindPreviewViewport(renderer.domElement,controls.ui,resizeScene,exportMode);
if(exportMode)addEventListener("resize",()=>resizeScene(innerWidth,innerHeight));
async function init(){
  loadingStage("Downloading photo manifest…");
  const response=await fetch("./slides.json",{signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error("Missing slides.json; run npm run build or npm run dev");
  const manifest=await response.json();if(!manifest.photos.length)throw Error("No photos found");
  shots=makeShots(manifest.photos.length,manifest.config);frameLaunches(shots,camera);total=duration(shots);playback.duration=total;controls.sync(playback);
  loadingStage("Loading photo prints…",0,manifest.photos.length);
  for(let i=0;i<manifest.photos.length;i++){
    const c=shots[i].config;
    let timer;const source=await Promise.race([loader.loadAsync(manifest.photos[i]),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error("Photo "+(i+1)+" failed to load in time")),20000);})]).finally(()=>clearTimeout(timer));
    const tex=printTexture(source.image,c,renderer.capabilities.getMaxAnisotropy());source.dispose();
    const front=new THREE.MeshPhysicalMaterial({map:tex,roughness:.43,clearcoat:.22,clearcoatRoughness:.46});
    const card=createPhoto(c,shapeFor(c.seed,i),{front,back:paper,edge});
    scene.add(card);cards.push(card);loadingStage("Loading photo prints…",i+1,manifest.photos.length);
  }
  loadingStage("Rendering first frame…");
  await new Promise(resolve=>requestAnimationFrame(resolve));
  update(0);
  loadingReady();
  window.__slideshow={duration:total,count:cards.length,seek:t=>{play(false);update(t);},capture:t=>{play(false);setMode("raster");update(t);return renderer.domElement.toDataURL("image/png");},beginTrace:(t,samples)=>{play(false);setMode("raytrace");target=samples;update(t);},traceStep:()=>{if(mode!=="raytrace")throw Error(traceError||"Ray tracer unavailable");traceDraw();return {samples:traceDirty?0:tracer.samples,target};},traceCapture:()=>{if(mode!=="raytrace"||traceDirty||tracer.samples<target)throw Error("Frame not ready");return renderer.domElement.toDataURL("image/png");},gpu:()=>{const gl=renderer.getContext(),ext=gl.getExtension("WEBGL_debug_renderer_info");return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);}};
  if(!exportMode){function tick(now){if(playback.tick(now,mode!=="cinematic"||(!traceDirty&&tracer&&tracer.samples>=target),mode==="cinematic"?1/60:undefined))update(playback.time,true);else if(mode==="cinematic"||(!playback.playing&&mode==="raytrace"))draw();controls.sync(playback);requestAnimationFrame(tick);}requestAnimationFrame(tick);}
}
await init();
}
boot().catch(e=>{loadingFailed(e);document.querySelector("#error").textContent=String(e);window.__slideshowError=String(e);console.error(e);});
