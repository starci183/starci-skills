#!/usr/bin/env node
// starci runtime ledger-hygiene — the standalone report of scripts/housekeeping/hk-orphan-ledgers.mjs's finding
// (docs/ledger-db.md §1): orphan ledgers in the state root. It is report-only by default; `--apply` archives the
// orphan ledgers found (never deletes) and never touches a file inside a repository.
//
//   starci runtime ledger-hygiene [--apply] [--json]
//
// This is the same detection `starci runtime housekeeping --only orphanledgers [--apply]` runs as
// part of the full sweep; use this instead for a one-shot health check without running the whole housekeeping pass.
// Exit codes: 0 clean, 1 findings remain (a dry run, or an --apply run that could not clear every orphan), 2 bad
// usage.
import { isMain } from '../lib/is-main.mjs';
import { orphanLedgerFindings, ORPHAN_LEDGER_CODE, sweepOrphanLedgers } from './hk-orphan-ledgers.mjs';

export const CODES = Object.freeze([ORPHAN_LEDGER_CODE]);

/**
 * The report: {ok, orphans: [...], applied: [...], errors: [...]}. `apply:true` archives
 * every orphan found (through sweepOrphanLedgers) and re-reads to report what is left.
 */
export async function ledgerHygieneReport({ env = process.env, apply = false, now = Date.now() } = {}) {
  if (!apply) {
    const orphans = orphanLedgerFindings({ env });
    return { ok: orphans.length === 0, orphans, applied: [], errors: [] };
  }
  const swept = await sweepOrphanLedgers({ apply: true, now, env });
  return { ok: swept.ok, orphans: swept.report, applied: swept.moved, errors: swept.errors };
}

function formatReport(report) {
  const lines = [];
  for (const o of report.orphans) lines.push(`  ${o.code} ledger ${o.name ?? o.ledgerId} (${o.ledgerId}) - ${o.reason}; source roots: ${o.sourceRoots.join(', ') || '(none)'}`);
  for (const a of report.applied) lines.push(`  ARCHIVED ${a.ledgerId}: ${a.from} -> ${a.to}`);
  for (const e of report.errors) lines.push(`  ERROR ${e.ledgerId ?? ''} ${e.error}`);
  return lines.join('\n');
}

async function main(argv) {
  const apply = argv.includes('--apply');
  const json = argv.includes('--json');
  const unknown = argv.filter((a) => a.startsWith('--') && !['--apply', '--json'].includes(a));
  if (unknown.length) { process.stderr.write(`unknown flag(s): ${unknown.join(' ')}\nusage: starci runtime ledger-hygiene [--apply] [--json]\n`); return 2; }
  const report = await ledgerHygieneReport({ apply });
  if (json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else {
    const archived = apply ? `, ${report.applied.length} archived` : '';
    process.stdout.write(`ledger-hygiene: ${report.orphans.length} orphan ledger(s)${archived}\n`);
    const body = formatReport(report);
    if (body) process.stdout.write(`${body}\n`);
  }
  return report.ok ? 0 : 1;
}

if (isMain(import.meta.url)) process.exitCode = await main(process.argv.slice(2));
