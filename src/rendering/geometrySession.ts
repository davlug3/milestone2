/** Shared timeline contract for geometry exports. A scene supplies its own deterministic evaluator. */
export function geometrySession<TSetup,TFrame>(evaluate:(time:number)=>void,exporter:{setup():TSetup;frame(checkpoint?:boolean):TFrame}){
 let ready=false;
 return {
  blenderSetup(){evaluate(0);const result=exporter.setup();ready=true;return result;},
  blenderFrame(time:number,checkpoint=false){if(!ready)throw Error("Initialize geometry session first");if(!Number.isFinite(time)||time<0)throw Error("Invalid simulation time");evaluate(time);return exporter.frame(checkpoint);}
 };
}
