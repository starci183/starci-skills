// starci kernel foundation: split from cli.mjs.
import path from 'node:path';
import { resolveIncident } from '../../../engine/db/ledger.mjs';
import { csvList, getWorkflow, workflowRunning } from './shared/rows.mjs';
import { PEER_WAIT, openPeerWaits, releaseTypedWaits, writePeerMessage } from './shared/peer-waits.mjs';
import { FOUNDATION_KINDS, claimFoundation, declarationsOf, declareDependent, landFoundation, normalizeFoundationName, readDeclaration, readFoundation, writeDeclaration, writeFoundation } from '../foundation-registry.mjs';
import { wakeKernelForTransition } from '../wake-delivery.mjs';
const FOUNDATION_ACTIONS = ['claim', 'declare-dependent', 'land', 'declare-none'];

function declareNoFoundation(ledger, db, { workflowId, detail, now, emit, args }) {
  const declared = declarationsOf(db, workflowId);
  if (declared.owns.length || declared.needs.length) {
    const owns = declared.owns.map((f) => f.name).join(', ') || '-';
    const needs = declared.needs.map((f) => f.name).join(', ') || '-';
    throw Object.assign(new Error(`${workflowId} already owns ${owns} and needs ${needs}; none would contradict that`), { code: 'foundation-declared' });
  }
  ledger.transaction(() => {
    writeDeclaration(db, workflowId, { none: true, detail, at: now }, now);
    ledger.appendEvent({ workflowId, entityType: 'workflow', entityId: workflowId, kind: 'foundation-none-declared', payload: { detail } });
  });
  emit({ ok: true, workflowId, action: 'declare-none', none: true }, `${workflowId} declared it owns and needs no shared foundation`, args.json);
}

const foundationMarker = (db, workflowId, now) => {
  if (!readDeclaration(db, workflowId)) writeDeclaration(db, workflowId, { none: false, at: now }, now);
};

function notifyFoundationDependents(ledger, db, { wf, workflowId, name, record, now }) {
  const notified = [];
  const versionLabel = record.version ? ` ${record.version}` : '';
  const versionAt = record.version ? ` at ${record.version}` : '';
  for (const dependent of record.dependents ?? []) {
    const to = getWorkflow(db, dependent.workflowId);
    if (!workflowRunning(to) || to.workflow_id === workflowId) continue;
    notified.push(writePeerMessage(ledger, { from: wf, to: to.workflow_id, kind: 'heads-up', now,
      subject: `foundation landed: ${name}${versionLabel}`,
      body: `${wf.title ?? workflowId} (${workflowId}) landed shared foundation ${name}${versionAt}: ${record.landed.proof}. `
        + 'Any peer-wait --until-foundation on it is resolved. Verify it holds in your own preflight, enqueue the work it held, and ack this message with what you did.',
      refs: [name, ...record.landed.refs], extra: { auto: 'foundation-landed', foundation: name, version: record.version } }));
  }
  return notified;
}

function releaseFoundationWaiters(ledger, db, { workflowId, name, record, now }) {
  const released = [];
  const versionAt = record.version ? ` at ${record.version}` : '';
  const waiting = db.prepare("SELECT DISTINCT workflow_id FROM incidents WHERE status='open' AND last_progress LIKE ?").all(`[${PEER_WAIT}]%`).map((row) => row.workflow_id);
  for (const waiter of waiting) {
    for (const wait of openPeerWaits(db, waiter).filter((item) => item.untilFoundation === name)) {
      resolveIncident(db, { incidentId: wait.incidentId, reason: 'fixed', at: now });
      ledger.appendEvent({ workflowId: waiter, entityType: 'incident', entityId: wait.incidentId, kind: 'incident-resolved',
        payload: { detail: `foundation ${name} landed${versionAt} by ${workflowId}: ${record.landed.proof}`, foundation: name, by: 'foundation-landed' } });
      released.push({ workflowId: waiter, incidentId: wait.incidentId, holds: wait.holds });
    }
  }
  return released;
}

