import {clamp01,smootherstep} from "../animation/easing";
/** Stack-safe common curvature, with a tiny individual handling history.
 * The bound edge and fore-edge pins remain unchanged. Closed covers compress the stack.
 */
export function restingPageWear(index:number,u:number,v:number,opening:number):number{
 const gate=smootherstep(clamp01((opening-.12)/.88));
 const edge=Math.sin(Math.PI*clamp01(u))**2;
 const z=2*v-1;
 const common=.00045*edge*(.35+.65*z*z)+.00018*edge*Math.sin(5*u+2*z);
 const unique=.000018*edge*Math.sin(index*2.399+u*9+z*5);
 return gate*(common+unique);
}
/** A persistent material-coordinate crease, expressed only during free flight.
 * Fade before contact so the original collision bake is unchanged.
 */
export function freePageWear(index:number,u:number,v:number,progress:number):number{
 const envelope=Math.sin(Math.PI*clamp01(progress))**2;
 const edge=Math.sin(Math.PI*clamp01(u))**2;
 const z=2*v-1,side=index%2?1:-1;
 const corner=smootherstep(clamp01((u*.8+side*z*.5-.55)/.65));
 const curl=.0018*edge*(.25+.75*z*z);
 const fold=(index%3===1?.0032:.0013)*corner*edge;
 const ripple=.00045*edge*Math.sin(10*u+5*z+index*2.399);
 return envelope*(curl+fold+ripple);
}
