#!/usr/bin/env node
// notify.mjs — the [Supervisor]'s notice to one workflow's Kernel (a ruling, a "fixed by <sha>, resolve inc-...",
// a disposition). Since lane rc-decisions (reconciler DESIGN §10.2) the notice is a durable Decision Item, never text
// typed into the Kernel terminal: it opens a `supervisor-ruling` DI in the product ledger through `api decisions --open
// --by supervisor` (text = the notice; it supersedes the Kernel's live DIs on the same entity) and rings the doorbell
// (scripts/machine/decisions.mjs ringDoorbell: one fixed line, only when the seat reads turn-idle).
//
//   node scripts/supervisor/notify.mjs --repo <ledger-owner> --workflow <id> (--text <t> | --text-file <f>) [--item <owed-action key>]
//        [--entity <type>:<id>] [--json]
//
// A busy Kernel is no longer a failure: the DI waits in the ledger and the answer is `queued` (delivered: true); the
// doorbell rings when the seat turns idle. --item names the owed action (scripts/supervisor/actions.mjs) the notice acts
// on: a delivered notice stops that item's SLA clock (recordAction). Every notice is also a supervisor-notice event in
// machine.sqlite sup_events.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openLedger, ledgerFileFor } from '../../engine/db/ledger.mjs';
import { openDecision, ringDoorbellWith } from '../machine/decisions.mjs';
import { wakeKernel } from '../kernel/wake-delivery.mjs';
import { supervisorEvent, supervisorLog, withSupervisor } from '../machine/home.mjs';
import { recordAction } from './actions.mjs';
import { actionRow, supLog } from '../machine/sup-log.mjs';

const selfFile = fileURLToPath(import.meta.url);
export const NOTICE_TAG = '[supervisor]';

// One tag, even when the caller's text already carries it (seen: "[supervisor] [supervisor] ...").
export const noticeText = (text) => `${NOTICE_TAG} ${String(text ?? '').replace(/\s+/g, ' ').trim().replace(/^(?:\[supervisor\]\s*)+/i, '')}`;

/** The doorbell over the product ledger. */
export function ringKernel({ repo, workflowId, wake = wakeKernel }) {
  const ledger = openLedger({ file: ledgerFileFor(path.resolve(repo)) });
  try { return ringDoorbellWith({ ledger, workflowId, wake }); } finally { ledger.close(); }
}

/**
 * Deliver one notice as a supervisor-ruling DI plus a doorbell; {action, delivered, decision, ring, ...}.
 * action: kernel-woken (DI opened, doorbell rung) | queued (DI opened, the seat was busy or rung recently) |
 * decision-open-failed (no DI: delivered false). `open`, `ring` and `wake` replace the DI writer, the doorbell and the
 * terminal wake in specs. Async: openDecision returns a Promise (the product-ledger child, the supervisor ledger); a
 * sync `open` double still works.
 */
export async function notifyKernel({ repo, workflowId, text, item = null, entity = null, open = openDecision, ring = ringKernel, wake = wakeKernel, env = process.env }) {
  const body = noticeText(text);
  let opened;
  try {
    opened = await open(path.resolve(repo), { workflowId, kind: 'supervisor-ruling', decider: 'kernel', summary: body,
      entity: entity ?? { type: 'workflow', id: workflowId }, by: 'supervisor', ...(item ? { item } : {}) }, { env: { ...env, STARCI_ACTOR: 'supervisor' } });
  } catch (error) { opened = { ok: false, err: String(error?.message ?? error).slice(0, 200) }; }
  const decision = opened?.json?.decision ?? null;
  let result;
  if (!opened?.ok || !decision) {
    result = { action: 'decision-open-failed', delivered: false, error: opened?.json?.error ?? opened?.err ?? null, code: opened?.json?.code ?? null };
  } else {
    let rang = null;
    try { rang = ring({ repo: path.resolve(repo), workflowId, wake }); } catch (error) { rang = { action: 'deferred', error: String(error?.message ?? error).slice(0, 200) }; }
    result = { action: rang?.action === 'rung' ? 'kernel-woken' : 'queued', delivered: true, decision: decision.id,
      superseded: opened.json.superseded ?? [], existing: opened.json.existing === true, ring: rang?.action ?? null, ...(rang?.wake ? { state: rang.wake } : {}) };
  }
  try {
    withSupervisor((m) => supervisorEvent(m, { entityType: 'notice', entityId: workflowId, kind: 'supervisor-notice', payload: { repo, workflowId, action: result.action, delivered: result.delivered === true, chars: body.length, decision: result.decision ?? null, ...(item ? { item } : {}) } }), { env });
  } catch { /* the record is best effort */ }
  if (item && result.delivered) {
    try { recordAction({ item, action: 'notify', reason: body, workflowId, refs: [result.decision].filter(Boolean), env }); } catch { /* the notice event stands */ }
  } else {
    supLog(actionRow({ item: item ?? `notice|${workflowId}`, action: 'notify', reason: body, workflowId, repo, delivered: result.delivered === true }), { env });
  }
  return { ...result, workflowId, repo };
}

if (process.argv[1] && path.resolve(process.argv[1]) === selfFile) {
  const argv = process.argv.slice(2);
  const value = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] ?? null : null; };
  const text = value('text-file') ? fs.readFileSync(value('text-file'), 'utf8') : value('text');
  const entityArg = value('entity');
  const entity = entityArg && entityArg.includes(':') ? { type: entityArg.slice(0, entityArg.indexOf(':')), id: entityArg.slice(entityArg.indexOf(':') + 1) } : null;
  if (!value('repo') || !value('workflow') || !text?.trim()) {
    console.error('use: notify.mjs --repo <ledger-owner> --workflow <id> (--text <t> | --text-file <f>) [--item <key>] [--entity <type>:<id>] [--json]');
    process.exitCode = 2;
  } else {
    const r = await notifyKernel({ repo: value('repo'), workflowId: value('workflow'), text, item: value('item'), entity });
    supervisorLog('notice', `${value('workflow')}: ${r.action}${r.decision ? ` ${r.decision}` : ''}`);
    console.log(argv.includes('--json') ? JSON.stringify(r) : `${r.workflowId}: ${r.action}${r.delivered ? ' (delivered)' : ''}${r.decision ? ` decision ${r.decision}` : ''}${r.ring ? ` doorbell=${r.ring}` : ''}`);
    if (!r.delivered) process.exitCode = 1;
  }
}
