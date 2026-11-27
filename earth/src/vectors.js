import * as THREE from 'three';
// Forward screen displacement of the currently visible surface, in pixels/frame.
// RGB float TIFF: R = signed dx (right), G = signed dy (down), B = validity.
export function createVectors(renderer,globe,camera,configureCamera){
 const scene=new THREE.Scene(),next=new THREE.Matrix4(),size=new THREE.Vector2();
 const material=new THREE.ShaderMaterial({
  uniforms:{nextVP:{value:next},resolution:{value:size}},
  vertexShader:`varying vec4 future;uniform mat4 nextVP;void main(){vec4 world=modelMatrix*vec4(position,1.);future=nextVP*world;gl_Position=projectionMatrix*viewMatrix*world;}`,
  fragmentShader:`varying vec4 future;uniform vec2 resolution;void main(){if(future.w<=0.){gl_FragColor=vec4(0.);return;}vec2 dst=(future.xy/future.w*.5+.5)*resolution;vec2 v=dst-gl_FragCoord.xy;gl_FragColor=vec4(v.x,-v.y,1.,1.);}`
 });
 const mesh=new THREE.Mesh(globe.geometry,material);scene.add(mesh);scene.background=new THREE.Color(0);
 const futureCamera=camera.clone();
 const target=new THREE.WebGLRenderTarget(1,1,{type:THREE.FloatType,format:THREE.RGBAFormat,depthBuffer:true,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter,samples:0});
 return function capture(t,dt){
  renderer.getDrawingBufferSize(size);const w=size.x,h=size.y;
  configureCamera(futureCamera,t+dt);futureCamera.updateMatrixWorld(true);
  next.multiplyMatrices(futureCamera.projectionMatrix,futureCamera.matrixWorldInverse);
  target.setSize(w,h);const previous=renderer.getRenderTarget(),auto=renderer.autoClear;
  try{
   renderer.autoClear=true;renderer.setRenderTarget(target);
   renderer.render(scene,camera);
   const rgba=new Float32Array(w*h*4);renderer.readRenderTargetPixels(target,0,0,w,h,rgba);
   const rgb=new Float32Array(w*h*3);
   for(let y=0;y<h;y++)for(let x=0;x<w;x++){const src=((h-1-y)*w+x)*4,dst=(y*w+x)*3;rgb[dst]=rgba[src];rgb[dst+1]=rgba[src+1];rgb[dst+2]=rgba[src+2];}
   const bytes=new Uint8Array(rgb.buffer);let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
   return {width:w,height:h,base64:btoa(binary),samples:1};
  }finally{renderer.setRenderTarget(previous);renderer.autoClear=auto;}
 };
}
