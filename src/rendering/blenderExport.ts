import {browserAssets,type SceneAssets} from "./sceneAssets";
import * as THREE from "three";
function b64(a: ArrayBufferView): string {
  const bytes=new Uint8Array(a.buffer,a.byteOffset,a.byteLength);
  let s="";for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return btoa(s);
}
function attr(a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute): string {
  if((a as THREE.BufferAttribute).isBufferAttribute)return b64(Float32Array.from((a as THREE.BufferAttribute).array));
  const out=new Float32Array(a.count*a.itemSize);
  for(let i=0;i<a.count;i++)for(let j=0;j<a.itemSize;j++)out[i*a.itemSize+j]=a.getComponent(i,j);
  return b64(out);
}
export class BlenderExport {
  private meshes: THREE.Mesh[]=[];
  private lights: Array<THREE.DirectionalLight|THREE.SpotLight|THREE.PointLight>=[];
  private previous=new Map<number,string>();
  constructor(private scene:THREE.Scene,private camera:THREE.PerspectiveCamera,private assets:SceneAssets=browserAssets){}
  setup(){
    this.meshes=[];this.previous.clear();
    this.lights=[];
    this.scene.traverse(o=>{if((o as THREE.Mesh).isMesh)this.meshes.push(o as THREE.Mesh);if((o as THREE.DirectionalLight).isDirectionalLight||(o as THREE.SpotLight).isSpotLight||(o as THREE.PointLight).isPointLight)this.lights.push(o as THREE.DirectionalLight|THREE.SpotLight|THREE.PointLight);});
    if(!this.meshes.length)throw Error("Geometry export contains no meshes");
    const textures=new Map<THREE.Texture,number>(), textureData:unknown[]=[];
    const materials=new Map<THREE.Material,number>(), materialData:unknown[]=[];
    const tex=(t:THREE.Texture|null)=>{
      if(!t)return null;
      if(textures.has(t))return textures.get(t)!;
      const id=textures.size;textures.set(t,id);
      let canvas:HTMLCanvasElement;
      if(this.assets.isCanvas(t.image))canvas=t.image;
      else if((t as THREE.DataTexture).isDataTexture){
        const {width,height,data}=(t as THREE.DataTexture).image;canvas=this.assets.canvas(width,height);
        if(!(data instanceof Uint8Array)||data.length!==width*height*4)throw Error("Unsupported texture "+t.uuid);
        canvas.getContext("2d")!.putImageData(this.assets.imageData(new Uint8ClampedArray(data),width,height),0,0);
      }else throw Error("Unsupported texture source "+t.uuid);
      textureData.push({id,png:this.assets.png(canvas),srgb:t.colorSpace===THREE.SRGBColorSpace,flipY:t.flipY,repeat:t.repeat.toArray(),offset:t.offset.toArray()});
      return id;
    };
    const mat=(m:THREE.Material)=>{
      if(materials.has(m))return materials.get(m)!;
      if(!(m as THREE.MeshStandardMaterial).isMeshStandardMaterial)throw Error("Unsupported material "+m.type);
      const id=materials.size;materials.set(m,id);
      const standard=m as THREE.MeshStandardMaterial;const p=(m as THREE.MeshPhysicalMaterial).isMeshPhysicalMaterial?m as THREE.MeshPhysicalMaterial:null;
      materialData.push({id,emissive:standard.emissive.toArray(),emissiveIntensity:standard.emissiveIntensity,emissiveMap:tex(standard.emissiveMap),color:standard.color.toArray(),roughness:standard.roughness,metalness:standard.metalness,map:tex(standard.map),roughnessMap:tex(standard.roughnessMap),normalMap:tex(standard.normalMap),normalScale:standard.normalScale.toArray(),bump:tex(standard.bumpMap),bumpScale:standard.bumpScale,anisotropy:p?.anisotropy??0,anisotropyRotation:p?.anisotropyRotation??0,coat:p?.clearcoat??0,coatRoughness:p?.clearcoatRoughness??0,sheen:p?.sheen??0,sheenRoughness:p?.sheenRoughness??1,sheenColor:p?.sheenColor.toArray()??[1,1,1]});
      return id;
    };
    const meshes=this.meshes.map((m,id)=>{
      const g=m.geometry,p=g.getAttribute("position"),uv=g.getAttribute("uv"),n=g.getAttribute("normal");
      const indices=g.index?Uint32Array.from(g.index.array):Uint32Array.from({length:p.count},(_,i)=>i);
      const slots=(Array.isArray(m.material)?m.material:[m.material]).map(mat);
      const faceMaterials=new Uint16Array(indices.length/3);
      if(Array.isArray(m.material))for(const group of g.groups)faceMaterials.fill(group.materialIndex??0,group.start/3,(group.start+group.count)/3);
      return {id,name:m.name||"mesh-"+id,positions:attr(p),normals:n?attr(n):null,uv:uv?attr(uv):null,indices:b64(indices),faceMaterials:b64(faceMaterials),slots};
    });
    return {meshes,materials:materialData,textures:textureData,background:(this.scene.background as THREE.Color|null)?.isColor?(this.scene.background as THREE.Color).toArray():[.025,.025,.025],environmentIntensity:this.scene.environmentIntensity};
  }
  frame(checkpoint=false){
    this.scene.updateMatrixWorld(true);this.camera.updateMatrixWorld(true);
    const meshes=this.meshes.map((m,id)=>{
      const p=attr(m.geometry.getAttribute("position"));
      const changed=checkpoint||this.previous.get(id)!==p;this.previous.set(id,p);
      let visible=true;for(let o:THREE.Object3D|null=m;o;o=o.parent)visible=visible&&o.visible;
      return {id,visible,matrix:m.matrixWorld.toArray(),...(changed?{positions:p}: {})};
    });
    const camera=this.camera as THREE.PerspectiveCamera & {focusDistance:number;fStop:number};
    const lights=this.lights.map((l,id)=>({id,name:l.name||l.type,type:l.type,position:l.getWorldPosition(new THREE.Vector3()).toArray(),target:(l as THREE.PointLight).isPointLight?[0,0,0]:(l as THREE.SpotLight|THREE.DirectionalLight).target.getWorldPosition(new THREE.Vector3()).toArray(),color:l.color.toArray(),intensity:l.intensity,radius:(l as THREE.SpotLight & {radius?:number}).radius??.1,angle:(l as THREE.SpotLight).isSpotLight?(l as THREE.SpotLight).angle:0,penumbra:(l as THREE.SpotLight).isSpotLight?(l as THREE.SpotLight).penumbra:0}));
    return {meshes,lights,camera:{matrix:camera.matrixWorld.toArray(),fov:camera.fov,focus:camera.focusDistance??camera.position.length(),fstop:camera.fStop??4}};
  }
}
