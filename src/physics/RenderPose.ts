import type { Particle } from "./Particle";

/** Interpolate consecutive fixed solver poses without modifying the solver. */
export class RenderPose {
  private previous: Particle[] = [];
  private display: Particle[] = [];
  reset(particles: readonly Particle[]): void {
    this.previous = particles.map(p => ({...p}));
    this.display = particles.map(p => ({...p}));
  }
  capture(particles: readonly Particle[]): void {
    if (this.previous.length !== particles.length) this.reset(particles);
    for (let i=0;i<particles.length;i++) {
      const p=particles[i], q=this.previous[i];
      q.x=p.x;q.y=p.y;q.z=p.z;
    }
  }
  sample(particles: Particle[], alpha: number): Particle[] {
    const a=Math.max(0,Math.min(1,alpha));
    if(a===1 || this.previous.length!==particles.length)return particles;
    for(let i=0;i<particles.length;i++){
      const p=particles[i],q=this.previous[i],out=this.display[i];
      out.x=q.x+(p.x-q.x)*a;
      out.y=q.y+(p.y-q.y)*a;
      out.z=q.z+(p.z-q.z)*a;
    }
    return this.display;
  }
}
export const PLAYBACK_RATE = 0.85;
