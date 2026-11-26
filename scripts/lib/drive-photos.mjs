import {createHash} from 'node:crypto';
import {mkdir,writeFile,rename,readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';

const FOLDER='application/vnd.google-apps.folder';
const api='https://www.googleapis.com/drive/v3';
const esc=s=>s.replaceAll('\\','\\\\').replaceAll("'","\\'");
const scope='https://www.googleapis.com/auth/drive.readonly';
let tokenPromise;
async function token(){
 if(!tokenPromise)tokenPromise=(async()=>{
  if(process.env.VERCEL==='1'&&process.env.VERCEL_ENV!=='production')throw Error('Drive photos are restricted to Vercel production builds');
  const subject=process.env.VERCEL_OIDC_TOKEN;
  if(!subject)throw Error('Missing VERCEL_OIDC_TOKEN; enable Vercel OIDC');
  const cfg=JSON.parse(await readFile(new URL('../../config/gdrive-federation.json',import.meta.url),'utf8'));
  const exchange=await fetch(cfg.token_url,{
   method:'POST',
   body:new URLSearchParams({
    audience:cfg.audience,
    grant_type:'urn:ietf:params:oauth:grant-type:token-exchange',
    requested_token_type:'urn:ietf:params:oauth:token-type:access_token',
    subject_token_type:cfg.subject_token_type,
    subject_token:subject,
    scope:'https://www.googleapis.com/auth/cloud-platform'
   }),signal:AbortSignal.timeout(30000)
  });
  if(!exchange.ok)throw Error('Google STS token exchange failed: HTTP '+exchange.status);
  const federated=(await exchange.json()).access_token;
  if(!federated)throw Error('Google STS returned no access token');
  const impersonation=await fetch(cfg.service_account_impersonation_url,{
   method:'POST',
   headers:{Authorization:'Bearer '+federated,'Content-Type':'application/json'},
   body:JSON.stringify({scope:[scope],lifetime:'3600s'}),signal:AbortSignal.timeout(30000)
  });
  if(!impersonation.ok)throw Error('Google service account impersonation failed: HTTP '+impersonation.status);
  const access=(await impersonation.json()).accessToken;
  if(!access)throw Error('Google IAM returned no access token');
  return access;
 })();
 return tokenPromise;
}
async function request(url){
 const res=await fetch(url,{headers:{Authorization:'Bearer '+await token()},signal:AbortSignal.timeout(60000)});
 if(!res.ok)throw Error('Google Drive request failed: HTTP '+res.status);
 return res;
}
const listings=new Map();
async function children(id){
 if(!listings.has(id))listings.set(id,(async()=>{
  const files=[];let pageToken;
  do{
   const q=new URLSearchParams({q:"'"+esc(id)+"' in parents and trashed = false",fields:'nextPageToken,files(id,name,mimeType,size,md5Checksum)',pageSize:'1000',supportsAllDrives:'true',includeItemsFromAllDrives:'true'});
   if(pageToken)q.set('pageToken',pageToken);
   const page=await (await request(api+'/files?'+q)).json();
   files.push(...page.files);pageToken=page.nextPageToken;
  }while(pageToken);
  return files;
 })());
 return listings.get(id);
}
export async function resolveDrivePhotos(entry,isImage){
 // The local sibling folder maps to one explicitly shared Drive root.
 const prefix='../jilp-old-pics';
 let normalized=entry.replaceAll('\\','/');
 const raw=normalized.match(/^\.\.\/crawler\/output\/raw\/([a-f0-9]{64}\.jpg)$/);
 if(raw)normalized=prefix+'/AI-Selected/'+raw[1];
 if(normalized!==prefix&&!normalized.startsWith(prefix+'/'))throw Error('No Drive mapping for photo path: '+entry);
 const root=process.env.GDRIVE_PHOTO_FOLDER_ID;
 if(!root)throw Error('Missing GDRIVE_PHOTO_FOLDER_ID');
 const parts=normalized.slice(prefix.length).split('/').filter(Boolean);
 if(parts.some(p=>p==='..'||p==='.'))throw Error('Invalid Drive photo path');
 let item={id:root,mimeType:FOLDER,name:prefix};
 for(const name of parts){
  if(item.mimeType!==FOLDER)throw Error('Not a Drive directory: '+name);
  const matches=(await children(item.id)).filter(f=>f.name===name);
  if(matches.length!==1)throw Error('Drive path resolution failed at '+name+' (matches='+matches.length+', visible children='+(await children(item.id)).length+'): '+entry);
  item=matches[0];
 }
 const files=item.mimeType===FOLDER?(await children(item.id)).sort((a,b)=>a.name.localeCompare(b.name,'en',{numeric:true})||a.id.localeCompare(b.id)):[item];
 const result=[];
 for(const f of files){
  if(!f.mimeType.startsWith('image/')||!isImage(f.name))continue;
  if(Number(f.size)>30*1024*1024)throw Error('Drive image exceeds 30 MiB: '+f.name);
  const dir=resolve('.photo-drive-cache');await mkdir(dir,{recursive:true});
  const path=resolve(dir,createHash('sha256').update(f.id).digest('hex')+extname(f.name).toLowerCase());
  const bytes=Buffer.from(await (await request(api+'/files/'+encodeURIComponent(f.id)+'?alt=media&supportsAllDrives=true')).arrayBuffer());
  if(!bytes.length||bytes.length>30*1024*1024)throw Error('Invalid Drive image size');
  if(f.md5Checksum&&createHash('md5').update(bytes).digest('hex')!==f.md5Checksum)throw Error('Drive image checksum mismatch');
  const tmp=path+'.'+process.pid+'.'+crypto.randomUUID()+'.tmp';
  await writeFile(tmp,bytes);await rename(tmp,path);result.push(path);
 }
 return result;
}
