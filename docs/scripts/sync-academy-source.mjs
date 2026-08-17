import {access, cp, mkdir, readFile, rm, writeFile} from "node:fs/promises";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";

const scriptDirectory = fileURLToPath(new URL(".", import.meta.url));
const siteRoot = resolve(scriptDirectory, "..");
const sourceRoot = resolve(siteRoot, "../..");
const workspaceConfigPath = resolve(sourceRoot, ".workspace/starci-academy/fe/config.json");
const workspaceConfig = JSON.parse(await readFile(workspaceConfigPath, "utf8"));
if (workspaceConfig.project !== "starci-academy" || workspaceConfig.role !== "fe") {
  throw new Error(`Cannot sync StarCi Academy FE source. Invalid workspace route: ${workspaceConfigPath}`);
}
const academyRoot = workspaceConfig.repository?.diskPath;
if (typeof academyRoot !== "string" || academyRoot.length === 0) {
  throw new Error(`Cannot sync StarCi Academy FE source. Missing repository.diskPath: ${workspaceConfigPath}`);
}
const source = resolve(academyRoot, "src");
const destination = resolve(siteRoot, ".academy-src");
const requiredStyles = resolve(source, "app/globals.css");

try {
  await access(requiredStyles);
} catch {
  throw new Error(`Cannot sync StarCi Academy FE source from ${workspaceConfigPath}. Expected: ${requiredStyles}`);
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
