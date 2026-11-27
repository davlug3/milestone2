import * as T from 'three';
export function paperGeometry(w,h,seed,bend){
 const g=new T.PlaneGeometry(w,h,18,14),p=g.attributes.position,uv=g.attributes.uv;
 const zAt=(u,v)=>{
  const x=u-.5,free=Math.pow(1-v,1.8);
  return bend*(free*(.32+.7*x*x)+.14*Math.sin(u*9+seed)*Math.sin(v*7+seed)*free+.10*Math.sin(u*19+v*12+seed)*Math.sin(v*13)*free+.32*Math.pow(Math.abs(x)*2,4)*(1-v));
 };
 for(let i=0;i<p.count;i++){
  const u=uv.getX(i),v=uv.getY(i),edge=Math.pow(Math.abs(u-.5)*2,8);
  p.setX(i,p.getX(i)+.003*w*Math.sin(v*32+seed)*edge);p.setZ(i,zAt(u,v));
 }
 g.computeVertexNormals();return {geometry:g,zAt};
}
