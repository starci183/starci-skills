#!/usr/bin/env node
// orch-send.mjs — `orca orchestration send` as a callable function.
//   node scripts/api/orca/orch-send.mjs --subject <text> [--to <run:id|dispatch:id|handle>] [--run <run_id>] [--from <handle>]
//     [--body <text>] [--type <t>] [--priority <l>] [--thread-id <id>] [--payload <json>] [--task-id <id>]
//     [--dispatch-id <id>] [--outcome <succeeded|failed>] [--files-modified <csv>] [--report-path <p>] [--phase <t>]
// Returns {ok, result}. --payload is JSON (objects serialized); --files-modified is csv (arrays joined).
import { orcaRun, jsonOf, arg } from './lib.mjs';

export function orchSend({ subject, to, run, from, body, type, priority, threadId, payload, taskId, dispatchId, dispatchCapability, outcome, filesModified, reportPath, phase }) {
  if (!subject) throw new Error('orchSend: missing required --subject');
  const argv = ['orchestration', 'send', '--subject', subject, '--json'];
  if (to) argv.push('--to', to);
  if (run) argv.push('--run', run);
  if (from) argv.push('--from', from);
  if (body) argv.push('--body', body);
  if (type) argv.push('--type', type);
  if (priority) argv.push('--priority', priority);
  if (threadId) argv.push('--thread-id', threadId);
  if (payload !== undefined && payload !== null) argv.push('--payload', typeof payload === 'string' ? payload : JSON.stringify(payload));
  if (taskId) argv.push('--task-id', taskId);
  if (dispatchId) argv.push('--dispatch-id', dispatchId);
  if (dispatchCapability) argv.push('--dispatch-capability', dispatchCapability);
  if (outcome) argv.push('--outcome', outcome);
  if (filesModified) argv.push('--files-modified', Array.isArray(filesModified) ? filesModified.join(',') : filesModified);
  if (reportPath) argv.push('--report-path', reportPath);
  if (phase) argv.push('--phase', phase);
  const r = orcaRun(argv);
  const result = jsonOf(r.stdout)?.result ?? null;
  return { ok: r.status === 0 && Boolean(result), result, error: r.error ?? r.stderr };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replaceAll('\\', '/')}`).href || process.argv[1]?.endsWith('orch-send.mjs')) {
  const argv = process.argv.slice(2);
  const out = orchSend({
    subject: arg(argv, 'subject'),
    to: arg(argv, 'to'),
    run: arg(argv, 'run'),
    from: arg(argv, 'from'),
    body: arg(argv, 'body'),
    type: arg(argv, 'type'),
    priority: arg(argv, 'priority'),
    threadId: arg(argv, 'thread-id'),
    payload: arg(argv, 'payload'),
    taskId: arg(argv, 'task-id'),
    dispatchId: arg(argv, 'dispatch-id'),
    dispatchCapability: arg(argv, 'dispatch-capability'),
    outcome: arg(argv, 'outcome'),
    filesModified: arg(argv, 'files-modified'),
    reportPath: arg(argv, 'report-path'),
    phase: arg(argv, 'phase'),
  });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
