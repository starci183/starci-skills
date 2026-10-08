// release-affected-commits.mjs - the per-commit selection of the `affected tests` row (release-affected.mjs) for a release range wider than the verb's bound: each commit of the range, newest `maxCommits` first,
// has its own affected set (the same selection `starci test affected` makes, over that commit's diff against its parent), or evidence from an earlier cut.
import fs from 'node:fs';
import path from 'node:path';
import { diff } from '../api/git/diff.mjs';
import { revList } from '../api/git/rev-list.mjs';
import { readModuleJson } from '../../engine/runtime-root.mjs';
import { readSpecs } from '../lib/spec-pool.mjs';
import { byCodeUnit } from '../lib/list.mjs';
import { affectedSelection, readSources } from './affected-select.mjs';
import { symbolsAgainst } from './affected-test.mjs';
import { readAffectedLedger } from './release-affected-ledger.mjs';

const lines = (r) => String(r.stdout ?? '').split(/\r?\n/).filter(Boolean);

/**
 * The plan of each commit of `base..head` (no merge commits, newest `policy.maxCommits`): `plans` [{commit, reused, files}] for the covered ones, `notCovered` [{commit, reason}] for the rest.
 * A commit with a ledger is `reused` (its recorded files); another has its set selected now, and one whose set is over `bound` is not covered.
 */
export function commitPlans({ root, base, head, bound, policy, deps = {} }) {
  const commits = lines(revList(['--no-merges', `${base}..${head}`], { cwd: root }));
  const dataRoots = readModuleJson('modules', 'supervisor', 'affected-tests.yaml').dataRoots;
  const specs = deps.specs ?? readSpecs(root);
  const sources = deps.sources ?? readSources(root);
  const plans = [], notCovered = [];
  commits.slice(0, policy.maxCommits).forEach((commit) => {
    const earlier = readAffectedLedger({ repo: root, commit });
    if (earlier) { plans.push({ commit, reused: true, files: earlier }); return; }
    const changed = lines(diff(['--name-only', '--diff-filter=ACMRD', `${commit}^`, commit], { cwd: root })).sort(byCodeUnit);
    const picked = affectedSelection({ root, changed, specs, sources, maxFiles: bound, dataRoots, exists: (file) => fs.existsSync(path.join(root, file)), symbolsOf: (file) => symbolsAgainst({ root, base: `${commit}^`, deps }, file) });
    if (picked.over) notCovered.push({ commit, reason: `its own affected set (${picked.files.length} spec files) is over the bound ${bound}` });
    else plans.push({ commit, reused: false, files: picked.files });
  });
  commits.slice(policy.maxCommits).forEach((commit) => notCovered.push({ commit, reason: `past maxCommits ${policy.maxCommits}` }));
  return { plans, notCovered };
}
