import {makeTurn,type TurnSpec} from "./bookTurnSimulation";
import {Heightfield} from "../physics/Heightfield";
import {textRoot,textPageY} from "../book/textBlockBinding";
import {restingPageWear} from "../paper/pageShape";
const scope=self as unknown as {onmessage:((e:MessageEvent<TurnSpec>)=>void)|null;postMessage:(message:unknown,transfer?:Transferable[])=>void};
scope.onmessage=({data:spec})=>{
 try{
 const {dims,cols,rows,dt,floor,spineWidth,windows}=spec,W=dims.width,H=dims.height;
 const field=new Heightfield({width:W,height:H,nx:120,nz:110,paddingX:spineWidth});field.reset(floor);
 for(let k=0;k<windows.length;k++){
  const win=windows[k],{sim,controller}=makeTurn(spec,k,field),root=textRoot(dims,k,1);
  sim.reset();
  for(const p of sim.particles){const x=p.x+W/2;p.x=p.px=p.x+root.x;p.y=p.py=textPageY(dims,k,x,1)+restingPageWear(k,x/W,p.z/H+.5,1)}
  controller.setProgress(0);controller.apply(sim.particles);
  const steps=Math.ceil((win.dur+win.settle)/dt),stride=cols*rows*3,frames=new Float64Array((steps+1)*stride);
  function record(n:number){let i=n*stride;for(const p of sim.particles){frames[i++]=p.x;frames[i++]=p.y;frames[i++]=p.z}}
  record(0);
  for(let n=0;n<steps;n++){controller.setProgress(Math.max(0,Math.min(1,n*dt/win.dur)));controller.apply(sim.particles);sim.step();record(n+1)}
  for(const p of sim.particles)if(p.x < -W/2-.04)field.splat(p.x,p.z,p.y+.0006,2);
  scope.postMessage({kind:"page",index:k,steps,frames},[frames.buffer]);
 }
 scope.postMessage({kind:"done"});
 }catch(e){scope.postMessage({kind:"error",message:e instanceof Error?e.message:String(e)})}
};
