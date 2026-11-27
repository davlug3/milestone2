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
export function createWalnutTextures(size=1024){
  function grain(x:number,y:number){
    const plank=Math.floor(y*3);
    const v=y*3-plank;
    const warp=noise(x*3,y*12)*2+noise(x*11,y*32)*0.3;
    const rings=Math.sin((y*105+warp*1.8+Math.sin(x*3+plank)*0.6)*Math.PI*2);
    const fine=noise(x*19,y*370);
    const seam=Math.min(v,1-v)<0.002?0.76:1;
    const age=0.84+0.28*noise(x*7,y*8);
    const scratch=noise(x*35,y*590)>0.92?1.18:1;
    const kx=x-.72,ky=(y-.27)*3.5;
    const knot=Math.exp(-(kx*kx+ky*ky)*125);
    const knotRing=Math.sin(Math.hypot(kx,ky)*95);
    const patina=.88+.24*noise(x*4+19,y*5+12);
    const scuff=noise(x*23+3,y*39+7)>.83?.91:1;
    const score=Math.exp(-Math.pow((y-.69-.035*Math.sin(x*5))*500,2))*Math.exp(-Math.pow((x-.32)*9,2));
    const cupRing=Math.exp(-Math.pow((Math.hypot((x-.13)*1.45,y-.79)-.075)*210,2))*.055;
    return {tone:(0.82+0.18*rings+0.17*(fine-0.5)+0.25*(noise(x*5,y*30)-0.5)+0.15*(hash(plank,4)-0.5))*seam*age*scratch*patina*scuff*(1-.13*knot+.07*knot*knotRing-.09*score-cupRing),bump:0.5+0.18*rings+0.22*(fine-0.5)-.09*score+.035*knot*knotRing};
  }
  return {
    map:texture(size,(x,y)=>{const t=grain(x,y).tone;return [105*t,65*t,38*t]},true),
    bumpMap:texture(size,(x,y)=>{const v=grain(x,y).bump*255;return [v,v,v]}),
    roughnessMap:texture(Math.min(size,512),(x,y)=>{const v=178+38*noise(x*7,y*18)+20*noise(x*28,y*115)-32*noise(x*3+10,y*4);return [v,v,v]})
  };
}
/** Localized finish wear for the writing surface, with correlated linear height
 * and roughness maps. Deterministic, UV-stable, no additional meshes. */
export function createWornWalnutTop(size=1024){
  const base=createWalnutTextures(size);
  const color=base.map.image.data as Uint8Array;
  const height=base.bumpMap.image.data as Uint8Array;
  const rough=base.roughnessMap.image.data as Uint8Array;
  const rs=base.roughnessMap.image.width;
  const scratches=Array.from({length:48},(_,i)=>{
    const x=hash(i,31),y=hash(i,37),a=(hash(i,41)-.5)*1.6;
    const length=.012+.115*hash(i,43)**2;
    return {x,y,dx:Math.cos(a),dy:Math.sin(a),length,width:.00035+.00085*hash(i,47),depth:.12+.22*hash(i,53)};
  });
  // Rasterize finite grooves into one height field, rather than evaluating
  // every scratch for every pixel. Soft shoulders and tapered endpoints.
  const grooves=new Float32Array(size*size);
  for(const q of scratches){
    const ex=q.x+q.dx*q.length,ey=q.y+q.dy*q.length,margin=q.width*3;
    const x0=Math.max(0,Math.floor((Math.min(q.x,ex)-margin)*size));
    const x1=Math.min(size-1,Math.ceil((Math.max(q.x,ex)+margin)*size));
    const y0=Math.max(0,Math.floor((Math.min(q.y,ey)-margin)*size));
    const y1=Math.min(size-1,Math.ceil((Math.max(q.y,ey)+margin)*size));
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
      const px=(x+.5)/size-q.x,py=(y+.5)/size-q.y;
      const t=(px*q.dx+py*q.dy)/q.length;
      if(t<=0||t>=1)continue;
      const d=(px*q.dy-py*q.dx)/q.width;
      const g=Math.exp(-d*d)*Math.sin(Math.PI*t)**.35*q.depth;
      const i=y*size+x;grooves[i]=Math.max(grooves[i],g);
    }
  }
  const clamp=(n:number)=>Math.max(0,Math.min(255,n));
  function wear(x:number,y:number){
    const mottled=noise(x*7+11,y*12+23);
    const rubbed=Math.exp(-(((x-.48)*2.6)**2+((y-.67)*4.5)**2))*mottled;
    const edge=Math.exp(-Math.min(y,1-y,x,1-x)*75)*(.35+.65*noise(x*23,y*27));
    return Math.min(1,.8*rubbed+.55*edge+.14*noise(x*17,y*28));
  }
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const i=y*size+x,k=i*4,u=x/size,v=y/size,w=wear(u,v),g=grooves[i];
    const pores=Math.max(0,noise(u*48,v*280)-.72)*.19;
    const patina=.91+.20*noise(u*4+5,v*5+2);
    const lightened=w*.12+g*.55;
    color[k]=clamp(color[k]*patina+lightened*70);
    color[k+1]=clamp(color[k+1]*patina+lightened*49);
    color[k+2]=clamp(color[k+2]*patina+lightened*31);
    const h=clamp(height[k]-255*(g+pores)+w*5);
    height[k]=height[k+1]=height[k+2]=h;
  }
  for(let y=0;y<rs;y++)for(let x=0;x<rs;x++){
    const u=x/rs,v=y/rs,k=(y*rs+x)*4;
    const g=grooves[Math.min(size-1,Math.floor(v*size))*size+Math.min(size-1,Math.floor(u*size))];
    const value=clamp(rough[k]-wear(u,v)*47+g*110);
    rough[k]=rough[k+1]=rough[k+2]=value;
  }
  base.map.needsUpdate=base.bumpMap.needsUpdate=base.roughnessMap.needsUpdate=true;
  return base;
}

