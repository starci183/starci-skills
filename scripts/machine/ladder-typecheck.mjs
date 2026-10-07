// ladder-typecheck.mjs - `starci typecheck run`: Node syntax for runtime JS and tsc for the app projects in scope.
import path from 'node:path';
import { syntaxCheck } from '../api/node/syntax-check.mjs';
import { runNode } from '../api/node/run-node.mjs';
import { failedRunFinding } from '../lib/verb-call.mjs';
import { ladderResult, pathList, scopeFor, unrunnableLevel } from './test-ladder.mjs';
import { changedPathsOf, projectsForChanges, repositoryKind, runOutcome, tracked, typeScriptProjects } from './ladder-select.mjs';
import { byCodeUnit } from '../lib/list.mjs';

const SCHEMA = 'starci/typecheck-run@1';
const RUNTIME_SOURCE = /^(?:engine|scripts|modules|bin)\/.*\.(?:mjs|cjs)$/i;

function runtimeSources(root, level, changed, deps) {
  if (level === 'L0' || level === 'L1') return pathList(changed).filter((file) => RUNTIME_SOURCE.test(file));
  return [...tracked(root, '*.mjs', deps), ...tracked(root, '*.cjs', deps)].filter((file) => RUNTIME_SOURCE.test(file)).sort(byCodeUnit);
}

function checkSyntax(root, files, deps) {
  const findings = [];
  const run = deps.syntaxCheck ?? syntaxCheck;
  for (const file of files) {
    const result = run(path.join(root, file));
    if (!result?.ok) findings.push({ kind: 'syntax-red', file, message: String(result?.stderr ?? `${file} did not parse`).trim().slice(-2000) });
  }
  return findings;
}

function runProject(root, project, deps) {
  if (deps.runTypeScript) return runOutcome(deps.runTypeScript({ root, project }));
  const tsc = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc');
  return runOutcome((deps.runNode ?? runNode)([tsc, '--noEmit', '-p', project], { cwd: root, maxBuffer: 64 * 1024 * 1024 }));
}

// The TypeScript projects an app checks when none is named: every project at L4, else those the change touches (affected ones at L2/L3).
function defaultProjects({ root, level, changed, deps }) {
  const all = typeScriptProjects(root, deps);
  if (level === 'L4') return all;
  return projectsForChanges(all, changed, { affected: level === 'L2' || level === 'L3' });
}

/** `starci typecheck run`; projects can be supplied explicitly or are selected from the changed paths. */
export async function typecheckRun(ctx, deps = {}) {
  const findingOf = (project, run) => failedRunFinding('typecheck-red', { project }, run, { limit: 4000 });
  const args = ctx?.args ?? {};
  const level = args.level ?? 'L1';
  const root = path.resolve(ctx?.cwd ?? process.cwd());
  const unrunnable = unrunnableLevel({ schema: SCHEMA, level, verb: 'starci typecheck run' });
  if (unrunnable) return unrunnable;
  const changed = changedPathsOf(args, root, deps);
  const explicit = pathList(args.project);
  const kind = repositoryKind(root, deps);
  const scope = [];
  const findings = [];

  const checkProjects = (projects) => {
    for (const project of projects) {
      scope.push(project);
      const run = runProject(root, project, deps);
      if (!run.ok) findings.push(findingOf(project, run));
    }
  };

  if (kind === 'runtime') {
    const sources = runtimeSources(root, level, changed, deps);
    scope.push(...sources);
    findings.push(...checkSyntax(root, sources, deps));
    if (level === 'L4' || explicit.length) checkProjects(explicit.length ? explicit : typeScriptProjects(root, deps));
  } else checkProjects(explicit.length ? explicit : defaultProjects({ root, level, changed, deps }));

  return ladderResult({ schema: SCHEMA, level, scope, ok: findings.length === 0, findings, changed, model: scopeFor(level).typecheck });
}
