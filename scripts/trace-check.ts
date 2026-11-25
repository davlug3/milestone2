import * as THREE from "three";
import { TraceScene } from "../src/rendering/traceScene";
import { PathTracingSceneGenerator } from "three-gpu-pathtracer";
const scene=new THREE.Scene();
const materials=[0x00ff00,0xff0000,0x0000ff].map(color=>new THREE.MeshStandardMaterial({color}));
const geo=new THREE.BoxGeometry();
const mesh=new THREE.Mesh(geo,[materials[0],materials[1],materials[2],materials[0],materials[1],materials[2]]);
scene.add(mesh);
const floor=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial({color:0x553311}));
scene.add(floor);floor.position.y=-2;
const proxy=new TraceScene();
const traced=proxy.update(scene);
const generator=new PathTracingSceneGenerator(traced);
const result=generator.generate();
const idx=result.geometry.index!, mat=result.geometry.getAttribute("materialIndex");
const pos=result.geometry.getAttribute("position");
for(let i=0;i<idx.count;i+=3){
  const a=idx.getX(i),b=idx.getX(i+1),c=idx.getX(i+2);
  const color=result.materials[mat.getX(a)] as THREE.MeshStandardMaterial;
  if(mat.getX(a)!==mat.getX(b)||mat.getX(a)!==mat.getX(c))throw Error("Mixed triangle material");
  if(pos.getY(a)<-1 && color!==floor.material)throw Error("Floor received page material");
}
if(result.materials.length!==7)throw Error("Unexpected material count");
proxy.dispose();
console.log("PASS: six material groups split, tabletop material isolated");
