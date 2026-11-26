import {gzipSync} from "node:zlib";
const MAGIC=Buffer.from("M2CACHE2");
export function encodeCache(data){
 const chunks=[];let offset=0;
 const pack=(value)=>{
  if(typeof value!=="string")return value;
  const bytes=Buffer.from(value,"base64");
  const ref={$binary:[offset,bytes.length]};chunks.push(bytes);offset+=bytes.length;return ref;
 };
 const copy={...data,meshes:data.meshes.map(m=>{
  const out={...m};for(const k of ["positions","normals","uv","indices","faceMaterials"])if(typeof out[k]==="string")out[k]=pack(out[k]);return out;
 })};
 if(data.textures)copy.textures=data.textures.map(t=>({...t,png:pack(t.png)}));
 const metadata=Buffer.from(JSON.stringify(copy),"utf8"),header=Buffer.alloc(12);MAGIC.copy(header);header.writeUInt32LE(metadata.length,8);
 return gzipSync(Buffer.concat([header,metadata,...chunks]),{level:1});
}
