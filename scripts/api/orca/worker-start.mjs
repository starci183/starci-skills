#!/usr/bin/env node
// Deep map WRAP W3, R2, RR2: the runtime runs the receipt's recovery argv and keeps the no-effect proof; --retry-of is for a same-attempt infra retry only, a semantic retry is a new Task.
// worker-start.mjs — the calls.yaml `worker-start` call as a callable function.
//   node scripts/api/orca/worker-start.mjs --spec <text|path> --worktree <sel> --agent <agent> --run <run_id> --request <identity json>
//     [--task-title <t>] [--model <id>] [--effort <level>] [--name <n>] [--repo <sel>] [--base-branch <ref>]
//     [--display-name <t>] [--setup <run|skip|inherit>] [--timeout-ms <n>] [--from <handle>]
// --spec makes Orca create the worker's Task in the same call (no task-create, so a failed start leaves no orphan
// Task). calls.yaml declares replay: request: `request` is the caller's ledger identity (the job and its lease token
// for an op), and the first issue already carries the --retry-request id derived from it.
// Outcome and effectState come from the calls.yaml classify block; returns
// {ok, outcome, effectState, dispatchId, taskId, runId, agentTerminalHandle, state, launch, result, request}.
import { orcaCall, arg } from './lib.mjs';
import { isMain } from '../../lib/is-main.mjs';

export function workerStart({ spec, taskTitle, worktree, agent, model, effort, name, repo, baseBranch, displayName, setup, timeoutMs, run, from, request }) {
  const r = orcaCall('worker-start', {
    spec, 'task-title': taskTitle, worktree, agent, model, effort, name, repo,
    'base-branch': baseBranch, 'display-name': displayName, setup,
    'timeout-ms': timeoutMs, run, from,
  }, { request });
  const result = r.result;
  return {
    ok: r.outcome === 'ok',
    outcome: r.outcome,
    effectState: r.effectState,
    reason: r.reason ?? null,
    dispatchId: result?.dispatchId ?? null,
    taskId: result?.taskId ?? null,
    runId: result?.runId ?? null,
    agentTerminalHandle: result?.worker?.agentTerminalHandle ?? null,
    state: result?.state ?? result?.worker?.state ?? null,
    launch: result?.launch?.effective ?? null,
    result,
    request: r.request,
    errorCode: r.receipt?.error?.code ?? null,
    errorReceipt: r.receipt?.error ?? null,
    error: r.error,
    hostUnavailable: r.hostUnavailable === true,
  };
}

if (isMain(import.meta.url)) {
  const argv = process.argv.slice(2);
  const out = workerStart({
    spec: arg(argv, 'spec'),
    taskTitle: arg(argv, 'task-title'),
    worktree: arg(argv, 'worktree'),
    agent: arg(argv, 'agent'),
    model: arg(argv, 'model'),
    effort: arg(argv, 'effort'),
    name: arg(argv, 'name'),
    repo: arg(argv, 'repo'),
    baseBranch: arg(argv, 'base-branch'),
    displayName: arg(argv, 'display-name'),
    setup: arg(argv, 'setup'),
    timeoutMs: arg(argv, 'timeout-ms'),
    run: arg(argv, 'run'),
    from: arg(argv, 'from'),
    request: JSON.parse(arg(argv, 'request') ?? 'null'),
  });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
