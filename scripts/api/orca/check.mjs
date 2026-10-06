#!/usr/bin/env node
// check.mjs — the calls.yaml `check` call as a callable function: Orca's consuming FIFO Delivery of a Run's
// coordinator inbox (orchestration check).
// Internal entry: spawned by scripts/kernel/cli.mjs; not invoked directly.
// Args: --run <run_id> --terminal <coordinator_handle> [--ack <delivery_id>]
//
// check returns the Run's oldest unacknowledged batch (up to 50 messages, every type): {ok, deliveryId, messages,
// acked, error, errorCode, fenced, hostUnavailable}. With `ack` Orca first acknowledges that Delivery (idempotent: a
// second ack of it answers the same) and returns the next one; `acked` is Orca's result.acknowledged. The same
// batch replays until it is acknowledged, so a caller writes every message into the ledger first and only then calls
// check again with `ack: deliveryId` (map REPLACE #7, smoke E2: a process outside Orca names the Run and its
// coordinator terminal, here the Kernel's). Name the terminal: Orca resolves a caller that names none to whatever
// terminal it considers current (E2 measured a bare shell of another worktree).
// `fenced` is Orca's consumer_fenced: the terminal named is no longer the Run's consumer (a newer run-use).
// Each message is Orca's row {id, run_id, from_handle, to_handle, subject, body, type, thread_id, payload (JSON
// text), sequence, created_at}.
import { orcaCall } from './lib.mjs';
import { arg } from '../../lib/cli-arg.mjs';
import { isMain } from '../../lib/is-main.mjs';

/**
 * Reads a Run coordinator's unacknowledged delivery, optionally acknowledging the supplied delivery first.
 * Callers name the Run and coordinator terminal and persist every message before passing ack; unacknowledged batches replay.
 * A failed or malformed read returns ok false with a fallback messages array, which cannot prove an empty inbox.
 * Consumer fencing and host unavailability remain distinct from a successful empty delivery.
 */
export function check({ run, terminal, ack = null }) {
  const r = orcaCall('check', { run, terminal, ack });
  const messages = Array.isArray(r.result?.messages) ? r.result.messages : null;
  const errorCode = r.receipt?.error?.code ?? null;
  const ok = r.exitCode === 0 && Array.isArray(messages);
  let error = null;
  if (!ok) error = r.exitCode === 0 ? 'orchestration check returned no messages[]' : r.error;
  return {
    ok,
    deliveryId: ok ? r.result.deliveryId ?? null : null,
    messages: messages ?? [],
    acked: r.result?.acknowledged ?? null,
    error,
    errorCode,
    fenced: errorCode === 'consumer_fenced',
    hostUnavailable: r.hostUnavailable === true,
  };
}

if (isMain(import.meta.url)) {
  const argv = process.argv.slice(2);
  const out = check({ run: arg(argv, 'run'), terminal: arg(argv, 'terminal'), ack: arg(argv, 'ack') });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
