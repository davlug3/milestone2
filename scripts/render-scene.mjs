import {projectOutput} from "./lib/project-output.mjs";
import {spawnSync} from "node:child_process";
import {resolve} from "node:path";
import {existsSync} from "node:fs";
import {fileURLToPath} from "node:url";
const root=fileURLToPath(new URL("../",import.meta.url));
const args=process.argv.slice(2);
const scenes=["book","slideshow","stats","clothesline","floating"];
function take(name){const i=args.findIndex(a=>a===name||a.startsWith(name+"="));if(i<0)return undefined;const a=args[i];if(a.includes("=")){args.splice(i,1);return a.slice(name.length+1);}const value=args[i+1];if(!value||value.startsWith("--"))throw Error("Missing value for "+name);args.splice(i,2);return value;}
function flag(name){const i=args.indexOf(name);if(i<0)return false;args.splice(i,1);return true;}
if(args.includes("--help")||args.includes("-h")){console.log(`npm run render -- --scene book|slideshow|stats|clothesline|floating [options]
npm run render -- --scene floating --mode raster --duration 3
npm run render -- --scene clothesline --samples 384 --frames-only
npm run render -- --scene stats --layer separate
npm run render -- --scene slideshow --engine cycles --samples 96
npm run render -- --scene floating --engine cycles --frames-only --passes all
npm run render -- --scene book --passes albedo,normal,depth,mask
--no-build reuses existing site-dist for unified-site exporters.
Scene-specific options are passed through to the original exporter.
Book and tabletop retain their native Windows/WSL rendering workflows.`);process.exit(0);}
const scene=take("--scene")??(scenes.includes(args[0])?args.shift():"book");
if(!scenes.includes(scene))throw Error("Unknown scene: "+scene);
const passes=take("--passes"),noBuild=flag("--no-build"),engine=take("--engine")??"browser";if(!["browser","cycles"].includes(engine))throw Error("Unknown engine: "+engine);
function run(file,argv,cwd=root){const result=spawnSync(process.execPath,[file,...argv],{cwd,stdio:"inherit",env:process.env});if(result.error)throw result.error;if(result.status!==0)throw Error(file+" failed ("+result.status+")");}
const siteBuild=()=>{if(!noBuild)run(resolve(root,"scripts/build-site.mjs"),[]);else if(!existsSync(resolve(root,"site-dist",scene,"index.html")))throw Error("Missing site-dist; remove --no-build.");};
if(engine==="cycles"){if(scene==="stats")throw Error("Statistics uses the 2D renderer; choose --engine browser");if(passes!==undefined&&!["all","beauty","essential"].includes(passes))throw Error("For native render passes use --passes all, essential, or beauty");run(resolve(root,"scripts/render-blender.mjs"),["--scene",scene,...(noBuild?["--no-build"]:[]),...(passes!==undefined?["--passes",passes]:[]),...args]);}
else if(passes!==undefined){siteBuild();run(resolve(root,"scripts/render-passes.mjs"),["--scene",scene,"--passes",passes,...args]);}
else if(scene==="book"){if(noBuild)throw Error("--no-build is not supported by the legacy book exporter");run(resolve(root,"scripts/render-video.mjs"),args);}
else if(scene==="slideshow"){if(noBuild)throw Error("--no-build is not supported by the legacy tabletop exporter");const output=take("--output");const absolute=output?resolve(process.cwd(),output):undefined;run(resolve(root,"slideshow/scripts/render.mjs"),[...(absolute?["--output",absolute]:[]),...args],resolve(root,"slideshow"));}
else{siteBuild();run(resolve(root,"scripts/render-"+scene+".mjs"),args);}
