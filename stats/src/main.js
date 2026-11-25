import {PlaybackClock,createPlaybackControls} from "../../src/playback/transport.ts";
import {bindPreviewViewport} from "../../src/playback/viewport.ts";
import {browserQuality,QUALITY_PROFILES,qualityOptions,changeQuality,DEFAULT_OUTPUT} from "../../src/rendering/quality.ts";
import {SLIDE_SECONDS,slidePose,validateSlides,numberText,motionPose,easeOut,unit} from "./model.js";
import examples from "./data.json";
const query=new URLSearchParams(location.search),exportMode=query.has("export"),qualityName=browserQuality(query),profile=QUALITY_PROFILES[qualityName];
const canvas=document.getElementById("scene"),ctx=canvas.getContext("2d"),loading=document.getElementById("loading");
const layers=["composite","background","foreground","chroma"],validLayer=value=>layers.includes(value)?value:"composite";
let layer=validLayer(query.get("layer"));
const W=DEFAULT_OUTPUT.width,H=DEFAULT_OUTPUT.height,storageKey="milestone2.stats.v1";
let slides=validateSlides(examples);
if(!exportMode){try{const saved=localStorage.getItem(storageKey);if(saved)slides=validateSlides(JSON.parse(saved));}catch{}}
const clock=new PlaybackClock(slides.length*SLIDE_SECONDS,1);
const controls=createPlaybackControls({modes:[{value:"composite",label:"Full composite"},{value:"background",label:"Background only"},{value:"foreground",label:"Transparent overlay"},{value:"chroma",label:"Green-screen overlay"}],quality:{value:qualityName,options:qualityOptions(),onChange:changeQuality},onToggle:()=>{if(clock.time>=clock.duration)clock.seek(0);clock.setPlaying(!clock.playing);controls.sync(clock);},onRestart:()=>{clock.seek(0);clock.setPlaying(true);draw();},onSeek:t=>{clock.setPlaying(false);clock.seek(t);draw();},onMode:value=>{layer=validLayer(value);const url=new URL(location.href);url.searchParams.set("layer",layer);history.replaceState(null,"",url.href);draw();},hidden:exportMode});
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
function reveal(str,x,y,max,size,font,color,progress,exit=0,metallic=false){
 if(progress<=0||exit>=1)return;
 ctx.font=font.replace("SIZE",String(size));
 while(ctx.measureText(str).width>max&&size>12){size-=2;ctx.font=font.replace("SIZE",String(size));}
 const metrics=ctx.measureText(str),width=Math.ceil(metrics.width+48),height=Math.ceil(size*1.65);
 const density=Math.min(2,Math.max(.35,canvas.width/W));
 matte.width=Math.max(1,Math.ceil(width*density));matte.height=Math.max(1,Math.ceil(height*density));
 mc.setTransform(matte.width/width,0,0,matte.height/height,0,0);
 mc.font=ctx.font;mc.textAlign="center";mc.textBaseline="middle";
 if(metallic){const foil=mc.createLinearGradient(0,height*.18,0,height*.82);foil.addColorStop(0,"#fff5df");foil.addColorStop(.42,color);foil.addColorStop(1,"#bc9858");mc.fillStyle=foil;}else mc.fillStyle=color;
 mc.fillText(str,width/2,height/2);
 if(progress<1||exit>0){
   const feather=Math.min(100,width*.25),edge=progress*(width+2*feather)-feather;
   mc.globalCompositeOperation="destination-in";
   if(progress<1){const wipe=mc.createLinearGradient(edge-feather,0,edge+feather,0);wipe.addColorStop(0,"#fff");wipe.addColorStop(1,"#fff0");mc.fillStyle=wipe;mc.fillRect(0,0,width,height);}
   if(exit>0){const e=exit*(width+2*feather)-feather;const wipe=mc.createLinearGradient(e-feather,0,e+feather,0);wipe.addColorStop(0,"#fff0");wipe.addColorStop(1,"#fff");mc.fillStyle=wipe;mc.fillRect(0,0,width,height);}
   mc.globalCompositeOperation="source-over";
 }
 ctx.save();ctx.globalAlpha=unit(progress*3)*(1-exit*.35);ctx.drawImage(matte,x-width/2,y-height/2,width,height);ctx.restore();
}
function draw(){
 const p=slidePose(clock.time,slides.length),s=slides[p.index],palette=palettes[p.index%palettes.length];
 const [a,b,gold,ivory]=palette,m=motionPose(p.local,p.index,slides.length);
 ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);ctx.clearRect(0,0,W,H);
 if(layer==="chroma"){ctx.fillStyle="#00ff00";ctx.fillRect(0,0,W,H);}
 if(layer==="composite"||layer==="background"){
 const bg=ctx.createLinearGradient(0,0,W,H);bg.addColorStop(0,a);bg.addColorStop(1,b);ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
 const glow=ctx.createRadialGradient(W/2,H/2,0,W/2,H/2,850);glow.addColorStop(0,gold+"18");glow.addColorStop(1,gold+"00");ctx.fillStyle=glow;ctx.fillRect(0,0,W,H);
 // Quiet silk-like diagonal lighting and two fine architectural corner details.
 ctx.save();ctx.translate(W/2,H/2);ctx.rotate(-.47);
 const drift=Math.sin(clock.time*.24)*145;
 const silk=ctx.createLinearGradient(-800+drift,0,800+drift,0);
 silk.addColorStop(0,gold+"00");silk.addColorStop(.42,gold+"00");silk.addColorStop(.52,gold+"15");silk.addColorStop(.63,gold+"00");silk.addColorStop(1,gold+"00");
 ctx.fillStyle=silk;ctx.fillRect(-1600,-1200,3200,2400);ctx.restore();
 ctx.strokeStyle=gold+"32";ctx.lineWidth=1.5;
 for(const sign of [-1,1]){ctx.save();ctx.translate(W/2+sign*824,H/2+sign*414);ctx.scale(sign,sign);ctx.beginPath();ctx.moveTo(-148,0);ctx.lineTo(0,0);ctx.lineTo(0,-94);ctx.stroke();ctx.restore();}

 }
 if(layer!=="background"){
 ctx.textAlign="center";ctx.textBaseline="middle";
 const title=layoutLines(s.title,1510,78,"500 SIZEpx system-ui",2);
 const subtitle=s.subtitle?layoutLines(s.subtitle,1400,38,"400 SIZEpx system-ui",2):null;
 const numberBlock=310,gap=24,divider=2,afterDivider=42,subtitleGap=24;
 const blockHeight=numberBlock+gap+divider+afterDivider+title.height+(subtitle?subtitleGap+subtitle.height:0);
 let y=(H-blockHeight)/2;
 reveal(numberText(s.number),W/2,y+numberBlock/2,1570,350,"400 SIZEpx Georgia, serif","#ebd6a9",m.number,m.exit,true);
 y+=numberBlock+gap;
 // Thin centered rule with a diamond at its center; opens smoothly before the text.
 ctx.save();ctx.globalAlpha=m.accent*(1-m.exit);
 const bar=220*m.accent;ctx.fillStyle=gold;ctx.fillRect(W/2-bar/2,y,bar,divider);
 ctx.translate(W/2,y+divider/2);ctx.rotate(Math.PI/4);ctx.fillRect(-4,-4,8,8);ctx.restore();
 y+=divider+afterDivider;
 for(let i=0;i<title.list.length;i++){reveal(title.list[i],W/2,y+title.size*.565,1510,title.size,"500 SIZEpx system-ui",ivory,easeOut((p.local-.68-i*.12)/.82),m.exit);y+=title.size*1.13;}
 if(subtitle){y+=subtitleGap;for(let i=0;i<subtitle.list.length;i++){reveal(subtitle.list[i],W/2,y+subtitle.size*.565,1400,subtitle.size,"400 SIZEpx system-ui","#d9d3c6",easeOut((p.local-.92-i*.1)/.8),m.exit);y+=subtitle.size*1.13;}}
 // No counter or progress bar is burned into the editorial overlay.

 }
 canvas.style.background=(!exportMode&&layer==="foreground")?"repeating-conic-gradient(#303030 0% 25%,#484848 0% 50%) 50% / 24px 24px":"transparent";
 controls.sync(clock);controls.setFrameProgress({phase:"Frame render · Motion graphics",ready:true});
}
function resize(w,h){const dpr=exportMode?1:Math.min(devicePixelRatio||1,profile.dpr);canvas.width=Math.max(1,Math.round(w*dpr));canvas.height=Math.max(1,Math.round(h*dpr));draw();}
if(exportMode){canvas.width=W;canvas.height=H;canvas.style.width="100vw";canvas.style.height="100vh";}else bindPreviewViewport(canvas,controls.ui,resize,false,DEFAULT_OUTPUT.aspect);
const dialog=document.getElementById("editor"),json=document.getElementById("json"),msg=document.getElementById("message"),edit=document.getElementById("edit");
edit.hidden=exportMode;edit.onclick=()=>{clock.setPlaying(false);controls.sync(clock);json.value=JSON.stringify(slides,null,2);msg.textContent="";dialog.showModal();};
document.getElementById("cancel").onclick=()=>dialog.close();
document.getElementById("reset").onclick=()=>{json.value=JSON.stringify(examples,null,2);msg.textContent="";};
document.getElementById("save").onclick=()=>{try{const next=validateSlides(JSON.parse(json.value));slides=next;try{localStorage.setItem(storageKey,JSON.stringify(slides));}catch{}clock.duration=slides.length*SLIDE_SECONDS;clock.seek(0);dialog.close();draw();}catch(e){msg.textContent=String(e.message||e);}};
window.__stats={get duration(){return clock.duration;},get count(){return slides.length;},setLayer(value){layer=validLayer(value);controls.mode.value=layer;draw();},setData(value){slides=validateSlides(value);clock.duration=slides.length*SLIDE_SECONDS;clock.seek(0);draw();},seek(t){clock.setPlaying(false);clock.seek(t);draw();},capture(t,pass){if(pass!==undefined)this.setLayer(pass);this.seek(t);return canvas.toDataURL("image/png");}};
const saveFrame=document.getElementById("save-frame");saveFrame.hidden=exportMode;saveFrame.onclick=()=>{clock.setPlaying(false);const oldWidth=canvas.width,oldHeight=canvas.height;canvas.width=W;canvas.height=H;draw();const a=document.createElement("a");a.download="stats-"+layer+"-"+Math.round(clock.time*60)+".png";a.href=canvas.toDataURL("image/png");a.click();canvas.width=oldWidth;canvas.height=oldHeight;draw();};
draw();loading.hidden=true;
if(!exportMode){function tick(now){if(clock.tick(now))draw();requestAnimationFrame(tick);}requestAnimationFrame(tick);}
