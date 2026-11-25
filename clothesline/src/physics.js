// Fixed-step XPBD-inspired distance constraints, with two kinematic clothespin attachments.
import {random,cameraPose} from "../../slideshow/src/pose.js";
export const DT=1/120,SPACING=.49,PHOTO_W=.39,PHOTO_H=.274,THICKNESS=.00065;
export const lineY=(x,span)=>1.66-.12*(1-Math.pow(2*x/span,2));
export function galleryCamera(t,count,duration){
 const span=Math.max(0,(count-1)*SPACING),ropeSpan=Math.max(1.5,span+.9),u=Math.max(0,Math.min(1,t/duration));
 const f=u-.075*Math.sin(2*Math.PI*u)/(2*Math.PI);
 const x=-span/2+span*f,h=cameraPose(t);
 // Track the middle of the hanging prints along the actual sag of the hero line.
 const centerY=lineY(x,ropeSpan)-.012-PHOTO_H/2;
 return {x:x-.24+h.x,y:centerY+.035+h.y-.78,z:1.24+h.z-.35,targetX:x+h.targetX,targetY:centerY,targetZ:.012+h.targetZ,roll:h.roll};
}
export function makeSheet(index,cols=25,rows=19){
 const n=cols*rows,r=random(137+index*915),rest=new Float64Array(n*3),p=new Float64Array(n*3),prev=new Float64Array(n*3),inverse=new Float64Array(n),links=[];
 const phase=r()*6.283,phase2=r()*6.283,curl=.006+r()*.009,fold=.008+r()*.012,side=r()<.5?-1:1;
 const left=Math.round((cols-1)*.19),right=Math.round((cols-1)*.81);
 for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
  const k=j*cols+i,u=i/(cols-1),v=j/(rows-1),x=(u-.5)*PHOTO_W;
  const crease=Math.max(0,(side*(u-.5)*2+v-1.24)/.76);
  const z=v*(curl*(2*u-1)**2+.0022*Math.sin(u*21+v*11+phase)+.0015*Math.sin(v*27-u*5+phase2))+fold*crease*crease;
  rest.set([x,-v*PHOTO_H,z],3*k);inverse[k]=j===0&&(i===left||i===right)?0:1;
 }
 p.set(rest);prev.set(rest);
 function link(a,b,compliance){const i=a*3,j=b*3;links.push({a,b,len:Math.hypot(rest[i]-rest[j],rest[i+1]-rest[j+1],rest[i+2]-rest[j+2]),compliance,lambda:0});}
 for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
  const k=j*cols+i;
  if(i+1<cols)link(k,k+1,1e-9);
  if(j+1<rows)link(k,k+cols,1e-9);
  if(i+1<cols&&j+1<rows){link(k,k+cols+1,1.5e-9);link(k+1,k+cols,1.5e-9);}
  if(i+2<cols)link(k,k+2,2e-8);
  if(j+2<rows)link(k,k+cols*2,2e-8);
  // Stiffer long-range bending links preserve the print's curved rest shape.
  if(i+4<cols)link(k,k+4,6e-8);
  if(j+4<rows)link(k,k+cols*4,6e-8);
  if(i+8<cols)link(k,k+8,8e-8);
  if(j+8<rows)link(k,k+cols*8,8e-8);
  if(i+4<cols&&j+4<rows){link(k,k+cols*4+4,7e-8);link(k+4,k+cols*4,7e-8);}
 }
 return {cols,rows,p,prev,rest,inverse,links,phase,phase2,left,right};
}
export function resetSheet(s){s.p.set(s.rest);s.prev.set(s.rest);}
export function windAt(t,phase){return 1.0*Math.sin(t*1.5+phase)+.48*Math.sin(t*3.7+phase*.53)+.22*Math.sin(t*7.9+phase);}
export function stepSheet(s,t,iterations=12){
 const {p,prev,rest,inverse,links,cols,rows,phase}=s;
 for(let k=0;k<inverse.length;k++){
  const i=k*3;if(!inverse[k]){for(let q=0;q<3;q++)p[i+q]=prev[i+q]=rest[i+q];continue;}
  const v=Math.floor(k/cols)/(rows-1),u=(k%cols)/(cols-1);
  const ax=.24*windAt(t+.14*u,phase+1.3),az=(.75+v*.45)*windAt(t-.17*v,phase)+.26;
  const ox=p[i],oy=p[i+1],oz=p[i+2];
  p[i]+=(ox-prev[i])*.978+ax*DT*DT;
  p[i+1]+=(oy-prev[i+1])*.978-9.81*DT*DT;
  p[i+2]+=(oz-prev[i+2])*.978+az*DT*DT;
  prev[i]=ox;prev[i+1]=oy;prev[i+2]=oz;
 }
 for(const l of links)l.lambda=0;
 for(let it=0;it<iterations;it++)for(const l of links){
  const a=l.a*3,b=l.b*3,wa=inverse[l.a],wb=inverse[l.b];if(!wa&&!wb)continue;
  const x=p[a]-p[b],y=p[a+1]-p[b+1],z=p[a+2]-p[b+2],len=Math.hypot(x,y,z);if(len<1e-10)continue;
  const alpha=l.compliance/(DT*DT),dl=(-(len-l.len)-alpha*l.lambda)/(wa+wb+alpha);l.lambda+=dl;
  const q=dl/len;p[a]+=wa*q*x;p[a+1]+=wa*q*y;p[a+2]+=wa*q*z;p[b]-=wb*q*x;p[b+1]-=wb*q*y;p[b+2]-=wb*q*z;
 }
}
