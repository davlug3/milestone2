import { mkdir, readFile, writeFile, rename, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);
const dir = fileURLToPath(new URL("../public/page-photos/", import.meta.url));
const ids = [10,11,15,16,17,18,19,20,28,29,31,33,37,43,49,57,61,65,73,77,83,84,88,94];
const valid = b => b.length > 4 && b[0] === 255 && b[1] === 216 && b[b.length-2] === 255 && b[b.length-1] === 217;
await mkdir(dir, { recursive: true });
const photos = [];
for (const id of ids) {
  const file = join(dir, id + ".jpg");
  const tmp = file + ".tmp";
  const url = "https://picsum.photos/id/" + id + "/640/480";
  try {
    if (!valid(await readFile(file).catch(() => Buffer.alloc(0)))) {
      await exec("curl", ["-fsSL", "--retry", "3", "--max-time", "30", "-o", tmp, url]);
      if (!valid(await readFile(tmp))) throw new Error("Invalid JPEG");
      await rename(tmp, file);
      console.log("Downloaded", id);
    } else console.log("Already downloaded", id);
    photos.push({ id, file: id + ".jpg", source: url, info: "https://picsum.photos/id/" + id + "/info" });
  } catch (error) {
    await rm(tmp, { force: true });
    console.error("Failed", id, error.message);
  }
}
await writeFile(join(dir, "sources.json"), JSON.stringify(photos, null, 2) + "\n");
console.log(photos.length + "/" + ids.length + " photos available.");
if (photos.length !== ids.length) process.exitCode = 1;
