import * as THREE from "three";

/** Scoped PCSS for the preview's perspective spot shadow maps.
 * Eight blocker taps + twelve filter taps, stable disk pattern. The original
 * shadow shader remains available for every non-preview rendering mode.
 */
const original=THREE.ShaderChunk.shadowmap_pars_fragment;
const anchor="#if defined( SHADOWMAP_TYPE_PCF )";
const pcss=`#if defined( SHADOWMAP_TYPE_PCF ) && defined( BOOK_PREVIEW_PCSS )
   // Both preview shadow cameras use near=.12, far=4 metres.
   vec2 texel=1.0/shadowMapSize;
   float receiver=-perspectiveDepthToViewZ(shadowCoord.z,0.12,4.0);
   float search=clamp(shadowRadius*2.0,2.0,12.0);
   float blockers=0.0, depthSum=0.0;
   for(int j=0;j<8;j++){
     float a=float(j)*2.39996323;
     vec2 disk=vec2(cos(a),sin(a))*sqrt((float(j)+0.5)/8.0);
     float d=unpackRGBAToDepth(texture2D(shadowMap,clamp(shadowCoord.xy+disk*texel*search,vec2(0.0),vec2(1.0))));
     if(d<shadowCoord.z){depthSum+=-perspectiveDepthToViewZ(d,0.12,4.0);blockers+=1.0;}
   }
   if(blockers>0.0){
     float avg=depthSum/blockers;
     float penumbra=clamp((receiver-avg)/max(avg,0.001)*shadowRadius*45.0,0.8,14.0);
     shadow=0.0;
     for(int j=0;j<12;j++){
       float a=float(j)*2.39996323;
       vec2 disk=vec2(cos(a),sin(a))*sqrt((float(j)+0.5)/12.0);
       shadow+=texture2DCompare(shadowMap,clamp(shadowCoord.xy+disk*texel*penumbra,vec2(0.0),vec2(1.0)),shadowCoord.z);
     }
     shadow/=12.0;
   }else{shadow=texture2DCompare(shadowMap,shadowCoord.xy,shadowCoord.z);}
 #elif defined( SHADOWMAP_TYPE_PCF )`;
const modified=original.replace(anchor,pcss);
export function withPreviewPCSS<T>(scene:THREE.Scene,enabled:boolean,draw:()=>T):T{
 if(!enabled||modified===original)return draw();
 // Scope to the preview's materials; preserve existing shader callbacks and cache keys.
 const swaps:Array<[THREE.Mesh,THREE.Material|THREE.Material[]]>=[];
 scene.traverse(o=>{
  if(!(o instanceof THREE.Mesh))return;
  const m=o.material;
  swaps.push([o,m]);o.material=Array.isArray(m)?m.map(variant):variant(m);
 });
 try{return draw();}finally{for(const [mesh,mat] of swaps)mesh.material=mat;}
}
const variants=new Map<THREE.Material,THREE.Material>();
function variant(m:THREE.Material){
 if(!(m instanceof THREE.MeshStandardMaterial))return m;
 let v=variants.get(m);
 if(!v){
  v=m.clone();const prior=m.onBeforeCompile,cache=m.customProgramCacheKey.call(m);
  v.onBeforeCompile=function(shader,renderer){
   prior.call(this,shader,renderer);
   shader.fragmentShader="#define BOOK_PREVIEW_PCSS\n"+shader.fragmentShader.replace("#include <shadowmap_pars_fragment>",modified);
  };
  v.customProgramCacheKey=()=>cache+"|book-pcss-v1";variants.set(m,v);
 }
 const target=v as THREE.MeshStandardMaterial;
 if(target.map!==m.map){target.map=m.map;target.needsUpdate=true;}
 return v;
}
export function disposePreviewPCSS(){for(const m of variants.values())m.dispose();variants.clear();}
