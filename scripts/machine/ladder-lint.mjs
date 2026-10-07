// ladder-lint.mjs - `starci lint run`: changed-file lint while working and whole-repository lint only at release cut.
import path from 'node:path';
import { failedRunFinding } from '../lib/verb-call.mjs';
import { ladderRefusal, ladderResult, pathList, scopeFor, unrunnableLevel } from './test-ladder.mjs';
import { RUNTIME_ROOT, changedPathsOf, repositoryKind, runStarci } from './ladder-select.mjs';

const SCHEMA = 'starci/lint-run@1';
export const RUNTIME_LINT_CHECKS = Object.freeze(['doc-language', 'helper-once', 'clones', 'export-used', 'env', 'specs']);

/** Lint-family self-checks relevant to the changed runtime paths. */
export function lintChecksForChanges(changed) {
  const files = pathList(changed);
  const code = files.some((file) => /\.(?:[cm]?js|ts|tsx)$/i.test(file));
  const prose = files.some((file) => /\.(?:md|ya?ml)$/i.test(file));
  const specs = files.some((file) => /(?:^|\/)tests?\/|\.spec\./i.test(file));
  return RUNTIME_LINT_CHECKS.filter((id) => {
    if (id === 'doc-language') return prose;
    if (id === 'specs') return specs;
    return code;
  });
}

// An app's lint: its changed files (the whole repository at L4 or with --all), one starci call.
function lintApp({ ctx, args, level, root, changed, deps }) {
  const scoped = level !== 'L4' && args.all !== true;
  const argv = ['app', 'lint', ...(scoped ? changed.flatMap((file) => ['--changed', file]) : []), ...(args.fix === true ? ['--fix'] : [])];
  const run = runStarci(RUNTIME_ROOT, argv, { cwd: root, env: ctx?.env }, deps);
  return { scope: scoped ? [...changed] : ['app:whole-repo'], findings: run.ok ? [] : [failedRunFinding('lint-red', { check: 'app:lint' }, run)] };
}

// The runtime's lint-family self-checks of one level, each run through the starci CLI.
function lintRuntime({ ctx, level, root, changed, deps }) {
  const checks = level === 'L0' || level === 'L1' ? (deps.lintChecksForChanges ?? lintChecksForChanges)(changed) : RUNTIME_LINT_CHECKS;
  const scope = [];
  const findings = [];
  for (const check of checks) {
    scope.push(check);
    const run = runStarci(RUNTIME_ROOT, ['runtime', 'check', '--only', check], { cwd: root, env: ctx?.env }, deps);
    if (!run.ok) findings.push(failedRunFinding('lint-red', { check }, run));
  }
  return { scope, findings };
}

/** `starci lint run`; process execution stays behind the starci CLI and is injectable with deps.runStarci. */
export async function lintRun(ctx, deps = {}) {
  const args = ctx?.args ?? {};
  const level = args.level ?? 'L1';
  const root = path.resolve(ctx?.cwd ?? process.cwd());
  const unrunnable = unrunnableLevel({ schema: SCHEMA, level, verb: 'starci lint run' });
  if (unrunnable) return unrunnable;
  if (args.all === true && level !== 'L4') return ladderRefusal({ schema: SCHEMA, level, message: 'starci lint run: --all is release scope and requires L4' });

  const changed = changedPathsOf(args, root, deps);
  const { scope, findings } = repositoryKind(root, deps) === 'app'
    ? lintApp({ ctx, args, level, root, changed, deps })
    : lintRuntime({ ctx, level, root, changed, deps });
  return ladderResult({ schema: SCHEMA, level, scope, ok: findings.length === 0, findings, changed, model: scopeFor(level).lint });
}
