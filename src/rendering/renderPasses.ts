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
 function setPass(value:string){if(!PASS_OPTIONS.some(([key])=>key===value))throw Error("Unknown render pass: "+value);selected=value as PassName;}
 function addUI(ui:HTMLElement,onChange:()=>void){
  const row=document.createElement("div");row.style.cssText="display:grid;grid-template-columns:1fr 1fr;gap:8px";const select=document.createElement("select");select.setAttribute("aria-label","Render pass");
  for(const [value,label] of PASS_OPTIONS){const opt=document.createElement("option");opt.value=value;opt.textContent=label;select.appendChild(opt);}select.value=selected;select.onchange=()=>{setPass(select.value);onChange();};
  const save=document.createElement("button");save.textContent="Save pass PNG";save.onclick=()=>{onChange();render();const a=document.createElement("a");a.download="pass-"+selected+".png";a.href=renderer.domElement.toDataURL("image/png");a.click();};row.append(select,save);ui.appendChild(row);
 }
 return {get pass(){return selected;},setPass,render,addUI,settings,capture(pass:PassName){render(pass);return renderer.domElement.toDataURL("image/png");},idMap(){return Array.from(ids,([mesh,id])=>({id,name:mesh.name||mesh.type,uuid:mesh.uuid,rgb:[(id>>16)&255,(id>>8)&255,id&255]}));},dispose(){normal.dispose();clay.dispose();depth.dispose();for(const m of cache.values())m.dispose();}};
}
