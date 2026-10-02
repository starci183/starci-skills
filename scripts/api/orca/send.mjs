#!/usr/bin/env node
// send.mjs — the calls.yaml `send` call, for the one message the runtime sends: an op's worker_done.
// Internal entry: spawned by scripts/kernel/cli.mjs; not invoked directly.
// Args: --task-id <task> --dispatch-id <dispatch> --from <agent terminal>
//        --outcome succeeded|failed --dispatch-capability <the capability of your Orca preamble> [--report-path <path>] [--subject <text>]
// Issued only by `starci kernel report` (scripts/kernel/verbs/report.mjs), which runs inside the op's own pane after the
// report row committed, so Orca settles the op's Task and Dispatch from the dispatched pane (orca-deep-map REPLACE #9).
// No --to: Orca addresses a worker_done to the Dispatch's own Run mailbox. replay: request with the identity
// {dispatch, type}: a lost receipt is settled by request-show and one replay, never a second worker_done.
// Returns {ok, outcome, result, request, errorCode, error, hostUnavailable}.
import path from 'node:path';
import { orcaCall } from './lib.mjs';
import { arg } from '../../lib/cli-arg.mjs';

export function send({ taskId, dispatchId, from, outcome, reportPath = null, subject = null, dispatchCapability = null }) {
  if (!['succeeded', 'failed'].includes(outcome)) throw new Error(`worker_done --outcome must be succeeded|failed, got '${outcome}'`);
  const r = orcaCall('send', {
    type: 'worker_done', subject: subject ?? `worker_done ${outcome}`, 'task-id': taskId, 'dispatch-id': dispatchId,
    from, outcome, 'report-path': reportPath, 'dispatch-capability': dispatchCapability,
  }, { request: { dispatch: dispatchId, type: 'worker_done' } });
  const errorCode = typeof r.receipt?.error?.code === 'string' ? r.receipt.error.code : null;
  return { ok: r.exitCode === 0 && r.outcome === 'ok', outcome: r.outcome, result: r.result ?? null, request: r.request ?? null,
    errorCode, error: r.exitCode === 0 ? null : r.error, hostUnavailable: r.hostUnavailable === true };
}

if (path.basename(process.argv[1] ?? '') === 'send.mjs') {
  const argv = process.argv.slice(2);
  const out = send({ taskId: arg(argv, 'task-id'), dispatchId: arg(argv, 'dispatch-id'), from: arg(argv, 'from'),
    outcome: arg(argv, 'outcome'), reportPath: arg(argv, 'report-path'), subject: arg(argv, 'subject'), dispatchCapability: arg(argv, 'dispatch-capability') });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
