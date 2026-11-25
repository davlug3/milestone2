import {PlaybackClock,createPlaybackControls} from "../../src/playback/transport.ts";
import {bindPreviewViewport} from "../../src/playback/viewport.ts";
import {browserQuality,QUALITY_PROFILES,qualityOptions,changeQuality,DEFAULT_OUTPUT} from "../../src/rendering/quality.ts";
import {SLIDE_SECONDS,slidePose,validateSlides,numberText} from "./model.js";
import examples from "./data.json";
const query=new URLSearchParams(location.search),exportMode=query.has("export"),qualityName=browserQuality(query),profile=QUALITY_PROFILES[qualityName];
const canvas=document.getElementById("scene"),ctx=canvas.getContext("2d"),loading=document.getElementById("loading");
const W=DEFAULT_OUTPUT.width,H=DEFAULT_OUTPUT.height,storageKey="milestone2.stats.v1";
let slides=validateSlides(examples);
if(!exportMode){try{const saved=localStorage.getItem(storageKey);if(saved)slides=validateSlides(JSON.parse(saved));}catch{}}
const clock=new PlaybackClock(slides.length*SLIDE_SECONDS,1);
const controls=createPlaybackControls({modes:[{value:"motion",label:"Motion graphics"}],quality:{value:qualityName,options:qualityOptions(),onChange:changeQuality},onToggle:()=>{if(clock.time>=clock.duration)clock.seek(0);clock.setPlaying(!clock.playing);controls.sync(clock);},onRestart:()=>{clock.seek(0);clock.setPlaying(true);draw();},onSeek:t=>{clock.setPlaying(false);clock.seek(t);draw();},onMode:()=>{},hidden:exportMode});
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
function lines(str,x,y,max,size,font,color,limit){
 let list=wrap(str,max,size,font,limit);while(!list&&size>18){size-=2;list=wrap(str,max,size,font,limit);}
 list=list||[str];ctx.fillStyle=color;list.forEach((l,i)=>text(l,x,y+i*size*1.13,max,size,font,color));return list.length*size*1.13;
}
function draw(){
 const p=slidePose(clock.time,slides.length),s=slides[p.index],palette=palettes[p.index%palettes.length];
 const [a,b,gold,ivory]=palette;
 ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);ctx.clearRect(0,0,W,H);
 const bg=ctx.createLinearGradient(0,0,W,H);bg.addColorStop(0,a);bg.addColorStop(1,b);ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
 const glow=ctx.createRadialGradient(1470,475,0,1470,475,850);glow.addColorStop(0,gold+"18");glow.addColorStop(1,gold+"00");ctx.fillStyle=glow;ctx.fillRect(0,0,W,H);
 // Fine graphic contours, decorative only: no fabricated quantitative chart.
 ctx.save();ctx.translate(1510,510);ctx.rotate(-.28+p.local*.013);
 for(let i=0;i<9;i++){ctx.strokeStyle=gold+(i%3===0?"38":"18");ctx.lineWidth=i%3===0?2:1;ctx.beginPath();ctx.ellipse(0,0,190+i*43,270+i*34,0,0,Math.PI*2);ctx.stroke();}
 ctx.restore();
 ctx.fillStyle=gold;ctx.fillRect(126,105,84,3);ctx.letterSpacing="5px";ctx.font="500 24px system-ui";ctx.fillText("IMPACT IN NUMBERS",126,88);ctx.letterSpacing="0px";
 ctx.save();ctx.globalAlpha=p.entrance*p.exit;ctx.translate(0,36*(1-p.entrance)-18*(1-p.exit));
 ctx.textBaseline="alphabetic";
 const num=numberText(s.number,p.countProgress);
 text(num,115,565,1240,360,"700 SIZEpx Georgia, serif",ivory);
 ctx.fillStyle=gold;ctx.fillRect(132,620,Math.max(2,110*p.entrance),5);
 const titleHeight=lines(s.title,128,731,1420,86,"600 SIZEpx system-ui",ivory,2);
 if(s.subtitle)lines(s.subtitle,132,731+titleHeight+16,1390,38,"400 SIZEpx system-ui","#c8cec3",2);
 ctx.restore();
 ctx.fillStyle=gold;ctx.font="500 23px system-ui";ctx.fillText(String(p.index+1).padStart(2,"0")+" / "+String(slides.length).padStart(2,"0"),132,1000);
 ctx.fillStyle=gold+"35";ctx.fillRect(310,987,1475,3);ctx.fillStyle=gold;ctx.fillRect(310,987,1475*clock.time/clock.duration,3);
 controls.sync(clock);controls.setFrameProgress({phase:"Frame render · Motion graphics",ready:true});
}
function resize(w,h){const dpr=exportMode?1:Math.min(devicePixelRatio||1,profile.dpr);canvas.width=Math.max(1,Math.round(w*dpr));canvas.height=Math.max(1,Math.round(h*dpr));draw();}
if(exportMode){canvas.width=W;canvas.height=H;canvas.style.width="100vw";canvas.style.height="100vh";}else bindPreviewViewport(canvas,controls.ui,resize,false,DEFAULT_OUTPUT.aspect);
const dialog=document.getElementById("editor"),json=document.getElementById("json"),msg=document.getElementById("message"),edit=document.getElementById("edit");
edit.hidden=exportMode;edit.onclick=()=>{clock.setPlaying(false);controls.sync(clock);json.value=JSON.stringify(slides,null,2);msg.textContent="";dialog.showModal();};
document.getElementById("cancel").onclick=()=>dialog.close();
document.getElementById("reset").onclick=()=>{json.value=JSON.stringify(examples,null,2);msg.textContent="";};
document.getElementById("save").onclick=()=>{try{const next=validateSlides(JSON.parse(json.value));slides=next;try{localStorage.setItem(storageKey,JSON.stringify(slides));}catch{}clock.duration=slides.length*SLIDE_SECONDS;clock.seek(0);dialog.close();draw();}catch(e){msg.textContent=String(e.message||e);}};
window.__stats={get duration(){return clock.duration;},get count(){return slides.length;},setData(value){slides=validateSlides(value);clock.duration=slides.length*SLIDE_SECONDS;clock.seek(0);draw();},seek(t){clock.setPlaying(false);clock.seek(t);draw();},capture(t){this.seek(t);return canvas.toDataURL("image/png");}};
draw();loading.hidden=true;
if(!exportMode){function tick(now){if(clock.tick(now))draw();requestAnimationFrame(tick);}requestAnimationFrame(tick);}
