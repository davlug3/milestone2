import * as THREE from "three";
/** Matte dark-green painted room backdrop with low-contrast deterministic surface texture. */
export function createStudioWall(scene:THREE.Scene){
 const canvas=document.createElement("canvas");canvas.width=canvas.height=512;
 const ctx=canvas.getContext("2d")!,data=ctx.createImageData(512,512);
 let seed=871;
 for(let y=0;y<512;y++)for(let x=0;x<512;x++){
  seed=(Math.imul(seed,1664525)+1013904223)>>>0;
  const grain=(seed/4294967296-.5)*5+1.4*Math.sin(x*2.7+y*.9)+1.1*Math.sin(y*2.4-x*.6);
  const cloud=1.5*Math.sin(x*.028+y*.011)+1.2*Math.sin(y*.045-x*.018)+.7*Math.cos(x*.091+y*.067);
  const i=(y*512+x)*4;data.data[i]=35+grain+cloud;data.data[i+1]=58+grain+cloud;data.data[i+2]=45+grain+cloud;data.data[i+3]=255;
 }
 ctx.putImageData(data,0,0);
 const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.set(3,2);
 const material=new THREE.MeshStandardMaterial({map,roughness:1,metalness:0});
 const trim=new THREE.MeshStandardMaterial({color:0x29382e,roughness:.85});
 const wall=new THREE.Mesh(new THREE.BoxGeometry(5,3,.08),material);
 wall.name="dark-green-matte-painted-wall";wall.position.set(0,.775,-.82);wall.receiveShadow=true;scene.add(wall);
 const baseboard=new THREE.Mesh(new THREE.BoxGeometry(5,.095,.025),trim);
 baseboard.name="wall-baseboard";baseboard.position.set(0,-.6775,-.768);baseboard.receiveShadow=true;scene.add(baseboard);
 return ()=>{scene.remove(wall,baseboard);wall.geometry.dispose();baseboard.geometry.dispose();material.dispose();trim.dispose();map.dispose();};
}
