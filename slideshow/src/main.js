import {browserAssets as assets} from "../../src/rendering/sceneAssets.ts";
import {createSceneRenderer} from "../../src/rendering/sceneRenderer.ts";
import {geometrySession} from "../../src/rendering/geometrySession.ts";
import {BlenderExport} from "../../src/rendering/blenderExport.ts";
import {visualStyle,addStyleControl,LUXURY} from "../../src/rendering/visualStyle.ts";
import {createRenderPasses} from "../../src/rendering/renderPasses.ts";
import { frameLaunches } from "./frameLaunches.js";
import { loadingStage, loadingReady, loadingFailed } from "../../src/playback/loading.ts";
import { bindPreviewViewport, previewPixelRatio, fitVerticalFov } from "../../src/playback/viewport.ts";
import { browserQuality,QUALITY_PROFILES,qualityOptions,changeQuality } from "../../src/rendering/quality.ts";
import { PlaybackClock, createPlaybackControls } from "../../src/playback/transport.ts";
import * as THREE from "three";
import { PhysicalSpotLight, WebGLPathTracer, GradientEquirectTexture } from "three-gpu-pathtracer";
import { makeShots,pose,duration,cameraPose,random } from "./pose.js";
import { shapeFor,printTexture,createPhoto,placePhoto } from "./photoDeform.js";
const q=new URLSearchParams(location.search),exportMode=q.has("export");
const qualityName=browserQuality(q),profile=QUALITY_PROFILES[qualityName];
if(exportMode)document.body.classList.add("export");
loadingStage("Initializing WebGL renderer…");
// Paint the HTML loading screen before building procedural textures.
async function boot(){
await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
const renderer=createSceneRenderer(new URLSearchParams(location.search).has("geometry-export"),{antialias:true,preserveDrawingBuffer:exportMode,powerPreference:"high-performance"});
renderer.setPixelRatio(exportMode?1:Math.min(devicePixelRatio||1,profile.dpr));
renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;
const style=visualStyle(),luxury=style==="luxury";
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=luxury?.91:.86;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color(luxury?0x111b16:0x1d150f);
const camera=new THREE.PerspectiveCamera(exportMode?40:fitVerticalFov(40,innerWidth/innerHeight),innerWidth/innerHeight,.02,8);
const key=new PhysicalSpotLight(luxury?LUXURY.key:0xffe3c7,luxury?4.0:3.6,4,Math.PI/3,.95,2);
key.radius=.48;key.position.set(-.55,.94,.30);key.target.position.set(0,0,0);key.castShadow=true;key.shadow.mapSize.set(2048,2048);
key.shadow.camera.near=.08;key.shadow.camera.far=3;key.shadow.radius=5;key.shadow.blurSamples=16;key.shadow.bias=-.00004;key.shadow.normalBias=.0003;scene.add(key,key.target);
const fill=new THREE.DirectionalLight(luxury?LUXURY.fill:0xd8e5ff,luxury?.35:.48);fill.position.set(.8,.85,-.6);scene.add(fill);
const rim=new THREE.DirectionalLight(luxury?LUXURY.rim:0xffe8d0,luxury?.28:.12);rim.position.set(.1,.6,-.8);scene.add(rim);
scene.add(new THREE.HemisphereLight(0xffecd8,luxury?0x35473b:0x66503e,luxury?.27:.34));
const environment=new GradientEquirectTexture(128);environment.topColor.set(0x9ca8c4);environment.bottomColor.set(luxury?0x19251c:0x27190f);environment.update();
scene.environment=environment;scene.environmentIntensity=.27;
let tracer=null,mode="raster",traceDirty=true,traceError="",target=profile.preview.samples;

function setMode(value){mode=value;target=value==="cinematic"?profile.cinematic.samples:profile.preview.samples;controls.mode.value=value;traceDirty=true;traceError="";controls.samples.textContent="";}
function traceDraw(){
  if(!tracer){
    if(!renderer.extensions.has("EXT_color_buffer_float"))throw Error("GPU lacks float render targets");
    tracer=new WebGLPathTracer(renderer);tracer.textureSize.set(profile.atlas,profile.atlas);tracer.bounces=5;tracer.renderDelay=0;tracer.fadeDuration=0;tracer.minSamples=1;tracer.tiles.set(profile.tiles,profile.tiles);
  }
  if(traceDirty){const quality=exportMode||mode==="cinematic"?profile.cinematic:profile.preview;tracer.bounces=quality.bounces;tracer.renderScale=exportMode?1:quality.scale;tracer.pausePathTracing=false;tracer.setScene(scene,camera);tracer.reset();traceDirty=false;tracer.renderSample();controls.setFrameProgress({phase:tracer.samples>=target?"Frame complete":tracer.samples>0?"Accumulating samples":"Preparing first sample",samples:tracer.samples,target});return;}
  tracer.pausePathTracing=tracer.samples>=target;tracer.renderSample();
  controls.setFrameProgress({phase:tracer.samples>=target?"Frame complete":tracer.samples>0?"Accumulating samples":"Preparing first sample",samples:tracer.samples,target});
}
function beautyDraw(){
  if(mode==="cinematic"||(mode==="raytrace"&&!playback.playing)){try{traceDraw();return;}catch(e){setMode("raster");traceError=String(e);controls.samples.textContent="Ray tracing failed: "+String(e);}}
  renderer.render(scene,camera);
  controls.setFrameProgress({phase:mode==="raytrace"?"Real-time playback · pause to trace":"Frame render · Real-time",ready:true});
}

function draw(){if(new URLSearchParams(location.search).has("geometry-export"))return;if(passes.pass==="beauty")beautyDraw();else{passes.render();controls.setFrameProgress({phase:"Render pass · "+passes.pass,ready:true});}}
function walnut(){
  const n=profile.woodSize,c=assets.canvas();c.width=c.height=n;const ctx=c.getContext("2d"),im=ctx.createImageData(n,n),r=random(91);
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
const wood=walnut(),table=new THREE.Mesh(new THREE.PlaneGeometry(2.2,1.6),new THREE.MeshStandardMaterial({map:wood,color:new THREE.Color().setScalar(luxury?.66:.82),roughness:luxury?.68:.78}));
table.rotation.x=-Math.PI/2;table.receiveShadow=true;scene.add(table);
const cards=[];
const paper=new THREE.MeshPhysicalMaterial({color:0xf4eee3,roughness:.82,sheen:.08});
const edge=new THREE.MeshStandardMaterial({color:0xe1d8c9,roughness:.9});
let shots=[],total=0,clock=0;
const playback=new PlaybackClock(0);
const controls=createPlaybackControls({quality:{value:qualityName,options:qualityOptions(),onChange:changeQuality},modes:[{value:"raster",label:"Real-time"},{value:"raytrace",label:"Ray-traced preview"},{value:"cinematic",label:"Cinematic"}],onToggle:()=>play(!playback.playing),onRestart:()=>{update(0);play(true);},onSeek:t=>{play(false);update(t);},onMode:m=>{play(false);setMode(m);draw();},hidden:exportMode});
const passes=createRenderPasses(renderer,scene,camera,mesh=>cards.some(card=>mesh.parent===card),beautyDraw);addStyleControl(controls.ui,style);passes.addUI(controls.ui,()=>{play(false);traceDirty=true;draw();});
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
  const manifest=await assets.json("./slides.json");if(!manifest.photos.length)throw Error("No photos found");
  shots=makeShots(manifest.photos.length,manifest.config);frameLaunches(shots,camera);total=duration(shots);playback.duration=total;controls.sync(playback);
  loadingStage("Loading photo prints…",0,manifest.photos.length);
  for(let i=0;i<manifest.photos.length;i++){
    const c=shots[i].config;
    const source=await assets.image(manifest.photos[i]);
    const tex=printTexture(source,c,renderer.capabilities.getMaxAnisotropy(),profile.photoWidth,assets);
    const front=new THREE.MeshPhysicalMaterial({map:tex,roughness:luxury?.36:.43,clearcoat:luxury?.31:.22,clearcoatRoughness:luxury?.35:.46});
    const card=createPhoto(c,shapeFor(c.seed,i),{front,back:paper,edge});
    scene.add(card);cards.push(card);loadingStage("Loading photo prints…",i+1,manifest.photos.length);
  }
  loadingStage("Rendering first frame…");
  await new Promise(resolve=>requestAnimationFrame(resolve));
  update(0);
  loadingReady();
  const blenderExport=new BlenderExport(scene,camera);
 window.__slideshow={captureProduction:t=>{play(false);passes.setPass("beauty");setMode("raster");update(t);return {beauty:renderer.domElement.toDataURL("image/png"),depth:passes.captureDepth32()};},...geometrySession(t=>{play(false);update(t);},blenderExport),capturePass:(t,pass)=>{play(false);const old=passes.pass;passes.setPass(pass);update(t);const png=renderer.domElement.toDataURL("image/png");passes.setPass(old);return png;},passIds:()=>passes.idMap(),setPass:value=>{passes.setPass(value);draw();},duration:total,count:cards.length,canvas:renderer.domElement,seek:t=>{play(false);update(t);},capture:t=>{play(false);setMode("raster");update(t);return renderer.domElement.toDataURL("image/png");},beginTrace:(t,samples)=>{play(false);setMode("raytrace");target=samples;update(t);},traceStep:()=>{if(mode!=="raytrace")throw Error(traceError||"Ray tracer unavailable");traceDraw();return {samples:traceDirty?0:tracer.samples,target};},traceCapture:()=>{if(mode!=="raytrace"||traceDirty||tracer.samples<target)throw Error("Frame not ready");return renderer.domElement.toDataURL("image/png");},gpu:()=>{const gl=renderer.getContext(),ext=gl.getExtension("WEBGL_debug_renderer_info");return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);}};
  if(!exportMode){function tick(now){if(playback.tick(now,passes.pass!=="beauty"||mode!=="cinematic"||(!traceDirty&&tracer&&tracer.samples>=target),mode==="cinematic"?1/60:undefined))update(playback.time,true);else if(mode==="cinematic"||(!playback.playing&&mode==="raytrace"))draw();controls.sync(playback);requestAnimationFrame(tick);}requestAnimationFrame(tick);}
}
await init();
}
boot().catch(e=>{loadingFailed(e);document.querySelector("#error").textContent=String(e);window.__slideshowError=String(e);console.error(e);});
