import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {makeShots,pose} from "../src/pose.js";
import {shapeFor,displacement,createPhoto,placePhoto,supportHeight} from "../src/photoDeform.js";
const shots=makeShots(8),c=shots[0].config;
const materials={front:new THREE.MeshStandardMaterial(),back:new THREE.MeshStandardMaterial(),edge:new THREE.MeshStandardMaterial()};
test("seeded shapes vary and damping returns to rest",()=>{
 const a=shapeFor(c.seed,0),b=shapeFor(c.seed,1);
 assert.deepEqual(a,shapeFor(c.seed,0));assert.notDeepEqual(a,b);
 const rest=displacement(a,.9,.8,c.flight+c.settle,c);
 assert.equal(displacement(a,.9,.8,c.flight+c.settle+2,c),rest);
 assert.ok(Math.abs(displacement(a,.9,.8,c.flight-.000001,c)-displacement(a,.9,.8,c.flight,c))<1e-6);
 assert.notEqual(displacement(a,.9,.8,c.flight+.05,c),rest);
 for(let i=0;i<100;i++)assert.ok(Math.abs(displacement(b,i/100,.9,i/50,c))<.09);
});
test("closed shell, contact and deterministic seeking",()=>{
 const cards=shots.map((s,i)=>createPhoto(c,shapeFor(c.seed,i),materials));
 const times=[.7,1.6,2.4,5,8,24,1.1,5,24];
 let snapshot;
 for(const t of times){
  for(let i=0;i<shots.length;i++){
   const s=pose(shots[i],t),card=cards[i];card.visible=s.visible;if(!s.visible)continue;
   placePhoto(card,s,shots[i],t,cards.slice(0,i));card.updateMatrixWorld(true);
   const {top,bottom,edge}=card.userData.photo;
   assert.equal(top.attributes.position.count,bottom.attributes.position.count);
   const a=top.attributes.position,b=bottom.attributes.position;
   for(let k=0;k<b.count;k++){
    assert.ok(Math.abs(a.getY(k)-b.getY(k)-c.thickness)<1e-7);
    const p=new THREE.Vector3().fromBufferAttribute(b,k).applyMatrix4(card.matrixWorld);
    let floor=0;for(const other of cards.slice(0,i))if(other.visible)floor=Math.max(floor,supportHeight(other,p.x,p.z));
    assert.ok(p.y>=floor-1e-7,"sampled underside penetrated support");
   }
   for(const g of [top,bottom,edge])assert.ok(g.attributes.normal.array.every(Number.isFinite));
  }
  if(t===24){const current=cards.map(x=>({position:x.position.toArray(),vertices:Array.from(x.userData.photo.top.attributes.position.array)}));if(snapshot)assert.deepEqual(current,snapshot);snapshot=current;}
 }
});
