export const TRACE_QUALITY = { preview: { samples: 96, bounces: 5, scale: .85 }, cinematic: { samples: 384, bounces: 10, scale: 1 } } as const;
export const QUALITY_PROFILES = {
 mobile:{label:"Mobile",dpr:1,pageScale:.5,allPrints:false,woodSize:512,photoWidth:800,atlas:256,tiles:2,preview:{samples:48,bounces:4,scale:.65},cinematic:{samples:96,bounces:5,scale:.65}},
 desktop:{label:"Desktop",dpr:2,pageScale:1,allPrints:true,woodSize:1024,photoWidth:1600,atlas:512,tiles:1,preview:TRACE_QUALITY.preview,cinematic:TRACE_QUALITY.cinematic},
 ultra:{label:"Ultra",dpr:2,pageScale:2,allPrints:true,woodSize:2048,photoWidth:2400,atlas:1024,tiles:2,preview:{samples:256,bounces:8,scale:1},cinematic:{samples:1024,bounces:16,scale:1}},
 offline:{label:"Offline Cinema",dpr:1,pageScale:2,allPrints:true,woodSize:2048,photoWidth:3200,atlas:1024,tiles:2,preview:{samples:384,bounces:10,scale:1},cinematic:{samples:1536,bounces:20,scale:1}}
} as const;
export type QualityName=keyof typeof QUALITY_PROFILES;
export type QualityProfile=typeof QUALITY_PROFILES[QualityName];
export const DEFAULT_OUTPUT={width:1920,height:1080,fps:60,aspect:16/9} as const;
export function resolveQuality(query:URLSearchParams,mobile:boolean):QualityName{
 const name=query.get("quality");
 if(name&&Object.prototype.hasOwnProperty.call(QUALITY_PROFILES,name))return name as QualityName;
 if(query.has("export")||query.has("geometry-export"))return "offline";
 if(query.has("lite"))return "mobile";
 return mobile?"mobile":"desktop";
}
export function browserQuality(query=new URLSearchParams(location.search)){
 return resolveQuality(query,matchMedia("(pointer: coarse), (max-width: 720px)").matches);
}
export function qualityOptions(){return Object.entries(QUALITY_PROFILES).map(([value,p])=>({value,label:p.label}));}
export function changeQuality(name:string){
 if(!Object.prototype.hasOwnProperty.call(QUALITY_PROFILES,name))return;
 const url=new URL(location.href);url.searchParams.set("quality",name);url.searchParams.delete("lite");
 location.assign(url.href);
}
