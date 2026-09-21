#!/usr/bin/env node
// worker-start.mjs — `orca orchestration worker-start` as a callable function.
//   node scripts/api/orca/worker-start.mjs --task <task_id> --worktree <sel> --agent <agent> --run <run_id>
//     [--model <id>] [--effort <level>] [--name <n>] [--repo <sel>] [--base-branch <ref>]
//     [--display-name <t>] [--setup <run|skip|inherit>] [--retry-of <dispatch>] [--timeout-ms <n>] [--from <handle>]
// Applies the calls.yaml classify rules; returns {ok, outcome, effectState, dispatchId, state, launch, result}.
import { orcaRun, jsonOf, arg } from './lib.mjs';

const nonEmpty = (v) => Array.isArray(v) ? v.length > 0 : (v && typeof v === 'object' ? Object.keys(v).length > 0 : Boolean(v));

export function workerStart({ task, worktree, agent, model, effort, name, repo, baseBranch, displayName, setup, retryOf, timeoutMs, run, from }) {
  for (const [k, v] of [['task', task], ['worktree', worktree], ['agent', agent], ['run', run]]) {
    if (!v) throw new Error(`workerStart: missing required --${k}`);
  }
  const argv = ['orchestration', 'worker-start', '--task', task, '--worktree', worktree, '--agent', agent, '--run', run];
  if (model) argv.push('--model', model);
  if (effort) argv.push('--effort', effort);
  if (name) argv.push('--name', name);
  if (repo) argv.push('--repo', repo);
  if (baseBranch) argv.push('--base-branch', baseBranch);
  if (displayName) argv.push('--display-name', displayName);
  if (setup) argv.push('--setup', setup);
  if (retryOf) argv.push('--retry-of', retryOf);
  if (timeoutMs) argv.push('--timeout-ms', String(timeoutMs));
  if (from) argv.push('--from', from);
  argv.push('--json');
  const r = orcaRun(argv, { timeout: 150000 });
  const j = jsonOf(r.stdout);
  const result = j?.result ?? null;
  const errCode = j?.error?.code;
  const state = result?.state ?? result?.worker?.state ?? null;
  // calls.yaml worker-start classify, evaluated in contract order — first match wins.
  let outcome, effectState;
  if (r.status === 0 && (result?.state === 'ready' || result?.worker?.state === 'ready')) {
    outcome = 'ok'; effectState = 'committed';
  } else if (r.status === 0) {
    outcome = 'unknown'; effectState = 'unknown'; // exited 0 without a ready worker
  } else if (['outcome_unknown', 'unknown'].includes(result?.state) || ['outcome_unknown', 'unknown'].includes(result?.worker?.state)) {
    outcome = 'unknown'; effectState = 'unknown';
  } else if (nonEmpty(result?.residualResources) || nonEmpty(result?.worker?.residualResources)) {
    outcome = 'failed'; effectState = 'partial';
  } else if (result?.failedStage !== undefined && result?.failedStage !== null || result?.stage !== undefined && result?.stage !== null || errCode) {
    outcome = 'failed'; effectState = 'none';
  } else {
    outcome = 'unknown'; effectState = 'unknown'; // non-zero exit with no classifiable receipt
  }
  return {
    ok: outcome === 'ok',
    outcome,
    effectState,
    dispatchId: result?.dispatchId ?? null,
    state,
    launch: result?.launch?.effective ?? null,
    result,
    errorCode: errCode ?? null,
    errorReceipt: j?.error ?? null,
    error: r.error ?? r.stderr,
  };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replaceAll('\\', '/')}`).href || process.argv[1]?.endsWith('worker-start.mjs')) {
  const argv = process.argv.slice(2);
  const out = workerStart({
    task: arg(argv, 'task'),
    worktree: arg(argv, 'worktree'),
    agent: arg(argv, 'agent'),
    model: arg(argv, 'model'),
    effort: arg(argv, 'effort'),
    name: arg(argv, 'name'),
    repo: arg(argv, 'repo'),
    baseBranch: arg(argv, 'base-branch'),
    displayName: arg(argv, 'display-name'),
    setup: arg(argv, 'setup'),
    retryOf: arg(argv, 'retry-of'),
    timeoutMs: arg(argv, 'timeout-ms'),
    run: arg(argv, 'run'),
    from: arg(argv, 'from'),
  });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
