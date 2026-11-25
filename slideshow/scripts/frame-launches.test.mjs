import {test} from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {makeShots,cameraPose,pose} from "../src/pose.js";
import {frameLaunches} from "../src/frameLaunches.js";
test("launch prints clear the whole frame in portrait, square and wide views",()=>{
 for(const aspect of [.45,1,16/9,2.4]){
  const fov=2*Math.atan(Math.tan(40*Math.PI/360)*Math.max(1,(16/9)/aspect))*180/Math.PI;
  const camera=new THREE.PerspectiveCamera(fov,aspect,.02,8),shots=makeShots(8);
  frameLaunches(shots,camera);
  for(const shot of shots){
   const p=cameraPose(shot.start);camera.position.set(p.x,p.y,p.z);camera.lookAt(p.targetX,0,p.targetZ);camera.rotateZ(p.roll);camera.updateMatrixWorld(true);
   const frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
   const start=pose(shot,shot.start),center=new THREE.Vector3(start.x,start.height,start.z),radius=Math.hypot(shot.config.width,shot.config.depth)/2+.10;
   assert.ok(frustum.planes.slice(0,4).some(plane=>plane.distanceToPoint(center)<-radius));
   const end=pose(shot,shot.start+shot.config.flight+shot.config.settle+1);assert.equal(end.x,shot.x);assert.equal(end.z,shot.z);
  }
 }
});
