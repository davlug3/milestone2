import {PlaybackClock,createPlaybackControls} from "../../src/playback/transport.ts";
import {bindPreviewViewport} from "../../src/playback/viewport.ts";
import {browserQuality,QUALITY_PROFILES,qualityOptions,changeQuality,DEFAULT_OUTPUT} from "../../src/rendering/quality.ts";
import {SLIDE_SECONDS,slidePose,validateSlides,numberText,motionPose,easeOut,unit} from "./model.js";
import examples from "./data.json";
const query=new URLSearchParams(location.search),exportMode=query.has("export"),qualityName=browserQuality(query),profile=QUALITY_PROFILES[qualityName];
const canvas=document.getElementById("scene"),ctx=canvas.getContext("2d"),loading=document.getElementById("loading");
const layers=["composite","background","foreground","chroma","typography","accent"],validLayer=value=>layers.includes(value)?value:"composite";
let layer=validLayer(query.get("layer"));
let background=query.get("background")==="tabletop"?"tabletop":"luxury";
let tabletopFrame=null,tabletopAPI=null,tabletopPromise=null,tabletopError="";
function prepareTabletop(){
 if(tabletopPromise)return tabletopPromise;
 tabletopPromise=new Promise((resolve,reject)=>{
  tabletopFrame=document.createElement("iframe");tabletopFrame.title="Tabletop background renderer";tabletopFrame.setAttribute("aria-hidden","true");tabletopFrame.tabIndex=-1;
  Object.assign(tabletopFrame.style,{position:"fixed",left:"-20000px",top:"0",width:"1920px",height:"1080px",border:"0",pointerEvents:"none"});
  tabletopFrame.src="../slideshow/?export&quality="+encodeURIComponent(qualityName);document.body.appendChild(tabletopFrame);
  const start=performance.now();const check=()=>{try{const win=tabletopFrame.contentWindow;if(win?.__slideshowError)throw Error(win.__slideshowError);if(win?.__slideshow?.canvas){tabletopAPI=win.__slideshow;resolve();return;}if(performance.now()-start>120000)throw Error("Tabletop background loading timed out");setTimeout(check,100);}catch(e){reject(e);}};check();
 }).catch(e=>{tabletopError=String(e.message||e);tabletopFrame?.remove();tabletopFrame=null;throw e;});
 return tabletopPromise;
}
async function selectBackground(value){background=value==="tabletop"?"tabletop":"luxury";if(background==="tabletop"&&!tabletopAPI){try{await prepareTabletop();}catch(e){if(background==="tabletop")throw e;}}}

