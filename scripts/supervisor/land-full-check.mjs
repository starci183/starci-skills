// land-full-check.mjs - the land gate's full `starci check` step (3.5). The gate is not the whole check: the candidate's
// own `npm run check` (bin/starci.mjs check: node --check, the runtime HFS check and every retained self-check) runs in
// its scratch tree as a step of the land, and a red one refuses the land with its output tail. There is no red-on-main
// baseline for it: main is kept green, and a land never makes a self-check red.
import fs from 'node:fs';
import path from 'node:path';

export const FULL_CHECK_ENTRY = 'bin/starci.mjs';

/** The candidate's full check in `dir`: {ok, output, full}, or {ok: true, skipped: true} for a tree with no bin/starci.mjs. `runner(cmd, args, {cwd, timeout})` -> {ok, stdout, stderr}. */
export function fullCheck(dir, runner, tail = (text) => String(text ?? '').trim().split(/\r?\n/).slice(-30).join('\n')) {
  if (!fs.existsSync(path.join(dir, FULL_CHECK_ENTRY))) return { ok: true, skipped: true };
  const r = runner(process.execPath, [FULL_CHECK_ENTRY, 'check'], { cwd: dir, timeout: 1_800_000 });
  const full = r.stdout + r.stderr;
  return { ok: r.ok, output: tail(full), full };
}

/** The `starci check` entry of runChecks' list, or null when the tree has no entry point. */
export function fullCheckStep(dir, runner) {
  const full = fullCheck(dir, runner);
  return full.skipped ? null : { name: 'starci check', ok: full.ok, ...(full.ok ? {} : { output: full.output }) };
}
