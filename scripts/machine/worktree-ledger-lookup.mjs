// worktree-ledger-lookup.mjs - the GC's read-only owner lookups over every registered ledger (scripts/machine/worktrees.mjs):
// a job's status and a workflow's phase. A ledger that could hold the row but cannot be read answers LEDGER_UNREADABLE,
// never null: "no ledger knows this owner" (owner-unknown) is a finding about the ledgers, an unreadable ledger is not.
import fs from 'node:fs';
import { withRegistry } from './worktree-registry.mjs';
import { openLedgerReader } from '../../engine/db/ledger.mjs';

/** The answer for an owner whose ledger exists in the registry but could not be read: not ended, not settled, not unknown. */
export const LEDGER_UNREADABLE = 'ledger-unreadable';

/**
 * The default owner lookups, cached for one pass: lookup(ledgerId, jobId) -> job status | null | LEDGER_UNREADABLE, with
 * .workflowPhase(ledgerId, workflowId) -> phase | null | LEDGER_UNREADABLE and .close().
 */
export function ledgerLookup(env) {
  const cache = new Map();
  let ledgers = null;
  const readers = new Map();
  const readerOf = (file) => {
    if (!file || !fs.existsSync(file)) return null;
    if (!readers.has(file)) { try { readers.set(file, openLedgerReader(file)); } catch { readers.set(file, null); } }
    return readers.get(file);
  };
  const ask = (ledgerId, k, sql, ...args) => {
    const ck = `${k}\0${ledgerId ?? '*'}\0${args.join('\0')}`;
    if (cache.has(ck)) return cache.get(ck);
    let value = null;
    try {
      ledgers ??= withRegistry((m) => m.listLedgers(), env);
      for (const l of ledgers.filter((x) => !ledgerId || x.ledgerId === ledgerId)) {
        const reader = readerOf(l.file);
        if (!reader) { value ??= LEDGER_UNREADABLE; continue; }
        const row = reader.prepare(sql).get(...args);
        if (row) { value = Object.values(row)[0] ?? null; break; }
      }
    } catch { value = LEDGER_UNREADABLE; }
    cache.set(ck, value);
    return value;
  };
  const jobStatus = (ledgerId, jobId) => ask(ledgerId, 'job', 'SELECT status FROM jobs WHERE job_id=?', jobId);
  jobStatus.workflowPhase = (ledgerId, workflowId) => ask(ledgerId, 'wf', 'SELECT phase FROM workflows WHERE workflow_id=?', workflowId);
  jobStatus.close = () => { for (const h of readers.values()) { try { h?.close?.(); } catch { /* closed */ } } };
  return jobStatus;
}
