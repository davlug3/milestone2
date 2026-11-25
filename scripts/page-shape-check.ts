import {restingPageWear,freePageWear} from "../src/paper/pageShape";
function check(ok:boolean,message:string){if(!ok)throw Error(message);}
for(let i=0;i<72;i++)for(let x=0;x<=20;x++)for(let y=0;y<=20;y++){
 const u=x/20,v=y/20;
 check(restingPageWear(i,u,v,0)===0,"closed compression");
 check(Math.abs(restingPageWear(i,u,v,1)-restingPageWear(i+1,u,v,1))<=.0000361,"stack spacing");
 check(Math.abs(freePageWear(i,u,v,1))<1e-12,"contact fade");
 if(x===0||x===20)check(Math.abs(freePageWear(i,u,v,.5))<1e-12,"pinned edges");
}
console.log("PASS: all 72 resting profiles, stack spacing, pin and landing invariants");
