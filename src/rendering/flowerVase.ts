import {createMicroSurface} from "./surfaceTextures";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import * as THREE from "three";
/** Small handmade ceramic vase and asymmetric botanical arrangement. */
export function createFlowerVase(scene:THREE.Scene){
 const root=new THREE.Group();root.name="ceramic-vase-with-flowers";root.position.set(-.29,0,-.208);scene.add(root);
 const petalDetail=createMicroSurface("petal"),leafDetail=createMicroSurface("leaf"),ceramicDetail=createMicroSurface("ceramic");
 const ceramic=new THREE.MeshPhysicalMaterial({color:0xc4b69c,roughness:.64,clearcoat:.19,clearcoatRoughness:.61,normalMap:ceramicDetail.normalMap,roughnessMap:ceramicDetail.roughnessMap,normalScale:new THREE.Vector2(.36,.36)});
 const inside=new THREE.MeshStandardMaterial({color:0x514a3d,roughness:.9});
 const stem=new THREE.MeshStandardMaterial({color:0x52613a,roughness:.86});
 const leaf=new THREE.MeshPhysicalMaterial({color:0x647344,roughness:.69,normalMap:leafDetail.normalMap,roughnessMap:leafDetail.roughnessMap,normalScale:new THREE.Vector2(.32,.32),clearcoat:.12,clearcoatRoughness:.6,side:THREE.DoubleSide});
 const ivory=new THREE.MeshStandardMaterial({color:0xe3d7bd,roughness:.85,side:THREE.DoubleSide});
 const blush=new THREE.MeshStandardMaterial({color:0xb98378,roughness:.85,side:THREE.DoubleSide});
 const pollen=new THREE.MeshStandardMaterial({color:0xb49a53,roughness:.9});
 const mats=[ceramic,inside,stem,leaf,ivory,blush,pollen],geos=new Set<THREE.BufferGeometry>();
 function mesh(g:THREE.BufferGeometry,m:THREE.Material,p:THREE.Vector3,parent:THREE.Group=root){
  const o=new THREE.Mesh(g,m);o.position.copy(p);o.castShadow=o.receiveShadow=true;parent.add(o);geos.add(g);return o;
 }
 const v=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z);
 // Continuous outer and inner profile, so the vessel has a real open mouth.
 const profile=[[0,0],[.021,0],[.025,.008],[.029,.026],[.028,.048],[.021,.068],[.014,.083],[.016,.088],[.016,.091],[.012,.091],[.011,.086],[.016,.067],[.023,.045],[.020,.013],[0,.007]].map(([r,y])=>new THREE.Vector2(r,y));
 mesh(new THREE.LatheGeometry(profile,40),ceramic,v(0,0,0));
 mesh(new THREE.CylinderGeometry(.010,.010,.002,20),inside,v(0,.072,0));
 // Deterministic botanical variation. Curved petal surfaces are actual geometry.
 let seed=72631;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const roseColors=[0x762e39,0xa24c51,0xc17e79,0xe1c4ae,0xd4a18e];
 const roseMats=roseColors.map(color=>new THREE.MeshPhysicalMaterial({color,roughness:.87,normalMap:petalDetail.normalMap,roughnessMap:petalDetail.roughnessMap,normalScale:new THREE.Vector2(.48,.48),sheen:.48,sheenColor:new THREE.Color(color).lerp(new THREE.Color(0xffded0),.20),sheenRoughness:.82,side:THREE.DoubleSide}));
 mats.push(...roseMats);
 const darkLeaf=new THREE.MeshPhysicalMaterial({color:0x394d30,roughness:.73,normalMap:leafDetail.normalMap,roughnessMap:leafDetail.roughnessMap,normalScale:new THREE.Vector2(.32,.32),clearcoat:.10,clearcoatRoughness:.65,side:THREE.DoubleSide});
 mats.push(darkLeaf);
 // Merge the many static botanical pieces by material to avoid hundreds of draw calls.
 const batches=new Map<THREE.Material,THREE.BufferGeometry[]>();
 function batch(g:THREE.BufferGeometry,m:THREE.Material,position:THREE.Vector3,rotation:THREE.Quaternion){
   g.applyQuaternion(rotation);g.translate(position.x,position.y,position.z);
   let list=batches.get(m);if(!list){list=[];batches.set(m,list);}list.push(g);
 }
 function surface(nu:number,nv:number,point:(u:number,v:number)=>THREE.Vector3){
   const p:number[]=[],uv:number[]=[],idx:number[]=[];
   for(let j=0;j<=nv;j++)for(let i=0;i<=nu;i++){const u=i/nu,w=j/nv,q=point(u,w);p.push(q.x,q.y,q.z);uv.push(u,w);}
   for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){const k=j*(nu+1)+i,l=k+nu+1;idx.push(k,l,k+1,k+1,l,l+1);}
   const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.Float32BufferAttribute(p,3));g.setAttribute("uv",new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
 }
 function petal(r:number,h:number,width:number,angle:number,phase:number,inner:boolean){
   // Broad rounded tips, cupped centers, narrow attachment, and rolled irregular margins.
   return surface(10,9,(u,t)=>{
     const s=2*u-1,fan=Math.pow(Math.sin(Math.PI*(.06+.89*t)),.68);
     const rr=r*(.22+.78*t)+(inner?-.08:.13)*r*Math.sin(Math.PI*t);
     const cross=s*width*fan*.5*(1+.07*Math.sin(t*9+phase));
     const wave=(.045*Math.sin(s*7+phase)+.025*Math.sin(s*14+phase*2))*h*t*t;
     const yy=h*(t-.22*t*t)+h*.28*s*s*Math.sin(Math.PI*t)-h*(inner?.04:.38)*Math.pow(t,5)+wave;
     return v(Math.cos(angle)*rr-Math.sin(angle)*cross,yy,Math.sin(angle)*rr+Math.cos(angle)*cross);
   });
 }
 const identity=new THREE.Quaternion();
 const leafVein=new THREE.MeshStandardMaterial({color:0x788457,roughness:.88});mats.push(leafVein);
 function leaflet(origin:THREE.Vector3,dir:THREE.Vector3,length:number,width:number){
   const q=new THREE.Quaternion().setFromUnitVectors(v(0,1,0),dir.clone().normalize());
   const twist=(random()-.5)*.003,curve=.003+random()*.004;
   const point=(u:number,t:number)=>{
     const s=2*u-1,outline=Math.pow(Math.max(0,Math.sin(Math.PI*t)),.74)*(1+.055*Math.sin(t*32*Math.PI));
     return v(s*width*.5*outline,length*t,curve*Math.sin(Math.PI*t)-.004*t*t+.0024*s*s*outline+twist*s*outline);
   };
   batch(surface(10,14,point),random()<.45?leaf:darkLeaf,origin,q);
   const mid=Array.from({length:9},(_,i)=>point(.5,i/8).add(v(0,0,.00022)));
   batch(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(mid),10,.00018,4,false),leafVein,origin,q);
   for(let i=1;i<=3;i++)for(const side of [-1,1]){
     const t=.16+i*.15,a=point(.5,t),b=point(.5+side*.38,t+.12);a.z+=.00015;b.z+=.00015;
     batch(new THREE.TubeGeometry(new THREE.LineCurve3(a,b),2,.000075,3,false),leafVein,origin,q);
   }
 }
 // Rose foliage is pinnate: two opposing leaflet pairs and a pointed terminal leaflet.
 function foliage(origin:THREE.Vector3,angle:number,length:number){
   const dir=v(Math.cos(angle),.12+random()*.45,Math.sin(angle)).normalize();
   const side=v(-Math.sin(angle),0,Math.cos(angle));
   const rachis=new THREE.QuadraticBezierCurve3(origin,origin.clone().addScaledVector(dir,length*.55).add(v(0,.006,0)),origin.clone().addScaledVector(dir,length));
   batch(new THREE.TubeGeometry(rachis,9,.00048,5,false),stem,v(0,0,0),identity);
   for(let j=0;j<2;j++)for(const sign of [-1,1]){
     const p=rachis.getPoint(.30+j*.35);
     const d=dir.clone().multiplyScalar(.48).addScaledVector(side,sign*.82).add(v(0,-.18+random()*.23,0));
     leaflet(p,d,length*(.53-j*.07),length*.29);
   }
   leaflet(rachis.getPoint(.83),dir.clone().add(v(0,-.3,0)),length*.59,length*.30);
 }
 // A tight, asymmetrical bouquet with staggered heights, openings and bloom sizes.
 const ends=[[-.036,.207,-.020],[.005,.257,-.017],[.040,.224,.002],[-.039,.174,.035],[.010,.198,.047],[-.064,.167,-.018],[.064,.169,.034],[.030,.251,-.036],[-.035,.241,-.041],[.002,.151,.063],[-.060,.199,.023],[.060,.204,-.030],[.002,.228,.015]];
 const tiltDegrees=[25,5,18,96,58,112,105,12,8,125,70,48,4];
 for(let i=0;i<ends.length;i++){
   const [x,y,z]=ends[i],tip=v(x,y,z),start=v((random()-.5)*.013,.075,(random()-.5)*.013);
   const tilt=tiltDegrees[i]*Math.PI/180,az=Math.atan2(z+.010,x)+(random()-.5)*.32;
   const axis=v(Math.cos(az)*Math.sin(tilt),Math.cos(tilt),Math.sin(az)*Math.sin(tilt));
   // The last stem tangent follows the actual flower neck, including downward blooms.
   const curve=new THREE.CubicBezierCurve3(start,v(x*.18,.112,z*.18),tip.clone().addScaledVector(axis,-.038),tip);
   batch(new THREE.TubeGeometry(curve,18,.00085+random()*.0004,6,false),stem,v(0,0,0),identity);
   for(let j=0;j<3;j++){const t=.22+j*.24,point=curve.getPoint(t);foliage(point,i*2.399+j*2.17,.027+random()*.015);}
   const q=new THREE.Quaternion().setFromUnitVectors(v(0,1,0),axis);
   const size=.014+random()*.009,open=(i===1||i===12)?.62:.83+random()*.24,mat=roseMats[(i*3+Math.floor(random()*3))%roseMats.length];
   // Five offset whorls: overlapping broad outer petals and tightly rolled inner petals.
   for(let ring=0;ring<5;ring++){
     const t=ring/4,count=[9,8,7,6,5][ring],r=size*(1-.78*t)*open;
     for(let j=0;j<count;j++){
       const angle=j*Math.PI*2/count+ring*1.07+i*.67+(random()-.5)*.22;
       const h=size*(.50+.39*t)*(1+(random()-.5)*.18);
       const g=petal(r,h,r*(1.40+.40*t),angle,random()*6.28,ring>2);
       g.translate(0,size*t*.24,0);batch(g,mat,tip,q);
     }
   }
   // Green calyx visible from the sides and beneath the bloom.
   for(let j=0;j<5;j++){
     const a=j*6.283/5+i;
     const g=surface(5,5,(u,t)=>v(Math.cos(a)*size*.68*t-Math.sin(a)*(u-.5)*.005*Math.sin(Math.PI*t),-size*.27+size*.26*t,Math.sin(a)*size*.68*t+Math.cos(a)*(u-.5)*.005*Math.sin(Math.PI*t)));
     batch(g,darkLeaf,tip,q);
   }
 }
 // Small pale filler blossoms threaded through the roses.
 for(let i=0;i<8;i++){
   const a=i*2.399,r=.028+random()*.032,tip=v(Math.cos(a)*r,.157+random()*.069,Math.sin(a)*r);
   const curve=new THREE.QuadraticBezierCurve3(v(0,.078,0),v(tip.x*.25,.125,tip.z*.25),tip);
   batch(new THREE.TubeGeometry(curve,8,.00055,5,false),stem,v(0,0,0),identity);
   for(let j=0;j<3;j++){
     const center=tip.clone().add(v(Math.cos(j*2.1)*.004,j*.003,Math.sin(j*2.1)*.004));
     for(let k=0;k<5;k++){const angle=k*Math.PI*2/5;const g=new THREE.SphereGeometry(1,8,5);g.scale(.0027,.001,.0017);g.rotateY(-angle);g.translate(Math.cos(angle)*.0019,0,Math.sin(angle)*.0019);batch(g,ivory,center,identity);}
     batch(new THREE.SphereGeometry(.0014,8,5),pollen,center.clone().add(v(0,.001,0)),identity);
   }
 }
 for(const [mat,list] of batches){
   const merged=mergeGeometries(list,false);
   if(merged)mesh(merged,mat,v(0,0,0));
   list.forEach(g=>g.dispose());
 }
 return ()=>{scene.remove(root);geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());petalDetail.dispose();leafDetail.dispose();ceramicDetail.dispose();};
}
