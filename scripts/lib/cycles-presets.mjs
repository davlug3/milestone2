export const CYCLES_PRESETS=Object.freeze({
 draft:{samples:16,bounces:3,noise:.08,minSamples:8,diffuse:2,glossy:2},
 "fast-production":{samples:48,bounces:6,noise:.03,minSamples:8,diffuse:3,glossy:3},
 cinema:{samples:96,bounces:8,noise:.02,minSamples:16,diffuse:4,glossy:4},
 master:{samples:256,bounces:12,noise:.005,minSamples:32,diffuse:6,glossy:6}
});
export function resolveCyclesPreset(name,overrides={}){
 const base=CYCLES_PRESETS[name];if(!Object.hasOwn(CYCLES_PRESETS,name))throw Error("Unknown Cycles preset: "+name);
 const r={...base};for(const k of Object.keys(base))if(overrides[k]!==undefined)r[k]=Number(overrides[k]);
 for(const k of ["samples","bounces","minSamples","diffuse","glossy"])if(!Number.isInteger(r[k])||r[k]<1)throw Error("Invalid "+k);
 if(!(r.noise>0&&r.noise<=1))throw Error("Invalid noise");
 r.minSamples=Math.min(r.minSamples,r.samples);r.diffuse=Math.min(r.diffuse,r.bounces);r.glossy=Math.min(r.glossy,r.bounces);
 return r;
}
