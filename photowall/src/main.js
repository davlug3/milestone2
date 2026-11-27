import * as T from 'three';
import {paperGeometry} from './paper.js';
import {prepareSheets,createPaperMotion} from './physics.js';
import {PlaybackClock,createPlaybackControls} from '../../src/playback/transport.ts';
import {createRenderPasses} from '../../src/rendering/renderPasses.ts';
const exportMode=new URLSearchParams(location.search).has('export'),duration=22;
let seed=43083;const rand=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};
const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:exportMode,powerPreference:'high-performance'});
renderer.setPixelRatio(1);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.04;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;
document.body.prepend(renderer.domElement);
const scene=new T.Scene(),camera=new T.PerspectiveCamera(20.408,16/9,.1,100);camera.filmGauge=36;camera.setFocalLength(70);scene.background=new T.Color(0x100e0b);
scene.add(new T.HemisphereLight(0xffe7cf,0x3d4844,.85));
const key=new T.DirectionalLight(0xffd7a0,2.3);key.position.set(-6,7,8);key.castShadow=true;
Object.assign(key.shadow.camera,{left:-22,right:22,top:12,bottom:-12,near:.1,far:35});key.shadow.mapSize.set(4096,4096);key.shadow.normalBias=.006;key.shadow.bias=-.0001;scene.add(key);
const fill=new T.DirectionalLight(0xa4cad8,.45);fill.position.set(6,-1,5);scene.add(fill);
const lamp=new T.SpotLight(0xffbd79,32,30,.62,.85,1.8);lamp.position.set(1,5,6);lamp.target.position.set(2,-1,0);scene.add(lamp,lamp.target);
function textureCanvas(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'));const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t;}
const wallMap=textureCanvas(512,512,c=>{c.fillStyle='#736957';c.fillRect(0,0,512,512);for(let i=0;i<42000;i++){const v=92+Math.floor(rand()*65);c.fillStyle='rgba('+v+','+(v-9)+','+(v-20)+',.32)';c.fillRect(rand()*512,rand()*512,1+rand()*3,1+rand()*2);}});
wallMap.wrapS=wallMap.wrapT=T.RepeatWrapping;wallMap.repeat.set(22,10);
const wall=new T.Mesh(new T.PlaneGeometry(48,22),new T.MeshStandardMaterial({map:wallMap,roughness:1,bumpMap:wallMap,bumpScale:.012}));wall.receiveShadow=true;scene.add(wall);
const frameMat=new T.MeshStandardMaterial({color:0x44301f,roughness:.63}),frameGeo=new T.BoxGeometry(1,1,1);
function bar(x,y,w,h){const m=new T.Mesh(frameGeo,frameMat);m.position.set(x,y,.12);m.scale.set(w,h,.22);m.castShadow=true;m.receiveShadow=true;scene.add(m);}
bar(0,6.7,31,.19);bar(0,-6.7,31,.19);bar(-15.4,0,.19,13.4);bar(15.4,0,.19,13.4);
const brass=new T.MeshStandardMaterial({color:0xc69a50,metalness:.35,roughness:.34}),pinGeo=new T.SphereGeometry(1,12,8);
const manifest=await fetch(import.meta.env.BASE_URL+'photos.json').then(r=>{if(!r.ok)throw Error('Photo manifest unavailable');return r.json();});
const loader=new T.TextureLoader(),count=manifest.photos.length,cols=18,rows=Math.ceil(count/cols);
const pins=new T.InstancedMesh(pinGeo,brass,count);pins.castShadow=true;scene.add(pins);
const dummy=new T.Object3D(),sheets=[];
for(let i=0;i<count;i++){
 const tex=await loader.loadAsync(new URL(manifest.photos[i],location.href).href);
 const col=i%cols,row=Math.floor(i/cols),aspect=tex.image.width/tex.image.height;
 const width=1.6+rand()*.62,height=Math.min(1.92,width/aspect),w=Math.min(width,height*aspect);
 const border=.06,extra=i%5===0?.15:.025,pw=w+border*2,ph=height+border*2+extra;
 const group=new T.Group();
 group.position.set((col-(cols-1)/2)*1.59+(rand()-.5)*.34,((rows-1)/2-row)*1.72+(rand()-.5)*.32,.04+(i%4)*.075);
 group.rotation.z=(rand()-.5)*.26;
 const bend=i%7===0?.24:i%3===0?.13:.04+rand()*.04;
 const {geometry,zAt}=paperGeometry(pw,ph,i*.83,bend);
 const c=document.createElement('canvas');c.width=Math.max(256,Math.round(1024*pw/Math.max(pw,ph)));c.height=Math.max(256,Math.round(1024*ph/Math.max(pw,ph)));const ctx=c.getContext('2d');
 ctx.fillStyle=i%5===0?'#e9dfca':'#f1e9da';ctx.fillRect(0,0,c.width,c.height);ctx.imageSmoothingQuality='high';
 ctx.drawImage(tex.image,border/pw*c.width,border/ph*c.height,w/pw*c.width,height/ph*c.height);
 const printTex=new T.CanvasTexture(c);printTex.colorSpace=T.SRGBColorSpace;printTex.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());tex.dispose();
 const photo=new T.Mesh(geometry,new T.MeshStandardMaterial({map:printTex,roughness:.83,side:T.DoubleSide}));photo.castShadow=true;photo.receiveShadow=true;group.add(photo);
 scene.add(group);group.updateMatrixWorld(true);
 const u=.5+(rand()-.5)*.27,v=.95;
 sheets.push({index:i,group,geometry,pin:new T.Vector3((u-.5)*pw,(v-.5)*ph,zAt(u,v)+.035)});
}
const clearance=prepareSheets(sheets),animatePaper=createPaperMotion(sheets,duration);
for(const s of sheets){dummy.position.copy(s.pin);s.group.localToWorld(dummy.position);dummy.scale.set(.055,.055,.035);dummy.updateMatrix();pins.setMatrixAt(s.index,dummy.matrix);}
pins.instanceMatrix.needsUpdate=true;renderer.shadowMap.needsUpdate=true;
const clock=new PlaybackClock(duration,1);
const passes=createRenderPasses(renderer,scene,camera,()=>true,()=>renderer.render(scene,camera));
function draw(t){
 const p=Math.max(0,Math.min(1,t/duration));const travel=p-.12*Math.sin(2*Math.PI*p)/(2*Math.PI);const x=-7.8+6.6*travel,y=1.25-.28*travel+.12*Math.sin(Math.PI*p),z=13;camera.position.set(x,y,z);camera.lookAt(x+z*Math.tan(17*Math.PI/180),y-z*Math.tan(6*Math.PI/180),0);
 animatePaper(t);renderer.shadowMap.needsUpdate=true;passes.render('beauty');controls.sync(clock);
}
function seek(t){clock.seek(t);draw(clock.time);}
const controls=createPlaybackControls({modes:[{value:'raster',label:'Real-time'}],onToggle:()=>{if(clock.time>=duration)seek(0);clock.setPlaying(!clock.playing);controls.sync(clock);},onRestart:()=>{seek(0);clock.setPlaying(true);},onSeek:t=>{clock.setPlaying(false);seek(t);},onMode:()=>{},hidden:exportMode});
function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.setFocalLength(70);camera.updateProjectionMatrix();draw(clock.time);}
addEventListener('resize',resize);resize();
window.__photowall={duration,seek,photoCount:count,physicsStatus:()=>clearance,cameraStatus:()=>({position:camera.position.toArray(),focalLength:camera.getFocalLength(),filmGauge:camera.filmGauge,fov:camera.fov}),captureProduction:t=>{clock.setPlaying(false);seek(t);return {beauty:renderer.domElement.toDataURL('image/png')};}};
if(!exportMode){function tick(now){if(clock.tick(now))draw(clock.time);requestAnimationFrame(tick);}requestAnimationFrame(tick);}
