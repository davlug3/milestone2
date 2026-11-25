import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
/** Sparse static props on the y=0 tabletop, outside the open book and page sweep. */
export function createDeskProps(scene:THREE.Scene){
 const root=new THREE.Group();root.name="book-set-dressing";scene.add(root);
 const brass=new THREE.MeshStandardMaterial({color:0x92784c,metalness:.82,roughness:.43});
 const black=new THREE.MeshPhysicalMaterial({color:0x242722,roughness:.38,clearcoat:.22});
 const wood=new THREE.MeshStandardMaterial({color:0x4c3022,roughness:.62});
 const paper=new THREE.MeshStandardMaterial({color:0xd7cbb3,roughness:.86});
 const darkPaper=new THREE.MeshStandardMaterial({color:0xa99b80,roughness:.9});
 const mats=[brass,black,wood,paper,darkPaper];
 const geometries:THREE.BufferGeometry[]=[];
 function part(g:THREE.BufferGeometry,m:THREE.Material,parent:THREE.Group,x:number,y:number,z:number){
  const mesh=new THREE.Mesh(g,m);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);geometries.push(g);return mesh;
 }
 function group(name:string,x:number,z:number,yaw:number){const g=new THREE.Group();g.name=name;g.position.set(x,0,z);g.rotation.y=yaw;root.add(g);return g;}
 function rod(g:THREE.Group,a:THREE.Vector3,b:THREE.Vector3,r:number,m:THREE.Material,r2=r){
  const delta=b.clone().sub(a),mid=a.clone().add(b).multiplyScalar(.5);
  const o=part(new THREE.CylinderGeometry(r2,r,delta.length(),12),m,g,mid.x,mid.y,mid.z);
  o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return o;
 }
 const v=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z);
 // Capped fountain pen along the right edge, clear of the full open cover.
 const pen=group("fountain-pen",.322,.035,-.18);
 rod(pen,v(0,.006,-.071),v(0,.006,.024),.0057,black,.0052);
 rod(pen,v(0,.006,.024),v(0,.006,.066),.0061,black);
 for(const z of [.021,.027,.062])rod(pen,v(0,.006,z),v(0,.006,z+.002),.0063,brass);
 rod(pen,v(.003,.012,.060),v(.004,.012,.033),.0012,brass);
 // Folded, thin brass spectacles at the front-left edge.
 const glasses=group("folded-brass-spectacles",-.304,.193,.08);
 for(const x of [-.028,.028]){
  const rim=part(new THREE.TorusGeometry(.023,.00145,8,36),brass,glasses,x,.005,0);
  rim.rotation.x=-Math.PI/2;rim.scale.set(1,.77,1);
  rod(glasses,v(x+(x<0?-.023:.023),.006,0),v(x*.45,.007,.021),.0013,brass);
 }
 rod(glasses,v(-.005,.005,0),v(.005,.005,0),.0015,brass);
 // Small wooden wax seal stamp behind the book, not over the page path.
 const stamp=group("wax-seal-stamp",.298,-.217,.4);
 part(new THREE.CylinderGeometry(.017,.018,.007,24),brass,stamp,0,.0035,0);
 const profile=[[0,.007],[.009,.007],[.010,.013],[.006,.021],[.007,.031],[.012,.038],[.013,.046],[.009,.053],[0,.055]].map(([r,y])=>new THREE.Vector2(r,y));
 part(new THREE.LatheGeometry(profile,24),wood,stamp,0,0,0);
 // Two understated overlapping paper slips behind the left side.
 const slips=group("loose-paper-slips",-.302,-.225,-.14);
 for(let i=0;i<2;i++){
  const slip=part(new RoundedBoxGeometry(.071,.0009,.045,2,.0004),i?paper:darkPaper,slips,i*.009,.00055+i*.001,i*.006);
  slip.rotation.y=i*.13;
 }
 return ()=>{scene.remove(root);geometries.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());};
}
