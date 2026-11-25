export function fitVerticalFov(fov:number,aspect:number,reference=16/9){
 return 2*Math.atan(Math.tan(fov*Math.PI/360)*Math.max(1,reference/Math.max(.05,aspect)))*180/Math.PI;
}
export function previewPixelRatio(exportMode=false){
 return exportMode?1:Math.min(window.devicePixelRatio||1,window.matchMedia("(pointer: coarse)").matches?1.5:2);
}
export function bindPreviewViewport(canvas:HTMLCanvasElement,controls:HTMLElement,resize:(width:number,height:number)=>void,exportMode=false){
 if(exportMode)return ()=>{};
 const mobile=window.matchMedia("(max-width: 720px), (pointer: coarse)");
 let lastWidth=0,lastHeight=0;
 const layout=()=>{
   const width=Math.max(1,Math.floor(window.visualViewport?.width??window.innerWidth));
   const height=Math.max(1,Math.floor(window.visualViewport?.height??window.innerHeight));
   const reserved=mobile.matches&&!controls.hidden?controls.offsetHeight+28:0;
   const sceneHeight=Math.max(1,height-reserved);
   if(width===lastWidth&&sceneHeight===lastHeight)return;
   lastWidth=width;lastHeight=sceneHeight;
   canvas.style.position="fixed";canvas.style.left="0";canvas.style.top="0";
   canvas.style.width=width+"px";canvas.style.height=sceneHeight+"px";
   resize(width,sceneHeight);
 };
 const observer=new ResizeObserver(layout);observer.observe(controls);
 window.addEventListener("resize",layout);window.visualViewport?.addEventListener("resize",layout);
 mobile.addEventListener("change",layout);layout();
 return ()=>{observer.disconnect();window.removeEventListener("resize",layout);window.visualViewport?.removeEventListener("resize",layout);mobile.removeEventListener("change",layout);};
}
