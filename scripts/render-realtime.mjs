import {parseArgs} from 'node:util';
import {spawnSync,execFileSync} from 'node:child_process';
import {existsSync,mkdtempSync,cpSync,copyFileSync,rmSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {isWSL} from './lib/windows-browser.mjs';
import {projectOutput} from './lib/project-output.mjs';
const {values:o}=parseArgs({options:{scene:{type:'string',multiple:true},duration:{type:'string'},width:{type:'string',default:'1920'},height:{type:'string',default:'1080'},fps:{type:'string',default:'24'},'no-build':{type:'boolean'},headed:{type:'boolean'},help:{type:'boolean'}}});
if(o.help){console.log('npm run render:realtime -- [--scene book|slideshow|clothesline|floating|earth|title|slideshow2d|photowall] [--duration seconds] [--no-build] [--headed] [--width 1920 --height 1080 --fps 24]');process.exit(0);}
const scenes=o.scene??['book','slideshow','clothesline','floating','earth','title','slideshow2d','photowall'];
if(scenes.some(s=>!['book','slideshow','clothesline','floating','earth','title','slideshow2d','photowall'].includes(s))||new Set(scenes).size!==scenes.length)throw Error('Choose unique 3D scenes');
const width=Number(o.width),height=Number(o.height),fps=Number(o.fps),duration=o.duration===undefined?undefined:Number(o.duration);
if(![width,height,fps].every(x=>Number.isInteger(x)&&x>0)||width%2||height%2||duration!==undefined&&(!Number.isFinite(duration)||duration<=0))throw Error('Invalid settings');
if(!o['no-build']){const r=spawnSync(process.execPath,['scripts/build-site.mjs'],{stdio:'inherit'});if(r.status!==0)throw Error('Build failed');}
const wsl=isWSL(),win=p=>wsl?execFileSync('wslpath',['-w',resolve(p)],{encoding:'utf8'}).trim():resolve(p);
const find=names=>names.find(x=>x&&existsSync(x));
const exe=find([process.env.WINDOWS_CHROME_PATH,process.env.CHROME_PATH,...(wsl?['/mnt/c/Program Files/Google/Chrome/Application/chrome.exe','/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe']:[])]);
const node=wsl?find([process.env.WINDOWS_NODE_PATH,'/mnt/c/Program Files/nodejs/node.exe','/mnt/c/nvm4w/nodejs/node.exe']):process.execPath;
if(!node||!exe)throw Error('Set native Chrome and Node paths');
const base=wsl?execFileSync('wslpath',['-u',execFileSync('/mnt/c/Windows/System32/cmd.exe',['/d','/c','echo','%TEMP%'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim()],{encoding:'utf8'}).trim():tmpdir();
const worker=mkdtempSync(join(base,'jilp-realtime-'));
try{
 mkdirSync(join(worker,'node_modules'),{recursive:true});
 for(const pkg of ['playwright','playwright-core'])cpSync(resolve('node_modules',pkg),join(worker,'node_modules',pkg),{recursive:true,dereference:true});
 for(const f of ['float-tiff.mjs','realtime-worker.mjs'])copyFileSync(resolve('scripts/lib',f),join(worker,f));
 const output=Object.fromEntries(scenes.map(s=>[s,win(projectOutput(s,undefined,{kind:'realtime',file:'render.frames'}))]));
 const cfg={root:win('site-dist'),output,exe:win(exe),scenes,width,height,fps,duration,headless:!o.headed};
 const r=spawnSync(node,[win(join(worker,'realtime-worker.mjs')),JSON.stringify(cfg)],{cwd:worker,stdio:'inherit'});if(r.error)throw r.error;if(r.status!==0)throw Error('Realtime worker failed: '+r.status);
}finally{rmSync(worker,{recursive:true,force:true});}
