#!/usr/bin/env node
// owner-claims-audit.mjs — list past incident resolutions that claim an owner decision no owner answer backs,
// and open owner-gates whose own text says they are not owner work (scripts/machine/owner-claim.mjs).
//
//   starci runtime owner-claims-audit --repo <repo>[,<repo>...] [--workflow <id>] [--json]
//
// Opens each repo's runtime.sqlite (engine/db/ledger.mjs ledgerFileFor) READ-ONLY and never writes: history is surfaced, never rewritten.
// Exit 0 nothing found, 1 findings listed, 2 usage or an unreadable ledger.
import fs from 'node:fs';
import path from 'node:path';
import { isMain } from '../lib/is-main.mjs';
import { findInOrder } from '../lib/in-order.mjs';
import { ledgerFileFor } from '../../engine/db/ledger.mjs';
import { ownerClaimAudit, ownerGatesNotOwnerWork } from '../machine/owner-claim.mjs';

async function auditLedger(file, { workflowId = null } = {}) {
  const { openLedgerReader } = await import('../../engine/db/ledger.mjs');
  const db = openLedgerReader(file);
  try {
    const unproven = ownerClaimAudit(db, { workflowId });
    const workflows = workflowId ? [workflowId] : db.prepare("SELECT DISTINCT workflow_id FROM incidents WHERE status='open'").all().map((r) => r.workflow_id);
    const notOwnerWork = workflows.flatMap((wf) => ownerGatesNotOwnerWork(db, wf).map((g) => ({ workflowId: wf, ...g })));
    return { ledger: file, unproven, notOwnerWork };
  } finally { db.close(); }
}

async function main(argv) {
  const get = (name) => { const i = argv.indexOf(name); return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null; };
  const repos = String(get('--repo') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const workflowId = get('--workflow'), json = argv.includes('--json');
  if (!repos.length) { process.stderr.write('use: starci runtime owner-claims-audit --repo <repo>[,<repo>...] [--workflow <id>] [--json]\n'); return 2; }
  const out = [];
  const missing = await findInOrder(repos, async (repo) => {
    const file = ledgerFileFor(path.resolve(repo));
    if (!fs.existsSync(file)) { process.stderr.write(`no ledger at ${file}\n`); return true; }
    out.push({ repo: path.resolve(repo), ...(await auditLedger(file, { workflowId })) });
    return false;
  });
  if (missing !== undefined) return 2;
  const found = out.reduce((n, r) => n + r.unproven.length + r.notOwnerWork.length, 0);
  if (json) process.stdout.write(`${JSON.stringify({ ok: found === 0, found, ledgers: out }, null, 2)}\n`);
  else {
    for (const r of out) {
      process.stdout.write(`${r.repo}: ${r.unproven.length} unproven owner claim(s), ${r.notOwnerWork.length} open owner-gate(s) that are not owner work\n`);
      for (const c of r.unproven) process.stdout.write(`  owner-claim-unproven ${c.workflowId} ${c.incidentId} [${c.kind ?? '-'}] ${c.resolvedAt} by ${c.by ?? '(unrecorded)'}: "${c.claim}" - ${c.reason}\n    ${c.detail}\n`);
      for (const g of r.notOwnerWork) process.stdout.write(`  owner-gate-not-owner-work ${g.workflowId} ${g.incidentId}: "${g.marker}" - ${g.detail}\n`);
    }
  }
  return found ? 1 : 0;
}

if (isMain(import.meta.url)) {
  try { process.exit(await main(process.argv.slice(2))); }
  catch (error) { process.stderr.write(`${error?.stack ?? error}\n`); process.exit(2); }
}
