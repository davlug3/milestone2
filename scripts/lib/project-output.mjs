import {resolve,relative,isAbsolute,basename,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID,createHash} from 'node:crypto';
export const repoRoot=fileURLToPath(new URL('../../',import.meta.url));
export const renderRoot=resolve(repoRoot,'../rendered');
export function projectOutput(scene,requested,{kind='final',file='render.mp4'}={}){
  if(requested){const p=resolve(requested),r=relative(renderRoot,p);if(r && !r.startsWith('..'+ '/') && r!=='..' && !isAbsolute(r))return p;
    if(!isAbsolute(requested)&&requested.startsWith('renders/'))return resolve(renderRoot,scene,kind,'legacy',basename(requested));
    throw Error('Render output must be inside '+renderRoot+'; received '+p);}
  const job=process.env.JILP_RENDER_JOB||new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8);
  if(!/^[a-zA-Z0-9_-]+$/.test(job))throw Error('Invalid JILP_RENDER_JOB');
  return resolve(renderRoot,scene,kind,job,file);
}
export function cacheFor(output){return resolve(repoRoot,'renders/cache',createHash('sha256').update(output).digest('hex').slice(0,20)+'.cache');}
