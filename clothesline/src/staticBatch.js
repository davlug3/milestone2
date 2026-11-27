import * as THREE from "three";
import {mergeGeometries} from "three/addons/utils/BufferGeometryUtils.js";

// Batch only immutable, single-material decoration meshes. Dynamic print
// shells remain separate, preserving their simulation and object-ID passes.
export function batchStaticDecorations(scene,objects,maxSpan=2){
 scene.updateMatrixWorld(true);
 const groups=new Map(),point=new THREE.Vector3();
 for(const object of objects){
  if(!object.isMesh||Array.isArray(object.material)||!object.visible||!object.parent)throw Error("Invalid static decoration");
  object.getWorldPosition(point);
  const g=object.geometry;
  // Partition by space as well as material to retain useful BVH/culling bounds.
  const signature=Object.keys(g.attributes).sort().map(k=>k+":"+g.attributes[k].itemSize).join(",");
  const key=[object.material.uuid,object.castShadow,object.receiveShadow,!!g.index,signature,Math.floor(point.x/maxSpan),Math.floor(point.z/maxSpan)].join("|");
  const list=groups.get(key)||[];list.push(object);groups.set(key,list);
 }
 let removed=0,added=0;
 const inverse=new THREE.Matrix4().copy(scene.matrixWorld).invert();
 for(const list of groups.values()){
  if(list.length<2)continue;
  const parts=list.map(o=>o.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,o.matrixWorld)));
  const geometry=mergeGeometries(parts,false);
  for(const g of parts)g.dispose();
  if(!geometry)throw Error("Static decoration batch failed");
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const first=list[0],batch=new THREE.Mesh(geometry,first.material);
  batch.name="static-decoration-"+added;batch.castShadow=first.castShadow;batch.receiveShadow=first.receiveShadow;
  for(const o of list){o.removeFromParent();removed++;}
  scene.add(batch);added++;
 }
 // Dispose only orphaned originals (shared assets may still be in use).
 const used=new Set();scene.traverse(o=>{if(o.isMesh)used.add(o.geometry);});
 for(const g of new Set(objects.map(o=>o.geometry)))if(!used.has(g))g.dispose();
 return {removed,added,reduction:removed-added};
}