const W=DEFAULT_OUTPUT.width,H=DEFAULT_OUTPUT.height,storageKey="milestone2.stats.v1";
let slides=validateSlides(examples);
if(!exportMode){try{const saved=localStorage.getItem(storageKey);if(saved)slides=validateSlides(JSON.parse(saved));}catch{}}
const clock=new PlaybackClock(slides.length*SLIDE_SECONDS,1);
const controls=createPlaybackControls({modes:[{value:"composite",label:"Full composite"},{value:"background",label:"Background only"},{value:"foreground",label:"Transparent overlay"},{value:"chroma",label:"Green-screen overlay"},{value:"typography",label:"Typography only"},{value:"accent",label:"Accent only"}],quality:{value:qualityName,options:qualityOptions(),onChange:changeQuality},onToggle:()=>{if(clock.time>=clock.duration)clock.seek(0);clock.setPlaying(!clock.playing);controls.sync(clock);},onRestart:()=>{clock.seek(0);clock.setPlaying(true);draw();},onSeek:t=>{clock.setPlaying(false);clock.seek(t);draw();},onMode:value=>{layer=validLayer(value);const url=new URL(location.href);url.searchParams.set("layer",layer);history.replaceState(null,"",url.href);draw();},hidden:exportMode});
controls.mode.value=layer;
const palettes=[["#10271f","#071310","#d8bc83","#f3ebd9"],["#152b30","#081516","#9bc4bf","#edf2e9"],["#30251d","#100e0b","#dfb994","#f5eadf"]];
function text(str,x,y,max,size,font,color){
 ctx.font=font.replace("SIZE",String(size));while(ctx.measureText(str).width>max&&size>12){size-=2;ctx.font=font.replace("SIZE",String(size));}ctx.fillStyle=color;ctx.fillText(str,x,y);return size;
}
function wrap(str,max,size,font,limit){
 ctx.font=font.replace("SIZE",String(size));const words=str.split(/\s+/),lines=[];let line="";
 for(const word of words){const candidate=line?line+" "+word:word;if(line&&ctx.measureText(candidate).width>max){lines.push(line);line=word;}else line=candidate;}
 if(line)lines.push(line);
 return lines.length>limit?null:lines;
}
function layoutLines(str,max,size,font,limit){
 let list=wrap(str,max,size,font,limit);while(!list&&size>18){size-=2;list=wrap(str,max,size,font,limit);}
 list=list||[str];return {list,size,height:list.length*size*1.13};
}
// A feathered traveling matte reveals intact typography, not animated digit slots.
// The offscreen canvas is composited over either the background or transparency.
const matte=document.createElement("canvas"),mc=matte.getContext("2d");
function reveal(str,x,y,max,size,font,color,progress,exit=0,metallic=false,local=0){
 if(progress<=0||exit>=1)return;
 ctx.font=font.replace("SIZE",String(size));
 while(ctx.measureText(str).width>max&&size>12){size-=2;ctx.font=font.replace("SIZE",String(size));}
 const metrics=ctx.measureText(str),width=Math.ceil(metrics.width+100),height=Math.ceil(size*1.65);
 const density=Math.min(2,Math.max(.35,canvas.width/W));
 matte.width=Math.max(1,Math.ceil(width*density));matte.height=Math.max(1,Math.ceil(height*density));
 mc.setTransform(matte.width/width,0,0,matte.height/height,0,0);
 mc.font=ctx.font;mc.textAlign="center";mc.textBaseline="middle";
 if(metallic){
   const depth=12,dx=4+5*(1-progress),dy=9+5*(1-progress);
   // Shallow simulated extrusion with shaded sidewalls, bevel highlights and a gold face.
   for(let i=depth;i>=1;i--){const t=i/depth;mc.fillStyle=i%2?"#70502e":"#795735";mc.fillText(str,width/2+dx*t,height/2+dy*t);}
   mc.lineJoin="round";mc.lineWidth=4.5;mc.strokeStyle="#8b642f";mc.strokeText(str,width/2,height/2);
   const foil=mc.createLinearGradient(0,height*.22,width*.16,height*.79);
   foil.addColorStop(0,"#f3dba8");foil.addColorStop(.22,"#fff3d5");foil.addColorStop(.43,"#cda66b");foil.addColorStop(.52,"#f0d19b");foil.addColorStop(.77,"#b68b4f");foil.addColorStop(1,"#e5c58d");
   mc.fillStyle=foil;mc.fillText(str,width/2,height/2);
   mc.lineWidth=1.25;mc.strokeStyle="#ffe9bba8";mc.strokeText(str,width/2-.8,height/2-1);
   const sweep=unit((local-1.35)/1.55);
   if(sweep>0&&sweep<1){
     const x=-width*.30+sweep*width*1.6;
     const gleam=mc.createLinearGradient(x-65,0,x+65,height*.14);
     gleam.addColorStop(0,"#fff0");gleam.addColorStop(.47,"#fff5d878");gleam.addColorStop(.56,"#fff8e9a0");gleam.addColorStop(1,"#fff0");
     mc.fillStyle=gleam;mc.fillText(str,width/2,height/2);
   }
 }else{mc.fillStyle=color;mc.fillText(str,width/2,height/2);}
 if(progress<1||exit>0){
   const feather=Math.min(100,width*.25),edge=progress*(width+2*feather)-feather;
   mc.globalCompositeOperation="destination-in";
   if(progress<1){const wipe=mc.createLinearGradient(edge-feather,0,edge+feather,0);wipe.addColorStop(0,"#fff");wipe.addColorStop(1,"#fff0");mc.fillStyle=wipe;mc.fillRect(0,0,width,height);}
   if(exit>0){const e=exit*(width+2*feather)-feather;const wipe=mc.createLinearGradient(e-feather,0,e+feather,0);wipe.addColorStop(0,"#fff0");wipe.addColorStop(1,"#fff");mc.fillStyle=wipe;mc.fillRect(0,0,width,height);}
   mc.globalCompositeOperation="source-over";
 }
 ctx.save();ctx.globalAlpha=unit(progress*3)*(1-exit*.35);if(metallic){ctx.translate(x,y);const settle=1-progress;ctx.transform(1-.045*settle,0,.035*settle,1,0,0);ctx.drawImage(matte,-width/2,-height/2,width,height);}else ctx.drawImage(matte,x-width/2,y-height/2,width,height);ctx.restore();
}
function draw(){
 const p=slidePose(clock.time,slides.length),s=slides[p.index],palette=palettes[p.index%palettes.length];
 const [a,b,gold,ivory]=palette,m=motionPose(p.local,p.index,slides.length);
 ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);ctx.clearRect(0,0,W,H);
 if(layer==="chroma"){ctx.fillStyle="#00ff00";ctx.fillRect(0,0,W,H);}
 if((layer==="composite"||layer==="background")&&background==="tabletop"&&tabletopAPI){
 tabletopAPI.seek(Math.min(tabletopAPI.duration,clock.time));
 ctx.drawImage(tabletopAPI.canvas,0,0,W,H);
 // Darken the footage for legible champagne-gold typography; this treatment belongs to the background pass.
 ctx.fillStyle="rgba(8,12,10,.48)";ctx.fillRect(0,0,W,H);
 const vignette=ctx.createRadialGradient(W/2,H/2,120,W/2,H/2,1100);vignette.addColorStop(0,"rgba(6,10,8,.18)");vignette.addColorStop(1,"rgba(6,10,8,.42)");ctx.fillStyle=vignette;ctx.fillRect(0,0,W,H);
 }else if(layer==="composite"||layer==="background"){
 const bg=ctx.createLinearGradient(0,0,W,H);bg.addColorStop(0,a);bg.addColorStop(1,b);ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
 const glow=ctx.createRadialGradient(W/2,H/2,0,W/2,H/2,850);glow.addColorStop(0,gold+"18");glow.addColorStop(1,gold+"00");ctx.fillStyle=glow;ctx.fillRect(0,0,W,H);
 // Rich, symmetrical architectural framing: layered elliptical gold ribbons
 // sit behind the type, with restrained parallax and a traveling specular highlight.
 const t=clock.time;
 ctx.save();ctx.translate(W/2,H/2);ctx.rotate(-.21+.015*Math.sin(t*.32));
 for(let i=0;i<6;i++){
   const rx=760+i*70,ry=450+i*49;
   const g=ctx.createLinearGradient(-rx,-ry,rx,ry);
   g.addColorStop(0,gold+"05");g.addColorStop(.22,gold+"21");g.addColorStop(.40,gold+"04");g.addColorStop(.73,gold+"24");g.addColorStop(1,gold+"05");
   ctx.strokeStyle=g;ctx.lineWidth=i%3===0?8:1.5;ctx.beginPath();ctx.ellipse(0,0,rx,ry,0,0,Math.PI*2);ctx.stroke();
   if(i%3===0){ctx.strokeStyle=gold+"28";ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(0,0,rx+6,ry+6,0,0,Math.PI*2);ctx.stroke();}
 }
 ctx.restore();
 // Animated diagonal light across the background, separate from the foreground pass.
 ctx.save();ctx.translate(W/2,H/2);ctx.rotate(-.47);
 const drift=Math.sin(t*.32)*280;
 const silk=ctx.createLinearGradient(-800+drift,0,800+drift,0);
 silk.addColorStop(0,gold+"00");silk.addColorStop(.42,gold+"00");silk.addColorStop(.52,gold+"1b");silk.addColorStop(.63,gold+"00");silk.addColorStop(1,gold+"00");
 ctx.fillStyle=silk;ctx.fillRect(-1600,-1200,3200,2400);ctx.restore();
 // Draw in a pair of double-line corner ornaments.
 const f=easeOut((p.local-.05)/1.2)*(1-m.exit);
 ctx.save();ctx.globalAlpha=.7*f;ctx.strokeStyle=gold;ctx.lineWidth=1.5;
 for(const sx of [-1,1])for(const sy of [-1,1]){
   ctx.save();ctx.translate(W/2+sx*824,H/2+sy*414);ctx.scale(sx,sy);
   ctx.beginPath();ctx.moveTo(-160*f,0);ctx.lineTo(0,0);ctx.lineTo(0,-100*f);ctx.stroke();
   ctx.beginPath();ctx.moveTo(-110*f,-9);ctx.lineTo(-9,-9);ctx.lineTo(-9,-65*f);ctx.stroke();
   ctx.rotate(Math.PI/4);ctx.fillStyle=gold;ctx.fillRect(-3,-3,6,6);ctx.restore();
 }ctx.restore();

 }
 if(layer!=="background"){
 ctx.textAlign="center";ctx.textBaseline="middle";
 const title=layoutLines(s.title,1510,78,"500 SIZEpx system-ui",2);
 const subtitle=s.subtitle?layoutLines(s.subtitle,1400,38,"400 SIZEpx system-ui",2):null;
 const numberBlock=310,gap=24,divider=2,afterDivider=42,subtitleGap=24;
 const blockHeight=numberBlock+gap+divider+afterDivider+title.height+(subtitle?subtitleGap+subtitle.height:0);
 let y=(H-blockHeight)/2;
 if(layer!=="accent")reveal(numberText(s.number),W/2,y+numberBlock/2,1570,350,"400 SIZEpx Georgia, serif","#ebd6a9",m.number,m.exit,true,p.local);
 y+=numberBlock+gap;
 // Thin centered rule with a diamond at its center; opens smoothly before the text.
 if(layer!=="typography"){ctx.save();ctx.globalAlpha=m.accent*(1-m.exit);
 const bar=220*m.accent;ctx.fillStyle=gold;ctx.fillRect(W/2-bar/2,y,bar,divider);
 ctx.translate(W/2,y+divider/2);ctx.rotate(Math.PI/4);ctx.fillRect(-4,-4,8,8);ctx.restore();}
 y+=divider+afterDivider;
 if(layer!=="accent")for(let i=0;i<title.list.length;i++){reveal(title.list[i],W/2,y+title.size*.565,1510,title.size,"500 SIZEpx system-ui",ivory,easeOut((p.local-.86-i*.12)/.82),m.exit);y+=title.size*1.13;}
 if(subtitle&&layer!=="accent"){y+=subtitleGap;for(let i=0;i<subtitle.list.length;i++){reveal(subtitle.list[i],W/2,y+subtitle.size*.565,1400,subtitle.size,"400 SIZEpx system-ui","#d9d3c6",easeOut((p.local-1.13-i*.1)/.8),m.exit);y+=subtitle.size*1.13;}}
 // No counter or progress bar is burned into the editorial overlay.

 }
 canvas.style.background=(!exportMode&&["foreground","typography","accent"].includes(layer))?"repeating-conic-gradient(#303030 0% 25%,#484848 0% 50%) 50% / 24px 24px":"transparent";
 controls.sync(clock);controls.setFrameProgress({phase:background==="tabletop"&&!tabletopAPI&&!tabletopError?"Loading tabletop background…":"Frame render · Motion graphics",ready:background!=="tabletop"||!!tabletopAPI||!!tabletopError});controls.samples.textContent=background==="tabletop"&&tabletopError?"Tabletop unavailable: "+tabletopError:"";
}
function resize(w,h){const dpr=exportMode?1:Math.min(devicePixelRatio||1,profile.dpr);canvas.width=Math.max(1,Math.round(w*dpr));canvas.height=Math.max(1,Math.round(h*dpr));draw();}
if(exportMode){canvas.width=W;canvas.height=H;canvas.style.width="100vw";canvas.style.height="100vh";}else bindPreviewViewport(canvas,controls.ui,resize,false,DEFAULT_OUTPUT.aspect);
const dialog=document.getElementById("editor"),json=document.getElementById("json"),msg=document.getElementById("message"),edit=document.getElementById("edit");
edit.hidden=exportMode;edit.onclick=()=>{clock.setPlaying(false);controls.sync(clock);json.value=JSON.stringify(slides,null,2);msg.textContent="";dialog.showModal();};
document.getElementById("cancel").onclick=()=>dialog.close();
document.getElementById("reset").onclick=()=>{json.value=JSON.stringify(examples,null,2);msg.textContent="";};
document.getElementById("save").onclick=()=>{try{const next=validateSlides(JSON.parse(json.value));slides=next;try{localStorage.setItem(storageKey,JSON.stringify(slides));}catch{}clock.duration=slides.length*SLIDE_SECONDS;clock.seek(0);dialog.close();draw();}catch(e){msg.textContent=String(e.message||e);}};
window.__stats={async setBackground(value){await selectBackground(value);draw();},get backgroundReady(){return background!=="tabletop"||!!tabletopAPI;},get duration(){return clock.duration;},get count(){return slides.length;},setLayer(value){layer=validLayer(value);controls.mode.value=layer;draw();},setData(value){slides=validateSlides(value);clock.duration=slides.length*SLIDE_SECONDS;clock.seek(0);draw();},seek(t){clock.setPlaying(false);clock.seek(t);draw();},capture(t,pass){if(pass!==undefined)this.setLayer(pass);this.seek(t);return canvas.toDataURL("image/png");}};
const saveFrame=document.getElementById("save-frame");saveFrame.hidden=exportMode;saveFrame.onclick=()=>{clock.setPlaying(false);const oldWidth=canvas.width,oldHeight=canvas.height;canvas.width=W;canvas.height=H;draw();const a=document.createElement("a");a.download="stats-"+layer+"-"+Math.round(clock.time*60)+".png";a.href=canvas.toDataURL("image/png");a.click();canvas.width=oldWidth;canvas.height=oldHeight;draw();};
const backgroundPicker=document.getElementById("background-picker");backgroundPicker.hidden=exportMode;backgroundPicker.value=background;
backgroundPicker.onchange=async()=>{clock.setPlaying(false);const value=backgroundPicker.value;const url=new URL(location.href);url.searchParams.set("background",value);history.replaceState(null,"",url.href);try{const pending=selectBackground(value);draw();await pending;}catch{}draw();};
if(background==="tabletop"){selectBackground(background).then(draw).catch(draw);}
draw();loading.hidden=true;
if(!exportMode){function tick(now){if(clock.tick(now,background!=="tabletop"||!!tabletopAPI||!!tabletopError))draw();requestAnimationFrame(tick);}requestAnimationFrame(tick);}
