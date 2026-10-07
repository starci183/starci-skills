// scripts/agent/codex-mirror-source.mjs — the system Codex home a launch also trusts, beside Orca's managed Codex home.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * The system Codex home (<home>/.codex). Orca starts a Codex worker in one of two homes and the launch cannot know
 * which until Orca spawns it: the managed home (<userData>/codex-runtime-home/home), whose config.toml Orca rebuilds
 * from this home's at every launch keeping only its own `[projects.*]` and `[hooks.state.*]` tables (a
 * `[[hooks.PreToolUse]]` block written to the managed file alone is gone seconds after `worker-start`, observed
 * 2026-10-07 18:32), or this home itself, once Codex has approved Orca's status hook in it (Orca 1.4.221 on Windows,
 * as on macOS and Linux). Launch trust therefore records the project, the notices and the guard in both.
 *
 * Null when the launch's Codex home is no Orca-chosen one (an explicit CODEX_HOME): Orca neither mirrors from nor
 * starts the worker in the system home then. A trust home (specs) re-roots the source under `<root>/system`, a
 * directory of its own beside the managed `<root>/.codex`.
 */
export function codexMirrorSource({ env = process.env } = {}) {
  const root = env.STARCI_AGENT_TRUST_HOME || null;
  if (root) return path.join(root, 'system', '.codex');
  return env.CODEX_HOME ? null : path.join(os.homedir(), '.codex');
}

/**
 * The Codex homes one launch records trust in: the active home(s) plus the system home when it has a config.toml.
 * A system home without one stays untouched: Orca refuses a blank mirror source, and a file created for the launch
 * alone would replace the owner's settings in the mirror and mask them in the home Orca starts the worker in.
 */
export function codexLaunchHomes({ homes, env = process.env }) {
  const source = codexMirrorSource({ env });
  const key = (dir) => path.resolve(dir).toLowerCase();
  const present = source && fs.existsSync(path.join(source, 'config.toml')) && !homes.some((h) => key(h.dir) === key(source));
  return present ? [...homes, { kind: 'system-codex-home', dir: path.resolve(source) }] : homes;
}
