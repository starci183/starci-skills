// api foundation: split from api.mjs.
import path from 'node:path';
import { resolveIncident } from '../../../engine/ledger-db.mjs';
import { csvList, getWorkflow, workflowRunning } from '../api-lib/rows.mjs';
import { PEER_WAIT, openPeerWaits, releaseTypedWaits, writePeerMessage } from '../api-lib/peers.mjs';
import { FOUNDATION_KINDS, claimFoundation, declarationsOf, declareDependent, landFoundation, normalizeFoundationName, readDeclaration, readFoundation, writeDeclaration, writeFoundation } from '../foundations.mjs';
import { wakeKernelForTransition } from '../wake-delivery.mjs';
const FOUNDATION_ACTIONS = ['claim', 'declare-dependent', 'land', 'declare-none'];

export default {
  verb: 'foundation',
  required: ['workflow'],
  kernelOnly: true,
  usageInCore: true,
  run({ ledger, args, repo, emit, internals }) {
    const db = ledger.db, workflowId = args.workflow;
    const wf = getWorkflow(db, workflowId);
    if (!wf) throw Object.assign(new Error(`unknown workflow ${workflowId}`), { code: 'workflow-unknown' });
    if (!workflowRunning(wf)) throw Object.assign(new Error(`workflow ${workflowId} is ${wf.archived_at != null ? 'archived' : `phase ${wf.phase ?? 'unset'}`}; only a running workflow owns or needs a foundation`), { code: 'workflow-not-running' });
    const actions = FOUNDATION_ACTIONS.filter((action) => args[action] != null);
    if (actions.length !== 1) throw Object.assign(new Error(`foundation takes exactly one of ${FOUNDATION_ACTIONS.map((a) => `--${a}`).join(' | ')}`), { code: 'foundation-action-invalid' });
    const action = actions[0], now = Date.now();
    const text = (value) => (typeof value === 'string' && value.trim() ? value.trim() : null);
    const detail = text(args.detail), version = text(args.version);
    if (action === 'declare-none') {
      const declared = declarationsOf(db, workflowId);
      if (declared.owns.length || declared.needs.length) {
        throw Object.assign(new Error(`${workflowId} already owns ${declared.owns.map((f) => f.name).join(', ') || '-'} and needs ${declared.needs.map((f) => f.name).join(', ') || '-'}; none would contradict that`), { code: 'foundation-declared' });
      }
      ledger.transaction(() => {
        writeDeclaration(db, workflowId, { none: true, detail, at: now }, now);
        ledger.appendEvent({ workflowId, entityType: 'workflow', entityId: workflowId, kind: 'foundation-none-declared', payload: { detail } });
      });
      emit({ ok: true, workflowId, action, none: true }, `${workflowId} declared it owns and needs no shared foundation`, args.json);
      return;
    }
    const name = normalizeFoundationName(args[action]);
    const existing = readFoundation(db, name);
    const kind = args.kind == null ? null : String(args.kind).trim();
    if (kind != null && !FOUNDATION_KINDS.includes(kind)) throw Object.assign(new Error(`--kind must be ${FOUNDATION_KINDS.join('|')}, got '${kind}'`), { code: 'foundation-kind-invalid' });
    const marker = () => { if (!readDeclaration(db, workflowId)) writeDeclaration(db, workflowId, { none: false, at: now }, now); };
    let result, notified = [], released = [];
    if (action === 'claim') {
      const ownerRunning = existing?.owner ? workflowRunning(getWorkflow(db, existing.owner.workflowId)) : false;
      result = claimFoundation(existing, { name, workflowId, ownerRunning, kind, detail, version, now });
      ledger.transaction(() => {
        writeFoundation(db, result.record, now);
        marker();
        ledger.appendEvent({ workflowId, entityType: 'foundation', entityId: name, kind: 'foundation-claimed',
          payload: { name, kind: result.record.kind, version: result.record.version, transferredFrom: result.transferredFrom, reopened: result.reopened } });
      });
    } else if (action === 'declare-dependent') {
      result = declareDependent(existing, { name, workflowId, detail, now });
      ledger.transaction(() => {
        writeFoundation(db, result.record, now);
        marker();
        ledger.appendEvent({ workflowId, entityType: 'foundation', entityId: name, kind: 'foundation-dependent-declared', payload: { name, detail } });
      });
    } else {
      result = landFoundation(existing, { name, workflowId, proof: args.proof, version, refs: csvList(args.refs), now });
      ledger.transaction(() => {
        writeFoundation(db, result.record, now);
        ledger.appendEvent({ workflowId, entityType: 'foundation', entityId: name, kind: 'foundation-landed',
          payload: { name, version: result.record.version, proof: result.record.landed.proof, refs: result.record.landed.refs, idempotent: result.idempotent } });
        if (result.idempotent) return;
        // Every running dependent hears it (a pending peer message makes its frontier actionable) ...
        for (const dependent of result.record.dependents ?? []) {
          const to = getWorkflow(db, dependent.workflowId);
          if (!workflowRunning(to) || to.workflow_id === workflowId) continue;
          notified.push(writePeerMessage(ledger, { from: wf, to: to.workflow_id, kind: 'heads-up', now,
            subject: `foundation landed: ${name}${result.record.version ? ` ${result.record.version}` : ''}`,
            body: `${wf.title ?? workflowId} (${workflowId}) landed shared foundation ${name}${result.record.version ? ` at ${result.record.version}` : ''}: ${result.record.landed.proof}. `
              + 'Any peer-wait --until-foundation on it is resolved. Verify it holds in your own preflight, enqueue the work it held, and ack this message with what you did.',
            refs: [name, ...result.record.landed.refs], extra: { auto: 'foundation-landed', foundation: name, version: result.record.version } }));
        }
        // ... and every typed wait on it, in any workflow of this ledger, is released.
        const waiting = db.prepare("SELECT DISTINCT workflow_id FROM incidents WHERE status='open' AND last_progress LIKE ?").all(`[${PEER_WAIT}]%`).map((row) => row.workflow_id);
        for (const waiter of waiting) {
          for (const wait of openPeerWaits(db, waiter).filter((item) => item.untilFoundation === name)) {
            resolveIncident(db, { incidentId: wait.incidentId, reason: 'fixed', at: now });
            ledger.appendEvent({ workflowId: waiter, entityType: 'incident', entityId: wait.incidentId, kind: 'incident-resolved',
              payload: { detail: `foundation ${name} landed${result.record.version ? ` at ${result.record.version}` : ''} by ${workflowId}: ${result.record.landed.proof}`, foundation: name, by: 'foundation-landed' } });
            released.push({ workflowId: waiter, incidentId: wait.incidentId, holds: wait.holds });
          }
        }
      });
    }
    // Waits typed on the foundation later (api incident --attach --until-foundation) resolve through the
    // typed-condition release, which now finds the foundation landed (gate-conditions.mjs).
    if (action === 'land' && !result.idempotent) {
      for (const item of releaseTypedWaits(ledger, { repo: path.resolve(args.repo ?? process.cwd()) }).resolved) {
        if (!released.some((r) => r.incidentId === item.incidentId)) released.push({ workflowId: item.workflowId, incidentId: item.incidentId, holds: item.holds });
      }
    }
    // The released and notified Kernels are woken now rather than at the next watchdog tick.
    const wakes = [];
    for (const target of [...new Set([...released.map((item) => item.workflowId), ...notified.map((item) => item.to)])]) {
      const holds = released.filter((item) => item.workflowId === target);
      let wake;
      try {
        wake = wakeKernelForTransition(ledger, { workflowId: target, transition: 'foundation-landed', lines: [
          `Shared foundation ${name}${result.record.version ? ` ${result.record.version}` : ''} landed by ${workflowId}${holds.length ? `; peer-wait ${holds.map((item) => item.incidentId).join(', ')} released (held ${holds.flatMap((item) => item.holds).join(', ') || '-'})` : ''}.`,
          'Re-read canonical api status and api inbox now; verify the foundation holds in your own preflight before you enqueue the work it held, and ack the message.',
        ] });
      } catch (error) { wake = { action: 'kernel-wake-failed', error: String(error?.message ?? error) }; }
      wakes.push({ workflowId: target, action: wake.action });
    }
    const record = result.record;
    const out = { ok: true, workflowId, action, name, state: record.state, kind: record.kind, version: record.version ?? null,
      owner: record.owner?.workflowId ?? null, dependents: (record.dependents ?? []).map((d) => d.workflowId), idempotent: Boolean(result.idempotent),
      ...(result.transferredFrom ? { transferredFrom: result.transferredFrom } : {}), ...(result.reopened ? { reopened: true } : {}),
      ...(action === 'land' ? { landed: record.landed, notified: notified.map(({ to, key }) => ({ to, key })), released, wakes } : {}),
      ...(action === 'declare-dependent' && record.state !== 'landed' ? { next: record.owner
        ? `hold the legs that need it with api incident --workflow ${workflowId} --kind peer-wait --until-foundation ${name} --holds <ops|jobs> --detail <what must land>; the landing releases it`
        : `nobody owns ${name} yet: agree the owner with your peers (api notify --kind request), who claims it; until then no wait can name it` } : {}),
    };
    emit(out, `foundation ${name} ${action}: ${record.state}${record.version ? ` ${record.version}` : ''} owner=${out.owner ?? '-'} dependents=${out.dependents.join(',') || '-'}${out.transferredFrom ? ` (taken over from ${out.transferredFrom}, no longer running)` : ''}${action === 'land' && !result.idempotent ? `; notified ${notified.map((m) => m.to).join(', ') || 'nobody'}; released ${released.map((r) => `${r.incidentId} (${r.workflowId})`).join(', ') || 'no wait'}` : ''}${out.next ? `; next: ${out.next}` : ''}`, args.json);
  },
};
