import {createServer} from 'node:http';
import {handleStatus} from '../tools/status/server.mjs';
const port=Number(process.env.STATUS_PORT||5180);
createServer((req,res)=>{void handleStatus(req,res).catch(()=>{if(!res.headersSent)res.writeHead(500);res.end()})}).listen(port,'127.0.0.1',()=>console.log('Milestone2 status: http://localhost:'+port+'/status/'));
