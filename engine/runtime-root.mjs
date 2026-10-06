import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseYaml} from './yaml.mjs';

/**
 * Runtime root helper. The runtime reads this source tree directly. `skillRoot` is the
 * directory containing `package.json` (this module's parent) — the checkout, or the copy of it
 * an install placed on the host.
 *
 * Every workflow, op, schema, knowledge and model contract read at runtime is an authored YAML
 * file (or an authored JSON one where a document is stored that way). `readModuleJson` resolves a
 * path under `skillRoot` and parses the file by its extension.
 */
const moduleRoot = path.dirname(fileURLToPath(new URL('../package.json', import.meta.url)));

/** The runtime root: this source tree (or an immutable sealed payload of it). */
export const skillRoot = moduleRoot;
/**
 * The StarCi Source root (the host containing .claude and .workspaces): STARCI_SOURCE_ROOT overrides it, else the directory
 * holding this runtime checkout. Parameterized over `env`, so a spec can inject a fixture Source.
 */
export const starciSourceRoot = (env = process.env) => (env.STARCI_SOURCE_ROOT ? path.resolve(env.STARCI_SOURCE_ROOT) : path.dirname(skillRoot));

/** Overrides the per-host state base wholesale (debug probes, spec trees); the one seam starciLocalRoot reads. */
export const LOCAL_ROOT_ENV = 'STARCI_LOCAL_ROOT';
/** The host-data directory of a runtime root. Git-ignored and never packed; the example fixtures under examples/.runtimes are a separate, public exception. */
export const RUNTIME_STATE_DIR = '.runtime';
/**
 * <root>/.runtime. The root is the `.claude` of the host Source: the checkout, or the copy `starci runtime install` places at
 * <app>/.claude. ~/.starci/runtime/node_modules/starci is only the CLI's download cache (it supplies the installer and hosts no
 * state), and `starci runtime link` merely points the launcher at a root, so the state follows the code's own location.
 */
export const runtimeStateDir = (root = skillRoot) => path.join(root, RUNTIME_STATE_DIR);
/**
 * The per-host state base, the one owner of every host-state location: machine.sqlite, projects/<ledger_id>/runtime.sqlite, archive/,
 * artifacts/ (the blob store), guards/, host-lock/ and the other process state sit under it. Default <runtime root>/.runtime;
 * LOCAL_ROOT_ENV replaces it wholesale. Nothing is read from or moved out of the earlier %LOCALAPPDATA%/StarCi and ~/.starci locations.
 */
export const starciLocalRoot = (env = process.env, root = skillRoot) => (env[LOCAL_ROOT_ENV] ? path.resolve(env[LOCAL_ROOT_ENV]) : runtimeStateDir(root));

/**
 * Read a runtime contract document. `parts` are path segments under `skillRoot`
 * (e.g. readModuleJson('modules', 'models', 'kinds.yaml')).
 */
export function readModuleJson(...parts) {
  const rel = parts.join('/');
  const file = path.join(skillRoot, rel);
  if (!(file.startsWith(skillRoot) && fs.existsSync(file) && fs.statSync(file).isFile()))
    throw new Error(`Required contract not found for ${rel} under ${skillRoot}`);
  const text = fs.readFileSync(file, 'utf8');
  if (/\.ya?ml$/i.test(file)) return parseYaml(text);
  return JSON.parse(text);
}
