import { TRACE_QUALITY } from "./quality";
import * as THREE from "three";
import { WebGLPathTracer, GradientEquirectTexture, PhysicalCamera, PhysicalSpotLight } from "three-gpu-pathtracer";
import { TraceScene } from "./traceScene";
export type RenderMode = "real-time" | "ray-traced" | "cinematic";
export const TRACE_SETTINGS = { "ray-traced": TRACE_QUALITY.preview, cinematic: TRACE_QUALITY.cinematic } as const;
export { PhysicalCamera, PhysicalSpotLight };
export class StudioTracer {
  private tracer: WebGLPathTracer | null = null;
  private environment: GradientEquirectTexture | null = null;
  private dirty = true;
  private exportQuality: {samples:number;bounces:number;scale:number} | null = null;
  setExportQuality(samples:number,bounces:number){
    if(!Number.isInteger(samples)||samples<1||!Number.isInteger(bounces)||bounces<1)throw Error('Invalid export quality');
    this.exportQuality={samples,bounces,scale:1};this.invalidate();
  }
  private proxy = new TraceScene();
  mode: RenderMode = "real-time";
  error = "";
  constructor(private renderer:THREE.WebGLRenderer,private scene:THREE.Scene,private camera:PhysicalCamera,private compact=false){}
  invalidate(){this.dirty=true;}
  setMode(mode:RenderMode){
    this.error="";
    this.mode=mode;
    this.invalidate();
  }
  get samples(){return this.dirty ? 0 : (this.tracer?.samples ?? 0);}
  get phase(){return this.dirty?'preparing scene / BVH':this.complete?'complete':this.samples>0?'accumulating samples':'waiting for shader / first sample';}
  get goal(){return this.mode==="real-time"?0:(this.mode==='cinematic' && this.exportQuality ? this.exportQuality : TRACE_SETTINGS[this.mode]).samples;}
  get contextLost(){return this.renderer.getContext().isContextLost();}
  get complete(){return !this.contextLost && !this.dirty && this.samples>=this.goal;}
  recover(){this.mode="real-time";this.error="GPU context lost. Recovered in real-time mode.";this.tracer=null;this.environment?.dispose();this.environment=null;this.proxy.dispose();this.proxy=new TraceScene();this.dirty=true;}
  private checkGPU(){const gl=this.renderer.getContext();if(gl.isContextLost())throw Error("GPU context lost");const error=gl.getError();if(error===gl.OUT_OF_MEMORY)throw Error("GPU memory exhausted");if(error===gl.INVALID_FRAMEBUFFER_OPERATION)throw Error("GPU framebuffer unavailable");}
  draw(rasterOnly=false){
    if(this.contextLost)return;
    if(this.mode==="real-time"||rasterOnly){this.renderer.render(this.scene,this.camera);return;}
    const original=this.scene.environment;
    try {
      if(!this.tracer){
        if(!this.renderer.extensions.has("EXT_color_buffer_float"))throw Error("GPU lacks floating-point render targets");
        this.environment=new GradientEquirectTexture(256);
        this.environment.topColor.set(0x929eaf);
        this.environment.bottomColor.set(0x201b17);
        this.environment.update();
        this.tracer=new WebGLPathTracer(this.renderer);
        this.tracer.textureSize.set(this.compact?256:512,this.compact?330:660);
        this.tracer.renderDelay=0;
        this.tracer.minSamples=1;
        this.tracer.rasterizeSceneCallback=()=>this.renderer.render(this.scene,this.camera);
        this.tracer.fadeDuration=0;
        this.tracer.tiles.set(this.compact?2:1,this.compact?2:1);
      }
      const tracer=this.tracer, settings=this.mode==='cinematic' && this.exportQuality ? this.exportQuality : TRACE_SETTINGS[this.mode];
      if(this.dirty){
        this.scene.environment=this.environment;
        tracer.bounces=this.compact?Math.min(5,settings.bounces):settings.bounces;
        tracer.renderScale=this.compact?Math.min(.65,settings.scale):settings.scale;
        tracer.pausePathTracing=false;
        tracer.setScene(this.proxy.update(this.scene),this.camera);
        tracer.reset();
        this.dirty=false;
        tracer.renderSample();this.checkGPU();
        return;
      }
      tracer.pausePathTracing=this.samples>=settings.samples;
      tracer.renderSample();this.checkGPU();
    }catch(e){
      this.error=e instanceof Error?e.message:String(e);
      this.mode="real-time";
      if(!this.contextLost){this.tracer?.dispose();this.tracer=null;this.proxy.dispose();this.proxy=new TraceScene();this.environment?.dispose();this.environment=null;this.renderer.render(this.scene,this.camera);}
    }finally{this.scene.environment=original;}
  }
  dispose(){this.tracer?.dispose();this.environment?.dispose();this.proxy.dispose();}
}
