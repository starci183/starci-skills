#!/usr/bin/env node
// terminal-create.mjs — the calls.yaml `terminal-create` call as a callable function.
//   node scripts/api/orca/terminal-create.mjs --worktree <path|sel> --title <t> --command <cmd> [--json]
// Prints the create receipt; stdout JSON always carries {ok, handle, terminal}.
// A refused create carries Orca's receipt error code (for example
// `selector_not_found` when the worktree is not a registered Orca repo) in
// `errorCode` and leads `error` with it.
import { orcaCall, arg } from './lib.mjs';

function receiptError(r) {
  const e = r.receipt?.error;
  const code = typeof e === 'object' && e ? (e.code ?? null) : null;
  const message = typeof e === 'string' ? e : (e?.message ?? null);
  const detail = [code, message].filter(Boolean).join(': ');
  return { errorCode: code, error: detail || r.error || (r.exitCode === 0 ? '' : `orca terminal create exited ${r.exitCode}`) };
}

// A refusal Orca issues before it touches the renderer or a PTY. Any other
// handle-less answer (runtime_error "Timed out waiting for terminal handle
// after creation", a killed or unparsable CLI) may have created the tab, so
// effectUnknown tells the caller to reconcile by listing the worktree.
const NO_EFFECT_CODES = new Set(['selector_not_found', 'invalid_argument', 'runtime_unavailable']);

export function terminalCreate({ worktree, title, command }) {
  const r = orcaCall('terminal-create', { worktree, title, command });
  const terminal = r.result?.terminal ?? null;
  const ok = r.exitCode === 0 && Boolean(terminal?.handle);
  const { errorCode, error } = ok ? { errorCode: null, error: r.error } : receiptError(r);
  const effectUnknown = !ok && r.reason !== 'host-contract-drift' && !NO_EFFECT_CODES.has(errorCode);
  return { ok, handle: terminal?.handle ?? null, terminal, errorCode, error, effectUnknown };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replaceAll('\\', '/')}`).href || process.argv[1]?.endsWith('terminal-create.mjs')) {
  const argv = process.argv.slice(2);
  const out = terminalCreate({ worktree: arg(argv, 'worktree'), title: arg(argv, 'title'), command: arg(argv, 'command') });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
