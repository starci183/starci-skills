// scripts/reconciler/reload-env.mjs — the environment of an engine self-reload when the running code cannot read config.yaml.
//
// Starting the replacement resolves its temp root (engine/temp-root.mjs tempChildEnv), which reads config.yaml with the
// RUNNING code. A config newer than that code made every reload fail with "Invalid config.yaml" and the engine stayed on
// the old revision. The replacement is the new code, so the old engine hands it the temp root it resolved while its own
// config was readable; the replacement drops that pin at once and reads config.yaml itself.
import { TEMP_ROOT_ENV, tempRoot } from '../../engine/temp-root.mjs';

const PINNED_TEMP_ENV = 'STARCI_RELOAD_PINNED_TEMP';

/** The temp root this process resolves from its config, or null when the config is unreadable. */
export function startTempRoot({ env = process.env, resolve = tempRoot } = {}) {
  try { return resolve({ env }); } catch { return null; }
}

/** `env` for the replacement: unchanged while the config reads; else with the start temp root pinned (when there is one). */
export function reloadEnv(env, startRoot, { resolve = tempRoot } = {}) {
  try { resolve({ env }); return env; } catch { return startRoot ? { ...env, [TEMP_ROOT_ENV]: startRoot, [PINNED_TEMP_ENV]: '1' } : env; }
}

/** In a replacement: drop the pinned temp root so the config decides again. */
export function releasePinnedTemp(env = process.env) {
  if (!env[PINNED_TEMP_ENV]) return;
  delete env[TEMP_ROOT_ENV];
  delete env[PINNED_TEMP_ENV];
}
