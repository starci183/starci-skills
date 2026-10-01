#!/usr/bin/env node
// why-backfill.mjs — DRY RUN: compute the `why` (scripts/kernel/why.mjs) of every attempt of a registered ledger that
// needs one and print it. Read-only: the ledger is opened with openLedgerReader, nothing is written and there is no apply
// mode (op_attempts.why_json of an old attempt is computed on read by whyOf; only the runtime writes the stored column).
//   node scripts/supervisor/why-backfill.mjs [--ledger <name>] [--workflow <id>] [--op <op>] [--state failed|blocked|...] [--json]
import { readMachine } from '../../engine/db/machine.mjs';
import { openLedgerReader } from '../../engine/db/ledger.mjs';
import { whyOf } from '../kernel/why.mjs';

const argv = process.argv.slice(2);
const flag = (name) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : null; };
const asJson = argv.includes('--json');
const ledgerName = flag('ledger') ?? 'nivo-backend';
const ledgers = readMachine((m) => m.db.prepare("SELECT name, repo_root, file FROM ledgers WHERE state='active' AND name=?").all(ledgerName), []);
if (!ledgers.length) { console.error(`no active registered ledger named ${ledgerName}`); process.exit(2); }

const reader = openLedgerReader(ledgers[0].file);
const out = [];
try {
  const where = ['1=1'], args = [];
  if (flag('workflow')) { where.push('workflow_id=?'); args.push(flag('workflow')); }
  if (flag('op')) { where.push('op_id=?'); args.push(flag('op')); }
  for (const a of reader.prepare(`SELECT * FROM op_attempts WHERE ${where.join(' AND ')} ORDER BY workflow_id, attempt_id`).all(...args)) {
    const why = whyOf(reader, a);
    if (!why || (flag('state') && why.state !== flag('state'))) continue;
    out.push({ workflowId: a.workflow_id, ...why });
  }
} finally { try { reader.close(); } catch { /* read only */ } }

if (asJson) console.log(JSON.stringify({ ledger: ledgerName, dryRun: true, count: out.length, whys: out }, null, 2));
else {
  console.log(`why-backfill DRY RUN (${ledgerName}): ${out.length} attempt(s) need a why; nothing was written`);
  for (const w of out) {
    console.log(`\n${w.workflowId} attempt ${w.attemptId} ${w.opId} try ${w.tryNo} [${w.state}] owner=${w.owner}`);
    console.log(`  headline: ${w.headline}`);
    console.log(`  cause: ${w.cause}`);
    if (w.disagreement) console.log(`  disagreement: ${w.disagreement}`);
    console.log(`  next: ${w.next}`);
    if (w.codes.length) console.log(`  codes: ${w.codes.join(', ')}`);
  }
}
