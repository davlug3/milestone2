import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {batchStaticDecorations} from "./staticBatch.js";
test("static batching preserves world vertices, material and dynamic geometry",()=>{
 const scene=new THREE.Scene(),group=new THREE.Group();scene.add(group);group.position.set(.2,.3,.4);group.rotation.y=.4;group.scale.set(1.1,.9,1.2);
 const g=new THREE.BoxGeometry(.1,.2,.3),m=new THREE.MeshStandardMaterial(),objects=[];
 for(let i=0;i<3;i++){const o=new THREE.Mesh(g,m);o.position.set(i*.1,.2,.2);o.castShadow=o.receiveShadow=true;group.add(o);objects.push(o);}
 const dynamic=new THREE.Mesh(g,m);group.add(dynamic);
 scene.updateMatrixWorld(true);
 const expected=objects.flatMap(o=>Array.from({length:g.attributes.position.count},(_,i)=>new THREE.Vector3().fromBufferAttribute(g.attributes.position,i).applyMatrix4(o.matrixWorld).toArray()));
 const result=batchStaticDecorations(scene,objects);
 assert.deepEqual(result,{removed:3,added:1,reduction:2});
 const batch=scene.children.find(o=>o.isMesh);assert.equal(batch.material,m);assert.ok(batch.castShadow&&batch.receiveShadow);assert.equal(dynamic.parent,group);
 assert.equal(batch.geometry.index.count,g.index.count*3);
 for(let i=0;i<expected.length;i++){const p=new THREE.Vector3().fromBufferAttribute(batch.geometry.attributes.position,i);assert.ok(p.distanceTo(new THREE.Vector3(...expected[i]))<1e-6);}
});
