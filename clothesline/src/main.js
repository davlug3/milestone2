import {browserAssets as assets} from "../../src/rendering/sceneAssets.ts";
import {createSceneRenderer} from "../../src/rendering/sceneRenderer.ts";
import {geometrySession} from "../../src/rendering/geometrySession.ts";
import {BlenderExport} from "../../src/rendering/blenderExport.ts";
import {UnrealBloomPass} from "three/addons/postprocessing/UnrealBloomPass.js";
import {visualStyle,addStyleControl,LUXURY} from "../../src/rendering/visualStyle.ts";
import {createRenderPasses} from "../../src/rendering/renderPasses.ts";
import * as THREE from "three";
import {PhysicalSpotLight,WebGLPathTracer,GradientEquirectTexture} from "three-gpu-pathtracer";
import {EffectComposer} from "three/addons/postprocessing/EffectComposer.js";
import {RenderPass} from "three/addons/postprocessing/RenderPass.js";
import {OutputPass} from "three/addons/postprocessing/OutputPass.js";
import {batchStaticDecorations} from "./staticBatch.js";
import {RoundedBoxGeometry} from "three/addons/geometries/RoundedBoxGeometry.js";
import {printTexture} from "../../slideshow/src/photoDeform.js";
import {random} from "../../slideshow/src/pose.js";
import {PlaybackClock,createPlaybackControls} from "../../src/playback/transport.ts";
import {bindPreviewViewport} from "../../src/playback/viewport.ts";
import {browserQuality,QUALITY_PROFILES,qualityOptions,changeQuality,DEFAULT_OUTPUT} from "../../src/rendering/quality.ts";
import {loadingStage,loadingReady,loadingFailed} from "../../src/playback/loading.ts";
import {DT,SPACING,PHOTO_W,PHOTO_H,THICKNESS,lineY,galleryCamera,makeSheet,resetSheet,stepSheet} from "./physics.js";
const query=new URLSearchParams(location.search),exportMode=query.has("export"),qualityName=browserQuality(query),profile=QUALITY_PROFILES[qualityName];
const style=visualStyle(query),luxury=style==="luxury";
async function boot(){
 await new Promise(r=>requestAnimationFrame(r));loadingStage("Preparing hanging gallery…");
 const renderer=createSceneRenderer(new URLSearchParams(location.search).has("geometry-export"),{antialias:true,preserveDrawingBuffer:exportMode,powerPreference:"high-performance"});
 renderer.setPixelRatio(exportMode?1:Math.min(devicePixelRatio||1,profile.dpr));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=luxury?.93:.95;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;document.body.prepend(renderer.domElement);
 const scene=new THREE.Scene();scene.background=new THREE.Color(luxury?0x10271f:0x343d32);
 const camera=new THREE.PerspectiveCamera(39.6,16/9,.03,35);camera.filmGauge=36;camera.focusDistance=1.05;camera.setFocalLength(50);
 // Pinhole camera: no depth of field in either raster or path-traced rendering.
 const composer=query.has("geometry-export")?null:new EffectComposer(renderer);
 if(composer){composer.addPass(new RenderPass(scene,camera));if(luxury)composer.addPass(new UnrealBloomPass(new THREE.Vector2(1,1),.18,.45,.85));composer.addPass(new OutputPass());}
 let previewPostError="";
 const env=new GradientEquirectTexture(128);env.topColor.set(0xd0c1a7);env.bottomColor.set(0x363e32);env.update();scene.environment=env;scene.environmentIntensity=.36;
 const manifest=await assets.json("../slideshow/clothesline-photos.json");if(!manifest.photos.length)throw Error("No photos");
 const count=manifest.photos.length,span=Math.max(1.5,(count-1)*SPACING+.9),duration=Math.max(8,count*3.2),clock=new PlaybackClock(duration,1);
 const labelsKey="milestone2.clothesline.labels.v1";
 const cleanLabels=value=>{if(!Array.isArray(value)||value.some(v=>typeof v!=="string"||v.length>100))throw Error("Use a JSON array of caption strings (maximum 100 characters each).");return Array.from({length:count},(_,i)=>(value[i]||"").trim());};
 let labels=cleanLabels(Array.isArray(manifest.config?.labels)?manifest.config.labels:[]);
 let labelsEnabled=query.get("labels")==="1"||query.get("labels")!=="0"&&labels.some(Boolean);
 if(!exportMode){try{const saved=JSON.parse(localStorage.getItem(labelsKey)||"null");if(saved&&Array.isArray(saved.labels)){labels=cleanLabels(saved.labels);if(!query.has("labels"))labelsEnabled=!!saved.enabled;}}catch{}}
 const wood=new THREE.MeshStandardMaterial({color:luxury?0x785239:0x715339,roughness:luxury?.71:.84});
 const ropeMat=new THREE.MeshStandardMaterial({color:0xb7a080,roughness:.98});
 const paperBack=new THREE.MeshStandardMaterial({color:0xe8dfcf,roughness:.93});
 const edgeMat=new THREE.MeshStandardMaterial({color:0xd7c9b1,roughness:.85,side:THREE.DoubleSide});
 const decorations=[];
 const steel=new THREE.MeshStandardMaterial({color:luxury?0xa78a58:0x77766d,metalness:.8,roughness:.45});
 function mesh(g,m,x,y,z,parent=scene,staticDecoration=true){const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;parent.add(o);if(staticDecoration)decorations.push(o);return o;}
 // Old timber veranda with a muted plaster backdrop, slatted openings and a secondary string of warm bulbs.
 const wallMat=new THREE.MeshStandardMaterial({color:luxury?0x203b2c:0x58634f,roughness:1});
 mesh(new THREE.BoxGeometry(span+7,4,.12),wallMat,0,1.3,-1.2);
 const floor=new THREE.MeshStandardMaterial({color:luxury?0x45372c:0x635a48,roughness:.92});mesh(new THREE.BoxGeometry(span+7,.1,5),floor,0,-.07,0);
 for(const x of [-span/2,span/2]){mesh(new RoundedBoxGeometry(.09,2.7,.10,3,.008),wood,x,1.34,0);mesh(new THREE.TorusGeometry(.023,.004,8,24),steel,x,lineY(x,span),0).rotation.y=Math.PI/2;}
 mesh(new RoundedBoxGeometry(span+.3,.10,.13,2,.008),wood,0,2.56,0);
 const curve=new THREE.CatmullRomCurve3(Array.from({length:41},(_,i)=>{const x=(i/40-.5)*span;return new THREE.Vector3(x,lineY(x,span),0);}));
 mesh(new THREE.TubeGeometry(curve,Math.max(100,count*24),.0035,8,false),ropeMat,0,0,0);
 // Fine twisted strands around the load-bearing rope.
 for(let k=0;k<2;k++){const strand=new THREE.CatmullRomCurve3(Array.from({length:Math.ceil(span*180)},(_,i)=>{const u=i/(Math.ceil(span*180)-1),x=(u-.5)*span,a=x*230+k*Math.PI;return new THREE.Vector3(x,lineY(x,span)+.003*Math.cos(a),.003*Math.sin(a));}));mesh(new THREE.TubeGeometry(strand,Math.ceil(span*180),.0008,4,false),ropeMat,0,0,0);}
 const lightWire=new THREE.MeshStandardMaterial({color:0x3b3429,roughness:.95}),bulb=new THREE.MeshStandardMaterial({color:0xffdcb1,emissive:0xffbd73,emissiveIntensity:luxury?2.3:1.8,roughness:.32});
 const lightCurve=new THREE.CatmullRomCurve3(Array.from({length:25},(_,i)=>{const x=(i/24-.5)*(span+1);return new THREE.Vector3(x,2.11-.17*(1-(2*x/(span+1))**2),-.55);}));
 mesh(new THREE.TubeGeometry(lightCurve,100,.0018,5,false),lightWire,0,0,0);
 const socketGeometry=new THREE.CylinderGeometry(.006,.006,.018,8),bulbGeometry=new THREE.SphereGeometry(.012,12,10);
 for(let i=0;i<Math.ceil(span/.23);i++){const v=lightCurve.getPoint(i/Math.max(1,Math.ceil(span/.23)-1));mesh(socketGeometry,lightWire,v.x,v.y-.012,v.z);mesh(bulbGeometry,bulb,v.x,v.y-.03,v.z);}
 // Muted greenery along the back wall, actual geometry rather than a flat backdrop.
 const leafMat=new THREE.MeshPhysicalMaterial({color:0x33492c,roughness:.77,side:THREE.DoubleSide,sheen:.15});
 const leafGeometry=new THREE.SphereGeometry(1,8,6);
 const r=random(51);for(let i=0;i<Math.ceil(span*8);i++){const x=(r()-.5)*(span+2),y=.15+r()*.67,z=-.88+r()*.12;const radius=.065+r()*.065,leaf=mesh(leafGeometry,leafMat,x,y,z);leaf.scale.set(.55*radius,radius,.15*radius);leaf.rotation.z=(r()-.5)*2.7;leaf.rotation.y=(r()-.5)*2;}
 const key=new PhysicalSpotLight(luxury?LUXURY.key:0xffe0b6,luxury?16:14,12,Math.PI/3,.85,2);key.position.set(-1.7,3.2,2.4);key.target.position.set(0,1.4,0);key.radius=.65;key.castShadow=true;key.shadow.mapSize.set(profile.dpr===1?1024:2048,profile.dpr===1?1024:2048);key.shadow.camera.near=.2;key.shadow.camera.far=12;key.shadow.normalBias=.0005;scene.add(key,key.target);
 const fill=new THREE.DirectionalLight(luxury?LUXURY.fill:0xc1d5e8,luxury?.70:.95);fill.position.set(2,2,1);scene.add(fill);const rim=new THREE.DirectionalLight(luxury?LUXURY.rim:0xffd4a0,luxury?1.7:1.5);rim.position.set(-1,2,-.7);scene.add(rim);scene.add(new THREE.HemisphereLight(0xf7e8cc,0x59634c,.45));
 const cards=[],photoMaterials=[],originalPrints=[];
 const clipJawGeometry=new RoundedBoxGeometry(.016,.058,.009,2,.0015),clipSpringGeometry=new THREE.TorusGeometry(.005,.0012,6,16);
 function makeGeometry(s,back=false){const n=s.cols*s.rows,uv=new Float32Array(n*2),indices=[];for(let j=0;j<s.rows;j++)for(let i=0;i<s.cols;i++){const k=j*s.cols+i;uv[k*2]=back?1-i/(s.cols-1):i/(s.cols-1);uv[k*2+1]=1-j/(s.rows-1);if(i+1<s.cols&&j+1<s.rows){const a=k,b=k+1,d=k+s.cols,e=d+1;if(back)indices.push(a,b,d,b,e,d);else indices.push(a,d,b,b,d,e);}}const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.BufferAttribute(new Float32Array(n*3),3).setUsage(THREE.DynamicDrawUsage));g.setAttribute("uv",new THREE.BufferAttribute(uv,2));g.setIndex(indices);return g;}
 function makeEdge(s){const boundary=[];for(let i=0;i<s.cols-1;i++)boundary.push(i);for(let j=0;j<s.rows-1;j++)boundary.push(j*s.cols+s.cols-1);for(let i=s.cols-1;i>0;i--)boundary.push((s.rows-1)*s.cols+i);for(let j=s.rows-1;j>0;j--)boundary.push(j*s.cols);const indices=[];for(let i=0;i<boundary.length;i++){const a=i*2,b=((i+1)%boundary.length)*2;indices.push(a,b,a+1,b,b+1,a+1);}const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.BufferAttribute(new Float32Array(boundary.length*6),3).setUsage(THREE.DynamicDrawUsage));g.setIndex(indices);return {g,boundary};}
 function syncCard(card){const {s,front,back,edge,boundary}=card,a=front.attributes.position,b=back.attributes.position,e=edge.attributes.position;for(let i=0;i<s.inverse.length;i++){const k=i*3;a.setXYZ(i,s.p[k],s.p[k+1],s.p[k+2]+THICKNESS/2);b.setXYZ(i,s.p[k],s.p[k+1],s.p[k+2]-THICKNESS/2);}for(let i=0;i<boundary.length;i++){const k=boundary[i];e.setXYZ(i*2,a.getX(k),a.getY(k),a.getZ(k));e.setXYZ(i*2+1,b.getX(k),b.getY(k),b.getZ(k));}for(const g of [front,back,edge]){g.attributes.position.needsUpdate=true;g.computeVertexNormals();g.computeBoundingSphere();}}
 for(let i=0;i<count;i++){
  loadingStage("Preparing suspended photographs…",i,count);
  const source=await assets.image(assets.resolve(manifest.photos[i],assets.resolve("../slideshow/")));
  const tex=printTexture(source,{width:PHOTO_W,depth:PHOTO_H},renderer.capabilities.getMaxAnisotropy(),profile.photoWidth,assets);
  const material=new THREE.MeshPhysicalMaterial({map:tex,roughness:luxury?.43:.57,clearcoat:luxury?.24:.15,clearcoatRoughness:luxury?.38:.48});
  photoMaterials.push(material);originalPrints.push(tex);
  const s=makeSheet(i,25,19),x=(i-(count-1)/2)*SPACING,group=new THREE.Group();group.position.set(x,lineY(x,span)-.012,.012);scene.add(group);
  const front=makeGeometry(s),back=makeGeometry(s,true),edge=makeEdge(s);
  mesh(front,material,0,0,0,group,false);mesh(back,paperBack,0,0,0,group,false);mesh(edge.g,edgeMat,0,0,0,group,false);
  // Each clip is aligned with an actual fixed solver vertex; two wooden jaws and a steel spring.
  for(const pin of [s.left,s.right]){const px=s.rest[pin*3],clip=new THREE.Group();clip.position.set(px,.008,-.003);clip.scale.set(1.25,1.25,1.15);group.add(clip);
   mesh(clipJawGeometry,wood,0,.009,-.006,clip);
   mesh(clipJawGeometry,wood,0,.009,.006,clip);
   const spring=mesh(clipSpringGeometry,steel,0,.012,0,clip);spring.rotation.y=Math.PI/2;
  }
  const card={s,front,back,edge:edge.g,boundary:edge.boundary};cards.push(card);syncCard(card);
 }
 // Two staggered background clotheslines, with independently wind-driven thick prints.
 // The middle row sits above the hero prints and the rear row below it, creating parallax.
 const backgroundRows=[{z:-.43,y:.28,offset:.5,scale:.82},{z:-.91,y:-.20,offset:.18,scale:.88}];
 for(let row=0;row<backgroundRows.length;row++){
  const spec=backgroundRows[row],rearSpan=span+.65;
  const height=x=>lineY(x,rearSpan)+spec.y;
  const line=new THREE.CatmullRomCurve3(Array.from({length:49},(_,j)=>{const x=(j/48-.5)*rearSpan;return new THREE.Vector3(x,height(x),spec.z);}));
  mesh(new THREE.TubeGeometry(line,Math.max(100,count*20),.003,8,false),ropeMat,0,0,0);
  for(const x of [-rearSpan/2,rearSpan/2]){mesh(new RoundedBoxGeometry(.07,2.45,.075,2,.005),wood,x,1.21,spec.z);mesh(new THREE.TorusGeometry(.019,.003,8,20),steel,x,height(x),spec.z).rotation.y=Math.PI/2;}
  const n=count+1;
  for(let i=0;i<n;i++){
   const x=(i-(n-1)/2+spec.offset-.25)*SPACING;
   const sheet=makeSheet(count+row*n+i,17,13),group=new THREE.Group();group.position.set(x,height(x)-.012*spec.scale,spec.z+.012);group.scale.setScalar(spec.scale);scene.add(group);
   const front=makeGeometry(sheet),back=makeGeometry(sheet,true),edge=makeEdge(sheet);
   const material=photoMaterials[(i*3+row*5+1)%count];
   mesh(front,material,0,0,0,group,false);mesh(back,paperBack,0,0,0,group,false);mesh(edge.g,edgeMat,0,0,0,group,false);
   for(const pin of [sheet.left,sheet.right]){
    const px=sheet.rest[pin*3],clip=new THREE.Group();clip.position.set(px,.008,-.003);clip.scale.set(1.25,1.25,1.15);group.add(clip);
    mesh(clipJawGeometry,wood,0,.009,-.006,clip);mesh(clipJawGeometry,wood,0,.009,.006,clip);
    mesh(clipSpringGeometry,steel,0,.012,0,clip).rotation.y=Math.PI/2;
   }
   const card={s:sheet,front,back,edge:edge.g,boundary:edge.boundary};cards.push(card);syncCard(card);
  }
 }
 // Perpendicular side galleries: depth-axis lines beyond the ends of the hero row.
 // Keep all side prints outside the dolly's swept volume, with their faces turned inward.
 const beforeSideRows=cards.length;
 for(const side of [-1,1]){
  const x=side*(span/2+.33),zStart=-.98,zEnd=.90,length=zEnd-zStart,mid=(zStart+zEnd)/2;
  const ropeHeight=z=>1.66-.085*(1-(2*(z-mid)/length)**2);
  const points=Array.from({length:49},(_,i)=>{const z=zStart+i/48*length;return new THREE.Vector3(x,ropeHeight(z),z);});
  mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),120,.0035,8,false),ropeMat,0,0,0);
  for(const z of [zStart,zEnd]){
   mesh(new RoundedBoxGeometry(.08,2.5,.085,2,.006),wood,x,1.23,z);
   mesh(new THREE.TorusGeometry(.02,.003,8,20),steel,x,ropeHeight(z),z);
  }
  const n=4,scale=.86;
  for(let i=0;i<n;i++){
   const z=zStart+.23+i*(length-.46)/(n-1);
   const sheet=makeSheet(beforeSideRows+(side===1?n:0)+i,19,15),group=new THREE.Group();
   group.position.set(x-side*.012,ropeHeight(z)-.012*scale,z);
   group.rotation.y=-side*Math.PI/2;group.scale.setScalar(scale);scene.add(group);
   const front=makeGeometry(sheet),back=makeGeometry(sheet,true),edge=makeEdge(sheet);
   const material=photoMaterials[(i*3+(side===1?2:0))%count];
   mesh(front,material,0,0,0,group,false);mesh(back,paperBack,0,0,0,group,false);mesh(edge.g,edgeMat,0,0,0,group,false);
   for(const pin of [sheet.left,sheet.right]){
    const clip=new THREE.Group();clip.position.set(sheet.rest[pin*3],.008,-.003);clip.scale.set(1.25,1.25,1.15);group.add(clip);
    mesh(clipJawGeometry,wood,0,.009,-.006,clip);mesh(clipJawGeometry,wood,0,.009,.006,clip);
    mesh(clipSpringGeometry,steel,0,.012,0,clip).rotation.y=Math.PI/2;
   }
   const card={s:sheet,front,back,edge:edge.g,boundary:edge.boundary};cards.push(card);syncCard(card);
  }
 }
 const sidePrintCount=cards.length-beforeSideRows;
 const staticBatchStats=query.has("unbatched")?null:batchStaticDecorations(scene,decorations);
 // Captions are painted into the actual photo texture and deform with the paper.
 // Rear prints keep their original material, so only the hero row carries editorial captions.
 const captionMaterials=photoMaterials.map(m=>m.clone());
 for(let i=0;i<count;i++){const card=cards[i];const obj=scene.children.find(o=>o.isGroup&&o.children.some(ch=>ch.geometry===card.front));if(obj){const face=obj.children.find(ch=>ch.geometry===card.front);face.material=captionMaterials[i];}}
 function updateLabels(){
  for(let i=0;i<count;i++){
   const m=captionMaterials[i],source=originalPrints[i];
   if(m.map&&m.map!==source)m.map.dispose();
   if(!labelsEnabled||!labels[i]){m.map=source;m.needsUpdate=true;continue;}
   const canvas=assets.canvas();canvas.width=source.image.width;canvas.height=source.image.height;
   const ctx=canvas.getContext("2d"),w=canvas.width,h=canvas.height,border=h*.14;
   ctx.fillStyle="#f5f0e6";ctx.fillRect(0,0,w,h);
   ctx.drawImage(source.image,0,0,w,h-border+h*.035);
   ctx.fillStyle="#f5f0e6";ctx.fillRect(0,h-border,w,border);
   let size=border*.55;ctx.font="500 "+size+"px Georgia, serif";
   while(ctx.measureText(labels[i]).width>w*.88&&size>8){size-=1;ctx.font="500 "+size+"px Georgia, serif";}
   ctx.fillStyle="#463d32";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(labels[i],w/2,h-border/2,w*.88);
   const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=source.anisotropy;m.map=tex;m.needsUpdate=true;
  }
 }
 updateLabels();
 let simStep=0,tracer=null,mode="raster",dirty=true,target=profile.preview.samples,traceError="";
 // Warm up the hanging sheets under gravity so playback starts in equilibrium.
 function reset(){for(const card of cards)resetSheet(card.s);for(let i=0;i<90;i++)for(const card of cards)stepSheet(card.s,(i-90)*DT);simStep=0;}
 reset();
 const controls=createPlaybackControls({modes:[{value:"raster",label:"Real-time"},{value:"raytrace",label:"Ray-traced preview"},{value:"cinematic",label:"Cinematic"}],quality:{value:qualityName,options:qualityOptions(),onChange:changeQuality},onToggle:()=>{if(clock.time>=duration)seek(0);clock.setPlaying(!clock.playing);controls.sync(clock);},onRestart:()=>{seek(0);clock.setPlaying(true);},onSeek:t=>{clock.setPlaying(false);seek(t);},onMode:m=>{clock.setPlaying(false);setMode(m);draw();},hidden:exportMode});
 function setMode(m){mode=m;target=m==="cinematic"?profile.cinematic.samples:profile.preview.samples;dirty=true;traceError="";controls.mode.value=m;}
 function traceDraw(){if(!tracer){if(!renderer.extensions.has("EXT_color_buffer_float"))throw Error("Floating point render targets unavailable");tracer=new WebGLPathTracer(renderer);tracer.textureSize.set(profile.atlas,profile.atlas);tracer.renderDelay=0;tracer.minSamples=1;tracer.fadeDuration=0;tracer.tiles.set(profile.tiles,profile.tiles);}if(dirty){const q=mode==="cinematic"||exportMode?profile.cinematic:profile.preview;tracer.bounces=q.bounces;tracer.renderScale=exportMode?1:q.scale;tracer.setScene(scene,camera);tracer.reset();dirty=false;}tracer.pausePathTracing=tracer.samples>=target;tracer.renderSample();controls.setFrameProgress({phase:"Accumulating samples",samples:tracer.samples,target});}
 function beautyDraw(){if(mode==="cinematic"||(mode==="raytrace"&&!clock.playing)){try{traceDraw();return;}catch(e){traceError=String(e);setMode("raster");controls.samples.textContent="Ray trace failed: "+e;}}if(!previewPostError){try{composer.render();}catch(e){previewPostError=String(e);renderer.render(scene,camera);}}else renderer.render(scene,camera);
 controls.setFrameProgress({phase:previewPostError?"Frame render · Real-time (postprocessing unavailable)":"Frame render · Real-time",ready:true});if(previewPostError)controls.samples.textContent="Preview postprocessing unavailable: "+previewPostError;}
 const passes=createRenderPasses(renderer,scene,camera,mesh=>cards.some(card=>mesh.geometry===card.front||mesh.geometry===card.back||mesh.geometry===card.edge),beautyDraw);addStyleControl(controls.ui,style);passes.addUI(controls.ui,()=>{clock.setPlaying(false);dirty=true;draw();});
 function draw(){if(query.has("geometry-export"))return;if(passes.pass==="beauty")beautyDraw();else{passes.render();controls.setFrameProgress({phase:"Render pass · "+passes.pass,ready:true});}}
 function seek(t,fromTick=false){if(!fromTick)clock.seek(t);const step=Math.floor(clock.time/DT+1e-8);if(step<simStep)reset();while(simStep<step){simStep++;for(const card of cards)stepSheet(card.s,simStep*DT);}for(const card of cards)syncCard(card);const p=galleryCamera(clock.time,count,duration);camera.position.set(p.x,p.y,p.z);camera.lookAt(p.targetX,p.targetY,p.targetZ);camera.rotateZ(p.roll);camera.focusDistance=camera.position.distanceTo(new THREE.Vector3(p.targetX,p.targetY,p.targetZ));dirty=true;draw();controls.sync(clock);}
 function resize(w,h){renderer.setSize(w,h,false);composer?.setSize(w,h);camera.aspect=w/h;camera.setFocalLength(50);camera.updateProjectionMatrix();seek(clock.time);}
 if(exportMode){resize(innerWidth,innerHeight);addEventListener("resize",()=>resize(innerWidth,innerHeight));}else bindPreviewViewport(renderer.domElement,controls.ui,resize,false,DEFAULT_OUTPUT.aspect);
 const labelPanel=document.getElementById("label-panel"),labelToggle=document.getElementById("label-toggle"),labelEdit=document.getElementById("label-edit"),labelDialog=document.getElementById("label-dialog"),labelInput=document.getElementById("label-input"),labelError=document.getElementById("label-error");
 labelPanel.hidden=exportMode;labelToggle.checked=labelsEnabled;
 function saveLabels(){try{localStorage.setItem(labelsKey,JSON.stringify({labels,enabled:labelsEnabled}));}catch{}}
 function setLabels(value,enabled=true){labels=cleanLabels(value);labelsEnabled=!!enabled;labelToggle.checked=labelsEnabled;updateLabels();dirty=true;draw();}
 labelToggle.onchange=()=>{setLabels(labels,labelToggle.checked);saveLabels();};
 labelEdit.onclick=()=>{clock.setPlaying(false);controls.sync(clock);labelInput.value=JSON.stringify(labels,null,2);labelError.textContent="";labelDialog.showModal();};
 document.getElementById("label-cancel").onclick=()=>labelDialog.close();
 document.getElementById("label-apply").onclick=()=>{try{setLabels(JSON.parse(labelInput.value),true);saveLabels();labelDialog.close();}catch(e){labelError.textContent=String(e.message||e);}};
 seek(0);loadingReady();
 const blenderExport=new BlenderExport(scene,camera);
 window.__clothesline={...geometrySession(t=>{clock.setPlaying(false);seek(t);},blenderExport),capturePass:(t,pass)=>{clock.setPlaying(false);const old=passes.pass;passes.setPass(pass);seek(t);const png=renderer.domElement.toDataURL("image/png");passes.setPass(old);return png;},passIds:()=>passes.idMap(),setPass:value=>{passes.setPass(value);draw();},duration,count,setLabels,staticBatchStats,backgroundCount:beforeSideRows-count,sidePrintCount,totalPrints:cards.length,seek:t=>{clock.setPlaying(false);seek(t);},capture:t=>{clock.setPlaying(false);setMode("raster");seek(t);return renderer.domElement.toDataURL("image/png");},beginTrace:(t,samples)=>{clock.setPlaying(false);setMode("raytrace");target=samples;seek(t);},traceStep:()=>{if(mode!=="raytrace")throw Error(traceError||"Ray tracer unavailable");traceDraw();return {samples:tracer.samples,target};},traceCapture:()=>{if(!tracer||dirty||tracer.samples<target)throw Error("Frame not ready");return renderer.domElement.toDataURL("image/png");},cameraStatus:()=>({focalLength:camera.getFocalLength(),fStop:null,focusDistance:camera.focusDistance,previewDof:false}),gpu:()=>{const gl=renderer.getContext(),ext=gl.getExtension("WEBGL_debug_renderer_info");return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);}};
 if(!exportMode){function tick(now){if(clock.tick(now,passes.pass!=="beauty"||mode!=="cinematic"||(!dirty&&tracer&&tracer.samples>=target),mode==="cinematic"?1/60:undefined))seek(clock.time,true);else if(mode==="cinematic"||mode==="raytrace"&&!clock.playing)draw();controls.sync(clock);requestAnimationFrame(tick);}requestAnimationFrame(tick);}
}
boot().catch(e=>{loadingFailed(e);window.__clotheslineError=String(e);document.getElementById("error").textContent=String(e);console.error(e);});
