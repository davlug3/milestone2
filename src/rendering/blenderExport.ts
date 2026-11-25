import * as THREE from "three";
function b64(a: ArrayBufferView): string {
  const bytes=new Uint8Array(a.buffer,a.byteOffset,a.byteLength);
  let s="";for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return btoa(s);
}
function attr(a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute): string {
  if(a instanceof THREE.BufferAttribute)return b64(Float32Array.from(a.array));
  const out=new Float32Array(a.count*a.itemSize);
  for(let i=0;i<a.count;i++)for(let j=0;j<a.itemSize;j++)out[i*a.itemSize+j]=a.getComponent(i,j);
  return b64(out);
}
export class BlenderExport {
  private meshes: THREE.Mesh[]=[];
  private previous=new Map<number,string>();
  constructor(private scene:THREE.Scene,private camera:THREE.PerspectiveCamera){}
  setup(){
    this.meshes=[];this.previous.clear();
    this.scene.traverseVisible(o=>{if(o instanceof THREE.Mesh)this.meshes.push(o);});
    const textures=new Map<THREE.Texture,number>(), textureData:unknown[]=[];
    const materials=new Map<THREE.Material,number>(), materialData:unknown[]=[];
    const tex=(t:THREE.Texture|null)=>{
      if(!t)return null;
      if(textures.has(t))return textures.get(t)!;
      const id=textures.size;textures.set(t,id);
      let canvas:HTMLCanvasElement;
      if(t.image instanceof HTMLCanvasElement)canvas=t.image;
      else if(t instanceof THREE.DataTexture){
        const {width,height,data}=t.image;canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;
        if(!(data instanceof Uint8Array)||data.length!==width*height*4)throw Error("Unsupported texture "+t.uuid);
        canvas.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(data),width,height),0,0);
      }else throw Error("Unsupported texture source "+t.uuid);
      textureData.push({id,png:canvas.toDataURL("image/png").split(",")[1],srgb:t.colorSpace===THREE.SRGBColorSpace,flipY:t.flipY,repeat:t.repeat.toArray(),offset:t.offset.toArray()});
      return id;
    };
    const mat=(m:THREE.Material)=>{
      if(materials.has(m))return materials.get(m)!;
      if(!(m instanceof THREE.MeshStandardMaterial))throw Error("Unsupported material "+m.type);
      const id=materials.size;materials.set(m,id);
      const p=m instanceof THREE.MeshPhysicalMaterial?m:null;
      materialData.push({id,color:m.color.toArray(),roughness:m.roughness,metalness:m.metalness,map:tex(m.map),bump:tex(m.bumpMap),bumpScale:m.bumpScale,coat:p?.clearcoat??0,coatRoughness:p?.clearcoatRoughness??0,sheen:p?.sheen??0,sheenRoughness:p?.sheenRoughness??1,sheenColor:p?.sheenColor.toArray()??[1,1,1]});
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
    return {meshes,materials:materialData,textures:textureData};
  }
  frame(){
    this.scene.updateMatrixWorld(true);this.camera.updateMatrixWorld(true);
    const meshes=this.meshes.map((m,id)=>{
      const p=attr(m.geometry.getAttribute("position"));
      const changed=this.previous.get(id)!==p;this.previous.set(id,p);
      return {id,matrix:m.matrixWorld.toArray(),...(changed?{positions:p}: {})};
    });
    const camera=this.camera as THREE.PerspectiveCamera & {focusDistance:number;fStop:number};
    return {meshes,camera:{matrix:camera.matrixWorld.toArray(),fov:camera.fov,focus:camera.focusDistance,fstop:camera.fStop}};
  }
}
