import {timingSafeEqual,createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {validateSlides} from '../stats/src/model.js';
const scenes=['book','slideshow','clothesline','floating'];
const hash=s=>createHash('sha256').update(s).digest('hex');
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 const secret=process.env.EDITOR_TOKEN;
 if(!secret)return res.status(503).json({error:'Cloud editor is not configured'});
 const a=Buffer.from(String(req.headers['x-editor-token']||'')),b=Buffer.from(secret);
 if(a.length!==b.length||!timingSafeEqual(a,b))return res.status(401).json({error:'Invalid editor token'});
 try{
  const raw=await readFile(new URL('../photos.config.jsonc',import.meta.url),'utf8');
  const parsed=ts.parseConfigFileTextToJson('photos.config.jsonc',raw);if(parsed.error)throw Error('Invalid deployed configuration');
  const config=parsed.config,revision=hash(raw);
  const photos=JSON.parse(await readFile(new URL('../site-dist/editor/catalog.json',import.meta.url),'utf8'));
  if(req.method==='GET')return res.status(200).json({config,revision,photos,mode:'cloud'});
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  if(req.headers['x-editor-request']!=='1'||req.headers.origin!=='https://'+req.headers.host)return res.status(403).json({error:'Invalid origin'});
  const data=typeof req.body==='string'?JSON.parse(req.body):req.body;
  if(data?.revision!==revision)return res.status(409).json({error:'Deployment changed. Reload before editing.'});
  const allowed=new Set(photos.map(p=>p.path));
  for(const s of scenes){const a=data.scenes?.[s];if(!Array.isArray(a)||a.length>2000||new Set(a).size!==a.length||a.some(p=>!allowed.has(p)))return res.status(400).json({error:'Invalid photo selection: '+s});config[s].photos=a}
  config.stats.slides=validateSlides(data.stats);
  return res.status(200).json({draft:JSON.stringify(config,null,2)+'\n',message:'Configuration draft ready'});
 }catch(e){return res.status(500).json({error:'Unable to prepare editor configuration'})}
}
