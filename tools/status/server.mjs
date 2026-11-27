import {readFile} from 'node:fs/promises';
import {snapshot} from './collector.mjs';
export async function handleStatus(req,res){
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET'){res.writeHead(405);res.end();return}
 const path=new URL(req.url,'http://localhost').pathname;
 if(path==='/status'||path==='/status/'){
  res.setHeader('Content-Type','text/html; charset=utf-8');res.end(await readFile(new URL('./index.html',import.meta.url)));return;
 }
 if(path==='/status/data.json'){
  res.setHeader('Content-Type','application/json');
  try{res.end(JSON.stringify(await snapshot()))}catch{res.writeHead(503);res.end(JSON.stringify({error:'Status collector unavailable. Check workspace and rclone.'}))}return;
 }
 res.writeHead(404);res.end();
}
