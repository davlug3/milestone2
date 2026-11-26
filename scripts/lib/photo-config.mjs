import {readFile, readdir, stat, realpath} from "node:fs/promises";
import {dirname, resolve, isAbsolute, extname} from "node:path";
import ts from "typescript";
import {resolveDrivePhotos} from "./drive-photos.mjs";

const extensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif", ".bmp"]);
const isImage = path => extensions.has(extname(path).toLowerCase());
export async function resolvePhotos(configPath, scene) {
  const result = ts.parseConfigFileTextToJson(configPath, await readFile(configPath, "utf8"));
  if (result.error) throw Error(ts.flattenDiagnosticMessageText(result.error.messageText, "\n"));
  const entries = scene ? result.config?.[scene]?.photos : result.config?.photos;
  if (!Array.isArray(entries)) throw Error("photos must be an array of relative paths");
  const photos = [], seen = new Set();
  async function add(path) {
    if (!isImage(path) || !(await stat(path)).isFile()) return;
    const canonical = await realpath(path);
    if (!seen.has(canonical)) { seen.add(canonical); photos.push(path); }
  }
  for (const entry of entries) {
    if (typeof entry !== "string" || !entry.trim() || isAbsolute(entry)) throw Error("Invalid relative photo path: "+entry);
    const path = resolve(dirname(configPath), entry);
    if(process.env.VERCEL==="1" && (process.env.VERCEL_ENV!=="production" || process.env.GDRIVE_PHOTOS_ENABLED!=="1"))throw Error("Personal photo builds on Vercel require explicit GDRIVE_PHOTOS_ENABLED=1 for production publication");
    const info = await stat(path).catch(e => { if(e.code==="ENOENT") return null; throw e; });
    if(!info){
      if(process.env.GDRIVE_PHOTOS_ENABLED!=="1")throw Error("Photo path not found: "+entry);
      for(const file of await resolveDrivePhotos(entry,isImage))await add(file);
      continue;
    }
    if (info.isDirectory()) {
      const names = await readdir(path);
      names.sort((a,b)=>a.localeCompare(b,"en",{numeric:true}) || (a<b?-1:a>b?1:0));
      for (const name of names) await add(resolve(path,name));
    } else await add(path);
  }
  if (entries.length && !photos.length) throw Error("Configured paths contain no supported images");
  return photos;
}
