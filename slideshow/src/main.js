import * as THREE from "three";
import { PhysicalSpotLight, WebGLPathTracer, GradientEquirectTexture } from "three-gpu-pathtracer";
import { makeShots,pose,duration,cameraPose,defaults,random } from "./pose.js";
const q=new URLSearchParams(location.search),exportMode=q.has("export");
if(exportMode)document.body.classList.add("export");
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:exportMode,powerPreference:"high-performance"});
renderer.setPixelRatio(exportMode?1:Math.min(devicePixelRatio,2));
renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.86;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color(0x1d150f);
const camera=new THREE.PerspectiveCamera(40,innerWidth/innerHeight,.02,8);
const key=new PhysicalSpotLight(0xffd6ad,5.1,4,Math.PI/4,.85,2);
key.radius=.24;key.position.set(-.55,.94,.30);key.target.position.set(0,0,0);key.castShadow=true;key.shadow.mapSize.set(2048,2048);
key.shadow.camera.near=.08;key.shadow.camera.far=3;key.shadow.bias=-.00004;key.shadow.normalBias=.0003;scene.add(key,key.target);
const fill=new THREE.DirectionalLight(0xb7cdff,.27);fill.position.set(.8,.85,-.6);scene.add(fill);
const rim=new THREE.DirectionalLight(0xffe2bd,.22);rim.position.set(.1,.6,-.8);scene.add(rim);
scene.add(new THREE.HemisphereLight(0xffe6cd,0x322015,.18));
const environment=new GradientEquirectTexture(128);environment.topColor.set(0x9ca8c4);environment.bottomColor.set(0x27190f);environment.update();
scene.environment=environment;scene.environmentIntensity=.16;
let tracer=null,mode="raster",traceDirty=true,traceError="",target=64;
const modeSelect=document.querySelector("#mode"),sampleLabel=document.querySelector("#samples");
function setMode(value){mode=value;modeSelect.value=value;traceDirty=true;traceError="";}
function traceDraw(){
  if(!tracer){
    if(!renderer.extensions.has("EXT_color_buffer_float"))throw Error("GPU lacks float render targets");
    tracer=new WebGLPathTracer(renderer);tracer.textureSize.set(1024,1024);tracer.bounces=5;tracer.renderDelay=0;tracer.fadeDuration=0;tracer.minSamples=1;tracer.tiles.set(1,1);
  }
  if(traceDirty){tracer.setScene(scene,camera);tracer.reset();traceDirty=false;}
  tracer.pausePathTracing=tracer.samples>=target;tracer.renderSample();
  sampleLabel.textContent=Math.floor(tracer.samples)+" / "+target+" spp";
}
function draw(){
  if(mode==="raytrace"&&!playing){try{traceDraw();return;}catch(e){setMode("raster");traceError=String(e);sampleLabel.textContent="Ray tracing failed: "+String(e);}}
  renderer.render(scene,camera);
}
modeSelect.onchange=()=>{play(false);setMode(modeSelect.value);draw();};
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
const wood=walnut(),table=new THREE.Mesh(new THREE.PlaneGeometry(2.2,1.6),new THREE.MeshStandardMaterial({map:wood,roughness:.78}));
table.rotation.x=-Math.PI/2;table.receiveShadow=true;scene.add(table);
const loader=new THREE.TextureLoader(),cards=[];
const paper=new THREE.MeshStandardMaterial({color:0xf4eee3,roughness:.86});
const edge=new THREE.MeshStandardMaterial({color:0xe1d8c9,roughness:.9});
let shots=[],total=0,clock=0,playing=!exportMode,last=performance.now();
const button=document.querySelector("#play"),seek=document.querySelector("#seek"),label=document.querySelector("#time");
const matrix=new THREE.Matrix4();
function update(t){
  clock=Math.max(0,Math.min(t,total));
  const p=cameraPose(clock);camera.position.set(p.x,p.y,p.z);camera.lookAt(p.targetX,0,p.targetZ);camera.rotateZ(p.roll);
  for(let i=0;i<cards.length;i++){
    const card=cards[i],s=pose(shots[i],clock);card.visible=s.visible;if(!s.visible)continue;
    card.rotation.set(s.pitch,s.yaw,s.roll,"YXZ");matrix.makeRotationFromEuler(card.rotation);
    const m=matrix.elements,c=shots[i].config;
    const clearance=Math.abs(m[1])*c.width/2+Math.abs(m[5])*c.thickness/2+Math.abs(m[9])*c.depth/2;
    card.position.set(s.x,s.height+clearance+.00015,s.z);
  }
  traceDirty=true;draw();seek.value=String(clock);label.textContent=clock.toFixed(1)+" / "+total.toFixed(1)+"s";
}
function play(value){playing=value;button.textContent=playing?"Pause":"Play";last=performance.now();}
button.onclick=()=>{if(clock>=total)update(0);play(!playing);};
document.querySelector("#restart").onclick=()=>{update(0);play(true);};
seek.oninput=()=>{play(false);update(Number(seek.value));};
addEventListener("resize",()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);update(clock);});
async function init(){
  const response=await fetch("./slides.json");if(!response.ok)throw Error("Missing slides.json; run npm run build or npm run dev");
  const manifest=await response.json();if(!manifest.photos.length)throw Error("No photos found");
  shots=makeShots(manifest.photos.length,manifest.config);total=duration(shots);seek.max=String(total);
  for(let i=0;i<manifest.photos.length;i++){
    const c=shots[i].config,tex=await loader.loadAsync(manifest.photos[i]);
    tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=renderer.capabilities.getMaxAnisotropy();
    const w=c.width-.020,h=c.depth-.022,target=w/h,aspect=tex.image.width/tex.image.height;
    if(aspect>target){tex.repeat.x=target/aspect;tex.offset.x=(1-tex.repeat.x)/2;}else{tex.repeat.y=aspect/target;tex.offset.y=(1-tex.repeat.y)/2;}
    const card=new THREE.Group(),board=new THREE.Mesh(new THREE.BoxGeometry(c.width,c.thickness,c.depth),paper);
    board.castShadow=true;board.receiveShadow=true;card.add(board);
    const image=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({map:tex,roughness:.63}));
    image.rotation.x=-Math.PI/2;image.position.y=c.thickness/2+.00004;image.receiveShadow=true;card.add(image);scene.add(card);cards.push(card);
  }
  update(0);
  window.__slideshow={duration:total,count:cards.length,seek:t=>{play(false);update(t);},capture:t=>{play(false);setMode("raster");update(t);return renderer.domElement.toDataURL("image/png");},beginTrace:(t,samples)=>{play(false);target=samples;setMode("raytrace");update(t);},traceStep:()=>{if(mode!=="raytrace")throw Error(traceError||"Ray tracer unavailable");traceDraw();return {samples:traceDirty?0:tracer.samples,target};},traceCapture:()=>{if(mode!=="raytrace"||traceDirty||tracer.samples<target)throw Error("Frame not ready");return renderer.domElement.toDataURL("image/png");},gpu:()=>{const gl=renderer.getContext(),ext=gl.getExtension("WEBGL_debug_renderer_info");return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);}};
  if(!exportMode){function tick(now){if(playing){update(clock+Math.min(.1,(now-last)/1000));if(clock>=total)play(false);}else if(mode==="raytrace")draw();last=now;requestAnimationFrame(tick);}requestAnimationFrame(tick);}
}
init().catch(e=>{document.querySelector("#error").textContent=String(e);window.__slideshowError=String(e);console.error(e);});
