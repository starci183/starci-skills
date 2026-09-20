#!/usr/bin/env node
// orch-check.mjs — `orca orchestration check` as a callable function.
//   node scripts/api/orca/orch-check.mjs [--terminal <handle>] [--run <run_id>] [--ack <delivery_id>]
//     [--unread] [--peek] [--all] [--types <type,...>] [--wait] [--timeout-ms <n>]
// --ack takes the prior Delivery id; --wait blocks up to --timeout-ms (keepalive on stderr).
// Returns {ok, result} — a wait timeout is ok with an empty batch. Wrapper timeout: 960000 (contract).
import { orcaRun, jsonOf, arg, flag } from './lib.mjs';

export function orchCheck({ terminal, run, ack, unread, peek, all, types, wait, timeoutMs } = {}) {
  const argv = ['orchestration', 'check', '--json'];
  if (terminal) argv.push('--terminal', terminal);
  if (run) argv.push('--run', run);
  if (ack) argv.push('--ack', ack);
  if (unread) argv.push('--unread');
  if (peek) argv.push('--peek');
  if (all) argv.push('--all');
  if (types) argv.push('--types', Array.isArray(types) ? types.join(',') : types);
  if (wait) argv.push('--wait');
  if (timeoutMs) argv.push('--timeout-ms', String(timeoutMs));
  const r = orcaRun(argv, { timeout: 960000 });
  const result = jsonOf(r.stdout)?.result ?? null;
  return { ok: r.status === 0, result, error: r.error ?? r.stderr };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replaceAll('\\', '/')}`).href || process.argv[1]?.endsWith('orch-check.mjs')) {
  const argv = process.argv.slice(2);
  const out = orchCheck({
    terminal: arg(argv, 'terminal'),
    run: arg(argv, 'run'),
    ack: arg(argv, 'ack'),
    unread: flag(argv, 'unread'),
    peek: flag(argv, 'peek'),
    all: flag(argv, 'all'),
    types: arg(argv, 'types'),
    wait: flag(argv, 'wait'),
    timeoutMs: arg(argv, 'timeout-ms'),
  });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
