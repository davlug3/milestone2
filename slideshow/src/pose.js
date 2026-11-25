// Analytic, deterministic 2.5D toss. Units: metres, seconds, radians.
export const defaults={interval:2.0,flight:.64,settle:.62,hold:2.5,seed:27,width:.205,depth:.145,thickness:.00065};
const clamp=x=>Math.max(0,Math.min(1,x));
const mix=(a,b,t)=>a+(b-a)*t;
const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
export function random(seed){let x=seed>>>0;return()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};}
export function makeShots(count,config={}){
  const c={...defaults,...config},r=random(c.seed),shots=[];
  // Alternating corners, with the latest print near the centre of attention.
  for(let i=0;i<count;i++){
    const side=i%4,angle=side*Math.PI/2+.25+(r()-.5)*.65;
    const x=(r()-.5)*.32,z=(r()-.5)*.18;
    const yaw=(r()-.5)*.62;
    const travel=[Math.cos(angle),Math.sin(angle)];
    const overlaps=shots.filter(p=>Math.abs(p.x-x)<c.width*.92&&Math.abs(p.z-z)<c.depth*.92);
    const layer=overlaps.length?Math.max(...overlaps.map(p=>p.layer))+1:0;
    shots.push({start:.35+i*c.interval,x,z,yaw,layer,fromX:x+travel[0]*.79,fromZ:z+travel[1]*.58,slideX:travel[0]*(.055+r()*.04),slideZ:travel[1]*(.04+r()*.025),spin:(r()-.5)*1.9,tilt:(r()-.5)*.9,roll:(r()-.5)*.65,config:c});
  }
  return shots;
}
export function duration(shots){return shots.length?shots.at(-1).start+shots.at(-1).config.flight+shots.at(-1).config.settle+shots.at(-1).config.hold:0;}
export function pose(shot,time){
  const {config:c}=shot,age=time-shot.start;
  if(age<0)return {visible:false,x:shot.fromX,z:shot.fromZ,height:0,yaw:shot.yaw,pitch:0,roll:0};
  const base=shot.layer*c.thickness;
  if(age<c.flight){
    const u=clamp(age/c.flight),travel=1-Math.pow(1-u,1.35);
    return {visible:true,x:mix(shot.fromX,shot.x+shot.slideX,travel),z:mix(shot.fromZ,shot.z+shot.slideZ,travel),height:base+.11*(1-u)+.27*4*u*(1-u),yaw:shot.yaw+shot.spin*(1-u)+.11,pitch:shot.tilt*(1-u)+.24*Math.sin(Math.PI*u),roll:shot.roll*(1-u)};
  }
  const u=clamp((age-c.flight)/c.settle),remain=Math.pow(1-u,3);
  const bounce=.018*Math.abs(Math.sin(u*Math.PI*3))*Math.pow(1-u,3);
  return {visible:true,x:shot.x+shot.slideX*remain,z:shot.z+shot.slideZ*remain,height:base+bounce,yaw:shot.yaw+.11*remain,pitch:.10*Math.sin(u*Math.PI*3)*Math.pow(1-u,3),roll:.065*Math.sin(u*Math.PI*2)*Math.pow(1-u,3)};
}
export function cameraPose(time){
  // Low-frequency, millimetre-scale movement: no pans or cuts.
  return {x:.009*Math.sin(time*.71)+.003*Math.sin(time*1.93),y:.83+.003*Math.sin(time*.91),z:.19+.006*Math.sin(time*.57),targetX:.005*Math.sin(time*.63),targetZ:.004*Math.cos(time*.81),roll:.003*Math.sin(time*.83)};
}
