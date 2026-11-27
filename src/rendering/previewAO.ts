import * as THREE from "three";
import {GTAOPass} from "three/addons/postprocessing/GTAOPass.js";
import {OutputPass} from "three/addons/postprocessing/OutputPass.js";
import {FullScreenQuad} from "three/addons/postprocessing/Pass.js";

/** Half-res native GTAO; combine in linear HDR before ACES and sRGB. */
export class PreviewAO {
 private ao:GTAOPass;
 private output=new OutputPass();
 private beauty=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType});
 private combined=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:false});
 private size=new THREE.Vector2();
 private mat=new THREE.ShaderMaterial({
  uniforms:{beauty:{value:null},ao:{value:null}},
  vertexShader:"varying vec2 uv0;void main(){uv0=uv;gl_Position=vec4(position.xy,0.,1.);}",
  fragmentShader:"varying vec2 uv0;uniform sampler2D beauty;uniform sampler2D ao;void main(){vec4 c=texture2D(beauty,uv0);float a=texture2D(ao,uv0).r;gl_FragColor=vec4(c.rgb*mix(1.0,clamp(a,0.0,1.0),0.38),c.a);}",
  depthTest:false,depthWrite:false,toneMapped:false
 });
 private quad=new FullScreenQuad(this.mat);
 constructor(private renderer:THREE.WebGLRenderer,scene:THREE.Scene,camera:THREE.PerspectiveCamera){
  this.ao=new GTAOPass(scene,camera,1,1);
  this.ao.output=GTAOPass.OUTPUT.Off;
  this.ao.updateGtaoMaterial({radius:.045,thickness:.018,distanceFallOff:1,scale:1,samples:8,screenSpaceRadius:false});
  this.ao.updatePdMaterial({radius:3,radiusExponent:1.5,samples:8});
  this.output.renderToScreen=true;
 }
 draw(beauty:()=>void){
  const r=this.renderer,prior=r.getRenderTarget();
  r.getDrawingBufferSize(this.size);
  const w=Math.max(1,this.size.x),h=Math.max(1,this.size.y);
  if(this.beauty.width!==w||this.beauty.height!==h){this.beauty.setSize(w,h);this.combined.setSize(w,h);this.ao.setSize(Math.max(1,Math.round(w/2)),Math.max(1,Math.round(h/2)));}
  try{
   r.setRenderTarget(this.beauty);beauty();
   const shadowAuto=r.shadowMap.autoUpdate,needs=r.shadowMap.needsUpdate;
   try{r.shadowMap.autoUpdate=false;r.shadowMap.needsUpdate=false;this.ao.render(r,this.combined,this.beauty,0,false);}
   finally{r.shadowMap.autoUpdate=shadowAuto;r.shadowMap.needsUpdate=needs;}
   this.mat.uniforms.beauty.value=this.beauty.texture;
   this.mat.uniforms.ao.value=this.ao.pdRenderTarget.texture;
   r.setRenderTarget(this.combined);this.quad.render(r);
   this.output.render(r,this.beauty,this.combined,0,false);
  }finally{r.setRenderTarget(prior);}
 }
 dispose(){this.ao.dispose();this.output.dispose();this.beauty.dispose();this.combined.dispose();this.mat.dispose();this.quad.dispose();}
}
