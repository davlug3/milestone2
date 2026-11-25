// Shared art direction, independent of quality and render mode.
export type VisualStyle="classic"|"luxury";
export const LUXURY={emerald:"#10271f",charcoal:"#101313",gold:"#d8bc83",ivory:"#f3ebdd",walnut:"#785239",key:0xffd8ac,fill:0xc3d8ef,rim:0xffc78e} as const;
export function visualStyle(query=new URLSearchParams(location.search)):VisualStyle{
 const explicit=query.get("style");if(explicit==="classic"||explicit==="luxury")return explicit;
 return "luxury";
}
export function addStyleControl(ui:HTMLElement,style:VisualStyle){
 const select=document.createElement("select");select.setAttribute("aria-label","Visual style");select.title="Visual style (reloads scene)";
 for(const [value,label] of [["luxury","Luxury"],["classic","Classic"]]){const option=document.createElement("option");option.value=value;option.textContent=label;select.appendChild(option);}
 select.value=style;select.onchange=()=>{const url=new URL(location.href);url.searchParams.set("style",select.value);location.assign(url.href);};
 ui.appendChild(select);
}
