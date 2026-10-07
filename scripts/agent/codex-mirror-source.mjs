// scripts/agent/codex-mirror-source.mjs — the Codex home Orca rebuilds its managed Codex home from.
import os from 'node:os';
import path from 'node:path';

/**
 * The system Codex home (<home>/.codex) whose config.toml Orca mirrors into its managed Codex home at every agent launch.
 * The mirror keeps only the managed file's [projects.*] and [hooks.state.*] tables, so a `[[hooks.PreToolUse]]` block the
 * launch wrote to the managed home alone is gone seconds after `worker-start` (observed 2026-10-07: 18:32:11 dispatch,
 * 18:32:16 managed config.toml rewritten without the guard). The guard therefore also lives in this file.
 *
 * Null when the launch's Codex home is no Orca-managed one (an explicit CODEX_HOME): nothing mirrors into it. A trust
 * home (specs) re-roots the source under `<root>/system`, a directory of its own beside the managed `<root>/.codex`.
 */
export function codexMirrorSource({ env = process.env } = {}) {
  const root = env.STARCI_AGENT_TRUST_HOME || null;
  if (root) return path.join(root, 'system', '.codex');
  return env.CODEX_HOME ? null : path.join(os.homedir(), '.codex');
}
