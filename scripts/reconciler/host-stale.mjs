// host-stale.mjs — the Host controller's retry of replaced Kernel terminals that an open kernel-stale-terminal-unclosed
// incident names (controllers/host.mjs reconcileKernelSeat -> staleTerminalStep).
import { mapInOrder } from '../lib/in-order.mjs';

const STALE_TERMINAL_CODE = 'kernel-stale-terminal-unclosed';
export const STALE_RETRY_MS = 5 * 60_000;
const STALE_RETRY_MAX_MS = 60 * 60_000;
export const STALE_ESCALATE_TRIES = 6;
export const CLOSE_VERIFY = 'scripts/machine/close-verify.mjs';

/**
 * The replaced Kernel terminals of a workflow's open kernel-stale-terminal-unclosed incidents:
 * [{incidentId, handle}], never the seat's live terminal. `rows` are incidents rows {incident_id, last_progress}
 * whose last_progress is `[orca-tree] {"code": ..., "handle": ...}`. Pure.
 */
export function staleTerminalsOf(rows, { liveHandle = null } = {}) {
  const out = [];
  for (const r of rows ?? []) {
    const text = String(r?.last_progress ?? '');
    let body = null;
    try { body = JSON.parse(text.slice(text.indexOf('{'))); } catch { body = null; }
    if (body?.code !== STALE_TERMINAL_CODE || !body.handle || body.handle === liveHandle) continue;
    out.push({ incidentId: r.incident_id, handle: String(body.handle) });
  }
  return out;
}

// The open stale-terminal incidents of a workflow and its seat's own terminal handle; null when the ledger cannot be read.
async function readStaleIncidents(ctx, { ledgerId, workflowId }) {
  try {
    return await ctx.read(ledgerId, (db) => {
      const rows = db.prepare("SELECT incident_id, last_progress FROM incidents WHERE workflow_id=? AND status='open' AND last_progress LIKE ?").all(workflowId, `%${STALE_TERMINAL_CODE}%`);
      let seatHandle = null;
      try { seatHandle = JSON.parse(db.prepare("SELECT value_json FROM signals WHERE scope='kernel' AND key=?").get(workflowId)?.value_json ?? 'null')?.terminal ?? null; } catch { seatHandle = null; }
      return { rows, seatHandle };
    });
  } catch { return null; }
}

/**
 * The retry start-workflow never had: every replaced Kernel terminal an open kernel-stale-terminal-unclosed
 * incident of this workflow names is closed again (close-verify.mjs --tree) and the incident resolved once the
 * terminal is proven gone - show says gone, or a responding Orca no longer lists it. 'disconnected' alone is no
 * proof: Orca keeps a disconnected terminal's persisted tab (inc-11df8ae56795 stayed open
 * 65+ min on {proof: disconnected, attempts: 1}). The seat's own terminal is never touched.
 * `state.staleCloses` holds the retry back-off per incident; `di` builds a Decision Item; `outputOf` reads a run's JSON;
 * `terminalHandles` lists the handles a responding Orca holds (null when it does not answer).
 */
export function createStaleTerminalStep({ state, terminalHandles, outputOf, di }) {
  // The incidents whose retry is due, each with its back-off key and tries so far.
  const dueOf = (now, found, { ledgerId, liveHandle }) => {
    const due = [];
    for (const t of staleTerminalsOf(found?.rows, { liveHandle })) {
      if (t.handle === found.seatHandle) continue;
      const k = `${ledgerId}|${t.incidentId}`, prev = state.staleCloses.get(k);
      if (prev && now < prev.nextAt) continue;
      due.push({ ...t, k, tries: prev?.tries ?? 0 });
    }
    return due;
  };

  // The proof that a close-verify answer leaves the terminal gone, and the reason when there is none.
  const proofOf = async (closed, t) => {
    let proof = closed.proof === 'gone' ? 'gone' : null, reason = closed.reason ?? closed.error ?? null;
    if (!proof && closed.ok === true) {
      let listed = null;
      try { listed = await terminalHandles(); } catch { listed = null; }
      if (listed && !listed.has(t.handle)) proof = 'unlisted';
      else reason = listed ? 'terminal-still-listed' : 'terminal-list-unavailable';
    }
    return { proof, reason };
  };

  const resolveClosed = async (ctx, t, { ledgerId, workflowId, proof }) => {
    state.staleCloses.delete(t.k);
    const resolved = await ctx.api(ledgerId, 'incident', ['--workflow', workflowId, '--resolve', t.incidentId, '--by', 'supervisor',
      '--detail', `host controller closed replaced Kernel terminal ${t.handle} (proof ${proof}, close-verify --tree)`], { timeoutMs: 60_000 });
    ctx.log('reconciler.host.stale-terminal', `${workflowId}: replaced Kernel terminal ${t.handle} closed (${proof}); ${t.incidentId} resolved`, { ledgerId, workflowId, handle: t.handle, incidentId: t.incidentId, proof, api: resolved?.ok ?? null });
    return { incidentId: t.incidentId, handle: t.handle, closed: true, proof, resolved: resolved?.ok === true };
  };

  const retryLater = async (ctx, t, { ledgerId, workflowId, now, closed, reason }) => {
    const tries = t.tries + 1;
    state.staleCloses.set(t.k, { tries, nextAt: now + Math.min(STALE_RETRY_MAX_MS, STALE_RETRY_MS * 2 ** (tries - 1)) });
    ctx.log('reconciler.host.stale-terminal', `${workflowId}: replaced Kernel terminal ${t.handle} still not closed (${reason ?? closed.proof ?? 'no proof'}; try ${tries})`, { ledgerId, workflowId, handle: t.handle, incidentId: t.incidentId, tries, reason, proof: closed.proof ?? null });
    if (tries === STALE_ESCALATE_TRIES) {
      await ctx.openDecision(di({
        kind: 'runtime-defect', ledger: ledgerId, workflowId, entity: { type: 'terminal', id: t.handle }, idempotencyKey: `${STALE_TERMINAL_CODE}:${ledgerId}:${t.incidentId}`,
        summary: `${workflowId}: replaced Kernel terminal ${t.handle} still not closed after ${tries} verified closes (${reason ?? 'no proof'}); ${t.incidentId} stays open`,
        evidence: [{ ref: `incident:${t.incidentId}` }, { ref: `terminal:${t.handle}` }],
        options: [{ key: 'close', verb: `node ${CLOSE_VERIFY} --terminal ${t.handle} --tree --log`, recommended: true }], allowedVerbs: [],
      }));
    }
    return { incidentId: t.incidentId, handle: t.handle, closed: false, tries, reason };
  };

  const closeOne = async (ctx, t, scope) => {
    const r = await ctx.run('node', [CLOSE_VERIFY, '--terminal', t.handle, '--owner', 'reconciler/host', '--tree', '--log', '--json'], { timeoutMs: 90_000 });
    if (r?.shadow) return { incidentId: t.incidentId, handle: t.handle, shadow: true };
    const closed = outputOf(r) ?? {};
    const { proof, reason } = await proofOf(closed, t);
    if (proof) return resolveClosed(ctx, t, { ...scope, proof });
    return retryLater(ctx, t, { ...scope, closed, reason });
  };

  return async function staleTerminalStep(ctx, { ledgerId, workflowId, liveHandle }) {
    const now = ctx.now();
    const found = await readStaleIncidents(ctx, { ledgerId, workflowId });
    const due = dueOf(now, found, { ledgerId, liveHandle });
    if (!due.length) return null;
    return mapInOrder(due, (t) => closeOne(ctx, t, { ledgerId, workflowId, now }));
  };
}
