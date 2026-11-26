import * as THREE from "three";
/** Geometry exports still need DOM image/canvas APIs, but never a WebGL context.
 * A narrow compatibility adapter for existing preview bootstrap code.
 * Rendering methods throw so accidental preview calls cannot silently succeed.
 */
export function createSceneRenderer(geometryOnly:boolean,options:THREE.WebGLRendererParameters):THREE.WebGLRenderer{
 if(!geometryOnly)return new THREE.WebGLRenderer(options);
 const canvas=document.createElement("canvas");
 const fail=()=>{throw Error("Pixel rendering is unavailable in geometry-only mode");};
 const adapter={
  domElement:canvas,shadowMap:{enabled:false,type:THREE.PCFSoftShadowMap},
  capabilities:{getMaxAnisotropy:()=>1},
  setPixelRatio:(_ratio:number)=>{},setSize:(w:number,h:number,style=true)=>{if(style){canvas.style.width=w+"px";canvas.style.height=h+"px";}},
  getContext:()=>({isContextLost:()=>false}),dispose:()=>{},render:fail,getRenderTarget:fail,setRenderTarget:fail,
 };
 return adapter as unknown as THREE.WebGLRenderer;
}
