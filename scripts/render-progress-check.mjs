import assert from "node:assert/strict";
import { renderFrame } from "./lib/render-progress.mjs";
let captures=0, polls=0;
globalThis.window={__demo:{
  exportFrame(){},
  renderStatus(){polls++;return {mode:"cinematic",samples:polls===1?0:2,target:2,complete:polls!==1&&polls!==3,error:""};},
  captureFrame(){captures++;return "data:image/png;base64,test";}
}};
const page={evaluate:async(fn,arg)=>fn(arg)};
const result=await renderFrame(page,{time:0,samples:2,bounces:2,statusInterval:0.1});
assert.equal(result,"data:image/png;base64,test");
assert.equal(captures,1);
assert.ok(polls>=5,"must retry after invalidation");
console.log("PASS: stale completion cannot capture an invalidated frame");
