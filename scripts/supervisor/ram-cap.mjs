#!/usr/bin/env node
// ram-cap.mjs — the Supervisor's handle on the RAM-aware dispatch cap (scripts/machine/ram-throttle.mjs).
//
//   node scripts/supervisor/ram-cap.mjs status [--op <kind>] [--workflow <id>] [--json]
//        the effective cap on this host now and why: mode, free RAM, CPU, running ops across every ledger, the
//        per-op RAM estimates (table or footprint history), the priorities, and - with --op - how one op would be
//        admitted
//   node scripts/supervisor/ram-cap.mjs prioritize --workflow <id> --weight <n> [--reserve <slots>] [--json]
//        this host's priority override for one workflow (weight 1 is everyone's default; a higher weight is
//        admitted first and keeps `reserve` slots and the RAM its queued ops need from lower workflows)
//   node scripts/supervisor/ram-cap.mjs unprioritize --workflow <id> [--json]
//        drop the host override; runtimes.yaml allocation.resources.ramThrottle.priorities applies again
//
// The override lives in machine.sqlite throttle_state.priorities_json, read by every dispatch of every workflow on
// this host.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hostThrottle, setPriority, throttleLine, readThrottleState, priorityTable } from '../machine/ram-throttle.mjs';
import { isMain } from '../lib/is-main.mjs';


function main(argv) {
  const [verb] = argv;
  const opt = (name) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : null; };
  const json = argv.includes('--json');
  const out = (value, text) => console.log(json ? JSON.stringify(value) : text);
  if (verb === 'prioritize' || verb === 'unprioritize') {
    const workflowId = opt('workflow');
    if (!workflowId) { console.error(`${verb} needs --workflow <id>`); return 2; }
    const weight = verb === 'prioritize' ? Number(opt('weight')) : null;
    if (verb === 'prioritize' && !(weight > 0)) { console.error('prioritize needs --weight <positive number>'); return 2; }
    const ok = setPriority({ workflowId, weight, reserve: Number(opt('reserve') ?? 0) });
    const priorities = priorityTable(null, readThrottleState());
    out({ ok, workflowId, priority: priorities[workflowId] ?? { weight: 1, reserve: 0 }, store: 'machine.sqlite throttle_state' },
      `${ok ? 'set' : 'FAILED'}: ${workflowId} ${JSON.stringify(priorities[workflowId] ?? { weight: 1, reserve: 0 })} (machine.sqlite throttle_state)`);
    return ok ? 0 : 1;
  }
  if (verb === 'status' || !verb) {
    const t = hostThrottle({ op: opt('op'), workflowId: opt('workflow') });
    const estimates = Object.entries(t.estimates).map(([kind, e]) => `  ${kind.padEnd(22)} ${String(e.mb).padStart(5)} MB ${e.class.padEnd(5)} ${e.source}${e.observations ? ` (${e.observations} obs)` : ''}`);
    out({ ...t, host: { freeRamPct: t.host.freeRamPct, totalRamBytes: t.host.totalRamBytes, freeRamBytes: t.host.freeRamBytes }, line: throttleLine(t) }, [
      throttleLine(t),
      `running by kind: ${Object.entries(t.runningByKind).map(([k, n]) => `${k} ${n}`).join(', ') || '-'}; queued ${t.queued}; kernels ${t.kernels}`,
      ...(t.admission ? [`admission of ${t.admission.op}${t.admission.workflowId ? ` for ${t.admission.workflowId}` : ''}: ${t.admission.ok ? 'ADMIT' : `WAIT ${t.admission.reason} - ${t.admission.detail}`}`] : []),
      'estimates:', ...estimates,
    ].join('\n'));
    return 0;
  }
  console.error('use: ram-cap.mjs status [--op <kind>] [--workflow <id>] | prioritize --workflow <id> --weight <n> [--reserve <slots>] | unprioritize --workflow <id>  [--json]');
  return 2;
}

if (isMain(import.meta.url)) process.exit(main(process.argv.slice(2)));
