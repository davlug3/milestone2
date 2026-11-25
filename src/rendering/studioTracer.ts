import * as THREE from "three";
import { WebGLPathTracer, GradientEquirectTexture, PhysicalCamera, PhysicalSpotLight } from "three-gpu-pathtracer";
import { TraceScene } from "./traceScene";
export type RenderMode = "real-time" | "ray-traced" | "cinematic";
export const TRACE_SETTINGS = { "ray-traced": {samples:96,bounces:5,scale:0.85}, cinematic:{samples:384,bounces:10,scale:1} } as const;
export { PhysicalCamera, PhysicalSpotLight };
export class StudioTracer {
  private tracer: WebGLPathTracer | null = null;
  private environment: GradientEquirectTexture | null = null;
  private dirty = true;
  private proxy = new TraceScene();
  mode: RenderMode = "real-time";
  error = "";
  constructor(private renderer:THREE.WebGLRenderer,private scene:THREE.Scene,private camera:PhysicalCamera){}
  invalidate(){this.dirty=true;}
  setMode(mode:RenderMode){
    this.error="";
    this.mode=mode;
    this.invalidate();
  }
  get samples(){return this.tracer?.samples ?? 0;}
  get goal(){return this.mode==="real-time"?0:TRACE_SETTINGS[this.mode].samples;}
  get complete(){return !this.dirty && this.samples>=this.goal;}
  draw(rasterOnly=false){
    if(this.mode==="real-time"||rasterOnly){this.renderer.render(this.scene,this.camera);return;}
    const original=this.scene.environment;
    try {
      if(!this.tracer){
        if(!this.renderer.extensions.has("EXT_color_buffer_float"))throw Error("GPU lacks floating-point render targets");
        this.environment=new GradientEquirectTexture(256);
        this.environment.topColor.set(0xa9b6cc);
        this.environment.bottomColor.set(0x241a13);
        this.environment.update();
        this.tracer=new WebGLPathTracer(this.renderer);
        this.tracer.textureSize.set(512, 660);
        this.tracer.renderDelay=0;
        this.tracer.minSamples=1;
        this.tracer.rasterizeSceneCallback=()=>this.renderer.render(this.scene,this.camera);
        this.tracer.fadeDuration=0;
        this.tracer.tiles.set(1,1);
      }
      const tracer=this.tracer, settings=TRACE_SETTINGS[this.mode];
      if(this.dirty){
        this.scene.environment=this.environment;
        tracer.bounces=settings.bounces;
        tracer.renderScale=settings.scale;
        tracer.setScene(this.proxy.update(this.scene),this.camera);
        this.dirty=false;
      }
      tracer.pausePathTracing=this.samples>=settings.samples;
      tracer.renderSample();
    }catch(e){
      this.error=e instanceof Error?e.message:String(e);
      this.mode="real-time";
      this.renderer.render(this.scene,this.camera);
    }finally{this.scene.environment=original;}
  }
  dispose(){this.tracer?.dispose();this.environment?.dispose();this.proxy.dispose();}
}
