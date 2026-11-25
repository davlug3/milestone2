import * as THREE from "three";
import {random} from "./pose.js";

const NX=28,NZ=20;
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
const damp=(t,f,d)=>Math.exp(-d*t)*Math.sin(2*Math.PI*f*t);
// Each print has a persistent, individually seeded handling history.
export function shapeFor(seed,index){
  const r=random((seed^Math.imul(index+1,0x9e3779b9))>>>0);
  return {curlX:.005+.009*r(),curlZ:.002+.006*r(),twist:(r()-.5)*.005,
    cornerX:r()<.5?-1:1,cornerZ:r()<.5?-1:1,
    fold:index%3===1?.010+.012*r():.001+.004*r(),
    wrinkle:index%4===2?.003+.002*r():.0007+.0015*r(),
    phase:r()*Math.PI*2,phase2:r()*Math.PI*2,frequency:3.5+2*r()};
}
// Closed-form damped modes: independent of frame rate, seeking and capture order.
export function displacement(shape,u,v,age,c){
  const x=2*u-1,z=2*v-1;
  const rest=shape.curlX*x*x+shape.curlZ*z*z+shape.twist*x*z;
  // A localized diagonal crease, with a narrow rounded hinge rather than a spike.
  const corner=clamp((shape.cornerX*x+shape.cornerZ*z-1.30)/.70);
  const crease=shape.fold*corner*corner*(3-2*corner);
  const wrinkles=shape.wrinkle*(.55*Math.sin(8*x+5*z+shape.phase)+.45*Math.sin(13*z-3*x+shape.phase2))*(.35+.65*Math.max(Math.abs(x),Math.abs(z)));
  let dynamic=0;
  if(age>=0&&age<c.flight){
    const t=clamp(age/c.flight),envelope=Math.sin(Math.PI*t);
    dynamic=envelope*(.009*Math.sin(2*Math.PI*shape.frequency*age+shape.phase+3*x)*x*x+.006*Math.sin(2*Math.PI*3.1*age+shape.phase2+2*z)*z*z+.007*Math.sin(2*Math.PI*2.6*age+shape.phase)*x*z);
  }else if(age>=c.flight){
    const t=age-c.flight;
    // An impact launches a bending wave from the leading edge; three modes
    // ring down independently, then stop exactly at the end of the settle.
    const gate=1-smooth((t/c.settle-.65)/.35);
    const bend=.018*damp(t,5.2,5.7)*(x*x-.3);
    const torsion=.011*damp(t,4.1,6.4)*x*z;
    const edgeWave=.008*damp(t,7.2,7.8)*(z*z-.2);
    dynamic=gate*(bend+torsion+edgeWave);
  }
  return rest+crease+wrinkles+dynamic;
}
function grid(c,back){
  const pos=new Float32Array((NX+1)*(NZ+1)*3),uv=new Float32Array((NX+1)*(NZ+1)*2),idx=[];
  for(let j=0;j<=NZ;j++)for(let i=0;i<=NX;i++){
    const k=j*(NX+1)+i,u=i/NX,v=j/NZ;
    pos[k*3]=(u-.5)*c.width;pos[k*3+1]=(back?-1:1)*c.thickness/2;pos[k*3+2]=(v-.5)*c.depth;
    uv[k*2]=back?1-u:u;uv[k*2+1]=1-v;
  }
  for(let j=0;j<NZ;j++)for(let i=0;i<NX;i++){
    const a=j*(NX+1)+i,b=a+1,d=a+NX+1,e=d+1;
    if(back)idx.push(a,b,d,b,e,d);else idx.push(a,d,b,b,d,e);
  }
  const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.BufferAttribute(pos,3).setUsage(THREE.DynamicDrawUsage));g.setAttribute("uv",new THREE.BufferAttribute(uv,2));g.setIndex(idx);return g;
}
const boundary=[];
for(let i=0;i<NX;i++)boundary.push(i);
for(let j=0;j<NZ;j++)boundary.push(j*(NX+1)+NX);
for(let i=NX;i>0;i--)boundary.push(NZ*(NX+1)+i);
for(let j=NZ;j>0;j--)boundary.push(j*(NX+1));
function edgeGeometry(){
  const g=new THREE.BufferGeometry(),idx=[],pos=new Float32Array(boundary.length*2*3),uv=new Float32Array(boundary.length*2*2);
  for(let i=0;i<boundary.length;i++){const a=i*2,b=((i+1)%boundary.length)*2;idx.push(a,b,a+1,b,b+1,a+1);uv[a*2]=i/boundary.length;uv[(a+1)*2]=i/boundary.length;uv[(a+1)*2+1]=1;}
  g.setAttribute("position",new THREE.BufferAttribute(pos,3).setUsage(THREE.DynamicDrawUsage));g.setAttribute("uv",new THREE.BufferAttribute(uv,2));g.setIndex(idx);return g;
}
// Bake the white border into the photo texture so image and paper share one
// continuous curved surface. No floating image plane or multi-material groups.
export function printTexture(image,c,anisotropy){
  const canvas=document.createElement("canvas");canvas.width=1600;canvas.height=Math.round(1600*c.depth/c.width);
  const ctx=canvas.getContext("2d"),w=canvas.width,h=canvas.height;
  ctx.fillStyle="#f5f0e6";ctx.fillRect(0,0,w,h);
  const bx=w*.027,by=h*.037,dw=w-2*bx,dh=h-2*by;
  const iw=image.naturalWidth||image.width,ih=image.naturalHeight||image.height,scale=Math.max(dw/iw,dh/ih);
  const sw=dw/scale,sh=dh/scale;
  ctx.drawImage(image,(iw-sw)/2,(ih-sh)/2,sw,sh,bx,by,dw,dh);
  const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(8,anisotropy);return t;
}
export function createPhoto(c,shape,materials){
  const card=new THREE.Group(),top=grid(c,false),bottom=grid(c,true),edge=edgeGeometry();
  for(const [geo,mat] of [[top,materials.front],[bottom,materials.back],[edge,materials.edge]]){
    const mesh=new THREE.Mesh(geo,mat);mesh.castShadow=true;mesh.receiveShadow=true;card.add(mesh);
  }
  card.userData.photo={c,shape,top,bottom,edge,lastAge:NaN};
  deformPhoto(card,c.flight+c.settle);
  return card;
}
export function deformPhoto(card,age){
  const d=card.userData.photo,{c,shape,top,bottom,edge}=d;
  // Settled prints are static; skip redundant buffer uploads.
  age=Math.max(0,Math.min(age,c.flight+c.settle));
  if(d.lastAge===age)return;
  d.lastAge=age;
  const a=top.attributes.position,b=bottom.attributes.position,e=edge.attributes.position;
  for(let j=0;j<=NZ;j++)for(let i=0;i<=NX;i++){
    const k=j*(NX+1)+i,y=displacement(shape,i/NX,j/NZ,age,c);
    a.setY(k,y+c.thickness/2);b.setY(k,y-c.thickness/2);
  }
  for(let i=0;i<boundary.length;i++){
    const k=boundary[i];e.setXYZ(i*2,a.getX(k),a.getY(k),a.getZ(k));e.setXYZ(i*2+1,b.getX(k),b.getY(k),b.getZ(k));
  }
  for(const g of [top,bottom,edge]){g.attributes.position.needsUpdate=true;g.computeVertexNormals();g.computeBoundingSphere();g.computeBoundingBox();}
}
// A settled print is yaw-only. Bilinear sampling gives the local upper surface
// beneath the new sheet, rather than stacking every sheet at a fixed height.
export function supportHeight(card,x,z){
  const d=card.userData.photo,c=d.c,dx=x-card.position.x,dz=z-card.position.z;
  const co=Math.cos(card.rotation.y),si=Math.sin(card.rotation.y);
  const u=(co*dx-si*dz)/c.width+.5,v=(si*dx+co*dz)/c.depth+.5;
  if(u<0||u>1||v<0||v>1)return 0;
  const gx=u*NX,gz=v*NZ,i=Math.min(NX-1,Math.floor(gx)),j=Math.min(NZ-1,Math.floor(gz)),fx=gx-i,fz=gz-j;
  const a=d.top.attributes.position,k=j*(NX+1)+i;
  // Match the actual triangulation (diagonal between b and d).
  const y=fx+fz<=1?a.getY(k)+(a.getY(k+1)-a.getY(k))*fx+(a.getY(k+NX+1)-a.getY(k))*fz:
    a.getY(k+NX+2)+(a.getY(k+NX+1)-a.getY(k+NX+2))*(1-fx)+(a.getY(k+1)-a.getY(k+NX+2))*(1-fz);
  return card.position.y+y;
}
const rotation=new THREE.Matrix4(),point=new THREE.Vector3();
export function placePhoto(card,s,shot,time,previous){
  const c=shot.config;deformPhoto(card,time-shot.start);
  card.rotation.set(s.pitch,s.yaw,s.roll,"YXZ");rotation.makeRotationFromEuler(card.rotation);
  const a=card.userData.photo.bottom.attributes.position;
  let required=-Infinity;
  for(let i=0;i<a.count;i++){
    point.fromBufferAttribute(a,i).applyMatrix4(rotation);
    const x=s.x+point.x,z=s.z+point.z;
    let support=0;
    for(const other of previous)if(other.visible)support=Math.max(support,supportHeight(other,x,z));
    required=Math.max(required,support-point.y);
  }
  // The analytic toss height is clearance above contact, not another pile layer.
  const lift=Math.max(0,s.height-shot.layer*c.thickness);
  card.position.set(s.x,required+lift+.00012,s.z);
}
