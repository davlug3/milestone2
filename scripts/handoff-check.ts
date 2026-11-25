import { BOOK_DIMENSIONS as dims } from "../src/config/bookConfig";
import { PaperSimulation } from "../src/physics/PaperSimulation";
import { PageTurnController } from "../src/animation/PageTurnController";
import { TurnHandoff, TURN_HANDOFF_SECONDS } from "../src/physics/TurnHandoff";
import { textRoot, textStackY, textPageY, textPageFloor, textCoverFloor } from "../src/book/textBlockBinding";

const cols=25, rows=33, dt=1/120, width=dims.width;
let rawFirst=0, smoothFirst=0;
for (let k=0;k<8;k++) {
  const root=textRoot(dims,k), gutterX=-width/2+root.x, restY=textStackY(dims,k);
  const sim=new PaperSimulation({cols,rows,width,height:dims.height,dt,iterations:12,bendStiffness:1.2,longRangeBend:true,bendSpans:[3,4,5,6],plane:"xz",groundHeight:x=>textPageFloor(dims,k,x+width/2,textCoverFloor(dims))});
  for (const p of sim.particles) {
    p.y=p.py=textPageY(dims,k,p.x+width/2);
    p.x=p.px=p.x+root.x;
  }
  const spineIndices=Array.from({length:rows},(_,r)=>r*cols);
  const foreEdgeIndices=spineIndices.map(i=>i+cols-1);
  const ctl=new PageTurnController({foreEdgeIndices,spineIndices,gutterX,restY,spineRestY:root.y,landY:textCoverFloor(dims)+0.0002+k*0.0008,landSpineY:root.y,spineTargetX:gutterX,width,duration:2.5,liftScale:0.45,lead:0.03,liftVar:0.03,rows});
  ctl.seedZ(sim.particles);ctl.setProgress(0);ctl.apply(sim.particles);
  const handoff=new TurnHandoff();handoff.capture(sim.particles);
  const rest=sim.particles.map(p=>({...p}));
  for(let n=1;n<=Math.ceil(TURN_HANDOFF_SECONDS/dt);n++){
    ctl.setProgress((n-1)*dt/2.5);ctl.apply(sim.particles);sim.step();
    const displayed=handoff.pose(sim.particles,n*dt);
    for(let i=0;i<displayed.length;i++){
      const a=rest[i],b=sim.particles[i],v=displayed[i];
      if(!Number.isFinite(v.x+v.y+v.z))throw Error("Nonfinite displayed page");
      if(n===1){
        rawFirst=Math.max(rawFirst,Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z));
        smoothFirst=Math.max(smoothFirst,Math.hypot(v.x-a.x,v.y-a.y,v.z-a.z));
      }
      if(i%cols===0 && Math.hypot(v.x-gutterX,v.y-root.y)>1e-9)throw Error("Binding moved");
    }
    if(n*dt>=TURN_HANDOFF_SECONDS && displayed!==sim.particles)throw Error("Handoff did not converge");
  }
}
if(smoothFirst>rawFirst*0.01+1e-9)throw Error("First-step displacement not suppressed");
console.log(`PASS: 8 pages; first-step displacement ${(rawFirst*1000).toFixed(3)}mm -> ${(smoothFirst*1000).toFixed(6)}mm; roots fixed`);
