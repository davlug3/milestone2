import * as THREE from "three";
import {mergeGeometries} from "three/addons/utils/BufferGeometryUtils.js";

/** Floor-standing ornamental rubber plant, cropped at the right edge of the 85mm shot.
 * World-space placement is fixed: the camera dolly naturally reveals less foliage.
 */
export function createOrnamentalPlant(scene:THREE.Scene){
 const root=new THREE.Group();root.name="off-frame-ornamental-plant";root.position.set(.77,-.725,-.43);scene.add(root);
 const potMat=new THREE.MeshStandardMaterial({color:0x514337,roughness:.93});
 const soilMat=new THREE.MeshStandardMaterial({color:0x322a20,roughness:1});
 const stemMat=new THREE.MeshStandardMaterial({color:0x625842,roughness:.85});
 const leafMats=[0x304a31,0x3b5838,0x49623c,0x263f2e].map(color=>new THREE.MeshPhysicalMaterial({color,roughness:.57,clearcoat:.08,clearcoatRoughness:.74,side:THREE.DoubleSide}));
 const veinMat=new THREE.MeshStandardMaterial({color:0x6c7950,roughness:.78});
 const mats=[potMat,soilMat,stemMat,...leafMats,veinMat];
 const geos=new Set<THREE.BufferGeometry>();
 const batches=new Map<THREE.Material,THREE.BufferGeometry[]>();
 const v=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z);
 function add(g:THREE.BufferGeometry,m:THREE.Material,x=0,y=0,z=0){
   const mesh=new THREE.Mesh(g,m);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);geos.add(g);return mesh;
 }
 function batch(g:THREE.BufferGeometry,m:THREE.Material){let list=batches.get(m);if(!list){list=[];batches.set(m,list);}list.push(g);}
 let seed=91827;const r=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const profile=[[0,0],[.082,0],[.087,.012],[.109,.18],[.113,.19],[.113,.20],[.103,.20],[.102,.185],[.075,.02],[0,.02]].map(([x,y])=>new THREE.Vector2(x,y));
 add(new THREE.LatheGeometry(profile,32),potMat);
 add(new THREE.CylinderGeometry(.10,.10,.012,24),soilMat,0,.178,0);
 function branch(a:THREE.Vector3,b:THREE.Vector3,c:THREE.Vector3,radius:number,mat:THREE.Material){
   batch(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a,b,c),12,radius,6,false),mat);
 }
 // Staggered foliage clusters lean toward the set; the pot and trunk stay beyond the crop.
 const trunks=[{x:0,z:0,h:1.10},{x:-.055,z:.035,h:.98},{x:.055,z:-.025,h:1.25}];
 for(let k=0;k<trunks.length;k++){
   const t=trunks[k],base=v(t.x*.25,.18,t.z*.25),tip=v(t.x,t.h,t.z);
   const trunk=new THREE.QuadraticBezierCurve3(base,v(t.x+.018,(.18+t.h)*.5,t.z-.015),tip);
   batch(new THREE.TubeGeometry(trunk,18,.0045-k*.0006,7,false),stemMat);
   for(let i=0;i<7;i++){
     const p=trunk.getPoint(.48+i*.078);
     // Most show only at frame right; a few emerge in front of the backdrop.
     const angle=i%2===0?Math.PI+(r()-.5)*.8:Math.PI*.62+(r()-.5)*1.3;
     const length=.17+r()*.105,width=.065+r()*.035;
     const dir=v(Math.cos(angle),0,Math.sin(angle));
     const across=v(-dir.z,0,dir.x);
     const petiole=p.clone().addScaledVector(dir,.055+r()*.025).add(v(0,.025+r()*.02,0));
     branch(p,p.clone().lerp(petiole,.55).add(v(0,.013,0)),petiole,.0015,stemMat);
     const rise=.045+r()*.06,droop=.05+r()*.035,twist=(r()-.5)*.04;
     function point(u:number,s:number){
       const span=Math.pow(Math.max(0,Math.sin(Math.PI*u)),.72)*(1+.025*Math.sin(u*25+i));
       const cross=s*width*.5*span;
       const h=rise*Math.sin(Math.PI*u*.95)-droop*u*u+(.009*s*s+twist*s)*span+.0018*Math.sin(u*19+s*5)*span;
       return petiole.clone().addScaledVector(dir,length*u).addScaledVector(across,cross).add(v(0,h,0));
     }
     const positions:number[]=[],uv:number[]=[],indices:number[]=[];
     const nu=14,nv=18;
     for(let j=0;j<=nv;j++)for(let m=0;m<=nu;m++){
       const q=point(j/nv,2*m/nu-1);positions.push(q.x,q.y,q.z);uv.push(m/nu,j/nv);
     }
     for(let j=0;j<nv;j++)for(let m=0;m<nu;m++){const a=j*(nu+1)+m,b=a+nu+1;indices.push(a,b,a+1,a+1,b,b+1);}
     const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));g.setAttribute("uv",new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();batch(g,leafMats[(i+k)%leafMats.length]);
     // Raised central vein, kept fine enough not to read as a stylized outline.
     const spine=Array.from({length:9},(_,j)=>point(j/8,0).add(v(0,.0006,0)));
     batch(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(spine),12,.00055,4,false),veinMat);
   }
 }
 for(const [m,list] of batches){const merged=mergeGeometries(list,false);if(merged)add(merged,m);list.forEach(g=>g.dispose());}
 return ()=>{scene.remove(root);geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());};
}
