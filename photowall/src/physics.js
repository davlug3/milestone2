// Reduced-coordinate stiff sheet dynamics. Fixed XY footprint; elastic Z modes.
// Conservative overlap layers ensure triangle clearance for the entire motion.
export const GAP=.018, DT=1/120, AMPLITUDE=.045;
export function prepareSheets(sheets){
 for(let i=0;i<sheets.length;i++){
  const s=sheets[i],a=s.geometry.attributes.position;
  s.rest=Float32Array.from(a.array);s.q=0;s.velocity=0;
  s.weights=new Float32Array(a.count);
  let lo=Infinity,hi=-Infinity,x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;
  const c=Math.cos(s.group.rotation.z),d=Math.sin(s.group.rotation.z);
  for(let k=0;k<a.count;k++){
   const x=a.getX(k),y=a.getY(k),z=a.getZ(k),u=s.geometry.attributes.uv.getX(k),v=s.geometry.attributes.uv.getY(k);
   const weight=(1-v)**2*(.7+.3*Math.cos((u-.5)*Math.PI));
   s.weights[k]=weight;lo=Math.min(lo,z-AMPLITUDE*weight);hi=Math.max(hi,z+AMPLITUDE*weight);
   const wx=s.group.position.x+c*x-d*y,wy=s.group.position.y+d*x+c*y;
   x0=Math.min(x0,wx);x1=Math.max(x1,wx);y0=Math.min(y0,wy);y1=Math.max(y1,wy);
  }
  s.bounds={x0,x1,y0,y1};s.lo=lo;s.hi=hi;
 }
 // Resolve back-to-front in stable original layer order, conservatively using
 // full swept Z intervals and projected AABBs, not sparse vertex contacts.
 const ordered=[...sheets].sort((a,b)=>a.group.position.z-b.group.position.z||a.index-b.index);
 const overlap=(a,b)=>a.x0<b.x1&&b.x0<a.x1&&a.y0<b.y1&&b.y0<a.y1;
 for(let i=0;i<ordered.length;i++){
  const s=ordered[i];let base=Math.max(.025-s.lo,s.group.position.z);
  for(let j=0;j<i;j++){const p=ordered[j];if(overlap(s.bounds,p.bounds))base=Math.max(base,p.group.position.z+p.hi+GAP-s.lo);}
  s.group.position.z=base;s.group.updateMatrixWorld(true);
 }
 let minGap=Infinity,pairs=0;
 for(let i=0;i<ordered.length;i++)for(let j=0;j<i;j++){
  const s=ordered[i],p=ordered[j];if(overlap(s.bounds,p.bounds)){pairs++;minGap=Math.min(minGap,s.group.position.z+s.lo-p.group.position.z-p.hi);}
 }
 if(minGap<GAP-1e-6)throw Error('Paper clearance failed');
 return {pairs,minGap,maxOffset:Math.max(...ordered.map(s=>s.group.position.z))};
}
export function createPaperMotion(sheets,duration){
 const frames=Math.ceil(duration/DT)+1,cache=new Float32Array(frames*sheets.length);
 // Damped spring bending mode, deterministic fixed step; pin row stays fixed.
 for(let n=0;n<frames;n++)for(let i=0;i<sheets.length;i++){
  const s=sheets[i],t=n*DT,phase=s.index*2.39996;
  const force=.95*Math.sin(t*2.1+phase)+.45*Math.sin(t*4.7+phase*.63);
  s.velocity+=(force-42*s.q-7*s.velocity)*DT;
  s.q=Math.max(-AMPLITUDE,Math.min(AMPLITUDE,s.q+s.velocity*DT));
  cache[n*sheets.length+i]=s.q;
 }
 return t=>{
  const f=Math.max(0,Math.min(frames-1,t/DT)),a=Math.floor(f),b=Math.min(frames-1,a+1),u=f-a;
  for(let i=0;i<sheets.length;i++){
   const s=sheets[i],p=s.geometry.attributes.position,q=cache[a*sheets.length+i]*(1-u)+cache[b*sheets.length+i]*u;
   for(let k=0;k<p.count;k++)p.setZ(k,s.rest[k*3+2]+s.weights[k]*q);
   p.needsUpdate=true;s.geometry.computeVertexNormals();
  }
 };
}