function recordFoundationAction(ledger, db, { action, name, workflowId, wf, existing, kind, detail, proof, version, refs, now }) {
  if (action === 'claim') {
    const ownerRunning = existing?.owner ? workflowRunning(getWorkflow(db, existing.owner.workflowId)) : false;
    const result = claimFoundation(existing, { name, workflowId, ownerRunning, kind, detail, version, now });
    ledger.transaction(() => {
      writeFoundation(db, result.record, now);
      foundationMarker(db, workflowId, now);
      ledger.appendEvent({ workflowId, entityType: 'foundation', entityId: name, kind: 'foundation-claimed',
        payload: { name, kind: result.record.kind, version: result.record.version, transferredFrom: result.transferredFrom, reopened: result.reopened } });
    });
    return { result, notified: [], released: [] };
  }
  if (action === 'declare-dependent') {
    const result = declareDependent(existing, { name, workflowId, detail, now });
    ledger.transaction(() => {
      writeFoundation(db, result.record, now);
      foundationMarker(db, workflowId, now);
      ledger.appendEvent({ workflowId, entityType: 'foundation', entityId: name, kind: 'foundation-dependent-declared', payload: { name, detail } });
    });
    return { result, notified: [], released: [] };
  }
  const result = landFoundation(existing, { name, workflowId, proof, version, refs, now });
  const notified = [], released = [];
  ledger.transaction(() => {
    writeFoundation(db, result.record, now);
    ledger.appendEvent({ workflowId, entityType: 'foundation', entityId: name, kind: 'foundation-landed',
      payload: { name, version: result.record.version, proof: result.record.landed.proof, refs: result.record.landed.refs, idempotent: result.idempotent } });
    if (result.idempotent) return;
    notified.push(...notifyFoundationDependents(ledger, db, { wf, workflowId, name, record: result.record, now }));
    released.push(...releaseFoundationWaiters(ledger, db, { workflowId, name, record: result.record, now }));
  });
  return { result, notified, released };
}

function wakeFoundationPeers(ledger, { name, workflowId, record, released, notified }) {
  const wakes = [];
  for (const target of new Set([...released.map((item) => item.workflowId), ...notified.map((item) => item.to)])) {
    const holds = released.filter((item) => item.workflowId === target);
    const versionLabel = record.version ? ` ${record.version}` : '';
    const heldIncidents = holds.map((item) => item.incidentId).join(', ');
    const heldOps = holds.flatMap((item) => item.holds).join(', ') || '-';
    const waitNote = holds.length ? `; peer-wait ${heldIncidents} released (held ${heldOps})` : '';
    let wake;
    try {
      wake = wakeKernelForTransition(ledger, { workflowId: target, transition: 'foundation-landed', lines: [
        `Shared foundation ${name}${versionLabel} landed by ${workflowId}${waitNote}.`,
        'Re-read canonical starci kernel status and starci kernel inbox now; verify the foundation holds in your own preflight before you enqueue the work it held, and ack the message.',
      ] });
    } catch (error) { wake = { action: 'kernel-wake-failed', error: String(error?.message ?? error) }; }
    wakes.push({ workflowId: target, action: wake.action });
  }
  return wakes;
}

