// ladder-lint.mjs - `starci lint run`: changed-file lint while working and whole-repository lint only at release cut.
import path from 'node:path';
import { ladderRefusal, ladderResult, pathList, scopeFor } from './test-ladder.mjs';
import { RUNTIME_ROOT, repositoryKind, runStarci, workingChanges } from './ladder-select.mjs';

const SCHEMA = 'starci/lint-run@1';
export const RUNTIME_LINT_CHECKS = Object.freeze(['doc-language', 'helper-once', 'clones', 'export-used', 'env', 'specs']);

/** Lint-family self-checks relevant to the changed runtime paths. */
export function lintChecksForChanges(changed) {
  const files = pathList(changed);
  const code = files.some((file) => /\.(?:[cm]?js|ts|tsx)$/i.test(file));
  const prose = files.some((file) => /\.(?:md|ya?ml)$/i.test(file));
  const specs = files.some((file) => /(?:^|\/)tests?\/|\.spec\./i.test(file));
  return RUNTIME_LINT_CHECKS.filter((id) => id === 'doc-language' ? prose : id === 'specs' ? specs : code);
}

const findingOf = (name, run) => ({ kind: 'lint-red', check: name, status: run.status, message: (run.stderr || run.stdout || `${name} exited ${run.status}`).trim().slice(-2000) });

/** `starci lint run`; process execution stays behind the starci CLI and is injectable with deps.runStarci. */
export async function lintRun(ctx, deps = {}) {
  const args = ctx?.args ?? {};
  const level = args.level ?? 'L1';
  const root = path.resolve(ctx?.cwd ?? process.cwd());
  if (level === 'L5') return ladderRefusal({ schema: SCHEMA, level, message: 'starci lint run: L5 is CI only and never runs locally' });
  if (!['L0', 'L1', 'L2', 'L3', 'L4'].includes(level)) return ladderRefusal({ schema: SCHEMA, level, message: `starci lint run: unsupported local level ${level}` });
  if (args.all === true && level !== 'L4') return ladderRefusal({ schema: SCHEMA, level, message: 'starci lint run: --all is release scope and requires L4' });

  const changed = pathList(args.changed).length ? pathList(args.changed) : workingChanges(root, deps);
  const kind = repositoryKind(root, deps);
  const scope = [];
  const findings = [];
  if (kind === 'app') {
    const scoped = level !== 'L4' && args.all !== true;
    const argv = ['app', 'lint', ...(scoped ? changed.flatMap((file) => ['--changed', file]) : []), ...(args.fix === true ? ['--fix'] : [])];
    const run = runStarci(RUNTIME_ROOT, argv, { cwd: root, env: ctx?.env }, deps);
    scope.push(...(scoped ? changed : ['app:whole-repo']));
    if (!run.ok) findings.push(findingOf('app:lint', run));
  } else {
    const checks = level === 'L0' || level === 'L1' ? (deps.lintChecksForChanges ?? lintChecksForChanges)(changed) : RUNTIME_LINT_CHECKS;
    for (const check of checks) {
      scope.push(check);
      const run = runStarci(RUNTIME_ROOT, ['runtime', 'check', '--only', check], { cwd: root, env: ctx?.env }, deps);
      if (!run.ok) findings.push(findingOf(check, run));
    }
  }
  return ladderResult({ schema: SCHEMA, level, scope, ok: findings.length === 0, findings, changed, model: scopeFor(level).lint });
}
