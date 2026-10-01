// guards-root.mjs — the one home of the op guard directory (runtime/guards: jobs/, terminals/, seats/, refusals.jsonl).
//
// The runtime's own guards live under <skillRoot>/runtime/guards. STARCI_GUARDS_ROOT relocates THAT directory only - a
// caller that names another root (a fixture's skill root) keeps <root>/runtime/guards. The node --test preload
// (tests/setup/isolated-temp.mjs) gives every spec process its own STARCI_GUARDS_ROOT, so two spec files that bind the
// same fake Orca handle (fake-terminal-1) never read each other's binding, and no spec writes the live runtime's guards.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const GUARDS_ROOT_ENV = 'STARCI_GUARDS_ROOT';
export const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const key = (p) => { const r = path.resolve(p); return process.platform === 'win32' ? r.toLowerCase() : r; };

/** The guard directory of `skillRoot` (the runtime's own by default). */
export function guardsRoot(skillRoot = SKILL_ROOT, env = process.env) {
  if (env[GUARDS_ROOT_ENV] && key(skillRoot) === key(SKILL_ROOT)) return path.resolve(env[GUARDS_ROOT_ENV]);
  return path.join(skillRoot, 'runtime', 'guards');
}
