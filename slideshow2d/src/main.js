import {createParallax} from './parallax.js';
import {PlaybackClock,createPlaybackControls} from '../../src/playback/transport.ts';
const exportMode=new URLSearchParams(location.search).has('export');
const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d',{alpha:false});
document.body.prepend(canvas);
const manifest=await fetch(import.meta.env.BASE_URL+'photos.json').then(r=>{if(!r.ok)throw Error('Photo manifest missing');return r.json();});
const photos=await Promise.all(manifest.photos.map(async src=>{const im=new Image();im.src=new URL(src,location.href).href;await im.decode();return im;}));
async function loadMaps(folder){
 return Promise.all(manifest.photos.map(async src=>{const im=new Image();im.src=new URL("./"+folder+"/"+src.split("/").at(-1).replace(/\.[^.]+$/,".png"),location.href).href;try{await im.decode();return im;}catch{return null;}}));
}
const hqMaps=await loadMaps('depth-hq'),highQuality=hqMaps.every(Boolean);
const maps=highQuality?hqMaps:await loadMaps('depth');
if(maps.some(m=>!m))throw Error("Missing archive depth maps: "+maps.filter(Boolean).length+"/"+photos.length);
const parallax=createParallax(highQuality);
const interval=2.5,fade=.5,duration=photos.length*interval,clock=new PlaybackClock(duration,1);
const clamp=x=>Math.max(0,Math.min(1,x)),ease=x=>{x=clamp(x);return x*x*(3-2*x);};
const layer=document.createElement("canvas"),layerCtx=layer.getContext("2d",{alpha:false});
function paint(i,t,alpha=1){
 const im=photos[i],w=canvas.width,h=canvas.height,p=clamp(t/(interval+fade));
 if(layer.width!==w||layer.height!==h){layer.width=w;layer.height=h;}
 layerCtx.globalAlpha=1;layerCtx.fillStyle="#101010";layerCtx.fillRect(0,0,w,h);
 // A dark, blurred fill behind the full photograph preserves portrait and group framing.
 const cover=Math.max(w/im.width,h/im.height)*1.12;
 layerCtx.save();layerCtx.filter='blur('+Math.max(8,h*.025)+'px) brightness(0.34)';layerCtx.drawImage(im,(w-im.width*cover)/2,(h-im.height*cover)/2,im.width*cover,im.height*cover);layerCtx.restore();
 const fit=Math.min(w/im.width,h/im.height)*(.92+.08*p);
 const iw=im.width*fit,ih=im.height*fit;
 const foreground=parallax&&maps[i]?parallax.render(im,maps[i],iw*1.5,ih*1.5,.065*p):im;
 layerCtx.imageSmoothingQuality="high";layerCtx.drawImage(foreground,(w-iw)/2,(h-ih)/2,iw,ih);
 ctx.globalAlpha=alpha;ctx.drawImage(layer,0,0);
 ctx.globalAlpha=1;
}
function draw(t){
 const i=Math.min(photos.length-1,Math.floor(t/interval)),local=t-i*interval;
 ctx.fillStyle='#101010';ctx.fillRect(0,0,canvas.width,canvas.height);
 if(i>0&&local<fade){paint(i-1,interval+local);paint(i,local,ease(local/fade));}else paint(i,local);
 controls.sync(clock);
}
function seek(t){clock.seek(t);draw(clock.time);}
const controls=createPlaybackControls({modes:[{value:'2d',label:'2D slideshow'}],onToggle:()=>{if(clock.time>=duration)seek(0);clock.setPlaying(!clock.playing);controls.sync(clock);},onRestart:()=>{seek(0);clock.setPlaying(true);},onSeek:t=>{clock.setPlaying(false);seek(t);},onMode:()=>{},hidden:exportMode});
function resize(){canvas.width=innerWidth;canvas.height=innerHeight;draw(clock.time);}
addEventListener('resize',resize);resize();
window.__slideshow2d={duration,seek,photoCount:photos.length,depthCount:maps.filter(Boolean).length,highQuality,captureProduction:t=>{clock.setPlaying(false);seek(t);return {beauty:canvas.toDataURL('image/png')};}};
if(!exportMode){function tick(now){if(clock.tick(now))draw(clock.time);requestAnimationFrame(tick);}requestAnimationFrame(tick);}
