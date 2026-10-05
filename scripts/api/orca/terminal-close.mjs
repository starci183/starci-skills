#!/usr/bin/env node
// Deep map WRAP T5: closes restored tabs no ledger binds and bare shells; a worker terminal is released with worker-release (T3).
// terminal-close.mjs — the calls.yaml `terminal-close` call as a callable function.
// Internal entry: spawned by scripts/kernel/close-op-terminal.mjs; not invoked directly.
// Args: --terminal <handle> [--tab]
// A runtime-owned background terminal has no renderer tab: Orca stops its PTY
// (terminal show then reports connected:false, exitCause operator_close) but
// answers the close with `runtime_error: tab_not_found`. That refusal is
// re-checked with terminal show, and the close counts only when show proves
// the exact terminal is disconnected (verifiedBy: 'terminal-show').
import { orcaCall } from './lib.mjs';
import { arg, flag } from '../../lib/cli-arg.mjs';
import { sleepSync } from '../../lib/sleep-sync.mjs';
import { terminalShow } from './terminal-show.mjs';

const CLOSE_VERIFY_MS = 5000;
const CLOSE_VERIFY_INTERVAL_MS = 500;

const receiptMessage = (receipt) => {
  const e = receipt?.error;
  return typeof e === 'string' ? e : (e?.message ?? null);
};

/**
 * Request closure of the caller-owned terminal or its tab; this call does not establish ownership.
 * A successful close receipt is accepted. A tab_not_found refusal is accepted only after bounded
 * terminal-show reads prove the same handle disconnected. Complete managed-worker teardown belongs
 * to scripts/machine/worker-close.mjs, which also verifies the worker's process tree.
 * @param {object} input - Required terminal handle and optional tab closure selector.
 * @returns {object} Closure acceptance, error, and any terminal-show verification and exit cause.
 */
export function terminalClose({ terminal, tab = false }) {
  const r = orcaCall('terminal-close', { terminal, tab });
  if (r.exitCode === 0) return { ok: true, error: r.error };
  if (receiptMessage(r.receipt) === 'tab_not_found') {
    // The PTY stop lands a moment after the answer: re-read for a bounded 5s.
    for (let waited = 0; waited <= CLOSE_VERIFY_MS; waited += CLOSE_VERIFY_INTERVAL_MS) {
      if (waited > 0) sleepSync(CLOSE_VERIFY_INTERVAL_MS);
      const shown = terminalShow({ terminal });
      if (!shown.ok || !shown.terminal) break;
      if (shown.connected === false)
        return { ok: true, verifiedBy: 'terminal-show', exitCause: shown.exitCause ?? null, error: null };
    }
  }
  return { ok: false, error: r.error };
}

if (process.argv[1]?.endsWith('terminal-close.mjs')) {
  const argv = process.argv.slice(2);
  const out = terminalClose({ terminal: arg(argv, 'terminal'), tab: flag(argv, 'tab') });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
