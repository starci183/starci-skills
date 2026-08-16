import {access, cp, mkdir, readFile, rm, writeFile} from "node:fs/promises";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";

const scriptDirectory = fileURLToPath(new URL(".", import.meta.url));
const siteRoot = resolve(scriptDirectory, "..");
const academyRoot = resolve(siteRoot, "../../../..", "starci-academy-fe");
const source = resolve(academyRoot, "src");
const destination = resolve(siteRoot, ".academy-src");
const requiredBranch = resolve(source, "components/branches/SurfaceListCard/index.tsx");

try {
  await access(requiredBranch);
} catch {
  throw new Error(`Cannot sync StarCi Academy FE source. Expected: ${requiredBranch}`);
}

await rm(destination, {recursive: true, force: true});
await mkdir(destination, {recursive: true});
await cp(source, destination, {recursive: true});

// Tailwind ignores hidden directories during automatic source discovery. The docs intentionally
// compile the synced Academy contracts, so bind the copied stylesheet to the copied source tree.
// Only the generated copy changes; the frontend repository remains the authority.
const syncedStylesPath = resolve(destination, "app/globals.css");
const syncedStyles = await readFile(syncedStylesPath, "utf8");
const tailwindImport = '@import "tailwindcss";';
if (!syncedStyles.includes(tailwindImport)) {
  throw new Error(`Cannot bind Tailwind source. Expected import in: ${syncedStylesPath}`);
}
await writeFile(
  syncedStylesPath,
  syncedStyles.replace(tailwindImport, '@import "tailwindcss" source("../");'),
  "utf8",
);

console.log(`Synced StarCi Academy FE source: ${source} -> ${destination}`);
