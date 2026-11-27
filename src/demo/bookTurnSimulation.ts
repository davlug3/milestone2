import { PaperSimulation } from "../physics/PaperSimulation";
import { PageTurnController } from "../animation/PageTurnController";
import { Heightfield } from "../physics/Heightfield";
import { restingPageWear } from "../paper/pageShape";
import { textRoot, textStackY, textPageY, textPageFloor } from "../book/textBlockBinding";
import type { BookDimensions } from "../config/bookConfig";
export interface TurnWindow {start:number;dur:number;settle:number}
export interface TurnSpec {dims:BookDimensions;cols:number;rows:number;dt:number;floor:number;landBase:number;landStep:number;spineWidth:number;windows:TurnWindow[]}
export function makeTurn(spec:TurnSpec,k:number,heightfield:Heightfield){
 const {dims:BOOK_DIMENSIONS,cols,rows,dt:FIXED_DT,floor:COVER_FLOOR_Y,landBase,landStep}=spec;
 const W=BOOK_DIMENSIONS.width,H=BOOK_DIMENSIONS.height,NUM_SHEETS=BOOK_DIMENSIONS.sheetCount,gutterX=-W/2;
 const win=spec.windows[k],restY=textStackY(BOOK_DIMENSIONS,k),landY=landBase+k*landStep;
 const root=textRoot(BOOK_DIMENSIONS,k);
 const groundHeight=(x:number,z:number)=>Math.max(heightfield.heightAt(x,z),textPageFloor(BOOK_DIMENSIONS,k,x+W/2,COVER_FLOOR_Y)+(x+W/2>=0&&k+1<NUM_SHEETS?restingPageWear(k+1,(x+W/2-textRoot(BOOK_DIMENSIONS,k+1).x)/W,z/H+.5,1):0));
  const sim = new PaperSimulation({
      cols,
      rows,
      width: W,
      height: H,
      dt: FIXED_DT,
      iterations: 12,
      bendStiffness: 1.2,
      longRangeBend: true,
      bendSpans: [3, 4, 5, 6], // longer links => stiffer, smoother sheet
      plane: "xz",
      groundHeight,
    });
    // The sheet is bound on the spine plane: its inner edge starts at the
    // binding height for its place in the closed stack and ramps up to the
    // fore-edge stack height over BIND_RAMP.
    const spineRestY = root.y;
    for (const p of sim.particles) {
      const localX = p.x + W / 2;
      p.x = p.px = p.x + root.x;
      p.y = p.py = textPageY(BOOK_DIMENSIONS, k, localX);
    }

    const spineIndices: number[] = [];
    const foreEdgeIndices: number[] = [];
    for (let r = 0; r < rows; r++) {
      spineIndices.push(r * cols + 0);
      foreEdgeIndices.push(r * cols + (cols - 1));
    }

    // On the left the sheet binds at the front cover hinge; the first sheet
    // turned is the bottom of the left stack, so its fan index is k.
    const landSpineY = root.y;

    const controller = new PageTurnController({
      foreEdgeIndices,
      spineIndices,
      gutterX: gutterX + root.x,
      restY,
      spineRestY,
      landY,
      landSpineY,
      // Preserve both coordinates of the material attachment through the turn.
      spineTargetX: gutterX + root.x,
      landSpineStart: 0.5,
      width: W,
      duration: win.dur,
      liftScale: 0.45,
      lead: 0.03,
      liftVar: 0.03,
      rows,
    });
    controller.seedZ(sim.particles);
    controller.setProgress(0);
    controller.apply(sim.particles);

  return {sim,controller};
}
