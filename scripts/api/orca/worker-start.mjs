#!/usr/bin/env node
// worker-start.mjs — the calls.yaml `worker-start` call as a callable function.
//   node scripts/api/orca/worker-start.mjs --task <task_id> --worktree <sel> --agent <agent> --run <run_id>
//     [--model <id>] [--effort <level>] [--name <n>] [--repo <sel>] [--base-branch <ref>]
//     [--display-name <t>] [--setup <run|skip|inherit>] [--retry-of <dispatch>] [--timeout-ms <n>] [--from <handle>]
// Outcome and effectState come from the calls.yaml classify block; returns
// {ok, outcome, effectState, dispatchId, state, launch, result}.
import { orcaCall, arg } from './lib.mjs';

export function workerStart({ task, worktree, agent, model, effort, name, repo, baseBranch, displayName, setup, retryOf, timeoutMs, run, from }) {
  const r = orcaCall('worker-start', {
    task, worktree, agent, model, effort, name, repo,
    'base-branch': baseBranch, 'display-name': displayName, setup,
    'retry-of': retryOf, 'timeout-ms': timeoutMs, run, from,
  });
  const result = r.result;
  return {
    ok: r.outcome === 'ok',
    outcome: r.outcome,
    effectState: r.effectState,
    dispatchId: result?.dispatchId ?? null,
    state: result?.state ?? result?.worker?.state ?? null,
    launch: result?.launch?.effective ?? null,
    result,
    errorCode: r.receipt?.error?.code ?? null,
    errorReceipt: r.receipt?.error ?? null,
    error: r.error,
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
