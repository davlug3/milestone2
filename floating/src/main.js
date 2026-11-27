import {browserAssets as assets} from "../../src/rendering/sceneAssets.ts";
import {createSceneRenderer} from "../../src/rendering/sceneRenderer.ts";
import {geometrySession} from "../../src/rendering/geometrySession.ts";
import {BlenderExport} from "../../src/rendering/blenderExport.ts";
import {UnrealBloomPass} from "three/addons/postprocessing/UnrealBloomPass.js";
import {visualStyle,addStyleControl,LUXURY} from "../../src/rendering/visualStyle.ts";
import * as THREE from "three";
import {PhysicalCamera,PhysicalSpotLight,WebGLPathTracer,GradientEquirectTexture} from "three-gpu-pathtracer";
import {EffectComposer} from "three/addons/postprocessing/EffectComposer.js";
import {RenderPass} from "three/addons/postprocessing/RenderPass.js";
import {OutputPass} from "three/addons/postprocessing/OutputPass.js";
import {createPhoto,shapeFor,printTexture} from "../../slideshow/src/photoDeform.js";
import {random} from "../../slideshow/src/pose.js";
import {PlaybackClock,createPlaybackControls} from "../../src/playback/transport.ts";
import {bindPreviewViewport} from "../../src/playback/viewport.ts";
import {browserQuality,QUALITY_PROFILES,qualityOptions,changeQuality,DEFAULT_OUTPUT} from "../../src/rendering/quality.ts";
import {loadingStage,loadingReady,loadingFailed} from "../../src/playback/loading.ts";
import {createRenderPasses} from "../../src/rendering/renderPasses.ts";
import {makeLayout,floatPose,memoryCamera,SECONDS} from "./motion.js";
const query=new URLSearchParams(location.search),exportMode=query.has("export"),qualityName=browserQuality(query),profile=QUALITY_PROFILES[qualityName];
const style=visualStyle(query),luxury=style==="luxury";
async function boot(){
 await new Promise(r=>requestAnimationFrame(r));loadingStage("Building floating memories…");
 const renderer=createSceneRenderer(new URLSearchParams(location.search).has("geometry-export"),{antialias:true,preserveDrawingBuffer:exportMode,powerPreference:"high-performance"});
 renderer.setPixelRatio(exportMode?1:Math.min(devicePixelRatio||1,profile.dpr));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=luxury?.99:.94;document.body.prepend(renderer.domElement);
 const scene=new THREE.Scene();scene.background=new THREE.Color(luxury?0x0c1c17:0x0e171a);scene.fog=new THREE.FogExp2(luxury?0x0c1c17:0x0e171a,luxury?.095:.065);
 const camera=new PhysicalCamera(39.6,16/9,.035,150);camera.filmGauge=36;camera.setFocalLength(50);camera.bokehSize=0;camera.focusDistance=1.1;
 const env=new GradientEquirectTexture(128);env.topColor.set(0xb4c2d2);env.bottomColor.set(0x33241b);env.update();scene.environment=env;scene.environmentIntensity=.31;
 const composer=query.has("geometry-export")?null:new EffectComposer(renderer);if(composer){composer.addPass(new RenderPass(scene,camera));if(luxury)composer.addPass(new UnrealBloomPass(new THREE.Vector2(1,1),.18,.45,.85));composer.addPass(new OutputPass());}let postError="";
 const manifest=await assets.json("../slideshow/floating-photos.json");if(!manifest.photos.length)throw Error("No photos");
 const count=manifest.photos.length,duration=count*SECONDS,clock=new PlaybackClock(duration,1),layout=makeLayout(count),cards=[],photoMeshes=new Set();
 const config={width:.46,depth:.322,thickness:.00065,flight:1.25,settle:.85},materials=[];
 const back=new THREE.MeshStandardMaterial({color:0xe9dfce,roughness:.92}),edge=new THREE.MeshStandardMaterial({color:0xdacdb8,roughness:.86});
 for(let i=0;i<count;i++){
  loadingStage("Loading memories…",i,count);const source=await assets.image(assets.resolve(manifest.photos[i],assets.resolve("../slideshow/")));
  const tex=printTexture(source,config,renderer.capabilities.getMaxAnisotropy(),profile.photoWidth,assets);
  materials.push(new THREE.MeshPhysicalMaterial({map:tex,roughness:luxury?.39:.55,clearcoat:luxury?.30:.15,clearcoatRoughness:luxury?.32:.44}));
 }
 // True front/back/edge paper surfaces. The rest shape comes from the shared tabletop print geometry.
 // Free-flight deformation is a small deterministic flex field around its curved rest shape.
 for(let i=0;i<layout.length;i++){
  const spec=layout[i],card=createPhoto(config,shapeFor(27,i),{front:materials[spec.photo],back,edge}),pivot=new THREE.Group();
  card.rotation.x=Math.PI/2; // +Y print face rotates toward the camera at +Z; local +Z becomes -Y.
  pivot.add(card);pivot.scale.setScalar(spec.scale);scene.add(pivot);card.name="Memory "+(i+1);
  const surfaces=card.children.map(mesh=>{photoMeshes.add(mesh);mesh.name=card.name+" "+(mesh===card.children[0]?"front":mesh===card.children[1]?"back":"edge");return {geometry:mesh.geometry,rest:mesh.geometry.attributes.position.array.slice()};});
  cards.push({spec,pivot,surfaces});
 }
 // A sparse constellation of gold dust, modeled as small emissive spheres, shared geometry/material.
 const rng=random(821),dustGeo=new THREE.SphereGeometry(.0045,6,4),dustMat=new THREE.MeshStandardMaterial({color:0xbca67b,emissive:0xa77a39,emissiveIntensity:luxury?.55:.32,roughness:.5});
 const dust=[];
 for(let i=0;i<count*18;i++){const o=new THREE.Mesh(dustGeo,dustMat);const base={x:(rng()-.5)*3.4,y:.35+rng()*2.2,z:-rng()*(count*1.35+1.5),phase:rng()*6.283};o.scale.setScalar(.35+rng()*.85);scene.add(o);dust.push({o,...base});}
 const key=new PhysicalSpotLight(luxury?LUXURY.key:0xffe4bb,luxury?10.5:9,8,Math.PI/3,.92,2);key.radius=.50;scene.add(key,key.target);
 const fill=new THREE.DirectionalLight(luxury?LUXURY.fill:0xb1cbff,luxury?.55:.75);fill.position.set(-2,2,1);scene.add(fill);
 const rim=new PhysicalSpotLight(luxury?LUXURY.rim:0xffc48c,luxury?7.5:6,7,Math.PI/3,.8,2);rim.radius=.25;scene.add(rim,rim.target);
 scene.add(new THREE.HemisphereLight(0xc8d5e7,0x433125,.35));
 let tracer=null,mode="raster",dirty=true,target=profile.preview.samples,traceError="";
 function setMode(m){mode=m;target=m==="cinematic"?profile.cinematic.samples:profile.preview.samples;dirty=true;traceError="";controls.mode.value=m;}
 function traceDraw(){if(!tracer){if(!renderer.extensions.has("EXT_color_buffer_float"))throw Error("Floating point render targets unavailable");tracer=new WebGLPathTracer(renderer);tracer.textureSize.set(profile.atlas,profile.atlas);tracer.renderDelay=0;tracer.minSamples=1;tracer.fadeDuration=0;tracer.tiles.set(profile.tiles,profile.tiles);}if(dirty){const q=mode==="cinematic"||exportMode?profile.cinematic:profile.preview;tracer.bounces=q.bounces;tracer.renderScale=exportMode?1:q.scale;tracer.setScene(scene,camera);tracer.reset();dirty=false;}tracer.pausePathTracing=tracer.samples>=target;tracer.renderSample();controls.setFrameProgress({phase:"Accumulating samples",samples:tracer.samples,target});}
 function beauty(){if(mode==="cinematic"||mode==="raytrace"&&!clock.playing){try{traceDraw();return;}catch(e){setMode("raster");traceError=String(e);}}if(!postError){try{composer.render();}catch(e){postError=String(e);renderer.render(scene,camera);}}else renderer.render(scene,camera);controls.setFrameProgress({phase:"Real-time",ready:true});controls.samples.textContent=traceError||postError;}
 const controls=createPlaybackControls({modes:[{value:"raster",label:"Real-time"},{value:"raytrace",label:"Ray-traced preview"},{value:"cinematic",label:"Cinematic"}],quality:{value:qualityName,options:qualityOptions(),onChange:changeQuality},onToggle:()=>{if(clock.time>=duration)seek(0);clock.setPlaying(!clock.playing);controls.sync(clock);},onRestart:()=>{seek(0);clock.setPlaying(true);},onSeek:t=>{clock.setPlaying(false);seek(t);},onMode:m=>{clock.setPlaying(false);setMode(m);draw();},hidden:exportMode});
 const passes=createRenderPasses(renderer,scene,camera,mesh=>photoMeshes.has(mesh),beauty);addStyleControl(controls.ui,style);passes.addUI(controls.ui,()=>{clock.setPlaying(false);dirty=true;draw();});
 function draw(){if(query.has("geometry-export"))return;if(passes.pass==="beauty")beauty();else{passes.render();controls.setFrameProgress({phase:"Render pass · "+passes.pass,ready:true});}}
 function seek(t,fromTick=false){if(!fromTick)clock.seek(t);t=clock.time;
  for(const {spec,pivot,surfaces} of cards){const p=floatPose(spec,t);pivot.position.set(p.x,p.y,p.z);pivot.rotation.set(p.pitch,p.yaw,p.roll,"YXZ");
   for(const {geometry,rest} of surfaces){const a=geometry.attributes.position;for(let k=0;k<a.count;k++){const x=rest[k*3],y=rest[k*3+1],z=rest[k*3+2],u=x/config.width*2,v=z/config.depth*2;const flex=.0027*Math.sin(t*1.8+spec.phase+u*1.7)*u*u+.0019*Math.sin(t*2.4+spec.phase-v*2.1)*v*v+.0012*Math.sin(t*1.1+spec.phase)*u*v;a.setXYZ(k,x,y+flex,z);}a.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingSphere();}
  }
  for(const d of dust)d.o.position.set(d.x+.05*Math.sin(t*.4+d.phase),d.y+.07*Math.sin(t*.37+d.phase),d.z+.025*Math.cos(t*.5+d.phase));
  const p=memoryCamera(t,count,layout);camera.position.set(p.x,p.y,p.z);camera.lookAt(p.targetX,p.targetY,p.targetZ);camera.rotateZ(p.roll);camera.focusDistance=camera.position.distanceTo(new THREE.Vector3(p.targetX,p.targetY,p.targetZ));
  key.position.set(p.targetX-.9,p.targetY+1.2,p.targetZ+1.25);key.target.position.set(p.targetX,p.targetY,p.targetZ);rim.position.set(p.targetX+.8,p.targetY+.75,p.targetZ-.75);rim.target.position.copy(key.target.position);
  dirty=true;draw();controls.sync(clock);
 }
 function resize(w,h){renderer.setSize(w,h,false);composer?.setSize(w,h);camera.aspect=w/h;camera.setFocalLength(50);camera.updateProjectionMatrix();seek(clock.time);}
 if(exportMode){resize(innerWidth,innerHeight);addEventListener("resize",()=>resize(innerWidth,innerHeight));}else bindPreviewViewport(renderer.domElement,controls.ui,resize,false,DEFAULT_OUTPUT.aspect);
 seek(0);loadingReady();
 const blenderExport=new BlenderExport(scene,camera);
 window.__floating={captureProduction:t=>{clock.setPlaying(false);passes.setPass("beauty");setMode("raster");seek(t);return {beauty:renderer.domElement.toDataURL("image/png"),depth:passes.captureDepth32()};},...geometrySession(t=>{clock.setPlaying(false);seek(t);},blenderExport),duration,count,totalPrints:cards.length,seek:t=>{clock.setPlaying(false);seek(t);},capture:t=>{clock.setPlaying(false);passes.setPass("beauty");setMode("raster");seek(t);return renderer.domElement.toDataURL("image/png");},beginTrace:(t,samples)=>{clock.setPlaying(false);passes.setPass("beauty");setMode("raytrace");target=samples;seek(t);},traceStep:()=>{if(mode!=="raytrace")throw Error(traceError||"Ray tracing unavailable");traceDraw();return {samples:tracer.samples,target};},traceCapture:()=>{if(!tracer||dirty||tracer.samples<target)throw Error("Frame not ready");return renderer.domElement.toDataURL("image/png");},capturePass:(t,pass)=>{clock.setPlaying(false);const old=passes.pass;passes.setPass(pass);seek(t);const png=renderer.domElement.toDataURL("image/png");passes.setPass(old);return png;},passIds:()=>passes.idMap(),setPass:value=>{passes.setPass(value);draw();},cameraStatus:()=>({focalLength:camera.getFocalLength(),fStop:null,bokehSize:camera.bokehSize,depthOfField:false,focusDistance:camera.focusDistance})};
 if(!exportMode){function tick(now){if(clock.tick(now,passes.pass!=="beauty"||mode!=="cinematic"||(!dirty&&tracer&&tracer.samples>=target),mode==="cinematic"&&passes.pass==="beauty"?1/60:undefined))seek(clock.time,true);else if(passes.pass==="beauty"&&(mode==="cinematic"||mode==="raytrace"&&!clock.playing))draw();controls.sync(clock);requestAnimationFrame(tick);}requestAnimationFrame(tick);}
}
boot().catch(e=>{loadingFailed(e);window.__floatingError=String(e);document.getElementById("error").textContent=String(e);console.error(e);});
