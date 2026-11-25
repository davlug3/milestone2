import * as THREE from "three";
function rng(seed:number){let s=seed>>>0;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
/** Shared fine paper relief; tiny seeded variation on each printed face. */
export function createPaperGrain(){
 const canvas=document.createElement("canvas");canvas.width=canvas.height=256;
 const ctx=canvas.getContext("2d")!,im=ctx.createImageData(256,256),r=rng(1907);
 for(let y=0;y<256;y++)for(let x=0;x<256;x++){
  const v=128+13*(r()-.5)+5*Math.sin(x*.57+y*.23)+4*Math.sin(x*.19-y*.71);
  const i=(y*256+x)*4;im.data[i]=im.data[i+1]=im.data[i+2]=v;im.data[i+3]=255;
 }
 ctx.putImageData(im,0,0);
 const bump=new THREE.CanvasTexture(canvas);bump.colorSpace=THREE.NoColorSpace;
 const rough=canvas.cloneNode() as HTMLCanvasElement;const rc=rough.getContext("2d")!;
 rc.fillStyle="#ffffff";rc.fillRect(0,0,256,256);rc.globalAlpha=.14;rc.drawImage(canvas,0,0);
 const roughness=new THREE.CanvasTexture(rough);roughness.colorSpace=THREE.NoColorSpace;
 return {bump,roughness};
}
/** UV-stable warm wear, restricted mostly to the margins; photos remain clear. */
export function paintPaperWear(ctx:CanvasRenderingContext2D,w:number,h:number,page:number){
 const r=rng(92371+page*7919);
 ctx.save();
 const edge=22+r()*10;
 for(const [x0,y0,x1,y1,ww,hh,x,y] of [[0,0,edge,0,edge,h,0,0],[w,0,w-edge,0,edge,h,w-edge,0],[0,0,0,edge,w,edge,0,0],[0,h,0,h-edge,w,edge,0,h-edge]]){
  const g=ctx.createLinearGradient(x0,y0,x1,y1);g.addColorStop(0,"rgba(126,91,50,.085)");g.addColorStop(1,"rgba(126,91,50,0)");ctx.fillStyle=g;ctx.fillRect(x,y,ww,hh);
 }
 for(let i=0;i<7;i++){
  const x=r()<.5?r()*29:w-r()*29,y=r()*h,rad=8+r()*19;
  const g=ctx.createRadialGradient(x,y,0,x,y,rad);g.addColorStop(0,"rgba(115,83,48,.027)");g.addColorStop(1,"rgba(115,83,48,0)");ctx.fillStyle=g;ctx.fillRect(x-rad,y-rad,rad*2,rad*2);
 }
 for(let i=0;i<900;i++){
  const x=r()*w,y=r()*h;if(x>31&&x<w-31&&y>31&&y<h-31)continue;
  ctx.strokeStyle=r()<.5?"rgba(99,77,49,.045)":"rgba(255,255,255,.16)";
  ctx.lineWidth=.35+r()*.45;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+1+r()*3,y+(r()-.5)*1.4);ctx.stroke();
 }
 ctx.restore();
}
