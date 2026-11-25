import * as THREE from "three";
import { PhysicalSpotLight } from "three-gpu-pathtracer";

/** Photographic lighting with restrained contrast and environment bounce. */
export function addStudioLighting(scene: THREE.Scene): void {
  const key = new PhysicalSpotLight(0xffe6cf, 5.4, 4, Math.PI/5, 0.72, 2);
  key.radius = 0.10;
  key.position.set(-0.55,0.82,0.35);
  key.target.position.set(0,0.035,-0.03);
  key.castShadow = true;
  key.shadow.mapSize.set(2048,2048);
  key.shadow.camera.near=0.15;
  key.shadow.camera.far=2.8;
  key.shadow.bias=-0.00008;
  key.shadow.normalBias=0.0008;
  scene.add(key,key.target);
  const rim = new THREE.DirectionalLight(0xc7d8ff,0.95);
  rim.position.set(0.7,0.6,-0.9);scene.add(rim);
  const fill = new THREE.DirectionalLight(0xfff4ea,0.35);
  fill.position.set(0.35,0.55,0.5);scene.add(fill);
  scene.add(new THREE.HemisphereLight(0xdce6f2,0x3a2b20,0.14));
}
