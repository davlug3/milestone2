import { bindingLoad, bindingLift } from "../src/book/bindingFlex";
import { BOOK_DIMENSIONS as d } from "../src/config/bookConfig";
import { textRoot, TEXT_BLOCK_THICKNESS } from "../src/book/textBlockBinding";
const span=TEXT_BLOCK_THICKNESS+2*d.coverThickness;
const turns=Array.from({length:8},(_,i)=>({start:3.7+i*3.3,dur:2.5,settle:0.5}));
let peak=0, prev=0;
for(let i=0;i<=3200;i++){
  const t=i/100, load=bindingLoad(t,1,turns);
  if(i && Math.abs(load-prev)>0.02) throw Error("Load discontinuity");
  prev=load;
  if(bindingLift(0,span,load)!==0 || bindingLift(-span,span,load)!==0 || bindingLift(0.001,span,load)!==0 || bindingLift(-span-0.001,span,load)!==0) throw Error("Board region moved");
  for(let k=0;k<d.sheetCount;k++){
    const root=textRoot(d,k);
    const dy=bindingLift(root.x,span,load);
    if(dy<0 || dy>0.0045)throw Error("Invalid displacement");
    peak=Math.max(peak,dy);
  }
}
if(peak<0.003)throw Error("Insufficient visible flex");
console.log("PASS: continuous elastic load, fixed hinge boundaries, peak lift="+(peak*1000).toFixed(2)+"mm");
