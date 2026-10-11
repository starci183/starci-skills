// release-leftovers.mjs - what an earlier cut, build or crash left in the checkout that would turn the suite red: authored-looking JSON outside modules/kernel/allowlist.yaml (the inventory of the docs gate, rule
// check-json-exceptions, which every workflow-checkpoint and settle spec runs against the runtime root). It is git-ignored files that make it silent: `git status` is clean while the suite fails 30 minutes in.
// The cut runs the same check script of the checkout before it takes the host lock and refuses in seconds, naming each file and the fix. Seams (deps): jsonExceptions (repo -> {offenders, missingAllowlist}), run (the node runner).
import path from 'node:path';
import { runNode } from '../api/node/run-node.mjs';

const CHECK = ['scripts', 'checks', 'check-json-exceptions.mjs'];

/** The lines indented under the heading of `stderr` that starts with `heading`. */
const listedUnder = (stderr, heading) => {
  const rows = String(stderr).split('\n');
  const at = rows.findIndex((row) => row.startsWith(heading));
  if (at < 0) return [];
  const listed = [];
  for (const row of rows.slice(at + 1)) {
    if (!row.startsWith('  ')) break;
    listed.push(row.trim());
  }
  return listed;
};

/** The check's own refusal lines as {offenders, missingAllowlist}; a check that exits 0 holds none, any exit other than 0 or 1 is a tool that could not run (thrown). */
function inventoryOf(repo, runCheck = runNode) {
  const run = runCheck([path.join(repo, ...CHECK)], { cwd: repo, encoding: 'utf8' });
  if (run.status === 0) return { offenders: [], missingAllowlist: [] };
  if (run.status !== 1) throw new Error(`check-json-exceptions could not run (exit ${run.status ?? 'none'}): ${String(run.stderr ?? run.error?.message ?? '').slice(-300)}`);
  return { offenders: listedUnder(run.stderr, 'Authored JSON outside'), missingAllowlist: listedUnder(run.stderr, 'Allowlist path missing') };
}

/** {verdict, why, findings} when the checkout `repo` holds a leftover the docs gate would refuse, else null. */
export function leftoversRefusal({ repo, deps = {} }) {
  const inventory = (deps.jsonExceptions ?? ((root) => inventoryOf(root, deps.run)))(repo);
  const offenders = inventory.offenders.map((file) => ({ what: `${file} is JSON outside modules/kernel/allowlist.yaml (the docs gate check-json-exceptions refuses it in every workflow spec)`, fix: `delete ${file} if an interrupted cut or a build left it, else register it in the allowlist` }));
  const missing = inventory.missingAllowlist.map((file) => ({ what: `${file} is registered in modules/kernel/allowlist.yaml but absent on disk`, fix: `restore ${file} or remove its allowlist entry` }));
  const findings = [...offenders, ...missing];
  if (!findings.length) return null;
  const described = findings.map((f) => `${f.what} (${f.fix})`);
  return { verdict: 'tree-leftovers', why: `the checkout holds leftovers that turn the suite red: ${described.join('; ')}`, findings };
}
