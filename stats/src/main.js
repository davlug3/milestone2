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
// All motion is a pure function of the timeline: seeking and layer exports stay synchronized.
function rollingNumber(value,progress,x,y,max,size,color){
 const final=numberText(value),current=numberText(value,progress),font="700 SIZEpx Georgia, serif";
 ctx.font=font.replace("SIZE",String(size));while(ctx.measureText(final).width>max&&size>12){size-=2;ctx.font=font.replace("SIZE",String(size));}
 const glyphWidth=Math.max(...Array.from("0123456789",ch=>ctx.measureText(ch).width));
 const widths=Array.from(final,ch=>/\d/.test(ch)?glyphWidth:ctx.measureText(ch).width);
 let left=x-widths.reduce((a,b)=>a+b,0)/2;
 // The integer counter uses fixed digit slots, so the center never jumps as digits appear.
 const digits=Array.from(current).filter(ch=>/\d/.test(ch)),total=Array.from(final).filter(ch=>/\d/.test(ch)).length;
 const padded=Array(Math.max(0,total-digits.length)).fill("0").concat(digits);let k=0;
 for(let i=0;i<final.length;i++){
   const ch=final[i],w=widths[i],cx=left+w/2;left+=w;
   if(!/\d/.test(ch)){ctx.fillStyle=color;ctx.fillText(ch,cx,y);continue;}
   const digit=Number(padded[k++]||0);
   const phase=progress>=1?0:Math.sin(Math.PI*progress)*.32*Math.sin(progress*15+i*.8);
   ctx.save();ctx.beginPath();ctx.rect(cx-w/2-3,y-size*.57,w+6,size*1.14);ctx.clip();ctx.fillStyle=color;
   ctx.fillText(String(digit),cx,y+phase*size);
   if(Math.abs(phase)>.03){ctx.globalAlpha*=Math.abs(phase)*.6;ctx.fillText(String((digit+(phase>0?9:1))%10),cx,y+phase*size-Math.sign(phase)*size);}
   ctx.restore();
 }
}
function revealLine(line,x,y,max,size,font,color,progress,exit){
 const q=unit(progress),lift=(1-q)*size*.82-exit*size*.45;
 ctx.save();ctx.globalAlpha*=q*(1-exit);ctx.beginPath();ctx.rect(x-max/2-4,y-size*.64,max+8,size*1.28);ctx.clip();
 text(line,x,y+lift,max,size,font,color);ctx.restore();
}
function draw(){
 const p=slidePose(clock.time,slides.length),s=slides[p.index],palette=palettes[p.index%palettes.length];
 const [a,b,gold,ivory]=palette,m=motionPose(p.local,p.index,slides.length);
 ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);ctx.clearRect(0,0,W,H);
 if(layer==="chroma"){ctx.fillStyle="#00ff00";ctx.fillRect(0,0,W,H);}
 if(layer==="composite"||layer==="background"){
 const bg=ctx.createLinearGradient(0,0,W,H);bg.addColorStop(0,a);bg.addColorStop(1,b);ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
 const glow=ctx.createRadialGradient(W/2,H/2,0,W/2,H/2,850);glow.addColorStop(0,gold+"18");glow.addColorStop(1,gold+"00");ctx.fillStyle=glow;ctx.fillRect(0,0,W,H);
 // Fine graphic contours, decorative only: no fabricated quantitative chart.
 ctx.save();ctx.translate(W/2,H/2);ctx.rotate(-.28+clock.time*.025);
 for(let i=0;i<9;i++){ctx.strokeStyle=gold+(i%3===0?"1c":"0c");ctx.lineWidth=i%3===0?2:1;ctx.beginPath();const breathing=1+.035*Math.sin(clock.time*.95+i*.4);ctx.ellipse(0,0,(190+i*43)*breathing,(270+i*34)*breathing,0,0,Math.PI*2);ctx.stroke();}
 ctx.restore();
 // Soft drifting light, and sparse deterministic dust motes (background pass only).
 const lx=W/2+Math.cos(clock.time*.35)*560,ly=H/2+Math.sin(clock.time*.29)*320;
 const bloom=ctx.createRadialGradient(lx,ly,0,lx,ly,620);bloom.addColorStop(0,gold+"12");bloom.addColorStop(1,gold+"00");ctx.fillStyle=bloom;ctx.fillRect(0,0,W,H);
 for(let i=0;i<48;i++){const x=((i*173.37+clock.time*(7+i%5))%W),y=((i*91.7-clock.time*(9+i%7))%H+H)%H;ctx.globalAlpha=.04+.10*(.5+.5*Math.sin(i*2.7+clock.time*.8));ctx.fillStyle=gold;ctx.beginPath();ctx.arc(x,y,.8+i%3*.65,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;
 }
 if(layer!=="background"){
 ctx.textAlign="center";ctx.textBaseline="middle";
 const title=layoutLines(s.title,1510,86,"600 SIZEpx system-ui",2);
 const subtitle=s.subtitle?layoutLines(s.subtitle,1400,38,"400 SIZEpx system-ui",2):null;
 const numberBlock=340,gap=42,divider=5,afterDivider=55,subtitleGap=subtitle?26:0;
 const blockHeight=numberBlock+gap+divider+afterDivider+title.height+subtitleGap+(subtitle?.height||0);
 let y=(H-blockHeight)/2;
 // Subtle overshoot and masked rolling digits, rather than a flat crossfade.
 ctx.save();ctx.globalAlpha=m.number*(1-m.exit);const cy=y+numberBlock/2;
 ctx.translate(W/2,cy+(1-m.number)*82-m.exit*60);
 const scale=.86+.14*m.number+.025*Math.sin(Math.PI*m.number);ctx.scale(scale,scale);
 ctx.beginPath();ctx.rect(-800,-numberBlock*.61,1600,numberBlock*1.22);ctx.clip();
 const tint=ctx.createLinearGradient(0,-180,0,180);tint.addColorStop(0,"#ffffff");tint.addColorStop(.48,ivory);tint.addColorStop(1,gold);
 rollingNumber(s.number,m.count,0,0,1570,360,tint);
 ctx.restore();y+=numberBlock+gap;
 // Accent extends from the center, followed by a restrained moving highlight.
 ctx.save();ctx.globalAlpha=(1-m.exit)*m.accent;
 const bar=110*m.accent;ctx.fillStyle=gold;ctx.fillRect(W/2-bar/2,y,bar,divider);
 if(m.shine>0&&m.shine<1){const sx=W/2-bar/2+bar*m.shine;const shine=ctx.createLinearGradient(sx-12,0,sx+12,0);shine.addColorStop(0,gold+"00");shine.addColorStop(.5,"#ffffff");shine.addColorStop(1,gold+"00");ctx.fillStyle=shine;ctx.fillRect(W/2-bar/2,y,bar,divider);}
 ctx.restore();y+=divider+afterDivider;
 for(let i=0;i<title.list.length;i++){revealLine(title.list[i],W/2,y+title.size*.565,1510,title.size,"600 SIZEpx system-ui",ivory,easeOut((p.local-.48-i*.11)/.85),m.exit);y+=title.size*1.13;}
 if(subtitle){y+=subtitleGap;for(let i=0;i<subtitle.list.length;i++){revealLine(subtitle.list[i],W/2,y+subtitle.size*.565,1400,subtitle.size,"400 SIZEpx system-ui","#c8cec3",easeOut((p.local-.88-i*.10)/.8),m.exit);y+=subtitle.size*1.13;}}
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
