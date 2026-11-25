import {spawnSync} from 'node:child_process';
import {mkdirSync,cpSync,rmSync,readFileSync,writeFileSync,readdirSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
process.chdir(root);
const out=resolve('site-dist');
function run(command,args,cwd=root){
 const r=spawnSync(command,args,{cwd,stdio:'inherit',shell:process.platform==='win32'});
 if(r.error)throw r.error;
 if(r.status!==0)throw Error(command+' failed: '+r.status);
}
rmSync(out,{recursive:true,force:true});mkdirSync(out,{recursive:true});
run('npm',['run','typecheck']);
run('node',['scripts/site-photos.mjs']);
const vite=resolve('node_modules/vite/bin/vite.js');
run('node',[vite,'build','--base','/book/','--outDir',resolve(out,'book')]);
run('node',[vite,'build','--base','/slideshow/','--outDir',resolve(out,'slideshow')],resolve('slideshow'));
for(const name of ['book','slideshow']){
 const path=resolve(out,name,'index.html');
 const html=readFileSync(path,'utf8');
 writeFileSync(path,html.replace('</body>',"<a id=\"site-home\" href=\"/\" aria-label=\"Back to presentation selection\" style=\"position:fixed;z-index:100;top:12px;left:12px;color:#eee;text-decoration:none;background:#151515bb;padding:9px 13px;border-radius:9px;font:14px system-ui\">← Presentations</a><script>if(location.search||!location.pathname.match(/^\\/(book|slideshow)\\//))document.getElementById('site-home').hidden=true;</script>"+'</body>'));
}
cpSync('site/index.html',resolve(out,'index.html'));
for(const name of ['book','slideshow'])if(!existsSync(resolve(out,name,'index.html')))throw Error('Missing '+name);
console.log('Unified site ready in '+out);
