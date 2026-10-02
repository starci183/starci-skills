#!/usr/bin/env node
// Deep map WRAP M2: the reply is Orca's; the ledger disposition of the worker question stays the runtime's.
// reply.mjs — the calls.yaml `reply` call as a callable function.
//   node scripts/api/orca/reply.mjs --id <msg_id> --body <text> [--run <run_id>]
// Answers one worker `question` message; the worker's blocking
// `orca orchestration ask` returns with this body. --from is left to Orca,
// which resolves it from the calling terminal (the Kernel's own). Returns
// {ok, result, error}. Only scripts/kernel/cli.mjs `reply` issues it.
import { orcaCall } from './lib.mjs';
import { arg } from '../../lib/cli-arg.mjs';
import { isMain } from '../../lib/is-main.mjs';

export function reply({ id, body, run = null }) {
  const r = orcaCall('reply', { id, body, run });
  return { ok: r.exitCode === 0 && r.outcome === 'ok', outcome: r.outcome, result: r.result, error: r.exitCode === 0 ? null : r.error };
}

if (isMain(import.meta.url)) {
  const argv = process.argv.slice(2);
  const out = reply({ id: arg(argv, 'id'), body: arg(argv, 'body'), run: arg(argv, 'run') });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
