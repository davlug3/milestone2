import {createMicroSurface} from "./surfaceTextures";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
/** Layered static props on the y=0 tabletop, outside the open book and page sweep. */
export function createDeskProps(scene:THREE.Scene){
 const root=new THREE.Group();root.name="book-set-dressing";scene.add(root);
 const metalDetail=createMicroSurface("metal");
 const brass=new THREE.MeshStandardMaterial({color:0xb39761,metalness:.94,roughness:.56,normalMap:metalDetail.normalMap,roughnessMap:metalDetail.roughnessMap,normalScale:new THREE.Vector2(.22,.22)});
 const black=new THREE.MeshPhysicalMaterial({color:0x242722,roughness:.32,clearcoat:.32,clearcoatRoughness:.35});
 const wood=new THREE.MeshStandardMaterial({color:0x4c3022,roughness:.62});
 const paper=new THREE.MeshStandardMaterial({color:0xd7cbb3,roughness:.86});
 const darkPaper=new THREE.MeshStandardMaterial({color:0xa99b80,roughness:.9});
 const ink=new THREE.MeshPhysicalMaterial({color:0x222827,roughness:.24,clearcoat:.46,clearcoatRoughness:.30});
 const wax=new THREE.MeshStandardMaterial({color:0x71352c,roughness:.67});
 const pencilWood=new THREE.MeshStandardMaterial({color:0x96764d,roughness:.81});
 const graphite=new THREE.MeshStandardMaterial({color:0x30302d,roughness:.62});
 const mats:THREE.Material[]=[brass,black,wood,paper,darkPaper,ink,wax,pencilWood,graphite];
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
 const pen=group("fountain-pen",.303,.042,-.12);
 rod(pen,v(0,.006,-.071),v(0,.006,.024),.0057,black,.0052);
 rod(pen,v(0,.006,.024),v(0,.006,.066),.0061,black);
 for(const z of [.021,.027,.062])rod(pen,v(0,.006,z),v(0,.006,z+.002),.0063,brass);
 rod(pen,v(.003,.012,.060),v(.004,.012,.033),.0012,brass);
 // Folded, thin brass spectacles at the front-left edge.
 const glasses=group("folded-brass-spectacles",-.274,.181,.18);
 for(const x of [-.028,.028]){
  const rim=part(new THREE.TorusGeometry(.023,.00145,8,36),brass,glasses,x,.005,0);
  rim.rotation.x=-Math.PI/2;rim.scale.set(1,.77,1);
  rod(glasses,v(x+(x<0?-.023:.023),.006,0),v(x*.45,.007,.021),.0013,brass);
 }
 rod(glasses,v(-.005,.005,0),v(.005,.005,0),.0015,brass);
 // Small wooden wax seal stamp behind the book, not over the page path.
 const stamp=group("wax-seal-stamp",.302,-.211,.4);
 part(new THREE.CylinderGeometry(.017,.018,.007,24),brass,stamp,0,.0035,0);
 const profile=[[0,.007],[.009,.007],[.010,.013],[.006,.021],[.007,.031],[.012,.038],[.013,.046],[.009,.053],[0,.055]].map(([r,y])=>new THREE.Vector2(r,y));
 part(new THREE.LatheGeometry(profile,24),wood,stamp,0,0,0);
 // Two understated overlapping paper slips behind the left side.
 const slips=group("loose-paper-slips",-.190,-.212,-.14);
 for(let i=0;i<3;i++){
  const slip=part(new RoundedBoxGeometry(.071,.0009,.045,2,.0004),i?paper:darkPaper,slips,i*.004,.00055+i*.001,i*.003);
  slip.rotation.y=i*.19;
 }
 const bottle=group("ink-bottle",-.310,-.107,-.19);
 part(new THREE.CylinderGeometry(.023,.026,.036,8),ink,bottle,0,.018,0);
 part(new THREE.CylinderGeometry(.012,.023,.012,8),ink,bottle,0,.042,0);
 part(new THREE.CylinderGeometry(.013,.013,.009,16),black,bottle,0,.052,0);
 const waxStick=group("sealing-wax-stick",.303,.165,.52);
 part(new RoundedBoxGeometry(.014,.013,.064,2,.003),wax,waxStick,0,.0065,0);
 const coins=group("scattered-coins",.289,-.095,-.1);
 for(let i=0;i<2;i++){const coin=part(new THREE.CylinderGeometry(.010+i*.002,.010+i*.002,.002,24),brass,coins,i*.017,.001,i*.009);coin.rotation.z=i*.02;}
 const pencil=group("pencil-stub",-.307,.009,-.21);
 rod(pencil,v(0,.004,-.044),v(0,.004,.030),.0038,pencilWood);
 rod(pencil,v(0,.004,.030),v(0,.004,.041),.0038,pencilWood,.001);
 rod(pencil,v(0,.004,.041),v(0,.004,.045),.001,graphite,.00015);
 const scraps=group("curled-paper-scraps",.07,-.225,.12);
 for(let i=0;i<3;i++){
  const g=new THREE.PlaneGeometry(.029+i*.007,.020+i*.003,6,4);
  const pos=g.attributes.position;
  for(let k=0;k<pos.count;k++){const x=pos.getX(k),y=pos.getY(k);pos.setZ(k,.0025*Math.sin(x*83+i)*Math.cos(y*70)+.0015*Math.sin(y*140+i));}
  g.computeVertexNormals();
  const m=part(g,paper,scraps,(i-1)*.052,.004,Math.sin(i*2)*.009);m.rotation.set(-Math.PI/2,0,i*.41-.3);
 }
 // Front margin: a worn pocket watch, loose key and delicate chain.
 const steel=new THREE.MeshStandardMaterial({color:0x888982,metalness:.95,roughness:.42,normalMap:metalDetail.normalMap,normalScale:new THREE.Vector2(.15,.15)});
 const dial=new THREE.MeshPhysicalMaterial({color:0xe0d2b3,roughness:.68,clearcoat:.22});
 const leather=new THREE.MeshPhysicalMaterial({color:0x55382a,roughness:.78,clearcoat:.08});
 const fadedInk=new THREE.MeshStandardMaterial({color:0x665441,roughness:.94});
 const ribbonMat=new THREE.MeshPhysicalMaterial({color:0x6a3834,roughness:.92,sheen:.4,sheenColor:new THREE.Color(0xb37872),side:THREE.DoubleSide});
 mats.push(steel,dial,leather,fadedInk,ribbonMat);
 const watch=group("antique-pocket-watch",.122,.182,.28);
 part(new THREE.CylinderGeometry(.022,.022,.007,48),brass,watch,0,.0035,0);
 part(new THREE.CylinderGeometry(.0185,.0185,.001,48),dial,watch,0,.0075,0);
 const bezel=part(new THREE.TorusGeometry(.020,.0013,8,48),brass,watch,0,.0076,0);bezel.rotation.x=-Math.PI/2;
 for(let i=0;i<60;i++){
   const a=i*Math.PI/30,r=i%5===0?.0155:.017;
   const tick=part(new THREE.BoxGeometry(i%5===0?.0008:.00035,.00025,i%5===0?.003:.0012),fadedInk,watch,Math.sin(a)*r,.0082,Math.cos(a)*r);tick.rotation.y=a;
 }
 for(const [a,len,w] of [[.94,.011,.001],[2.6,.014,.00065]]){
   const hand=part(new THREE.BoxGeometry(w,.00035,len),steel,watch,Math.sin(a)*len*.35,.0086,Math.cos(a)*len*.35);hand.rotation.y=a;
 }
 part(new THREE.CylinderGeometry(.0011,.0011,.0008,12),brass,watch,0,.009,0);
 rod(watch,v(0,.004,-.023),v(0,.004,-.026),.0027,brass);
 // Small chain meanders beside the watch; alternating link planes.
 for(let i=0;i<15;i++){
   const x=-.006-i*.0042,z=.004+Math.sin(i*.44)*.006;
   const link=part(new THREE.TorusGeometry(.0025,.00055,6,14),brass,watch,x,.0018,z);
   link.rotation.set(i%2?-.25:-Math.PI/2,0,.25*Math.cos(i*.4));link.scale.set(1.2,.70,1);
 }
 const key=group("old-brass-key",-.092,.181,-.18);
 const bow=part(new THREE.TorusGeometry(.009,.002,8,24),brass,key,-.018,.003,0);bow.rotation.x=-Math.PI/2;bow.scale.set(.88,1,1);
 rod(key,v(-.010,.003,0),v(.023,.003,0),.0019,brass);
 part(new THREE.BoxGeometry(.008,.0035,.007),brass,key,.020,.0022,.003);
 part(new THREE.BoxGeometry(.002,.0035,.004),brass,key,.017,.0022,.008);
 // Small envelope packet and handwritten slips behind the page sweep.
 const mail=group("old-letter-packet",.199,-.215,.04);
 for(let i=0;i<3;i++){
   const card=part(new RoundedBoxGeometry(.066,.0015,.048,2,.0005),i===2?paper:darkPaper,mail,i*.0015,.0008+i*.0017,0);card.rotation.y=(i-1)*.06;
 }
 const fold=part(new THREE.BufferGeometry().setFromPoints([v(-.031,.0058,-.021),v(.031,.0058,-.021),v(0,.006,.009)]),paper,mail,0,0,0);fold.geometry.setIndex([0,2,1]);fold.geometry.computeVertexNormals();
 for(let i=0;i<4;i++){
   const line=part(new THREE.BoxGeometry(.019-i*.001,.00015,.00035),fadedInk,mail,.009,.0063,.008+i*.004);line.rotation.y=.04;
 }
 const seal=part(new THREE.CylinderGeometry(.006,.0065,.0018,18),wax,mail,0,.0063,.001);seal.scale.set(1,.9,.93);
 // Closed miniature leather memo book, tucked beside the loose letters.
 const memo=group("small-leather-memo-book",-.065,-.218,.10);
 part(new RoundedBoxGeometry(.071,.003,.050,2,.001),leather,memo,0,.0015,0);
 part(new RoundedBoxGeometry(.066,.011,.046,2,.001),paper,memo,0,.008,0);
 part(new RoundedBoxGeometry(.071,.003,.050,2,.001),leather,memo,0,.015,0);
 part(new RoundedBoxGeometry(.006,.016,.050,2,.001),leather,memo,-.034,.008,0);
 for(let i=0;i<5;i++)part(new THREE.BoxGeometry(.064,.00024,.00025),darkPaper,memo,.001,.004+i*.0019,.0232);
 // Silk bookmark curling from the memo book (stays behind the main book).
 const rg=new THREE.PlaneGeometry(.009,.041,5,16),rp=rg.attributes.position;
 for(let i=0;i<rp.count;i++){const x=rp.getX(i),y=rp.getY(i);rp.setZ(i,.0025*Math.sin(y*160)+.001*x/.0045*Math.sin(y*80));}
 rg.computeVertexNormals();const ribbon=part(rg,ribbonMat,memo,.042,.004,.003);ribbon.rotation.set(-Math.PI/2,0,Math.PI/2);
 // Fallen rose petals near the vase and small scattered fragments on the front margin.
 for(const [x,z,yaw] of [[-.316,-.158,.7],[-.285,-.172,-.8],[-.142,.195,1.1],[.016,.19,-.3]]){
   const petal=group("fallen-rose-petal",x,z,yaw);
   const g=new THREE.PlaneGeometry(.014,.018,9,12),a=g.attributes.position;
   for(let i=0;i<a.count;i++){const xx=a.getX(i),yy=a.getY(i);a.setX(i,xx*(.55+.45*Math.cos(yy/.018*Math.PI)));a.setZ(i,.0014+.0025*Math.pow(xx/.007,2)+.0016*Math.sin(yy*190));}
   g.computeVertexNormals();const m=part(g,ribbonMat,petal,0,.002,0);m.rotation.x=-Math.PI/2;
 }
 return ()=>{scene.remove(root);geometries.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());metalDetail.dispose();};
}
