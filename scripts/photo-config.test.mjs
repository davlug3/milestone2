import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,basename} from 'node:path';
import {resolvePhotos} from './lib/photo-config.mjs';
test('JSONC photo paths expand in order, skip nonimages and deduplicate',async()=>{
 const root=await mkdtemp(join(tmpdir(),'m2-photo-'));
 try{
  await mkdir(join(root,'album'));
  await mkdir(join(root,'album','nested'));
  for(const file of ['10.JPG','2.png','notes.txt','nested/hidden.jpg'])await writeFile(join(root,'album',file),'fixture');
  await writeFile(join(root,'single.webp'),'fixture');
  const cfg=join(root,'photos.config.jsonc');
  await writeFile(cfg,'{ // comment\n "photos": ["album", "single.webp", "album/2.png", "album/notes.txt",], }');
  assert.deepEqual((await resolvePhotos(cfg)).map(basenameSafe),['2.png','10.JPG','single.webp']);
  await writeFile(cfg,'{"photos":["missing"]}');
  await assert.rejects(resolvePhotos(cfg),/Photo path not found/);
  await writeFile(cfg,'{"photos":["album/notes.txt"]}');
  await assert.rejects(resolvePhotos(cfg),/no supported images/);
  await writeFile(cfg,'{"photos":[]}');
  assert.deepEqual(await resolvePhotos(cfg),[]);
 }finally{await rm(root,{recursive:true,force:true});}
});
function basenameSafe(p){return basename(p);}
