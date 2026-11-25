import * as THREE from "three";
/** Matte plaster room backdrop with low-contrast deterministic surface texture. */
export function createStudioWall(scene:THREE.Scene){
 const canvas=document.createElement("canvas");canvas.width=canvas.height=512;
 const ctx=canvas.getContext("2d")!,data=ctx.createImageData(512,512);
 let seed=871;
 for(let y=0;y<512;y++)for(let x=0;x<512;x++){
  seed=(Math.imul(seed,1664525)+1013904223)>>>0;
  const grain=(seed/4294967296-.5)*7;
  const cloud=3*Math.sin(x*.028+y*.011)+2*Math.sin(y*.045-x*.018)+1.5*Math.cos(x*.091+y*.067);
  const i=(y*512+x)*4;data.data[i]=111+grain+cloud;data.data[i+1]=104+grain+cloud;data.data[i+2]=94+grain+cloud;data.data[i+3]=255;
 }
 ctx.putImageData(data,0,0);
 const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.set(3,2);
 const material=new THREE.MeshStandardMaterial({map,roughness:.96,metalness:0});
 const trim=new THREE.MeshStandardMaterial({color:0x51463a,roughness:.85});
 const wall=new THREE.Mesh(new THREE.BoxGeometry(5,3,.08),material);
 wall.name="aged-plaster-back-wall";wall.position.set(0,.775,-.82);wall.receiveShadow=true;scene.add(wall);
 const baseboard=new THREE.Mesh(new THREE.BoxGeometry(5,.095,.025),trim);
 baseboard.name="wall-baseboard";baseboard.position.set(0,-.6775,-.768);baseboard.receiveShadow=true;scene.add(baseboard);
 return ()=>{scene.remove(wall,baseboard);wall.geometry.dispose();baseboard.geometry.dispose();material.dispose();trim.dispose();map.dispose();};
}
