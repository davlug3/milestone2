import {readFile,mkdir,writeFile} from 'node:fs/promises';
import ts from 'typescript';
const config=ts.parseConfigFileTextToJson('photos.config.jsonc',await readFile('photos.config.jsonc','utf8')).config;
const catalog=new Map();
for(const scene of ['book','slideshow','clothesline','floating']){
 const paths=config[scene].photos;if(!paths.length)continue;
 const file=scene==='book'?'public/page-photos/manifest.json':'slideshow/public/'+(scene==='slideshow'?'slides.json':scene+'-photos.json');
 const manifest=JSON.parse(await readFile(file,'utf8')).photos;
 if(paths.length!==manifest.length)throw Error('Cloud editor requires explicit individual photo paths for '+scene);
 for(let i=0;i<paths.length;i++){
 const p=paths[i],url=scene==='book'?'/book/page-photos/'+manifest[i]:'/slideshow/'+manifest[i].replace(/^\.\//,'');
 catalog.set(p,{path:p,group:p.slice(0,p.lastIndexOf('/')),url});
 }
}
await mkdir('site-dist/editor',{recursive:true});
await writeFile('site-dist/editor/catalog.json',JSON.stringify([...catalog.values()]));
await writeFile('site-dist/editor/index.html',(await readFile('tools/photo-editor/index.html','utf8')).replace('<head>','<head><meta name="editor-cloud" content="1">'));
