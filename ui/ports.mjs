// ports.mjs - the one reader of the UI's ports. Their single home is modules/models/runtimes.yaml
// allocation.supervisorTick.statusApp (port: the built UI and the read-only API of server.mjs; devPort: the
// Vite dev and preview servers). vite.config.ts bundles this file beside itself, so the manifest is found by
// walking up from this file's directory. `node ports.mjs` prints the dev URL start.cmd opens.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../engine/yaml.mjs';
import { isMain } from '../scripts/lib/is-main.mjs';

const RUNTIMES = join('modules', 'models', 'runtimes.yaml');
const repoRoot = (() => {
  for (let dir = dirname(fileURLToPath(import.meta.url)); ; dir = dirname(dir)) {
    if (existsSync(join(dir, RUNTIMES))) return dir;
    if (dirname(dir) === dir) throw new Error(`no ${RUNTIMES} found above ${fileURLToPath(import.meta.url)}`);
  }
})();
const statusApp = parseYaml(readFileSync(join(repoRoot, RUNTIMES), 'utf8'))?.allocation?.supervisorTick?.statusApp ?? {};

/** The port ui/server.mjs serves the built UI and read-only API on (STARCI_STATUS_PORT overrides it); the dev proxy's target. */
export const appPort = Number(statusApp.port);
/** The port the Vite dev and preview servers bind (vite.config.ts; package.json scripts carry no flag for it). */
export const devPort = Number(statusApp.devPort);
/** Where start.cmd points the browser. */
export const devUrl = `http://127.0.0.1:${devPort}`;

if (isMain(import.meta.url)) process.stdout.write(`${devUrl}\n`);
