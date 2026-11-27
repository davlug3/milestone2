import * as THREE from "three";
import {withPreviewPCSS,disposePreviewPCSS} from "./previewPCSS";
import {PreviewAO} from "./previewAO";

/** Preview-only low-key photographic rig. Same lighting during play and pause.
 * The broad dome is a faint diffuse fill, not the principal shadow source.
 * Only key and rim cast shadow maps, avoiding expensive dome shadow passes.
 */
export class DomeShadows {
 readonly total:number;
 private group=new THREE.Group();
 private lights:THREE.SpotLight[]=[];
 private saved:THREE.Light[]=[];
 private key="";
 private error="";
 private ao:PreviewAO|null=null;
 private pcssEnabled=true;
 private aoEnabled=true;
 constructor(private renderer:THREE.WebGLRenderer,private scene:THREE.Scene,private camera:THREE.PerspectiveCamera,requested=4){
  this.total=requested>=4?4:2;
  this.group.name="preview-only-cinematic-lighting";
  scene.traverse(o=>{if(o instanceof THREE.SpotLight||o instanceof THREE.HemisphereLight)this.saved.push(o);});
  const spot=(name:string,color:number,power:number,p:number[],target:number[],angle:number,shadow:boolean,radius:number)=>{
   const l=new THREE.SpotLight(color,power,4,angle,.85,2);
   l.name=name;l.position.fromArray(p);l.target.position.fromArray(target);
   l.castShadow=shadow;
   if(shadow){l.shadow.mapSize.set(1024,1024);l.shadow.camera.near=.12;l.shadow.camera.far=4;
    l.shadow.bias=-.00006;l.shadow.normalBias=.00035;l.shadow.radius=radius;
    l.shadow.autoUpdate=false;l.shadow.needsUpdate=true;}
   this.group.add(l,l.target);this.lights.push(l);
  };
  spot("Amber key",0xffbf80,6.2,[-.65,.82,.36],[0,.045,0],Math.PI/7,true,3.2);
  spot("Teal fill",0x65c9de,.38,[.72,.43,.48],[0,.035,0],Math.PI/5,false,0);
  spot("Champagne rim",0xffe7c2,1.8,[.40,.61,-.57],[0,.055,-.045],Math.PI/7,true,2.5);
  // Low-energy, non-shadow-casting samples on a broad hemisphere.
  // Directional units differ from spot candela; keep aggregate irradiance tiny.
  for(let i=0;i<this.total;i++){
   const az=(i+.5)*2*Math.PI/this.total;
   const l=new THREE.DirectionalLight(i%2===0?0x99b6e2:0xc5a7df,.022/this.total);
   l.name="Ambient dome "+(i+1);l.position.set(Math.cos(az)*.75,.85,Math.sin(az)*.75);
   l.target.position.set(0,.035,0);this.group.add(l,l.target);
  }
 }
 configure(pcss:boolean,ao:boolean){this.pcssEnabled=pcss;this.aoEnabled=ao;this.invalidate();}
 invalidate(){this.key="";}
 draw(_playing:boolean,key:string){
  const type=this.renderer.shadowMap.type,env=this.scene.environmentIntensity;
  const visibility=this.saved.map(l=>l.visible);
  try{
   this.renderer.shadowMap.type=THREE.PCFShadowMap;
   this.scene.environmentIntensity=.025;
   this.saved.forEach(l=>l.visible=false);this.scene.add(this.group);
   if(key!==this.key){this.lights.filter(l=>l.castShadow).forEach(l=>l.shadow.needsUpdate=true);this.key=key;}
   const beauty=()=>withPreviewPCSS(this.scene,this.pcssEnabled,()=>this.renderer.render(this.scene,this.camera));
   if(this.aoEnabled&&this.renderer.extensions.has("EXT_color_buffer_float")){
    this.ao??=new PreviewAO(this.renderer,this.scene,this.camera);
    this.ao.draw(beauty);
   }else beauty();
  }catch(e){this.error=e instanceof Error?e.message:String(e);}
  finally{this.scene.remove(this.group);this.saved.forEach((l,i)=>l.visible=visibility[i]);this.scene.environmentIntensity=env;this.renderer.shadowMap.type=type;}
 }
 status(){return {total:this.total,live:3+this.total,samples:this.total,playing:false,error:this.error,pcss:this.pcssEnabled,gtao:this.aoEnabled&&!!this.ao};}
 dispose(){this.ao?.dispose();disposePreviewPCSS();this.scene.remove(this.group);for(const l of this.lights)l.shadow.dispose();}
}
