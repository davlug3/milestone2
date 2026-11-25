export function fitVerticalFov(fov:number,aspect:number,reference=16/9){
 return 2*Math.atan(Math.tan(fov*Math.PI/360)*Math.max(1,reference/Math.max(.05,aspect)))*180/Math.PI;
}
export function previewPixelRatio(exportMode=false){
 return exportMode?1:Math.min(window.devicePixelRatio||1,window.matchMedia("(pointer: coarse)").matches?1.5:2);
}
export function bindPreviewViewport(canvas:HTMLCanvasElement,controls:HTMLElement,resize:(width:number,height:number)=>void,exportMode=false,lockedAspect?:number){
 if(exportMode)return ()=>{};
 const mobile=window.matchMedia("(max-width: 720px), (pointer: coarse)");
 let lastWidth=0,lastHeight=0;
 const layout=()=>{
   const width=Math.max(1,Math.floor(window.visualViewport?.width??window.innerWidth));
   const height=Math.max(1,Math.floor(window.visualViewport?.height??window.innerHeight));
   const reserved=(mobile.matches||lockedAspect!==undefined)&&!controls.hidden?controls.offsetHeight+28:0;
   const availableHeight=Math.max(1,height-reserved);
   const sceneWidth=lockedAspect?Math.max(1,Math.floor(Math.min(width,availableHeight*lockedAspect))):width;
   const sceneHeight=lockedAspect?Math.max(1,Math.floor(sceneWidth/lockedAspect)):availableHeight;
   const changed=sceneWidth!==lastWidth||sceneHeight!==lastHeight;
   lastWidth=sceneWidth;lastHeight=sceneHeight;
   canvas.style.position="fixed";canvas.style.left=Math.floor((width-sceneWidth)/2)+"px";canvas.style.top=Math.floor((availableHeight-sceneHeight)/2)+"px";
   canvas.style.width=sceneWidth+"px";canvas.style.height=sceneHeight+"px";
   if(changed)resize(sceneWidth,sceneHeight);
 };
 const observer=new ResizeObserver(layout);observer.observe(controls);
 window.addEventListener("resize",layout);window.visualViewport?.addEventListener("resize",layout);
 mobile.addEventListener("change",layout);layout();
 return ()=>{observer.disconnect();window.removeEventListener("resize",layout);window.visualViewport?.removeEventListener("resize",layout);mobile.removeEventListener("change",layout);};
}