/** Derive tangent-space normals from the final worn height field.
 * UV derivatives are normalized to the physical table dimensions. */
export function walnutNormalMap(bump:THREE.DataTexture,amplitude=.0011){
 const {width:w,height:h,data}=bump.image;
 const sample=(x:number,y:number)=>data[4*(Math.max(0,Math.min(h-1,y))*w+Math.max(0,Math.min(w-1,x)))]/255;
 return texture(w,(u,v)=>{
  const x=Math.round(u*(w-1)),y=Math.round(v*(h-1));
  const dx=(sample(x+1,y)-sample(x-1,y))*w*amplitude/(2*.68);
  const dy=(sample(x,y+1)-sample(x,y-1))*h*amplitude/(2*.48);
  const l=Math.hypot(dx,dy,1);
  return [127.5*(1-dx/l),127.5*(1-dy/l),127.5*(1+1/l)];
 });
}

export function createClothTexture(){
  return texture(256,(x,y)=>{
    const a=Math.sin(x*Math.PI*2*64),b=Math.sin(y*Math.PI*2*64);
    const v=128+28*a+28*b+9*(hash(x*256,y*256)-0.5);
    return [v,v,v];
  });
}

/** Small shared linear-data maps, not custom GLSL, so both renderers use them.
 * The normal channels use tangent-space slopes encoded around neutral blue.
 */
export function createMicroSurface(kind:"petal"|"leaf"|"ceramic"|"metal"|"paint"){
 const size=128;
 function height(x:number,y:number){
   const u=Math.max(0,Math.min(1,x)),v=Math.max(0,Math.min(1,y));
   const fine=noise(u*64,v*64)-.5;
   if(kind==="petal")return .0035*Math.sin(u*55+Math.sin(v*8)*.8)*Math.sin(Math.PI*v)+.0014*fine;
   if(kind==="leaf")return .005*Math.sin(u*45+v*13)*Math.sin(Math.PI*u)+.002*fine;
   if(kind==="ceramic")return .009*noise(u*9,v*13)+.0015*Math.sin(v*105)+.002*fine;
   if(kind==="metal")return .0018*noise(u*8,v*75)+.0007*fine;
   return .004*noise(u*36,v*41)+.0015*fine;
 }
 const normalMap=texture(size,(x,y)=>{
   const d=1/size,dx=(height(x+d,y)-height(x-d,y))/(2*d),dy=(height(x,y+d)-height(x,y-d))/(2*d);
   const n=Math.hypot(dx,dy,1);return [127.5*(1-dx/n),127.5*(1-dy/n),127.5*(1+1/n)];
 });
 const roughnessMap=texture(size,(x,y)=>{
   const base=kind==="metal"?170:kind==="leaf"?218:235;
   const v=base+22*noise(x*8,y*11)+12*noise(x*37,y*53);return [v,v,v];
 });
 return {normalMap,roughnessMap,dispose(){normalMap.dispose();roughnessMap.dispose();}};
}
