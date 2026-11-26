import test from "node:test";import assert from "node:assert/strict";import {gunzipSync} from "node:zlib";import {encodeCache} from "./lib/binary-cache.mjs";
test("binary cache preserves typed bytes and metadata",()=>{
 const values=new Float32Array([1,-2.5,0.125]);const bytes=Buffer.from(values.buffer);
 const data={meshes:[{id:0,positions:bytes.toString("base64"),normals:null,slots:[1]}],textures:[{id:0,png:"AQID"}]};
 const raw=gunzipSync(encodeCache(data));assert.equal(raw.subarray(0,8).toString(),"M2CACHE2");
 const end=12+raw.readUInt32LE(8),meta=JSON.parse(raw.subarray(12,end));assert.deepEqual(meta.meshes[0].positions.$binary,[0,12]);
 assert.deepEqual(raw.subarray(end,end+12),bytes);assert.deepEqual([...raw.subarray(end+12)],[1,2,3]);assert.equal(meta.meshes[0].normals,null);
});
test("delta frame can omit geometry",()=>{const raw=gunzipSync(encodeCache({meshes:[{id:0,matrix:[1]}]}));assert.equal(raw.length,12+raw.readUInt32LE(8));});
