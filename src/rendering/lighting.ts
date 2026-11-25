import * as THREE from "three";
import { PhysicalSpotLight } from "three-gpu-pathtracer";

/** Photographic lighting with restrained contrast and environment bounce. */
export function addStudioLighting(scene: THREE.Scene): void {
  const key = new PhysicalSpotLight(0xffdfc2, 4.4, 4.2, Math.PI/4.8, 0.82, 2);
  key.radius = 0.22;
  key.position.set(-0.62,0.88,0.34);
  key.target.position.set(0,0.035,-0.03);
  key.castShadow = true;
  key.shadow.mapSize.set(2048,2048);
  key.shadow.camera.near=0.15;
  key.shadow.camera.far=2.8;
  key.shadow.bias=-0.00008;
  key.shadow.normalBias=0.0008;
  scene.add(key,key.target);
  const rim = new THREE.DirectionalLight(0xbfd2ff,0.42);
  rim.position.set(0.95,0.64,-0.9);scene.add(rim);
  const fill = new THREE.DirectionalLight(0xfff1e2,0.12);
  fill.position.set(0.18,0.42,0.58);scene.add(fill);
  scene.add(new THREE.HemisphereLight(0xd9e4f5,0x1d140f,0.08));
}
