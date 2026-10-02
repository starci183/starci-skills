// land-full-check.mjs - the land gate's full `starci runtime check` step (3.5). The gate is not the whole check: the candidate's
// own `npm run check` (bin/starci.mjs check: node --check, the runtime HFS check and every retained self-check) runs in
// its scratch tree as a step of the land, and a red one refuses the land with its output tail. There is no red-on-main
// baseline for it: main is kept green, and a land never makes a self-check red.
import fs from 'node:fs';
import path from 'node:path';
import { runNode } from '../api/node/run-node.mjs';

export const FULL_CHECK_ENTRY = 'bin/starci.mjs';

/** `node <args>` through scripts/api/node: {ok, stdout, stderr}. */
const nodeRunner = (args, options) => { const r = runNode(args, options); return { ok: !r.error && r.status === 0, stdout: String(r.stdout ?? ''), stderr: String(r.stderr ?? r.error?.message ?? '') }; };

/** The candidate's full check in `dir`: {ok, output, full}, or {ok: true, skipped: true} for a tree with no bin/starci.mjs. `runner(args, {cwd, timeout})` runs `node <args>` -> {ok, stdout, stderr}. */
export function fullCheck(dir, runner = nodeRunner, tail = (text) => String(text ?? '').trim().split(/\r?\n/).slice(-30).join('\n')) {
  if (!fs.existsSync(path.join(dir, FULL_CHECK_ENTRY))) return { ok: true, skipped: true };
  const r = runner([FULL_CHECK_ENTRY, 'check'], { cwd: dir, timeout: 1_800_000 });
  const full = r.stdout + r.stderr;
  return { ok: r.ok, output: tail(full), full };
}

/** The `starci runtime check` entry of runChecks' list, or null when the tree has no entry point. */
export function fullCheckStep(dir, runner = nodeRunner) {
  const full = fullCheck(dir, runner);
  return full.skipped ? null : { name: 'starci runtime check', ok: full.ok, ...(full.ok ? {} : { output: full.output }) };
}
