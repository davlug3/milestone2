import {defineConfig} from "vite";
import {fileURLToPath} from "node:url";
import {statsConfigPlugin} from "../scripts/lib/stats-config.mjs";
export default defineConfig({plugins:[statsConfigPlugin(fileURLToPath(new URL("../photos.config.jsonc",import.meta.url)))],server:{fs:{allow:[fileURLToPath(new URL("../",import.meta.url))]}}});
