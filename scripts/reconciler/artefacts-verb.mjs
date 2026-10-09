// artefacts-verb.mjs - `starci runtime artefacts [--migrate]`: the installed artefacts of the live workflows and the host tree, judged against the
// revision this tree carries (installed-artefacts.mjs), and migrated with --migrate. A deploy runs it from the new tree as a verified step.
import { skillRoot } from '../../engine/runtime-root.mjs';
import { readMachine } from '../../engine/db/machine.mjs';
import { migrateInstalledArtefacts } from './installed-artefacts.mjs';

const SCHEMA = 'starci/runtime-artefacts@1';
const NO_MACHINE = Object.freeze({ liveWorktrees: () => [] });

const stampOf = (r) => [r.before, r.after].filter((v) => v !== undefined).join(' -> ');
const causeOf = (r) => (r.code ? [r.code, r.detail].join(': ') : '');
const lineOf = (r) => [r.state.padEnd(8), r.artefact, r.target, stampOf(r) && '(' + stampOf(r) + ')', causeOf(r)].filter(Boolean).join(' ');

/** Function-backed `runtime artefacts` verb. */
export async function runtimeArtefacts(ctx, deps = {}) {
  if ((ctx?.positionals ?? []).length) return { code: 2, text: 'usage: starci runtime artefacts [--migrate]', data: { schema: SCHEMA, ok: false } };
  const root = deps.root ?? skillRoot;
  const apply = Boolean(ctx?.args?.migrate);
  const run = (machine) => migrateInstalledArtefacts({ root, machine, apply });
  const report = readMachine(run, null, { env: ctx?.env ?? process.env }) ?? run(NO_MACHINE);
  const summary = Object.entries(report.counts).filter(([, n]) => n).map(([k, n]) => `${k} ${n}`).join(', ') || 'none';
  const text = [`installed artefacts (${apply ? 'migrate' : 'check'}): ${summary}`, ...report.results.filter((r) => r.state !== 'current' && r.state !== 'absent').map(lineOf)].join('\n');
  return { code: report.ok ? 0 : 1, text, data: { schema: SCHEMA, ok: report.ok, root, mode: apply ? 'migrate' : 'check', counts: report.counts, results: report.results } };
}
