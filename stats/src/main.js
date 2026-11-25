import {PlaybackClock,createPlaybackControls} from "../../src/playback/transport.ts";
import {bindPreviewViewport} from "../../src/playback/viewport.ts";
import {browserQuality,QUALITY_PROFILES,qualityOptions,changeQuality,DEFAULT_OUTPUT} from "../../src/rendering/quality.ts";
import {SLIDE_SECONDS,slidePose,validateSlides,numberText} from "./model.js";
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
function draw(){
 const p=slidePose(clock.time,slides.length),s=slides[p.index],palette=palettes[p.index%palettes.length];
 const [a,b,gold,ivory]=palette;
 ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);ctx.clearRect(0,0,W,H);
 if(layer==="chroma"){ctx.fillStyle="#00ff00";ctx.fillRect(0,0,W,H);}
 if(layer==="composite"||layer==="background"){
 const bg=ctx.createLinearGradient(0,0,W,H);bg.addColorStop(0,a);bg.addColorStop(1,b);ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
 const glow=ctx.createRadialGradient(W/2,H/2,0,W/2,H/2,850);glow.addColorStop(0,gold+"18");glow.addColorStop(1,gold+"00");ctx.fillStyle=glow;ctx.fillRect(0,0,W,H);
 // Fine graphic contours, decorative only: no fabricated quantitative chart.
 ctx.save();ctx.translate(W/2,H/2);ctx.rotate(-.28+p.local*.013);
 for(let i=0;i<9;i++){ctx.strokeStyle=gold+(i%3===0?"1c":"0c");ctx.lineWidth=i%3===0?2:1;ctx.beginPath();ctx.ellipse(0,0,190+i*43,270+i*34,0,0,Math.PI*2);ctx.stroke();}
 ctx.restore();
 }
 if(layer!=="background"){
 ctx.textAlign="center";ctx.textBaseline="middle";
 ctx.fillStyle=gold;ctx.font="500 24px system-ui";ctx.letterSpacing="5px";ctx.fillText("IMPACT IN NUMBERS",W/2,89);ctx.letterSpacing="0px";
 ctx.fillRect(W/2-42,115,84,3);
 ctx.save();ctx.globalAlpha=p.entrance*p.exit;ctx.translate(0,36*(1-p.entrance)-18*(1-p.exit));
 const num=numberText(s.number,p.countProgress),title=layoutLines(s.title,1510,86,"600 SIZEpx system-ui",2);
 const subtitle=s.subtitle?layoutLines(s.subtitle,1400,38,"400 SIZEpx system-ui",2):null;
 const numberBlock=340,gap=42,divider=5,afterDivider=55,subtitleGap=subtitle?26:0;
 const blockHeight=numberBlock+gap+divider+afterDivider+title.height+subtitleGap+(subtitle?.height||0);
 let y=(H-blockHeight)/2;
 text(num,W/2,y+numberBlock/2,1570,360,"700 SIZEpx Georgia, serif",ivory);y+=numberBlock+gap;
 ctx.fillStyle=gold;const bar=Math.max(2,110*p.entrance);ctx.fillRect(W/2-bar/2,y,bar,divider);y+=divider+afterDivider;
 for(const l of title.list){text(l,W/2,y+title.size*.565,1510,title.size,"600 SIZEpx system-ui",ivory);y+=title.size*1.13;}
 if(subtitle){y+=subtitleGap;for(const l of subtitle.list){text(l,W/2,y+subtitle.size*.565,1400,subtitle.size,"400 SIZEpx system-ui","#c8cec3");y+=subtitle.size*1.13;}}
 ctx.restore();
 ctx.fillStyle=gold;ctx.font="500 23px system-ui";ctx.fillText(String(p.index+1).padStart(2,"0")+" / "+String(slides.length).padStart(2,"0"),W/2,968);
 const track=720,progress=track*clock.time/clock.duration;ctx.fillStyle=gold+"35";ctx.fillRect((W-track)/2,1002,track,3);ctx.fillStyle=gold;ctx.fillRect((W-progress)/2,1002,progress,3);
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
