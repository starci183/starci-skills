// guards-root.mjs - the one home of the op guard directory (jobs/, terminals/, seats/, refusals.jsonl).
//
// The runtime's own guards live OUT of the checkout, in the host state root: <starciLocalRoot>/guards
// (%LOCALAPPDATA%/StarCi/guards, or STARCI_LOCAL_ROOT/guards). STARCI_GUARDS_ROOT relocates THAT directory only - a
// caller that names another root (a fixture's skill root) keeps <root>/runtime/guards. The node --test preload
// (tests/setup/isolated-temp.mjs) gives every spec process its own STARCI_GUARDS_ROOT, so two spec files that bind the
// same fake Orca handle (fake-terminal-1) never read each other's binding, and no spec writes the live runtime's guards.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { starciLocalRoot } from '../../engine/db/machine.mjs';

export const GUARDS_ROOT_ENV = 'STARCI_GUARDS_ROOT';
export const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const key = (p) => { const r = path.resolve(p); return process.platform === 'win32' ? r.toLowerCase() : r; };

/** The guard directory of `skillRoot`: the runtime's own lives in the host state root, a fixture root keeps its own. */
export function guardsRoot(skillRoot = SKILL_ROOT, env = process.env) {
  if (key(skillRoot) !== key(SKILL_ROOT)) return path.join(skillRoot, 'runtime', 'guards');
  return env[GUARDS_ROOT_ENV] ? path.resolve(env[GUARDS_ROOT_ENV]) : path.join(starciLocalRoot(env), 'guards');
}
