import * as THREE from 'three';
import {PlaybackClock,createPlaybackControls} from '../../src/playback/transport.ts';
const duration=7,exportMode=new URLSearchParams(location.search).has('export');
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:exportMode,powerPreference:'high-performance'});
renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;document.body.prepend(renderer.domElement);
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(35,16/9,.1,100);
scene.background=new THREE.Color(0x080604);
const background=new THREE.Mesh(new THREE.PlaneGeometry(50,30),new THREE.ShaderMaterial({uniforms:{time:{value:0}},vertexShader:'varying vec2 uv0;void main(){uv0=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`varying vec2 uv0;uniform float time;void main(){vec2 p=uv0-.5;float g=exp(-dot(p*vec2(2.,3.),p*vec2(2.,3.))*14.);float grain=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);gl_FragColor=vec4(vec3(.018,.012,.008)+g*vec3(.09,.048,.018)+grain*.006,1.); #include <colorspace_fragment>\n}`.replace(' #include','\n#include')}));
background.position.z=-7;scene.add(background);
function lettering(text,font,tracking,color,y,w,h){
 const c=document.createElement('canvas');c.width=2048;c.height=512;const x=c.getContext('2d');x.font=font;x.textBaseline='middle';x.textAlign='left';x.fillStyle=color;
 const chars=[...text],width=chars.reduce((n,ch)=>n+x.measureText(ch).width,0)+tracking*(chars.length-1);let left=(c.width-width)/2;
 for(const ch of chars){x.fillText(ch,left,256);left+=x.measureText(ch).width+tracking;}
 const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,opacity:0}));mesh.position.y=y;scene.add(mesh);return mesh;
}
const intro=lettering('43 YEARS AGO','500 126px Arial',21,'#e6d5b4',.87,9,2.25);
const year=lettering('1983','500 440px Georgia',14,'#f5d49b',-.46,10,2.5);
const rule=new THREE.Mesh(new THREE.PlaneGeometry(3,.012),new THREE.MeshBasicMaterial({color:0xb78b48,transparent:true,opacity:0}));rule.position.y=-1.75;scene.add(rule);
const clock=new PlaybackClock(duration,1),ease=x=>{x=Math.min(1,Math.max(0,x));return x*x*(3-2*x);};
function draw(t){
 camera.position.set(.12*Math.sin(t*.22),.04,12-.12*t);camera.lookAt(0,0,0);
 intro.material.opacity=ease((t-.25)/1.2);year.material.opacity=ease((t-1.6)/1.5);year.position.y=-.46-.17*(1-ease((t-1.6)/1.8));rule.material.opacity=.75*ease((t-2.6)/1.2);rule.scale.x=ease((t-2.6)/1.4);
 renderer.render(scene,camera);controls.sync(clock);
}
function seek(t){clock.seek(t);draw(clock.time);}
const controls=createPlaybackControls({modes:[{value:'raster',label:'Real-time'}],onToggle:()=>{if(clock.time>=duration)seek(0);clock.setPlaying(!clock.playing);controls.sync(clock);},onRestart:()=>{seek(0);clock.setPlaying(true);},onSeek:t=>{clock.setPlaying(false);seek(t);},onMode:()=>{},hidden:exportMode});
function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();draw(clock.time);}
addEventListener('resize',resize);resize();
window.__title={duration,seek,captureProduction:t=>{clock.setPlaying(false);seek(t);return {beauty:renderer.domElement.toDataURL('image/png')};}};
if(!exportMode){function tick(now){if(clock.tick(now))draw(clock.time);requestAnimationFrame(tick);}requestAnimationFrame(tick);}
