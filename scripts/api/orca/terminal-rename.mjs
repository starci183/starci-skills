#!/usr/bin/env node
// terminal-rename.mjs — the calls.yaml `terminal-rename` call as a callable function.
// Internal entry: spawned by scripts/agent/lib.mjs; not invoked directly.
// Args: --terminal <handle> --title <text>
// Used after managed worker-start because creation display-name flags are not
// applicable to a fresh agent terminal inside an existing worktree.
import { orcaCall } from './lib.mjs';
import { arg } from '../../lib/cli-arg.mjs';

/**
 * Set the title of an exact authorized terminal after launch; a title is not launch attestation.
 * ok requires a successful receipt with a result. A refusal or missing result leaves the rename
 * unconfirmed, and this wrapper does not retry a lost title-write receipt.
 * @param {object} input - Required terminal handle and replacement title.
 * @returns {object} Receipt status, requested terminal/title, result, and error.
 */
export function terminalRename({ terminal, title }) {
  const r = orcaCall('terminal-rename', { terminal, title });
  return { ok: r.exitCode === 0 && Boolean(r.result), terminal, title, result: r.result, error: r.error };
}

if (process.argv[1]?.endsWith('terminal-rename.mjs')) {
  const argv = process.argv.slice(2);
  const out = terminalRename({ terminal: arg(argv, 'terminal'), title: arg(argv, 'title') });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
