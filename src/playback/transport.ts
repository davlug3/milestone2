/** Shared deterministic timeline and transport UI; scene-specific poses stay in adapters. */
export class PlaybackClock {
  time=0;
  playing=false;
  private last:number|null=null;
  constructor(public duration:number,public rate=0.85){}
  seek(t:number){this.time=Math.max(0,Math.min(this.duration,Number.isFinite(t)?t:0));this.last=null;return this.time;}
  setPlaying(next:boolean){this.playing=next;this.last=null;}
  tick(now:number,ready=true,fixedStep?:number){
    const dt=this.last===null?0:Math.max(0,Math.min(.05,(now-this.last)/1000));
    this.last=now;
    if(!this.playing||!ready)return false;
    const next=Math.min(this.duration,this.time+(fixedStep??dt)*this.rate);
    const changed=next!==this.time;this.time=next;
    if(this.time>=this.duration)this.setPlaying(false);
    return changed;
  }
}
export function createPlaybackControls(options:{modes:{value:string;label:string}[];onToggle:()=>void;onRestart:()=>void;onSeek:(t:number)=>void;onMode:(mode:string)=>void;hidden?:boolean}){
 const ui=document.createElement("div");
 ui.className="demo-ui shared-transport";ui.id="controls";
 ui.innerHTML='<div class="timeline-heading"><label for="seek">Timeline</label><span id="time" class="demo-time">0.0 / 0.0s</span></div><input id="seek" type="range" min="0" max="1" step=".01" value="0" aria-label="Playback position"><div class="transport-actions"><button id="play" class="demo-play" type="button">Play</button><button id="restart" type="button">Restart</button><select id="mode" class="demo-render" aria-label="Render mode"></select></div><div class="frame-meter"><div class="frame-heading"><span id="frame-stage">Frame render · Real-time</span><span id="frame-count">—</span></div><progress id="frame-progress" max="1" value="0" aria-label="Current frame render progress"></progress></div><span id="samples" class="demo-samples" aria-live="polite"></span>';
 const style=document.createElement("style");
 style.textContent=`
.shared-transport#controls{box-sizing:border-box;position:fixed;z-index:20;bottom:max(12px,env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);width:min(560px,calc(100% - 24px));max-width:calc(100% - 24px);display:grid;grid-template-columns:minmax(0,1fr);gap:7px;padding:12px 14px;background:#171717f2;border:1px solid #ffffff25;border-radius:14px;color:#f2e8d8;font:13px system-ui;white-space:normal;user-select:none}
.shared-transport#controls[hidden]{display:none}
.shared-transport .timeline-heading,.shared-transport .frame-heading{display:flex;align-items:center;justify-content:space-between;gap:8px;font-variant-numeric:tabular-nums}
.shared-transport .timeline-heading label{font-weight:600}
.shared-transport .demo-time{min-width:0;white-space:nowrap;text-align:right;color:#f2e8d8}
.shared-transport#controls #seek{appearance:none;-webkit-appearance:none;display:block;width:100%;max-width:none;min-width:0;height:36px;margin:0;padding:0;background:transparent;border:0;cursor:ew-resize;touch-action:none;--played:0%}
.shared-transport #seek::-webkit-slider-runnable-track{height:8px;border-radius:8px;background:linear-gradient(to right,#d9bb91 var(--played),#615950 var(--played))}
.shared-transport #seek::-moz-range-track{height:8px;border-radius:8px;background:linear-gradient(to right,#d9bb91 var(--played),#615950 var(--played))}
.shared-transport #seek::-webkit-slider-thumb{appearance:none;-webkit-appearance:none;width:24px;height:24px;margin-top:-8px;background:#fff0db;border:2px solid #aa8960;border-radius:50%;box-shadow:0 1px 5px #0008}
.shared-transport #seek::-moz-range-thumb{width:20px;height:20px;background:#fff0db;border:2px solid #aa8960;border-radius:50%}
.shared-transport #seek:focus-visible{outline:2px solid #d9bb91;outline-offset:2px;border-radius:6px}
.shared-transport .transport-actions{display:grid;grid-template-columns:auto auto minmax(0,1fr);gap:8px}
.shared-transport button,.shared-transport select{box-sizing:border-box;font:inherit;color:#211a14;background:#f2e8d8;border:0;border-radius:7px;padding:8px 10px;cursor:pointer;min-width:0;min-height:40px;width:100%}
.shared-transport .frame-meter{display:grid;gap:5px}
.shared-transport .frame-heading{font-size:11px;color:#d9cbb8}
.shared-transport #frame-count{white-space:nowrap}
.shared-transport #frame-progress{appearance:none;display:block;width:100%;height:6px;border:0;border-radius:6px;overflow:hidden;background:#615950;accent-color:#d9bb91}
.shared-transport #frame-progress::-webkit-progress-bar{background:#615950;border-radius:6px}
.shared-transport #frame-progress::-webkit-progress-value{background:#d9bb91;border-radius:6px}
.shared-transport #frame-progress::-moz-progress-bar{background:#d9bb91;border-radius:6px}
.shared-transport .demo-samples{font-size:11px;max-width:100%;overflow-wrap:anywhere}
.shared-transport .demo-samples:empty{display:none}
@media(max-width:720px),(pointer:coarse){.shared-transport#controls{padding:10px 12px;bottom:max(8px,env(safe-area-inset-bottom))}.shared-transport button,.shared-transport select{min-height:44px;font-size:14px}.shared-transport#controls #seek{height:44px}}
@media(max-height:450px) and (orientation:landscape){.shared-transport#controls{padding:6px 10px;gap:3px;width:min(640px,calc(100% - 24px))}.shared-transport#controls #seek{height:27px}.shared-transport button,.shared-transport select{min-height:32px;padding:5px 8px}}
`;
 document.head.appendChild(style);document.body.appendChild(ui);ui.hidden=!!options.hidden;
 const button=ui.querySelector<HTMLButtonElement>("#play")!,restart=ui.querySelector<HTMLButtonElement>("#restart")!,slider=ui.querySelector<HTMLInputElement>("#seek")!,label=ui.querySelector<HTMLSpanElement>("#time")!,mode=ui.querySelector<HTMLSelectElement>("#mode")!,samples=ui.querySelector<HTMLSpanElement>("#samples")!;
 const frameStage=ui.querySelector<HTMLSpanElement>("#frame-stage")!,frameCount=ui.querySelector<HTMLSpanElement>("#frame-count")!,frameProgress=ui.querySelector<HTMLProgressElement>("#frame-progress")!;
 for(const item of options.modes){const opt=document.createElement("option");opt.value=item.value;opt.textContent=item.label;mode.appendChild(opt);}
 button.onclick=options.onToggle;restart.onclick=options.onRestart;mode.onchange=()=>options.onMode(mode.value);
 let scrubbing=false,pending:number|null=null,seekRaf=0;
 const flush=()=>{seekRaf=0;if(pending!==null){const next=pending;pending=null;options.onSeek(next);}};
 const preview=(time:number,duration:number)=>{slider.style.setProperty("--played",(duration>0?Math.min(100,time/duration*100):0)+"%");label.textContent=time.toFixed(1)+" / "+duration.toFixed(1)+"s";};
 slider.addEventListener("pointerdown",()=>{scrubbing=true;});
 slider.addEventListener("input",()=>{pending=Number(slider.value);preview(pending,Number(slider.max));if(!seekRaf)seekRaf=requestAnimationFrame(flush);});
 const finish=()=>{if(!scrubbing&&pending===null)return;scrubbing=false;if(seekRaf)cancelAnimationFrame(seekRaf);flush();};
 window.addEventListener("pointerup",finish);window.addEventListener("pointercancel",finish);slider.addEventListener("change",finish);
 function setFrameProgress(state:{phase:string;samples?:number;target?:number;ready?:boolean}){
   const target=state.target??0,done=Math.max(0,Math.min(target,state.samples??0));
   frameStage.textContent=state.phase;
   if(target>0){frameProgress.max=target;frameProgress.value=done;frameCount.textContent=Math.floor(done)+" / "+target+" spp · "+Math.floor(done/target*100)+"%";}
   else{frameProgress.max=1;if(state.ready===undefined){frameProgress.removeAttribute("value");frameCount.textContent="Working…";}else{frameProgress.value=state.ready?1:0;frameCount.textContent=state.ready?"Ready":"Waiting";}}
 }
 return {ui,mode,samples,setFrameProgress,sync(clock:PlaybackClock){button.textContent=clock.playing?"Pause":"Play";slider.max=String(Math.max(.01,clock.duration));slider.disabled=clock.duration<=0;if(!scrubbing&&pending===null){slider.value=String(clock.time);preview(clock.time,clock.duration);}},dispose(){if(seekRaf)cancelAnimationFrame(seekRaf);window.removeEventListener("pointerup",finish);window.removeEventListener("pointercancel",finish);ui.remove();style.remove();}};
}
