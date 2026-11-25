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
  ui.className="demo-ui shared-transport";
  ui.id="controls";
  ui.innerHTML='<button id="play" class="demo-play" type="button">Play</button><button id="restart" type="button">Restart</button><input id="seek" type="range" min="0" max="1" step=".01" value="0" aria-label="Playback position"><span id="time" class="demo-time">0.0s</span><select id="mode" class="demo-render" aria-label="Render mode"></select><span id="samples" class="demo-samples" aria-live="polite"></span>';
  const style=document.createElement("style");
  style.textContent=".shared-transport#controls{box-sizing:border-box;position:fixed;z-index:20;bottom:max(12px,env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);width:max-content;max-width:calc(100vw - 24px);display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:8px;padding:10px 12px;background:#171717e8;border:1px solid #ffffff20;border-radius:14px;color:#f2e8d8;font:13px system-ui;white-space:normal}.shared-transport#controls[hidden]{display:none}.shared-transport button,.shared-transport select{font:inherit;color:#211a14;background:#f2e8d8;border:0;border-radius:7px;padding:8px 10px;cursor:pointer;min-width:0}.shared-transport input{width:clamp(80px,24vw,280px);accent-color:#cdb18d}.shared-transport .demo-time{min-width:0;white-space:nowrap}.shared-transport .demo-samples{font-size:11px;max-width:100%;overflow-wrap:anywhere}";
  document.head.appendChild(style);document.body.appendChild(ui);ui.hidden=!!options.hidden;
  const button=ui.querySelector<HTMLButtonElement>("#play")!;
  const restart=ui.querySelector<HTMLButtonElement>("#restart")!;
  const slider=ui.querySelector<HTMLInputElement>("#seek")!;
  const label=ui.querySelector<HTMLSpanElement>("#time")!;
  const mode=ui.querySelector<HTMLSelectElement>("#mode")!;
  const samples=ui.querySelector<HTMLSpanElement>("#samples")!;
  for(const item of options.modes){const opt=document.createElement("option");opt.value=item.value;opt.textContent=item.label;mode.appendChild(opt);}
  button.onclick=options.onToggle;restart.onclick=options.onRestart;slider.oninput=()=>options.onSeek(Number(slider.value));mode.onchange=()=>options.onMode(mode.value);
  return {ui,mode,samples,sync(clock:PlaybackClock){button.textContent=clock.playing?"Pause":"Play";slider.max=String(clock.duration);slider.value=String(clock.time);label.textContent=clock.time.toFixed(1)+" / "+clock.duration.toFixed(1)+"s";},dispose(){ui.remove();style.remove();}};
}