export default {
  verb: 'foundation',
  required: ['workflow'],
  kernelOnly: true,
  usageInCore: true,
  run({ ledger, args, repo, emit, internals }) {
    const db = ledger.db, workflowId = args.workflow;
    const wf = getWorkflow(db, workflowId);
    if (!wf) throw Object.assign(new Error(`unknown workflow ${workflowId}`), { code: 'workflow-unknown' });
    if (!workflowRunning(wf)) {
      const workflowState = wf.archived_at != null ? 'archived' : `phase ${wf.phase ?? 'unset'}`;
      throw Object.assign(new Error(`workflow ${workflowId} is ${workflowState}; only a running workflow owns or needs a foundation`), { code: 'workflow-not-running' });
    }
    const actions = FOUNDATION_ACTIONS.filter((action) => args[action] != null);
    if (actions.length !== 1) throw Object.assign(new Error(`foundation takes exactly one of ${FOUNDATION_ACTIONS.map((a) => `--${a}`).join(' | ')}`), { code: 'foundation-action-invalid' });
    const action = actions[0], now = Date.now();
    const text = (value) => (typeof value === 'string' && value.trim() ? value.trim() : null);
    const detail = text(args.detail), version = text(args.version);
    if (action === 'declare-none') {
      declareNoFoundation(ledger, db, { workflowId, detail, now, emit, args });
      return;
    }
    const name = normalizeFoundationName(args[action]);
    const existing = readFoundation(db, name);
    const kind = args.kind == null ? null : String(args.kind).trim();
    if (kind != null && !FOUNDATION_KINDS.includes(kind)) throw Object.assign(new Error(`--kind must be ${FOUNDATION_KINDS.join('|')}, got '${kind}'`), { code: 'foundation-kind-invalid' });
    const { result, notified, released } = recordFoundationAction(ledger, db, {
      action, name, workflowId, wf, existing, kind, detail, proof: args.proof,
      version, refs: csvList(args.refs), now,
    });
    // Waits typed on the foundation later (starci kernel incident --attach --until-foundation) resolve through the
    // typed-condition release, which now finds the foundation landed (gate-conditions.mjs).
    if (action === 'land' && !result.idempotent) {
      for (const item of releaseTypedWaits(ledger, { repo: path.resolve(args.repo ?? process.cwd()) }).resolved) {
        if (!released.some((r) => r.incidentId === item.incidentId)) released.push({ workflowId: item.workflowId, incidentId: item.incidentId, holds: item.holds });
      }
    }
    // The released and notified Kernels are woken now rather than at the next watchdog tick.
    const wakes = wakeFoundationPeers(ledger, { name, workflowId, record: result.record, released, notified });
    const record = result.record;
    let next;
    if (action === 'declare-dependent' && record.state !== 'landed') {
      if (record.owner) {
        next = `hold the legs that need it with starci kernel incident --workflow ${workflowId} --kind peer-wait --until-foundation ${name} --holds <ops|jobs> --detail <what must land>; the landing releases it`;
      } else {
        next = `nobody owns ${name} yet: agree the owner with your peers (starci kernel notify --kind request), who claims it; until then no wait can name it`;
      }
    }
    const out = { ok: true, workflowId, action, name, state: record.state, kind: record.kind, version: record.version ?? null,
      owner: record.owner?.workflowId ?? null, dependents: (record.dependents ?? []).map((d) => d.workflowId), idempotent: Boolean(result.idempotent),
      ...(result.transferredFrom ? { transferredFrom: result.transferredFrom } : {}), ...(result.reopened ? { reopened: true } : {}),
      ...(action === 'land' ? { landed: record.landed, notified: notified.map(({ to, key }) => ({ to, key })), released, wakes } : {}),
      ...(next ? { next } : {}),
    };
    const versionLabel = record.version ? ` ${record.version}` : '';
    const takeoverNote = out.transferredFrom ? ` (taken over from ${out.transferredFrom}, no longer running)` : '';
    const notifiedLabel = notified.map((message) => message.to).join(', ') || 'nobody';
    const releasedLabel = released.map((item) => `${item.incidentId} (${item.workflowId})`).join(', ') || 'no wait';
    const landingNote = action === 'land' && !result.idempotent ? `; notified ${notifiedLabel}; released ${releasedLabel}` : '';
    const nextNote = out.next ? `; next: ${out.next}` : '';
    emit(out, `foundation ${name} ${action}: ${record.state}${versionLabel} owner=${out.owner ?? '-'} dependents=${out.dependents.join(',') || '-'}${takeoverNote}${landingNote}${nextNote}`, args.json);
  },
};
