import * as THREE from "three";
import {createClothTexture} from "./surfaceTextures";

/** Full-length, gathered velvet curtains. Static geometry shared with Blender. */
export function createStudioWall(scene:THREE.Scene){
 const root=new THREE.Group();root.name="elegant-velvet-curtain-backdrop";scene.add(root);
 const weave=createClothTexture();weave.repeat.set(12,9);
 const velvet=new THREE.MeshPhysicalMaterial({
  color:0x263b36,roughness:.87,metalness:0,
  sheen:.85,sheenColor:new THREE.Color(0x526b5e),sheenRoughness:.72,
  bumpMap:weave,bumpScale:.00024,side:THREE.DoubleSide
 });
 const lining=new THREE.MeshStandardMaterial({color:0x131e1b,roughness:1});
 const gold=new THREE.MeshStandardMaterial({color:0x665036,roughness:.62,metalness:.55});
 const geometries:THREE.BufferGeometry[]=[];
 function add(g:THREE.BufferGeometry,m:THREE.Material,name:string){
  const o=new THREE.Mesh(g,m);o.name=name;o.receiveShadow=true;
  // The curtains sit behind the studio lights, never block the book lighting.
  o.castShadow=false;root.add(o);geometries.push(g);return o;
 }
 const width=2.5,height=3.02,bottom=-.725,back=-.88;
 // A dark lining prevents light leaks through the central overlap.
 const liner=add(new THREE.PlaneGeometry(5.3,3.2),lining,"curtain-dark-lining");
 liner.position.set(0,.83,-1.02);
 for(const side of [-1,1]){
  const g=new THREE.PlaneGeometry(width,height,224,64);
  const p=g.attributes.position,uv=g.attributes.uv;
  for(let i=0;i<p.count;i++){
   const u=uv.getX(i),v=uv.getY(i);
   // Variable-width folds, narrower at the gathered header and relaxed below.
   const phase=2*Math.PI*(u*13+.12*Math.sin(u*19+side)+.10*Math.sin(v*4.2+u*8));
   const depth=.042+.025*(1-v);
   const fold=Math.cos(phase)+.20*Math.cos(2*phase+.7)+.07*Math.sin(3*phase);
   const drape=.012*Math.sin(u*17+v*5)*Math.sin(Math.PI*v);
   const hem=.009*(1-v)**12*(1+Math.sin(phase));
   p.setXYZ(i,side*(.015+u*width)-side*.035*(1-u)**9,bottom+v*height+hem,back+depth*fold+drape);
  }
  g.computeVertexNormals();g.computeBoundingSphere();
  add(g,velvet,side<0?"left-gathered-velvet-panel":"right-gathered-velvet-panel");
 }
 // A restrained antique brass curtain rod and end finials above the folds.
 const rod=add(new THREE.CylinderGeometry(.014,.014,5.18,16),gold,"antique-curtain-rod");
 rod.rotation.z=Math.PI/2;rod.position.set(0,2.32,back);
 for(const side of [-1,1]){
  const finial=add(new THREE.SphereGeometry(.029,16,12),gold,"curtain-rod-finial");
  finial.position.set(side*2.61,2.32,back);
  finial.scale.set(1.3,1,1);
 }
 return ()=>{scene.remove(root);geometries.forEach(g=>g.dispose());velvet.dispose();lining.dispose();gold.dispose();weave.dispose();};
}
