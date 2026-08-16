import {copyFile, mkdir, rm} from "node:fs/promises";
import {dirname, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(siteRoot, "node_modules/@heroui/styles/dist/heroui.min.css");
const destination = resolve(siteRoot, "public/vendor/heroui.min.css");
const legacyDestination = resolve(siteRoot, "static/vendor/heroui.min.css");

await mkdir(dirname(destination), {recursive: true});
await copyFile(source, destination);
await rm(legacyDestination, {force: true});

console.log("Synced official HeroUI v3 stylesheet.");
