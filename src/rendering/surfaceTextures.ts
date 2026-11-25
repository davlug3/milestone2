import * as THREE from "three";

function hash(x:number,y:number):number {
  const n=Math.sin(x*127.1+y*311.7)*43758.5453;
  return n-Math.floor(n);
}
function noise(x:number,y:number):number {
  const ix=Math.floor(x), iy=Math.floor(y);
  let u=x-ix,v=y-iy;u=u*u*(3-2*u);v=v*v*(3-2*v);
  const a=hash(ix,iy)*(1-u)+hash(ix+1,iy)*u;
  const b=hash(ix,iy+1)*(1-u)+hash(ix+1,iy+1)*u;
  return a*(1-v)+b*v;
}
function texture(size:number, sample:(x:number,y:number)=>number[], srgb=false):THREE.DataTexture {
  const data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const v=sample(x/size,y/size);
    for(let i=0;i<3;i++)data[(y*size+x)*4+i]=Math.max(0,Math.min(255,v[i]));
    data[(y*size+x)*4+3]=255;
  }
  const t=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);
  t.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace;
  t.wrapS=t.wrapT=THREE.RepeatWrapping;
  t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;
  t.generateMipmaps=true;t.anisotropy=8;t.needsUpdate=true;
  return t;
}
export function createWalnutTextures(){
  function grain(x:number,y:number){
    const plank=Math.floor(y*6);
    const v=y*6-plank;
    const warp=noise(x*3,y*12)*2+noise(x*11,y*32)*0.3;
    const rings=Math.sin((y*105+warp*1.8+Math.sin(x*3+plank)*0.6)*Math.PI*2);
    const fine=noise(x*19,y*370);
    const seam=Math.min(v,1-v)<0.003?0.55:1;
    return {tone:(0.82+0.18*rings+0.17*(fine-0.5)+0.25*(noise(x*5,y*30)-0.5)+0.15*(hash(plank,4)-0.5))*seam,bump:0.5+0.18*rings+0.22*(fine-0.5)};
  }
  return {
    map:texture(1024,(x,y)=>{const t=grain(x,y).tone;return [111*t,73*t,44*t]},true),
    bumpMap:texture(1024,(x,y)=>{const v=grain(x,y).bump*255;return [v,v,v]})
  };
}
export function createClothTexture(){
  return texture(256,(x,y)=>{
    const a=Math.sin(x*Math.PI*2*64),b=Math.sin(y*Math.PI*2*64);
    const v=128+28*a+28*b+9*(hash(x*256,y*256)-0.5);
    return [v,v,v];
  });
}
