#!/usr/bin/env node
// orch-inbox.mjs — the calls.yaml `inbox` call as a callable function.
//   node scripts/api/orca/orch-inbox.mjs [--limit <n>] [--all]
// A read across recipients that consumes nothing: no Delivery is acknowledged
// and no message is marked read. Returns {ok, messages[]} — each message is
// Orca's row {id, run_id, from_handle, to_handle, subject, body, type,
// thread_id, payload (JSON text), read, sequence, created_at}, newest first.
// scripts/kernel/api.mjs reads worker `question` messages through it: the
// Kernel may not call Orca, so this is how an `orca orchestration ask` a worker
// sent its coordinator reaches the ledger (inc-b944cbaef24b, inc-20449a260df8).
import { orcaCall, arg, flag } from './lib.mjs';

// Worker liveness chatter is never a question or a reply: a nivo run's inbox
// was mostly `heartbeat` rows (2616 of 4653), which is what pushed the read
// past spawnSync's buffer (inc-13ab4be5059f). They are dropped before any
// caller bridges the rest; `status` rows stay because Orca threads replies as
// status messages. --all keeps them for inspection.
export const INBOX_NOISE_TYPES = new Set(['heartbeat', 'progress']);

export function orchInbox({ limit = null, all = false } = {}) {
  const r = orcaCall('inbox', { limit });
  const messages = r.result?.messages;
  const listed = Array.isArray(messages) ? messages : [];
  const kept = all ? listed : listed.filter((message) => !INBOX_NOISE_TYPES.has(String(message?.type ?? '')));
  return {
    ok: r.exitCode === 0 && Array.isArray(messages),
    messages: kept,
    dropped: listed.length - kept.length,
    error: r.exitCode === 0 && !Array.isArray(messages) ? 'orchestration inbox returned no messages[]' : r.error,
  };
}

if (process.argv[1]?.endsWith('orch-inbox.mjs')) {
  const argv = process.argv.slice(2);
  const out = orchInbox({ limit: arg(argv, 'limit'), all: flag(argv, 'all') });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
