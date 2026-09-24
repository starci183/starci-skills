#!/usr/bin/env node
// notify.mjs — the [Supervisor]'s notice to one workflow's Kernel (a ruling, a "fixed by <sha>, resolve
// inc-...", a disposition), delivered through the proven wake path (scripts/supervisor/stall-alert.mjs
// wakeKernel -> scripts/kernel/wake-delivery.mjs: split sends, screen-proven; guardrail notice-delivery-proven).
//
//   node scripts/supervisor/notify.mjs --repo <ledger-owner> --workflow <id> (--text <t> | --text-file <f>) [--json]
//
// The product ledger is only read (the Kernel's signal). A Kernel mid-turn, with input pending or at a gate is
// NOT typed into: the answer is `kernel-busy` / `kernel-gated` and the Supervisor retries on its next wake.
// Every attempt is recorded in the supervisor ledger (supervisor-notice), never in the product ledger.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { withLedgerRead } from '../connectors/lib.mjs';
import { wakeKernel } from './stall-alert.mjs';
import { openSupervisorLedger, supervisorEvent, supervisorLog } from './home.mjs';

const selfFile = fileURLToPath(import.meta.url);
export const NOTICE_TAG = '[supervisor]';

export const noticeText = (text) => `${NOTICE_TAG} ${String(text ?? '').replace(/\s+/g, ' ').trim()}`;

/** Deliver one notice; {action, delivered, terminal, ...}. `wake` replaces wakeKernel in specs. */
export function notifyKernel({ repo, workflowId, text, wake = wakeKernel, env = process.env }) {
  const body = noticeText(text);
  const result = withLedgerRead(path.resolve(repo), (db) => wake({ db, workflowId, text: body }), { action: 'ledger-unreadable', delivered: false });
  try {
    const ledger = openSupervisorLedger({ env });
    try { ledger.transaction(() => supervisorEvent(ledger, { entityType: 'notice', entityId: workflowId, kind: 'supervisor-notice', payload: { repo, workflowId, action: result.action, delivered: result.delivered === true, chars: body.length } })); }
    finally { ledger.close(); }
  } catch { /* the record is best effort */ }
  return { ...result, workflowId, repo };
}

if (process.argv[1] && path.resolve(process.argv[1]) === selfFile) {
  const argv = process.argv.slice(2);
  const value = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] ?? null : null; };
  const text = value('text-file') ? fs.readFileSync(value('text-file'), 'utf8') : value('text');
  if (!value('repo') || !value('workflow') || !text?.trim()) {
    console.error('use: notify.mjs --repo <ledger-owner> --workflow <id> (--text <t> | --text-file <f>) [--json]');
    process.exitCode = 2;
  } else {
    const r = notifyKernel({ repo: value('repo'), workflowId: value('workflow'), text });
    supervisorLog('notice', `${value('workflow')}: ${r.action}`);
    console.log(argv.includes('--json') ? JSON.stringify(r) : `${r.workflowId}: ${r.action}${r.delivered ? ' (delivered)' : ''}${r.state ? ` state=${r.state}` : ''}`);
    if (!r.delivered) process.exitCode = 1;
  }
}
