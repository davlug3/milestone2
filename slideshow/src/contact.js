// Exact vertical separation of piecewise-linear triangular surfaces.
// Extremal height difference over a projected triangle intersection occurs
// at a contained vertex or an edge intersection. Broad phase uses XZ bins.
const EPS=1e-10,CELL=.04;
const cross=(ax,az,bx,bz)=>ax*bz-az*bx;
const key=(x,z)=>x+','+z;
export function triangles(geometry,matrix,x=0,z=0){
 const a=geometry.attributes.position,idx=geometry.index.array,e=matrix.elements,points=[];
 for(let i=0;i<a.count;i++){
  const u=a.getX(i),v=a.getY(i),w=a.getZ(i);
  points.push([e[0]*u+e[4]*v+e[8]*w+e[12]+x,e[1]*u+e[5]*v+e[9]*w+e[13],e[2]*u+e[6]*v+e[10]*w+e[14]+z]);
 }
 const out=[];
 for(let i=0;i<idx.length;i+=3){
  const p=[points[idx[i]],points[idx[i+1]],points[idx[i+2]]];
  const det=cross(p[1][0]-p[0][0],p[1][2]-p[0][2],p[2][0]-p[0][0],p[2][2]-p[0][2]);
  if(Math.abs(det)<EPS)continue;
  out.push({p,det,minX:Math.min(...p.map(v=>v[0])),maxX:Math.max(...p.map(v=>v[0])),minZ:Math.min(...p.map(v=>v[2])),maxZ:Math.max(...p.map(v=>v[2]))});
 }
 return out;
}
function height(t,x,z){
 const [a,b,c]=t.p,dx=x-a[0],dz=z-a[2];
 const u=cross(dx,dz,c[0]-a[0],c[2]-a[2])/t.det;
 const v=cross(b[0]-a[0],b[2]-a[2],dx,dz)/t.det;
 return u>=-EPS&&v>=-EPS&&u+v<=1+EPS?a[1]+u*(b[1]-a[1])+v*(c[1]-a[1]):null;
}
export function separation(lower,upper){
 if(lower.maxX<upper.minX||upper.maxX<lower.minX||lower.maxZ<upper.minZ||upper.maxZ<lower.minZ)return -Infinity;
 let required=-Infinity;
 for(const p of lower.p){const h=height(upper,p[0],p[2]);if(h!==null)required=Math.max(required,h-p[1]);}
 for(const p of upper.p){const h=height(lower,p[0],p[2]);if(h!==null)required=Math.max(required,p[1]-h);}
 for(let i=0;i<3;i++)for(let j=0;j<3;j++){
  const a=lower.p[i],b=lower.p[(i+1)%3],c=upper.p[j],d=upper.p[(j+1)%3];
  const ax=b[0]-a[0],az=b[2]-a[2],bx=d[0]-c[0],bz=d[2]-c[2],det=cross(ax,az,bx,bz);
  if(Math.abs(det)<EPS)continue;
  const u=cross(c[0]-a[0],c[2]-a[2],bx,bz)/det,v=cross(c[0]-a[0],c[2]-a[2],ax,az)/det;
  if(u>=-EPS&&u<=1+EPS&&v>=-EPS&&v<=1+EPS)required=Math.max(required,c[1]+v*(d[1]-c[1])-a[1]-u*(b[1]-a[1]));
 }
 return required;
}
function cells(t,fn){
 for(let x=Math.floor(t.minX/CELL);x<=Math.floor(t.maxX/CELL);x++)
 for(let z=Math.floor(t.minZ/CELL);z<=Math.floor(t.maxZ/CELL);z++)fn(key(x,z));
}
export function contactIndex(tris){
 const bins=new Map();
 for(const t of tris)cells(t,k=>{let b=bins.get(k);if(!b)bins.set(k,b=[]);b.push(t);});
 return bins;
}
export function requiredLift(moving,indexes){
 let required=-Infinity;
 for(const t of moving){
  for(const p of t.p)required=Math.max(required,-p[1]);
  for(const bins of indexes){
   const seen=new Set();
   cells(t,k=>{for(const other of bins.get(k)??[]){if(seen.has(other))continue;seen.add(other);required=Math.max(required,separation(t,other));}});
  }
 }
 return required;
}
