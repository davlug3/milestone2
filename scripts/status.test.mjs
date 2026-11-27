import test from 'node:test';
import assert from 'node:assert/strict';
import {chunkCount} from '../tools/status/collector.mjs';
const archive=i=>['.json','.mov','.depth.tar'].map(e=>'chunks/chunk-'+String(i).padStart(6,'0')+e);
test('counts complete archive sets including partial final chunk',()=>{
 assert.equal(chunkCount(new Set([...archive(0),...archive(240)]),260,true),260);
});
test('ignores incomplete archive sets',()=>{
 assert.equal(chunkCount(new Set(archive(0).slice(0,2)),240,true),0);
});
test('requires every individual depth frame',()=>{
 const f=new Set(['chunks/chunk-000000.json','chunks/chunk-000000.mov','depth/frame-000000.png']);
 assert.equal(chunkCount(f,2),0);
 f.add('depth/frame-000001.png');assert.equal(chunkCount(f,2),2);
});
