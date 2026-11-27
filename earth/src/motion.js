export const R=6371000, DURATION=16;
export const TARGET={lat:15.08,lon:120.66};
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
export function pose(t){
 const transit=smooth(t/5.5), descent=smooth((t-2)/9), a=smooth(t/10.5), linger=Math.max(0,t-9), drift=linger*linger/(linger+2);
 return {lat:24+(TARGET.lat-24)*transit,lon:47+(TARGET.lon-47)*transit,
 altitude:Math.exp(Math.log(18000000)*(1-descent)+Math.log(115000)*descent)*Math.exp(-.012*drift),
 azimuth:-60+100*a+2.2*drift,tilt:12+23*a-.65*drift,roll:3*Math.sin(Math.PI*a)+.18*drift,
 boundary:smooth((t-9)/2)};
}
