import {rm} from "node:fs/promises";
import {dirname, relative, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

for (const name of [".next", "out", "content"]) {
  const target = resolve(siteRoot, name);
  if (relative(siteRoot, target) !== name) {
    throw new Error(`Refusing to remove unexpected path: ${target}`);
  }
  await rm(target, {recursive: true, force: true});
}

console.log("Cleared generated Nextra files.");
