#!/usr/bin/env node
// orch-inbox.mjs — the calls.yaml `inbox` call as a callable function.
//   node scripts/api/orca/orch-inbox.mjs [--limit <n>]
// A read across recipients that consumes nothing: no Delivery is acknowledged
// and no message is marked read. Returns {ok, messages[]} — each message is
// Orca's row {id, run_id, from_handle, to_handle, subject, body, type,
// thread_id, payload (JSON text), read, sequence, created_at}, newest first.
// scripts/kernel/api.mjs reads worker `question` messages through it: the
// Kernel may not call Orca, so this is how an `orca orchestration ask` a worker
// sent its coordinator reaches the ledger (inc-b944cbaef24b, inc-20449a260df8).
import { orcaCall, arg } from './lib.mjs';

export function orchInbox({ limit = null } = {}) {
  const r = orcaCall('inbox', { limit });
  const messages = r.result?.messages;
  return {
    ok: r.exitCode === 0 && Array.isArray(messages),
    messages: Array.isArray(messages) ? messages : [],
    error: r.exitCode === 0 && !Array.isArray(messages) ? 'orchestration inbox returned no messages[]' : r.error,
  };
}

if (process.argv[1]?.endsWith('orch-inbox.mjs')) {
  const out = orchInbox({ limit: arg(process.argv.slice(2), 'limit') });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
