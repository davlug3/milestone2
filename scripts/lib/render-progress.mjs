import { setTimeout as sleep } from "node:timers/promises";

// Keep heartbeats independent of browser/CDP round trips. A slow shader or
// blocked GPU readback must not make the terminal appear dead.
export async function renderFrame(page,{time,samples,bounces,statusInterval=5},report=()=>{}){
  let phase="updating pose / preparing acceleration structure";
  let status=null;
  const start=Date.now();
  const publish=()=>report({phase,status,elapsed:(Date.now()-start)/1000});
  publish();
  const heartbeat=setInterval(publish,statusInterval*1000);
  try{
    await page.evaluate(({time,samples,bounces})=>window.__demo.exportFrame(time,samples,bounces),{time,samples,bounces});
    phase="waiting for shader / first sample";
    for(;;){
      status=await page.evaluate(()=>window.__demo.renderStatus());
      if(status.error||status.mode!=="cinematic")throw Error("Ray tracing failed: "+status.error);
      phase=status.complete?"capturing PNG":status.phase??(status.samples>0?"accumulating samples":"waiting for first sample");
      if(status.complete){
        publish();
        // Readiness and capture must share one browser task. A resize or
        // invalidation between separate CDP requests can reset accumulation.
        const png=await page.evaluate(()=>{
          const current=window.__demo.renderStatus();
          return current.complete && current.mode==="cinematic" && !current.error ? window.__demo.captureFrame() : null;
        });
        if(png)return png;
        phase="frame invalidated; waiting for fresh samples";
      }
      await sleep(500);
    }
  }finally{clearInterval(heartbeat);}
}
