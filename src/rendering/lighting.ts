import * as THREE from "three";

/** Low-key photographic studio: warm side key, cool edge light, restrained fill. */
export function addStudioLighting(scene: THREE.Scene): void {
  const key=new THREE.SpotLight(0xffdfba, 8.5, 4, Math.PI/5, 0.65, 2);
  key.position.set(-0.65,0.85,0.32);
  key.target.position.set(0,0,-0.02);
  key.castShadow=true;
  key.shadow.mapSize.set(2048,2048);
  key.shadow.camera.near=0.1;key.shadow.camera.far=3;
  key.shadow.bias=-0.00012;key.shadow.normalBias=0.0012;
  scene.add(key,key.target);
  const rim=new THREE.DirectionalLight(0xc2d9ff,1.15);
  rim.position.set(0.45,0.55,-0.85);scene.add(rim);
  const fill=new THREE.DirectionalLight(0xfff5e8,0.55);
  fill.position.set(0.3,0.75,0.45);scene.add(fill);
  scene.add(new THREE.HemisphereLight(0xd9e4f7,0x49321e,0.24));
}
