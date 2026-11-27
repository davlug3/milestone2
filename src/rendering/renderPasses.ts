import * as THREE from "three";
export const PASS_OPTIONS=[["beauty","Beauty"],["albedo","Diffuse / base color"],["normal","View-space normals"],["depth","Linear depth"],["object-id","Object ID"],["mask","Subject mask"],["clay","Clay lighting"],["emission","Emission"]] as const;
export type PassName=typeof PASS_OPTIONS[number][0];
export function createRenderPasses(renderer:THREE.WebGLRenderer,scene:THREE.Scene,camera:THREE.Camera,subject:(mesh:THREE.Mesh)=>boolean,drawBeauty:()=>void){
 let selected:PassName="beauty";
 const normal=new THREE.MeshNormalMaterial({side:THREE.DoubleSide});
 const clay=new THREE.MeshStandardMaterial({color:0xbababa,roughness:.8,metalness:0,side:THREE.DoubleSide});
 const depth=new THREE.ShaderMaterial({side:THREE.DoubleSide,uniforms:{nearZ:{value:0},farZ:{value:10}},vertexShader:"varying float vz; void main(){vec4 p=modelViewMatrix*vec4(position,1.);vz=-p.z;gl_Position=projectionMatrix*p;}",fragmentShader:"varying float vz; uniform float nearZ; uniform float farZ; void main(){float d=clamp((vz-nearZ)/(farZ-nearZ),0.,1.);gl_FragColor=vec4(vec3(d),1.);}"});
 const cache=new Map<string,THREE.Material>();
 const ids=new Map<THREE.Mesh,number>();let nextId=1;
 const settings={near:0,far:10};
 function flat(key:string,color:THREE.ColorRepresentation,map:THREE.Texture|null=null,side:THREE.Side=THREE.FrontSide,alphaTest=0,alphaMap:THREE.Texture|null=null){
  let m=cache.get(key);if(!m){m=new THREE.MeshBasicMaterial({color,map,side,alphaTest,alphaMap,toneMapped:false,fog:false});cache.set(key,m);}return m;
 }
 function idColor(id:number){return new THREE.Color().setRGB(((id>>16)&255)/255,((id>>8)&255)/255,(id&255)/255,THREE.SRGBColorSpace);}
 function replacement(mesh:THREE.Mesh,mat:THREE.Material,pass:PassName){
  const m=mat as THREE.MeshStandardMaterial;
  if(pass==="normal")return normal;
  if(pass==="depth")return depth;
  if(pass==="clay")return clay;
  if(pass==="mask")return flat(subject(mesh)?"white":"black",subject(mesh)?0xffffff:0x000000,null,mat.side);
  if(pass==="object-id"){if(!ids.has(mesh))ids.set(mesh,nextId++);const id=ids.get(mesh)!;return flat("id"+id+":"+mat.side,idColor(id),null,mat.side);}
  if(pass==="emission"){const col=m.emissive?.clone().multiplyScalar(m.emissiveIntensity??1)??new THREE.Color(0);return flat("em:"+mat.uuid,col,m.emissiveMap??null,mat.side);}
  return flat("albedo:"+mat.uuid+":"+(m.map?.uuid??""),m.color??0xffffff,m.map??null,mat.side,mat.alphaTest,m.alphaMap??null);
 }
 function render(pass:PassName=selected){
  if(pass==="beauty"){drawBeauty();return;}
  const bg=scene.background,fog=scene.fog,tone=renderer.toneMapping,override=scene.overrideMaterial,previous=renderer.getRenderTarget();
  const saved:Array<[THREE.Mesh,THREE.Material|THREE.Material[]]>=[];
  try{
   scene.background=new THREE.Color(pass==="depth"?0xffffff:0x000000);scene.fog=null;scene.overrideMaterial=null;
   renderer.toneMapping=pass==="clay"?tone:THREE.NoToneMapping;renderer.setRenderTarget(null);
   depth.uniforms.nearZ.value=settings.near;depth.uniforms.farZ.value=settings.far;
   scene.traverse(o=>{if(!(o instanceof THREE.Mesh))return;const old=o.material;saved.push([o,old]);o.material=Array.isArray(old)?old.map(m=>replacement(o,m,pass)):replacement(o,old,pass);});
   renderer.render(scene,camera);
  }finally{for(const [mesh,mat] of saved)mesh.material=mat;scene.background=bg;scene.fog=fog;scene.overrideMaterial=override;renderer.toneMapping=tone;renderer.setRenderTarget(previous);}
 }
 // Capture actual interpolated view-space Z into RGBA32F, never a display image.
 let floatTarget:THREE.WebGLRenderTarget|undefined;
 const floatMaterials=new Map<THREE.Material,THREE.Material>();
 function captureDepth32(){
  if(!renderer.extensions.has("EXT_color_buffer_float"))throw Error("Float32 framebuffer unavailable");
  const size=renderer.getDrawingBufferSize(new THREE.Vector2()),w=size.x,h=size.y;
  if(!floatTarget)floatTarget=new THREE.WebGLRenderTarget(w,h,{type:THREE.FloatType,format:THREE.RGBAFormat,depthBuffer:true,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter});
  floatTarget.setSize(w,h);
  floatTarget.samples=0;
  const previous=renderer.getRenderTarget(),bg=scene.background,fog=scene.fog,override=scene.overrideMaterial,auto=renderer.autoClear,shadow=renderer.shadowMap.autoUpdate;
  const saved:Array<[THREE.Mesh,THREE.Material|THREE.Material[]]>=[],hidden:THREE.Object3D[]=[];
  function material(source:THREE.Material){
   let m=floatMaterials.get(source);
   if(!m){
    const original=source as THREE.MeshStandardMaterial;
    const replacement=new THREE.MeshBasicMaterial({side:source.side,map:original.map??null,alphaMap:original.alphaMap??null,alphaTest:source.alphaTest,opacity:source.opacity,transparent:false,depthWrite:true,depthTest:true,toneMapped:false,fog:false});
    replacement.onBeforeCompile=shader=>{
     shader.vertexShader="varying highp float linearZ;\n"+shader.vertexShader.replace("#include <project_vertex>","#include <project_vertex>\nlinearZ = -mvPosition.z;");
     shader.fragmentShader="varying highp float linearZ;\n"+shader.fragmentShader.replace("#include <opaque_fragment>","gl_FragColor = vec4(linearZ, 0.0, 0.0, 1.0);").replace("#include <tonemapping_fragment>","").replace("#include <colorspace_fragment>","").replace("#include <fog_fragment>","").replace("#include <dithering_fragment>","");
    };
    replacement.customProgramCacheKey=()=>"linear-camera-z-float32-v1";
    m=replacement;floatMaterials.set(source,m);
   }
   m.visible=source.visible&&source.depthWrite&&(!source.transparent||source.opacity>0);
   return m;
  }
  try{
   scene.background=new THREE.Color(0);scene.fog=null;scene.overrideMaterial=null;renderer.shadowMap.autoUpdate=false;renderer.autoClear=true;
   scene.traverse(o=>{if(o instanceof THREE.Mesh){saved.push([o,o.material]);o.material=Array.isArray(o.material)?o.material.map(material):material(o.material);}else if(o.visible&&(o instanceof THREE.Line||o instanceof THREE.Points||o instanceof THREE.Sprite)){hidden.push(o);o.visible=false;}});
   renderer.setRenderTarget(floatTarget);
   const gl=renderer.getContext();
   if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error("Incomplete float32 framebuffer");
   renderer.render(scene,camera);
   // Unfiltered, single-sample camera-space Z at each output pixel.
   const rgba=new Float32Array(w*h*4);renderer.readRenderTargetPixels(floatTarget,0,0,w,h,rgba);
   const plane=new Float32Array(w*h);
   for(let y=0;y<h;y++)for(let x=0;x<w;x++)plane[y*w+x]=rgba[((h-1-y)*w+x)*4];
   const bytes=new Uint8Array(plane.buffer);
   let binary="";for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
   return {width:w,height:h,base64:btoa(binary),samples:1,near:(camera as THREE.PerspectiveCamera).near,far:(camera as THREE.PerspectiveCamera).far};
  }finally{
   for(const [mesh,mat] of saved)mesh.material=mat;for(const o of hidden)o.visible=true;
   scene.background=bg;scene.fog=fog;scene.overrideMaterial=override;renderer.autoClear=auto;renderer.shadowMap.autoUpdate=shadow;renderer.setRenderTarget(previous);
  }
 }
 function setPass(value:string){if(!PASS_OPTIONS.some(([key])=>key===value))throw Error("Unknown render pass: "+value);selected=value as PassName;}
 function addUI(ui:HTMLElement,onChange:()=>void){
  const row=document.createElement("div");row.style.cssText="display:grid;grid-template-columns:1fr 1fr;gap:8px";const select=document.createElement("select");select.setAttribute("aria-label","Render pass");
  for(const [value,label] of PASS_OPTIONS){const opt=document.createElement("option");opt.value=value;opt.textContent=label;select.appendChild(opt);}select.value=selected;select.onchange=()=>{setPass(select.value);onChange();};
  const save=document.createElement("button");save.textContent="Save pass PNG";save.onclick=()=>{onChange();render();const a=document.createElement("a");a.download="pass-"+selected+".png";a.href=renderer.domElement.toDataURL("image/png");a.click();};row.append(select,save);ui.appendChild(row);
 }
 return {captureDepth32,get pass(){return selected;},setPass,render,addUI,settings,capture(pass:PassName){render(pass);return renderer.domElement.toDataURL("image/png");},idMap(){return Array.from(ids,([mesh,id])=>({id,name:mesh.name||mesh.type,uuid:mesh.uuid,rgb:[(id>>16)&255,(id>>8)&255,id&255]}));},dispose(){floatTarget?.dispose();for(const m of floatMaterials.values())m.dispose();normal.dispose();clay.dispose();depth.dispose();for(const m of cache.values())m.dispose();}};
}
