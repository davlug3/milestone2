import * as THREE from "three";
import {cameraPose} from "./pose.js";

// Recalculate only when framing changes, never during the toss.
export function frameLaunches(shots,camera){
 const launchCamera=camera.clone(),frustum=new THREE.Frustum(),matrix=new THREE.Matrix4(),center=new THREE.Vector3();
 for(const shot of shots){
   const p=cameraPose(shot.start);
   launchCamera.position.set(p.x,p.y,p.z);
   launchCamera.lookAt(p.targetX,0,p.targetZ);launchCamera.rotateZ(p.roll);
   launchCamera.updateMatrixWorld(true);
   frustum.setFromProjectionMatrix(matrix.multiplyMatrices(launchCamera.projectionMatrix,launchCamera.matrixWorldInverse));
   const dx=shot.fromX-shot.x,dz=shot.fromZ-shot.z;
   // Bound the entire curled/rotated print, plus clearance for its launch height and camera drift.
   const radius=Math.hypot(shot.config.width,shot.config.depth)/2+.15;
   center.set(shot.x+dx,shot.layer*shot.config.thickness+.11,shot.z+dz);
   let scale=1;
   // Four side planes only; do not mistake near/far clipping for an edge exit.
   const planes=frustum.planes.slice(0,4);
   for(const plane of planes){
     const slope=plane.normal.x*dx+plane.normal.z*dz;
     if(slope< -1e-6){
       const needed=1+(-radius-plane.distanceToPoint(center))/slope;
       if(!shot.launchScale||Math.max(1,needed)<shot.launchScale)shot.launchScale=Math.max(1,needed);
     }
   }
   scale=shot.launchScale??1;
   shot.launchX=shot.x+dx*scale;shot.launchZ=shot.z+dz*scale;
   delete shot.launchScale;
 }
}
