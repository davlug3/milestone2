import * as THREE from 'three';
import {Line2} from 'three/addons/lines/Line2.js';
import {LineGeometry} from 'three/addons/lines/LineGeometry.js';
import {LineMaterial} from 'three/addons/lines/LineMaterial.js';
import {createRenderPasses} from '../../src/rendering/renderPasses.ts';
import {PlaybackClock,createPlaybackControls} from '../../src/playback/transport.ts';
import {R,DURATION,pose} from './motion.js';
import {createClouds} from './clouds.js';
import {createVectors} from './vectors.js';
const q=new URLSearchParams(location.search),exportMode=q.has('export');
const asset=n=>import.meta.env.BASE_URL+n;
const rad=Math.PI/180;
function point(lon,lat,r=R){const a=lon*rad,b=lat*rad;return new THREE.Vector3(r*Math.cos(b)*Math.cos(a),r*Math.sin(b),-r*Math.cos(b)*Math.sin(a));}
async function boot(){
 const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:exportMode,powerPreference:'high-performance',logarithmicDepthBuffer:false});
 renderer.debug.onShaderError=(gl,program,vs,fs)=>{throw Error('Earth shader failed: '+gl.getProgramInfoLog(program)+' '+gl.getShaderInfoLog(vs)+' '+gl.getShaderInfoLog(fs));};
 renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setSize(innerWidth,innerHeight);document.body.prepend(renderer.domElement);
 const scene=new THREE.Scene();scene.background=new THREE.Color(0x02050b);
 const camera=new THREE.PerspectiveCamera(38,innerWidth/innerHeight,100,65000000);
 const loader=new THREE.TextureLoader();
 const [world,region,luzon,pampanga,province]=await Promise.all([loader.loadAsync(asset('earth-consistent.jpg')),loader.loadAsync(asset('region-satellite.jpg')),loader.loadAsync(asset('luzon-satellite.jpg')),loader.loadAsync(asset('pampanga-satellite.jpg')),fetch(asset('pampanga.geojson')).then(r=>{if(!r.ok)throw Error('Boundary unavailable');return r.json();})]);
 for(const tex of [world,region,luzon,pampanga]){tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());}
 const mat=new THREE.ShaderMaterial({uniforms:{world:{value:world},region:{value:region},luzon:{value:luzon},pampanga:{value:pampanga},level:{value:0},sun:{value:point(105,30,1)}},
 vertexShader:'varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
 fragmentShader:`uniform sampler2D world,region,luzon,pampanga;uniform float level;uniform vec3 sun;varying vec3 vP;
 vec3 blendRegion(sampler2D tex,vec4 bounds,vec2 ll,vec3 base,float lod){vec2 uv=(ll-bounds.xy)/(bounds.zw-bounds.xy);float e=min(min(uv.x,uv.y),min(1.-uv.x,1.-uv.y));return mix(base,texture2D(tex,clamp(uv,0.,1.)).rgb,smoothstep(0.,.12,e)*lod);}
 void main(){vec3 n=normalize(vP);vec2 ll=vec2(degrees(atan(-n.z,n.x)),degrees(asin(n.y)));vec3 c=texture2D(world,vec2((ll.x+180.)/360.,(ll.y+90.)/180.)).rgb;
 c=blendRegion(region,vec4(105.,3.,140.,30.),ll,c,smoothstep(.28,.48,level));
 c=blendRegion(luzon,vec4(117.,12.,124.,18.),ll,c,smoothstep(.53,.72,level));
 c=blendRegion(pampanga,vec4(119.,13.8,122.3,16.6),ll,c,smoothstep(.83,.98,level));
 float light=.52+.48*max(dot(n,sun),0.);gl_FragColor=vec4(c*light,1.);
 #include <colorspace_fragment>
 }`});
 const globe=new THREE.Mesh(new THREE.SphereGeometry(R,512,256),mat);scene.add(globe);
 const clouds=await createClouds(R);scene.add(clouds.mesh);
 const atmosphere=new THREE.Mesh(new THREE.SphereGeometry(R*1.012,128,64),new THREE.ShaderMaterial({side:THREE.BackSide,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{strength:{value:1}},vertexShader:'varying vec3 n;varying vec3 v;void main(){vec4 p=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);v=normalize(-p.xyz);gl_Position=projectionMatrix*p;}',fragmentShader:'varying vec3 n;varying vec3 v;uniform float strength;void main(){float a=pow(1.-abs(dot(normalize(n),normalize(v))),3.);gl_FragColor=vec4(.12,.38,.85,a*.65*strength);}'}));scene.add(atmosphere);
 // Screen-space strokes keep a consistent width throughout the descent.
 const boundary=new THREE.Group(),strokes=[];
 const strokeMaterials=[
  new LineMaterial({color:0xffa12d,linewidth:15,transparent:true,opacity:0,depthWrite:false,depthTest:false}),
  new LineMaterial({color:0x30200b,linewidth:8,transparent:true,opacity:0,depthWrite:false,depthTest:false}),
  new LineMaterial({color:0xffdd76,linewidth:4,transparent:true,opacity:0,depthWrite:false,depthTest:false})
 ];
 const polygons=province.geometry.type==='MultiPolygon'?province.geometry.coordinates:[province.geometry.coordinates];
 for(const poly of polygons)for(const ring of poly){
  const pts=ring.map(([lon,lat])=>point(lon,lat,R+220));
  const lengths=[0];for(let i=1;i<pts.length;i++)lengths.push(lengths[i-1]+pts[i].distanceTo(pts[i-1]));
  const geometry=new LineGeometry();geometry.setPositions(pts.flatMap(p=>p.toArray()));
  strokeMaterials.forEach((m,i)=>{const line=new Line2(geometry,m);line.renderOrder=20+i;line.frustumCulled=false;boundary.add(line);});
  strokes.push({geometry,pts,lengths,total:lengths.at(-1)});
 }
 scene.add(boundary);
 function animateBoundary(t){
  const clamp=x=>Math.max(0,Math.min(1,x));
  const ease=x=>{x=clamp(x);return x*x*(3-2*x);};
  const progress=ease((t-8.25)/2.25),visibility=ease((t-8.25)/.35);
  boundary.visible=progress>0;
  const pulse=.5+.5*Math.sin((t-10.5)*Math.PI*2/1.5);
  strokeMaterials[0].opacity=visibility*(.16+.12*pulse);
  strokeMaterials[1].opacity=visibility*.8;strokeMaterials[2].opacity=visibility;
  const scale=renderer.domElement.height/1080;
  strokeMaterials.forEach((m,i)=>{m.resolution.set(renderer.domElement.width,renderer.domElement.height);m.linewidth=[15,8,4][i]*scale;});
  for(const {geometry,pts,lengths,total} of strokes){
   const cutoff=total*progress;let k=0;while(k+1<lengths.length&&lengths[k+1]<=cutoff)k++;
   const arr=geometry.attributes.instanceEnd;
   // Keep full geometry stable; show complete segments plus one interpolated tip.
   const count=Math.min(k+1,pts.length-1);geometry.instanceCount=progress>0?count:0;
   if(k<pts.length-1){const f=(cutoff-lengths[k])/Math.max(1e-9,lengths[k+1]-lengths[k]);const tip=pts[k].clone().lerp(pts[k+1],clamp(f));arr.setXYZ(k,tip.x,tip.y,tip.z);}
   // Restore previously clipped segments, including when seeking backwards.
   for(let j=0;j<k;j++)arr.setXYZ(j,pts[j+1].x,pts[j+1].y,pts[j+1].z);
   arr.data.needsUpdate=true;
  }
 }
 const labelCanvas=document.createElement('canvas');labelCanvas.width=1024;labelCanvas.height=256;
 const ctx=labelCanvas.getContext('2d');ctx.textAlign='center';ctx.fillStyle='#ffe2ad';ctx.font='600 100px Arial';ctx.textBaseline='middle';ctx.fillText('PAMPANGA',512,128);
 const labelTex=new THREE.CanvasTexture(labelCanvas);labelTex.colorSpace=THREE.SRGBColorSpace;
 const label=new THREE.Sprite(new THREE.SpriteMaterial({map:labelTex,transparent:true,opacity:0,depthWrite:false,depthTest:false}));label.position.copy(point(120.66,15.08,R+2500));scene.add(label);
 const clock=new PlaybackClock(DURATION,1);
 const passes=createRenderPasses(renderer,scene,camera,m=>m===globe,()=>renderer.render(scene,camera));
 function configureCamera(camera,t){const p=pose(Math.min(DURATION,t)),n=point(p.lon,p.lat,1);const east=new THREE.Vector3(-Math.sin(p.lon*rad),0,-Math.cos(p.lon*rad));const north=new THREE.Vector3().crossVectors(east,n).normalize();const heading=east.multiplyScalar(Math.sin(p.azimuth*rad)).addScaledVector(north,Math.cos(p.azimuth*rad));const tilt=p.tilt*rad;camera.position.copy(n).multiplyScalar(R+p.altitude).addScaledVector(heading,p.altitude*Math.tan(tilt));camera.up.set(0,1,0);camera.lookAt(point(p.lon,p.lat));camera.rotateZ(p.roll*rad);camera.near=Math.max(100,p.altitude/100);camera.far=p.altitude+2*R;camera.updateProjectionMatrix();return p;}
 const captureVectors=createVectors(renderer,globe,camera,configureCamera);
 function draw(t){const p=configureCamera(camera,t);mat.uniforms.level.value=Math.max(0,Math.min(1,Math.log(18000000/p.altitude)/Math.log(18000000/115000)));atmosphere.material.uniforms.strength.value=Math.min(1,Math.max(0,(p.altitude-200000)/400000));atmosphere.visible=p.altitude>200000;clouds.update(camera,t);animateBoundary(t);label.material.opacity=Math.max(0,Math.min(1,(t-10.15)/.65));label.scale.set(p.altitude*.42,p.altitude*.105,1);passes.render('beauty');controls.sync(clock);}
 function seek(t){clock.seek(t);draw(clock.time);}
 const controls=createPlaybackControls({modes:[{value:'raster',label:'Real-time'}],onToggle:()=>{if(clock.time>=DURATION)seek(0);clock.setPlaying(!clock.playing);controls.sync(clock);},onRestart:()=>{seek(0);clock.setPlaying(true);},onSeek:t=>{clock.setPlaying(false);seek(t);},onMode:()=>{},hidden:exportMode});
 function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();draw(clock.time);}
 addEventListener('resize',resize);seek(0);
 window.__earth={duration:DURATION,seek,captureProduction:(t,dt=1/24)=>{clock.setPlaying(false);seek(t);return {beauty:renderer.domElement.toDataURL('image/png'),vectors:captureVectors(t,dt)};},cameraStatus:()=>pose(clock.time),textureStatus:()=>[world,region,luzon,pampanga].map(t=>({width:t.image.width,height:t.image.height}))};
 if(!exportMode){function tick(now){if(clock.tick(now))draw(clock.time);requestAnimationFrame(tick);}requestAnimationFrame(tick);}
}
boot().catch(e=>{window.__earthError=String(e);document.getElementById('error').textContent=String(e);console.error(e);});
