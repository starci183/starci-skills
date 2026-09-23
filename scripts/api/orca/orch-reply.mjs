#!/usr/bin/env node
// orch-reply.mjs — the calls.yaml `reply` call as a callable function.
//   node scripts/api/orca/orch-reply.mjs --id <msg_id> --body <text> [--run <run_id>]
// Answers one worker `question` message; the worker's blocking
// `orca orchestration ask` returns with this body. --from is left to Orca,
// which resolves it from the calling terminal (the Kernel's own). Returns
// {ok, result, error}. Only scripts/kernel/api.mjs `reply` issues it.
import { orcaCall, arg } from './lib.mjs';

export function orchReply({ id, body, run = null }) {
  const r = orcaCall('reply', { id, body, run });
  return { ok: r.exitCode === 0 && r.outcome === 'ok', outcome: r.outcome, result: r.result, error: r.exitCode === 0 ? null : r.error };
}

if (process.argv[1]?.endsWith('orch-reply.mjs')) {
  const argv = process.argv.slice(2);
  const out = orchReply({ id: arg(argv, 'id'), body: arg(argv, 'body'), run: arg(argv, 'run') });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
