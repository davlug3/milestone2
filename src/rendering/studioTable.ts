import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { createWalnutTextures } from "./surfaceTextures";

/** Compact antique writing table. The physical book still rests at y=0. */
export function createStudioTable(scene: THREE.Scene,textureSize=1024) {
  const textures = createWalnutTextures(textureSize);
  const wood = new THREE.MeshPhysicalMaterial({...textures, roughness:0.78, metalness:0, bumpScale:0.00055, clearcoat:0.13, clearcoatRoughness:0.58});
  const carved = new THREE.MeshPhysicalMaterial({...textures,color:0xb8a18a,roughness:0.65,bumpScale:0.00025,clearcoat:0.09,clearcoatRoughness:0.74});
  const trim = new THREE.MeshStandardMaterial({color:0x392015,roughness:0.6});
  const brass = new THREE.MeshStandardMaterial({color:0x9f8050,metalness:0.88,roughness:0.38});
  const floorMat = new THREE.MeshStandardMaterial({color:0x121416,roughness:0.96});
  const group = new THREE.Group();
  group.name = "antique-writing-table";
  group.position.set(-0.008,0,-0.025);
  group.scale.set(0.82,1,0.84);
  scene.add(group);
  const parts: THREE.Mesh[] = [];
  function mesh(g:THREE.BufferGeometry,m:THREE.Material,x:number,y:number,z:number) {
    const p=new THREE.Mesh(g,m);p.position.set(x,y,z);
    p.castShadow=p.receiveShadow=true;group.add(p);parts.push(p);return p;
  }
  function box(w:number,h:number,d:number,r:number,m:THREE.Material,x:number,y:number,z:number) {
    return mesh(new RoundedBoxGeometry(w,h,d,3,r),m,x,y,z);
  }
  const width=0.83, depth=0.57;
  const top=box(width,0.035,depth,0.006,wood,0,-0.0175,0);
  top.name="antique-table-top";
  box(width-0.012,0.013,depth-0.012,0.005,trim,0,-0.0415,0);
  box(width-0.035,0.015,depth-0.035,0.004,carved,0,-0.055,0);
  // Apron frame with framed drawer and shaped lower molding.
  for(const z of [-0.226,0.226]){
    box(0.70,0.105,0.026,0.003,carved,0,-0.113,z);
    box(0.70,0.012,0.032,0.003,trim,0,-0.166,z);
  }
  for(const x of [-0.35,0.35]){
    box(0.026,0.105,0.45,0.003,carved,x,-0.113,0);
    box(0.032,0.012,0.45,0.003,trim,x,-0.166,0);
  }
  box(0.425,0.072,0.013,0.003,trim,0,-0.114,0.244);
  box(0.409,0.058,0.014,0.003,wood,0,-0.114,0.250);
  for(const x of [-0.084,0.084]){
    const plate=mesh(new THREE.SphereGeometry(1,20,12),brass,x,-0.114,0.262);
    plate.scale.set(0.014,0.009,0.003);
    const ring=mesh(new THREE.TorusGeometry(0.010,0.0023,10,24),brass,x,-0.123,0.269);
    ring.rotation.x=0.12;
  }
  // Lathed spindle legs, with collars, baluster, tapered stem and foot.
  const profile=[
    [0,-0.725],[0.023,-0.725],[0.028,-0.718],[0.029,-0.703],
    [0.022,-0.691],[0.019,-0.682],[0.023,-0.670],[0.025,-0.661],
    [0.018,-0.647],[0.015,-0.615],[0.019,-0.49],[0.025,-0.395],
    [0.034,-0.354],[0.037,-0.324],[0.033,-0.292],[0.023,-0.268],
    [0.020,-0.252],[0.031,-0.238],[0.033,-0.224],[0.026,-0.211],
    [0.027,-0.190],[0.030,-0.177],[0.030,-0.153],[0,-0.153]
  ].map(([r,y])=>new THREE.Vector2(r,y));
  for(const x of [-0.35,0.35])for(const z of [-0.226,0.226]){
    box(0.072,0.112,0.072,0.004,carved,x,-0.111,z);
    mesh(new THREE.LatheGeometry(profile,32),carved,x,0,z);
  }
  // Narrow lower stretchers, inset from the feet.
  box(0.70,0.026,0.031,0.004,carved,0,-0.565,-0.226);
  for(const x of [-0.35,0.35])box(0.032,0.025,0.45,0.004,carved,x,-0.565,0);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(12,12),floorMat);
  floor.rotation.x=-Math.PI/2;floor.position.y=-0.725;
  floor.receiveShadow=true;scene.add(floor);
  return ()=>{
    scene.remove(group,floor);
    for(const p of parts)p.geometry.dispose();
    floor.geometry.dispose();
    for(const m of [wood,carved,trim,brass,floorMat])m.dispose();
    textures.map.dispose();textures.bumpMap.dispose();textures.roughnessMap.dispose();
  };
}
