import {spawnSync,execFileSync} from 'node:child_process';
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
run('node',[vite,'build','--base','/stats/','--outDir',resolve(out,'stats')],resolve('stats'));
run('node',[vite,'build','--base','/clothesline/','--outDir',resolve(out,'clothesline')],resolve('clothesline'));
run('node',[vite,'build','--base','/floating/','--outDir',resolve(out,'floating')],resolve('floating'));
for(const name of ['book','slideshow','stats','clothesline','floating']){
 const path=resolve(out,name,'index.html');
 const html=readFileSync(path,'utf8');
 writeFileSync(path,html.replace('</body>',"<a id=\"site-home\" href=\"/\" aria-label=\"Back to presentation selection\" style=\"position:fixed;z-index:100;top:12px;left:12px;color:#eee;text-decoration:none;background:#151515bb;padding:9px 13px;border-radius:9px;font:14px system-ui\">← Presentations</a><script>if(new URLSearchParams(location.search).has('export')||!location.pathname.match(/^\\/(book|slideshow|stats|clothesline|floating)\\//))document.getElementById('site-home').hidden=true;</script>"+'</body>'));
}
cpSync('site/index.html',resolve(out,'index.html'));
for(const name of ['book','slideshow','stats','clothesline','floating'])if(!existsSync(resolve(out,name,'index.html')))throw Error('Missing '+name);
let sha=process.env.VERCEL_GIT_COMMIT_SHA||'';
if(!/^[a-f0-9]{40}$/i.test(sha)){try{sha=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();}catch{sha='';}}
const verified=/^[a-f0-9]{40}$/i.test(sha);
const label=verified?sha.slice(0,7):'local';
const version='<a id="build-version" '+(verified?'href="https://github.com/davlug3/milestone2/commit/'+sha+'" ':'')+'title="Build '+(verified?sha:'local')+'" style="position:fixed;z-index:100;right:max(12px,env(safe-area-inset-right));top:max(12px,env(safe-area-inset-top));font:11px monospace;color:#eee;background:#151515bb;padding:6px 9px;border-radius:6px;text-decoration:none">v '+label+'</a><script>if(new URLSearchParams(location.search).has("export")||new URLSearchParams(location.search).has("geometry-export"))document.getElementById("build-version").hidden=true;</script>';
for(const name of ['index.html','book/index.html','slideshow/index.html','stats/index.html','clothesline/index.html','floating/index.html']){const path=resolve(out,name);writeFileSync(path,readFileSync(path,'utf8').replace('</body>',version+'</body>'));}
console.log('Unified site ready in '+out+' ('+label+')');
