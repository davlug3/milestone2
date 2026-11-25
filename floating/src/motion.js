import {random,cameraPose} from "../../slideshow/src/pose.js";
export const SPACING=1.35,SECONDS=4.2;
const clamp=x=>Math.max(0,Math.min(1,x)),smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
export function makeLayout(count){
 const r=random(184),out=[];
 for(let i=0;i<count;i++){
  const side=i%2===0?-1:1,z=-i*SPACING;
  out.push({photo:i,hero:true,x:side*.17,y:1.38+(r()-.5)*.08,z,scale:1,phase:r()*6.283,yaw:side*.10,roll:(r()-.5)*.12});
  for(let j=0;j<3;j++){
   const s=j%2===0?1:-1;
   out.push({photo:(i+j+1)%count,hero:false,x:s*(.69+r()*.25),y:1.36+(j===2?.48:-.24)+(r()-.5)*.18,z:z-.35-j*.26,scale:.68+r()*.19,phase:r()*6.283,yaw:-s*(.20+r()*.35),roll:(r()-.5)*.35});
  }
 }
 return out;
}
export function floatPose(s,t){
 const p=s.phase,amp=s.hero?1:1.35;
 return {x:s.x+amp*.036*Math.sin(t*.58+p),y:s.y+amp*.037*Math.sin(t*.74+p),z:s.z+.026*Math.cos(t*.48+p),yaw:s.yaw+.055*Math.sin(t*.69+p),pitch:.045*Math.sin(t*.91+p),roll:s.roll+.032*Math.sin(t*.81+p)};
}
export function memoryCamera(t,count,layout){
 const time=Math.max(0,Math.min(count*SECONDS,t)),i=Math.min(count-1,Math.floor(time/SECONDS)),u=(time-i*SECONDS)/SECONDS;
 const j=Math.min(count-1,i+1),a=floatPose(layout[i*4],time),b=floatPose(layout[j*4],time);
 // Hold the current image, then glide past it toward the next one on an offset track.
 const q=smooth((u-.58)/.42),x=a.x+(b.x-a.x)*q,y=a.y+(b.y-a.y)*q,z=a.z+(b.z-a.z)*q;
 const h=cameraPose(time),side=(i%2===0?-1:1)*(1-q)+(j%2===0?-1:1)*q;
 return {x:x-side*.16+.055*Math.sin(time*.45)+h.x,y:y+.035+h.y-.78,z:z+1.10-.045*Math.sin(Math.PI*u)**2+h.z-.35,targetX:x+h.targetX,targetY:y,targetZ:z+h.targetZ,roll:h.roll};
}
