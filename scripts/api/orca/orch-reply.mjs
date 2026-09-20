#!/usr/bin/env node
// orch-reply.mjs — `orca orchestration reply` as a callable function.
//   node scripts/api/orca/orch-reply.mjs --id <msg_id> --body <text> [--run <run_id>] [--from <handle>]
// Returns {ok, result}.
import { orcaRun, jsonOf, arg } from './lib.mjs';

export function orchReply({ id, body, run, from }) {
  if (!id) throw new Error('orchReply: missing required --id');
  if (!body) throw new Error('orchReply: missing required --body');
  const argv = ['orchestration', 'reply', '--id', id, '--body', body, '--json'];
  if (run) argv.push('--run', run);
  if (from) argv.push('--from', from);
  const r = orcaRun(argv);
  const result = jsonOf(r.stdout)?.result ?? null;
  return { ok: r.status === 0 && Boolean(result), result, error: r.error ?? r.stderr };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replaceAll('\\', '/')}`).href || process.argv[1]?.endsWith('orch-reply.mjs')) {
  const argv = process.argv.slice(2);
  const out = orchReply({ id: arg(argv, 'id'), body: arg(argv, 'body'), run: arg(argv, 'run'), from: arg(argv, 'from') });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
