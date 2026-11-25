import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { createWalnutTextures } from "./surfaceTextures";

/** Walnut writing desk: top face stays at y=0, the physics contact plane. */
export function createStudioTable(scene:THREE.Scene) {
  const textures=createWalnutTextures();
  const wood=new THREE.MeshStandardMaterial({...textures,roughness:0.63,metalness:0,bumpScale:0.00055});
  const edge=new THREE.MeshStandardMaterial({color:0x392317,roughness:0.72});
  const table=new THREE.Mesh(new RoundedBoxGeometry(1.65,0.045,1.08,3,0.006),wood);
  table.name="walnut-table";
  table.position.set(0,-0.0225,-0.12);
  table.receiveShadow=true;table.castShadow=true;
  scene.add(table);
  // Four solid legs, below the shot's tabletop.
  const legs:THREE.Mesh[]=[];
  for(const x of [-0.73,0.73])for(const z of [-0.57,0.33]){
    const leg=new THREE.Mesh(new THREE.BoxGeometry(0.055,0.70,0.055),edge);
    leg.position.set(x,-0.395,z);leg.castShadow=true;leg.receiveShadow=true;
    legs.push(leg);scene.add(leg);
  }
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(12,12),new THREE.MeshStandardMaterial({color:0x121416,roughness:0.95}));
  floor.rotation.x=-Math.PI/2;floor.position.y=-0.745;floor.receiveShadow=true;scene.add(floor);
  return ()=>{
    for(const mesh of [table,...legs,floor]){scene.remove(mesh);mesh.geometry.dispose();}
    wood.dispose();edge.dispose();(floor.material as THREE.Material).dispose();
    textures.map.dispose();textures.bumpMap.dispose();
  };
}
