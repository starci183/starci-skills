import {rm} from "node:fs/promises";
import {dirname, join, relative, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const generatedPaths = [
  [".next"],
  ["out"],
  ["content"],
  ["public", "template-assets", "archetypes"],
];

for (const segments of generatedPaths) {
  const expected = join(...segments);
  const target = resolve(siteRoot, ...segments);
  if (relative(siteRoot, target) !== expected) {
    throw new Error(`Refusing to remove unexpected path: ${target}`);
  }
  await rm(target, {recursive: true, force: true});
}

console.log("Cleared generated Nextra files.");
