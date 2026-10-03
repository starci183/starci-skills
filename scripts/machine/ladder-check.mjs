// ladder-check.mjs - `starci check run`: choose the applicable existing runtime/app checks for one ladder level.
import fs from 'node:fs';
import path from 'node:path';
import { failedRunFinding } from '../lib/verb-call.mjs';
import { ladderRefusal, ladderResult, pathList, scopeFor } from './test-ladder.mjs';
import { RUNTIME_ROOT, repositoryKind, runStarci, selfChecksForChanges, workingChanges } from './ladder-select.mjs';

const SCHEMA = 'starci/check-run@1';

function examples(root, deps) {
  if (deps.examples) return pathList(deps.examples(root));
  const base = path.join(root, 'examples');
  try {
    return fs.readdirSync(base, { withFileTypes: true }).filter((entry) => entry.isDirectory() && fs.existsSync(path.join(base, entry.name, 'hfs.json')))
      .map((entry) => `examples/${entry.name}`).sort();
  } catch { return []; }
}

/** `starci check run`; it only selects and calls the existing runtime/app check entries. */
export async function checkRun(ctx, deps = {}) {
  const findingOf = (name, run) => failedRunFinding('check-red', { check: name }, run);
  const args = ctx?.args ?? {};
  const level = args.level ?? 'L1';
  const root = path.resolve(ctx?.cwd ?? process.cwd());
  if (level === 'L5') return ladderRefusal({ schema: SCHEMA, level, message: 'starci check run: L5 is CI only and never runs locally' });
  if (!['L0', 'L1', 'L2', 'L3', 'L4'].includes(level)) return ladderRefusal({ schema: SCHEMA, level, message: `starci check run: unsupported local level ${level}` });
  const model = scopeFor(level).checks;
  const changed = pathList(args.changed).length ? pathList(args.changed) : workingChanges(root, deps);
  const kind = repositoryKind(root, deps);
  const scope = [];
  const findings = [];

  if (kind === 'app') {
    const argv = ['app', 'check', ...(level === 'L0' || level === 'L1' ? ['--fast'] : [])];
    const run = runStarci(RUNTIME_ROOT, argv, { cwd: root, env: ctx?.env }, deps);
    scope.push(level === 'L0' || level === 'L1' ? 'app:fast' : 'app:full');
    if (!run.ok) findings.push(findingOf(scope.at(-1), run));
  } else if (level === 'L0') {
    scope.push('work-hygiene');
    const run = runStarci(RUNTIME_ROOT, ['app', 'hygiene'], { cwd: root, env: ctx?.env }, deps);
    if (!run.ok) findings.push(findingOf('work-hygiene', run));
  } else if (level === 'L1') {
    const selected = (deps.selfChecksForChanges ?? selfChecksForChanges)(root, changed, deps);
    for (const check of selected) {
      scope.push(check.id);
      const run = runStarci(RUNTIME_ROOT, ['runtime', 'check', '--only', check.id], { cwd: root, env: ctx?.env }, deps);
      if (!run.ok) findings.push(findingOf(check.id, run));
    }
  } else {
    scope.push('runtime:full');
    const run = runStarci(RUNTIME_ROOT, ['runtime', 'check'], { cwd: root, env: ctx?.env }, deps);
    if (!run.ok) findings.push(findingOf('runtime:full', run));
    if (level === 'L4') for (const example of examples(root, deps)) {
      scope.push(`${example}:app-check`);
      const checked = runStarci(RUNTIME_ROOT, ['app', 'check'], { cwd: path.join(root, example), env: ctx?.env }, deps);
      if (!checked.ok) findings.push(findingOf(`${example}:app-check`, checked));
    }
  }

  return ladderResult({ schema: SCHEMA, level, scope, ok: findings.length === 0, findings, changed, model });
}
