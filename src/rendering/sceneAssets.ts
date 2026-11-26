/** Explicit asset boundary shared by preview and offline scene construction.
 * The interface uses DOM-compatible types for current CanvasTexture consumers.
 * A native runtime must provide compatible image and 2D canvas implementations.
 */
export interface SceneAssets {
 canvas(width?:number,height?:number):HTMLCanvasElement;
 image(url:string,timeoutMs?:number):Promise<HTMLImageElement>;
 json<T=unknown>(url:string):Promise<T>;
 resolve(path:string,base?:string):string;
 png(canvas:HTMLCanvasElement):string;
 isCanvas(value:unknown):value is HTMLCanvasElement;
 imageData(bytes:Uint8ClampedArray<ArrayBuffer>,width:number,height:number):ImageData;
}
export const browserAssets:SceneAssets={
 canvas(width,height){const c=document.createElement("canvas");if(width!==undefined)c.width=width;if(height!==undefined)c.height=height;return c;},
 image(url,timeoutMs=20000){return new Promise((resolve,reject)=>{
  const img=new Image();let timer:ReturnType<typeof setTimeout>;
  const finish=(error?:Error)=>{clearTimeout(timer);img.onload=null;img.onerror=null;if(error)reject(error);else resolve(img);};
  timer=setTimeout(()=>finish(Error("Image load timed out: "+url)),timeoutMs);
  img.onload=()=>finish();img.onerror=()=>finish(Error("Image unavailable: "+url));img.src=url;
 });},
 async json<T>(url:string):Promise<T>{const res=await fetch(url,{signal:AbortSignal.timeout(20000)});if(!res.ok)throw Error("Asset unavailable: "+url);return res.json();},
 resolve(path,base){return new URL(path,base??location.href).href;},
 png(canvas){return canvas.toDataURL("image/png").split(",")[1];},
 isCanvas(value):value is HTMLCanvasElement{return typeof HTMLCanvasElement!=="undefined"&&value instanceof HTMLCanvasElement;},
 imageData(bytes,width,height){return new ImageData(bytes,width,height);}
};
