// ladder-check.mjs - `starci check run`: choose the applicable existing runtime/app checks for one ladder level.
import fs from 'node:fs';
import path from 'node:path';
import { failedRunFinding } from '../lib/verb-call.mjs';
import { ladderResult, pathList, scopeFor, unrunnableLevel } from './test-ladder.mjs';
import { RUNTIME_ROOT, changedPathsOf, repositoryKind, runStarci, selfChecksForChanges } from './ladder-select.mjs';

const SCHEMA = 'starci/check-run@1';

function examples(root, deps) {
  if (deps.examples) return pathList(deps.examples(root));
  const base = path.join(root, 'examples');
  try {
    return fs.readdirSync(base, { withFileTypes: true }).filter((entry) => entry.isDirectory() && fs.existsSync(path.join(base, entry.name, 'hfs.json')))
      .map((entry) => `examples/${entry.name}`).sort();
  } catch { return []; }
}

// The starci check calls one level makes for a repository kind: { scope, findings }.
function levelChecks({ ctx, level, root, changed, kind, deps }) {
  const scope = [];
  const findings = [];
  // One starci call: its scope entry first, a finding when it ends red.
  const call = (name, argv, cwd = root) => {
    scope.push(name);
    const run = runStarci(RUNTIME_ROOT, argv, { cwd, env: ctx?.env }, deps);
    if (!run.ok) findings.push(failedRunFinding('check-red', { check: name }, run));
  };
  if (kind === 'app') {
    const fast = level === 'L0' || level === 'L1';
    call(fast ? 'app:fast' : 'app:full', ['app', 'check', ...(fast ? ['--fast'] : [])]);
  } else if (level === 'L0') call('work-hygiene', ['app', 'hygiene']);
  else if (level === 'L1') {
    for (const check of (deps.selfChecksForChanges ?? selfChecksForChanges)(root, changed, deps)) call(check.id, ['runtime', 'check', '--only', check.id]);
  } else {
    call('runtime:full', ['runtime', 'check']);
    if (level === 'L4') for (const example of examples(root, deps)) call(`${example}:app-check`, ['app', 'check'], path.join(root, example));
  }
  return { scope, findings };
}

/** `starci check run`; it only selects and calls the existing runtime/app check entries. */
export async function checkRun(ctx, deps = {}) {
  const args = ctx?.args ?? {};
  const level = args.level ?? 'L1';
  const root = path.resolve(ctx?.cwd ?? process.cwd());
  const unrunnable = unrunnableLevel({ schema: SCHEMA, level, verb: 'starci check run' });
  if (unrunnable) return unrunnable;
  const model = scopeFor(level).checks;
  const changed = changedPathsOf(args, root, deps);
  const { scope, findings } = levelChecks({ ctx, level, root, changed, kind: repositoryKind(root, deps), deps });
  return ladderResult({ schema: SCHEMA, level, scope, ok: findings.length === 0, findings, changed, model });
}
