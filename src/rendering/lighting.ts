import * as THREE from "three";
import { PhysicalSpotLight } from "three-gpu-pathtracer";

/** Low-key three-point photographic lighting. Warm key, cool fill, copper rim. */
export function addStudioLighting(scene: THREE.Scene,luxury=false): void {
 function spot(color:number,intensity:number,radius:number,position:[number,number,number],target:[number,number,number],angle:number,shadow:boolean){
   const light=new PhysicalSpotLight(color,luxury?intensity*1.08:intensity,5,angle,.80,2);
   light.radius=radius;light.position.set(...position);light.target.position.set(...target);
   light.castShadow=shadow;
   if(shadow){light.shadow.mapSize.set(2048,2048);light.shadow.camera.near=.12;light.shadow.camera.far=4;light.shadow.bias=-.00006;light.shadow.normalBias=.0005;light.shadow.radius=4;}
   scene.add(light,light.target);
 }
 spot(0xffd6a6,4.9,.25,[-.65,.83,.40],[0,.035,-.02],Math.PI/4.7,true);
 spot(0x9cbfff,0.85,.33,[.66,.49,.52],[0,.03,0],Math.PI/3.7,false);
 // Keep the rear light in front of the physical backdrop.
 spot(0xffb184,2.2,.17,[.41,.65,-.58],[-.10,.07,-.08],Math.PI/4.4,true);
 scene.add(new THREE.HemisphereLight(0xc0d3e1,luxury?0x172b20:0x29201b,luxury?.045:.055));
}
