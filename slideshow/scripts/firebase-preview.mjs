import {spawnSync} from "node:child_process";
const project=process.argv[2];
if(!project||!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(project)){
  console.error("Usage: npm run deploy:preview -- YOUR_SPARK_PROJECT_ID");
  process.exit(1);
}
if(!process.argv.includes("--confirm-spark")){
  console.error("Confirm the Firebase project is on Spark with no linked billing account, then append --confirm-spark.");
  console.error("Preview URLs are public. Review all photos in the generated dist directory before deploying.");
  process.exit(1);
}
function run(cmd,args){
  const r=spawnSync(cmd,args,{stdio:"inherit",shell:process.platform==="win32"});
  if(r.error)throw r.error;
  if(r.status!==0)process.exit(r.status??1);
}
run("npm",["run","build"]);
run("npx",["--yes","firebase-tools","hosting:channel:deploy","slideshow","--expires","7d","--project",project]);
