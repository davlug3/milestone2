export const SLIDE_SECONDS=5;
export function validateSlides(value){
 if(!Array.isArray(value)||!value.length||value.length>100)throw Error("Provide 1–100 slides.");
 return value.map((s,i)=>{
  if(!s||typeof s.title!=="string"||!s.title.trim()||s.title.length>150||typeof s.number!=="number"||!Number.isFinite(s.number)||Math.abs(s.number)>1e12||s.subtitle!==undefined&&(typeof s.subtitle!=="string"||s.subtitle.length>220))throw Error("Invalid slide "+(i+1)+": title and finite number required; subtitle optional.");
  return {title:s.title.trim(),number:s.number,...(s.subtitle?.trim()?{subtitle:s.subtitle.trim()}:{})};
 });
}
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
export function slidePose(time,count){
 const t=Math.max(0,Math.min(count*SLIDE_SECONDS,Number.isFinite(time)?time:0));
 const index=Math.min(count-1,Math.floor(t/SLIDE_SECONDS)),local=t-index*SLIDE_SECONDS;
 return {index,local,entrance:smooth(local/.7),countProgress:1-Math.pow(1-clamp((local-.22)/1.55),3),exit:index<count-1?smooth((SLIDE_SECONDS-local)/.48):1};
}
export function numberText(value,progress=1){
 const digits=Math.min(6,(String(value).split(".")[1]||"").length);
 return new Intl.NumberFormat("en-US",{minimumFractionDigits:digits,maximumFractionDigits:digits}).format(value*Math.max(0,Math.min(1,progress)));
}

export const unit=x=>Math.max(0,Math.min(1,x));
export const easeOut=x=>1-Math.pow(1-unit(x),4);
export function motionPose(local,index,count){
 const tail=index<count-1?unit((local-4.28)/.72):0;
 return {number:easeOut(local/.92),title:easeOut((local-.48)/.85),subtitle:easeOut((local-.88)/.8),accent:easeOut((local-.24)/1.05),exit:tail*tail*tail,shine:unit((local-1.35)/1.25),count:1-Math.pow(1-unit((local-.17)/1.7),3)};
}
