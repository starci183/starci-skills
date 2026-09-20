import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {parseYaml} from '../../engine/yaml.mjs';
import {walk} from './check-example-work.mjs';
import {runDerive} from '../example/example-derive.mjs';
import {runCritique} from '../example/example-critique.mjs';

/**
 * A separate gate rather than a line inside scripts/checks/check-example-work.mjs: another lane owns that file's
 * concept rules right now, and this gate's own two checks (derived index freshness, and the "no authored
 * field shaped like a derived one" rule) do not need anything check-example-work.mjs's `checkWorkTree`
 * already computes. Keeping this in its own file keeps both diffs small and independent to merge.
 *
 * Three checks, per `.starciwork` tree found under examples/:
 *  1. `_derived/index.yaml` exists and matches what scripts/example/example-derive.mjs computes right now (a stale
 *     or missing derived index is refused - it would be exactly the "authored by hand, drifts silently"
 *     failure mode the derivation exists to prevent).
 *  2. No real record (every `.yaml` file outside `_derived/`) authors a top-level field named `usedBy`,
 *     `effectiveState` or `frontier` - those are this tool's output vocabulary; a record that writes one by
 *     hand is indistinguishable from one the tool actually computed, which is the confusion the whole
 *     exercise exists to rule out. `provenBy` and `derived` belong to the same class: provenance is
 *     derived from done records' `proves` edges (check-work-deep.mjs's PROVENBY_AUTHORED refuses it too)
 *     and `derived:` is the "do not author" marker the compact format leaves only as a comment pointer -
 *     a record carrying either as a field is claiming computed output by hand.
 *  3. `_derived/critique.yaml` and `_derived/critique.md` exist and match what scripts/example/example-critique.mjs
 *     computes right now - the same freshness contract as #1, extended to the critique built on top of it.
 */
const FORBIDDEN_TOP_LEVEL_FIELDS = ['usedBy', 'effectiveState', 'frontier', 'provenBy', 'derived'];

export function checkExampleDerived(workRoot, problems) {
  const result = runDerive(workRoot, {write: false});
  if (!result.ok) problems.push(`${workRoot}/_derived/index.yaml is missing or stale; run \`node scripts/example/example-derive.mjs --work ${workRoot} --write\` to refresh it`);

  const critiqueResult = runCritique(workRoot, {write: false});
  if (!critiqueResult.ok) problems.push(`${workRoot}/_derived/critique.yaml or critique.md is missing or stale; run \`node scripts/example/example-critique.mjs --work ${workRoot} --write\` to refresh them`);

  for (const file of walk(workRoot).filter(f => f.endsWith('.yaml'))) {
    const rel = path.relative(workRoot, file).replaceAll('\\', '/');
    if (rel === '_derived' || rel.startsWith('_derived/')) continue;
    let data;
    try { data = parseYaml(fs.readFileSync(file, 'utf8')); } catch { continue; }
    if (!data || typeof data !== 'object' || Array.isArray(data)) continue;
    for (const field of FORBIDDEN_TOP_LEVEL_FIELDS) {
      if (Object.hasOwn(data, field)) problems.push(`${rel}: authors a top-level "${field}" field, which is derived-only vocabulary (scripts/example/example-derive.mjs); remove it and let the derivation compute it`);
    }
  }
  return {checked: true};
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const problems = [];
  const roots = walk(path.join(root, 'examples')).filter(file => file.endsWith(`.starciwork${path.sep}index.yaml`)).map(path.dirname);
  for (const workRoot of roots) checkExampleDerived(workRoot, problems);
  for (const problem of problems) console.log(`REFUSED ${problem}`);
  console.log(`${roots.length} work tree(s) checked: ${problems.length ? `${problems.length} refused` : 'every derived index is fresh and no record authors derived vocabulary'}`);
  process.exitCode = problems.length ? 1 : 0;
}
