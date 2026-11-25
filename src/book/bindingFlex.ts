import { clamp01, smootherstep } from "../animation/easing";
export interface BindingTurn { start: number; dur: number; settle: number }

/** Continuous elastic response: opening preload, moving turn loads, and
 * retained deformation from the transferred stack. No per-turn hard reset. */
export function bindingLoad(time: number, opening: number, turns: readonly BindingTurn[]): number {
  const open = smootherstep(clamp01(opening));
  let load = 0.18 * open;
  for (const turn of turns) {
    const p = clamp01((time - turn.start) / (turn.dur + turn.settle));
    load += 0.65 * Math.sin(Math.PI * p) ** 2 + 0.018 * smootherstep(p);
  }
  return Math.min(1, load) * open;
}

/** Shared upward displacement of cloth and paper, supported only inside the
 * fully open case gap. Endpoints and slopes vanish at the board hinges. */
export function bindingLift(x: number, span: number, load: number): number {
  if (x <= -span || x >= 0 || load <= 0) return 0;
  return 0.0045 * load * Math.sin(Math.PI * (-x / span)) ** 2;
}
