import {deflateSync,inflateSync} from 'node:zlib';
export function floatTiff(raw,w,h,channels=1){
 if(![1,3].includes(channels)||raw.length!==w*h*4*channels)throw Error('Invalid float32 raster');
 const rows=32,strips=[];
 for(let y=0;y<h;y+=rows)strips.push(deflateSync(raw.subarray(y*w*4*channels,Math.min(y+rows,h)*w*4*channels),{level:1}));
 const n=strips.length,tags=[[256,4,1,w],[257,4,1,h],[258,3,channels,32],[259,3,1,8],[262,3,1,channels===3?2:1],[273,4,n,0],[274,3,1,1],[277,3,1,channels],[278,4,1,rows],[279,4,n,0],[284,3,1,1],[339,3,channels,3]];
 let cursor=8+2+tags.length*12+4;
 const bits=cursor;cursor+=channels===3?6:0;const formats=cursor;cursor+=channels===3?6:0;
 const offsets=cursor;cursor+=n>1?n*4:0;
 const counts=cursor;cursor+=n>1?n*4:0;
 const head=Buffer.alloc(cursor);head.write('II');head.writeUInt16LE(42,2);head.writeUInt32LE(8,4);head.writeUInt16LE(tags.length,8);
 if(channels===3)for(let i=0;i<3;i++){head.writeUInt16LE(32,bits+i*2);head.writeUInt16LE(3,formats+i*2);}
 let pos=cursor;
 for(let i=0;i<n;i++){if(n>1){head.writeUInt32LE(pos,offsets+i*4);head.writeUInt32LE(strips[i].length,counts+i*4);}pos+=strips[i].length;}
 for(let i=0;i<tags.length;i++){let [tag,type,count,value]=tags[i];const o=10+i*12;if(channels===3&&tag===258)value=bits;if(channels===3&&tag===339)value=formats;if(tag===273)value=n===1?cursor:offsets;if(tag===279)value=n===1?strips[0].length:counts;head.writeUInt16LE(tag,o);head.writeUInt16LE(type,o+2);head.writeUInt32LE(count,o+4);head.writeUInt32LE(value,o+8);}
 return Buffer.concat([head,...strips]);
}
export function readFloatTiff(file){
 if(file.toString('ascii',0,2)!=='II'||file.readUInt16LE(2)!==42)throw Error('Invalid TIFF');
 const ifd=file.readUInt32LE(4),n=file.readUInt16LE(ifd),tags=new Map();
 for(let i=0;i<n;i++){const o=ifd+2+i*12,t=file.readUInt16LE(o),c=file.readUInt32LE(o+4),v=file.readUInt32LE(o+8);const type=file.readUInt16LE(o+2);tags.set(t,c===1?[v]:Array.from({length:c},(_,i)=>type===3?file.readUInt16LE(v+i*2):file.readUInt32LE(v+i*4)));}
 const channels=tags.get(277)?.[0];if(![1,3].includes(channels)||tags.get(258)?.length!==channels||!tags.get(258).every(v=>v===32)||tags.get(339)?.length!==channels||!tags.get(339).every(v=>v===3)||tags.get(259)?.[0]!==8)throw Error('Not IEEE float32 TIFF');
 const w=tags.get(256)[0],h=tags.get(257)[0],raw=Buffer.concat(tags.get(273).map((o,i)=>inflateSync(file.subarray(o,o+tags.get(279)[i]))));
 if(![1,3].includes(channels)||raw.length!==w*h*4*channels)throw Error('Incorrect TIFF payload');return {w,h,raw,channels};
}
