// seat-rotation.mjs — when a long-lived seat's session is replaced by a fresh one, and what it has spent since its boot.
//
// A seat's context grows by about a thousand tokens per turn and every turn re-reads all of it, so the cost of one session grows with
// the square of its turns (measured 2026-10-08: 50 k tokens at the first turn, 700 k to 800 k at turn 230 to 620, no compaction). The
// Kernel reads the ledger, not its memory (docs/workflow-kernel.md, Durable memory), so a replacement loses nothing: the runtime replaces a
// Kernel that is idle between wakes once it has received `afterWakes` wakes or spent `afterTokens` tokens since its boot
// (modules/reconciler/seat-cost.yaml rotation), through the same start-workflow path as every other replacement. The new seat's first
// status read is its handover: the menu, and the ledger behind it.
import { seatCostConfig, kernelWakeLog } from './seat-wakes.mjs';

/** The rule of a role: {afterWakes, afterTokens, event}, or null when the role is not rotated. */
export const rotationRule = (role) => seatCostConfig().rotation?.[role] ?? null;

/** Whether a seat that has spent `facts` ({wakes, tokens}) is due: {due, reason}. Pure. */
export function rotationDue(facts, rule) {
  if (!rule) return { due: false, reason: null };
  if (facts.wakes >= rule.afterWakes) return { due: true, reason: `${facts.wakes} wakes since its boot (bound ${rule.afterWakes})` };
  if (facts.tokens >= rule.afterTokens) return { due: true, reason: `${facts.tokens} tokens since its boot (bound ${rule.afterTokens})` };
  return { due: false, reason: null };
}

/** The session of a seat's usage row `<seat>:[<workflow>:]<session>@...`; `skip` is the number of leading parts before the session. */
export const sessionOf = (turnRef, skip) => String(turnRef).split('@')[0].split(':').slice(skip).join(':');

/** What the Kernel of a workflow has received and spent since its latest boot: {bootAt, wakes, tokens}. Ledger reads only. */
export function kernelSinceBoot(db, workflowId) {
  const boots = rotationRule('kernel').bootEvents;
  const bootAt = Number(db.prepare(`SELECT MAX(created_at) AS at FROM events WHERE workflow_id=? AND kind IN (${boots.map(() => '?').join(',')})`).get(workflowId, ...boots)?.at ?? 0);
  const wakes = kernelWakeLog(db, workflowId).filter((wake) => wake.at >= bootAt).length;
  const rows = db.prepare("SELECT turn_ref, at, COALESCE(input_tokens,0)+COALESCE(output_tokens,0)+COALESCE(cache_read_tokens,0)+COALESCE(cache_write_tokens,0) AS tokens FROM llm_usage WHERE workflow_id=? AND subject_type='kernel-turn'").all(workflowId);
  const older = new Set(rows.filter((row) => Number(row.at) < bootAt).map((row) => sessionOf(row.turn_ref, 2)));
  const tokens = rows.filter((row) => Number(row.at) >= bootAt && !older.has(sessionOf(row.turn_ref, 2))).reduce((sum, row) => sum + Number(row.tokens), 0);
  return { bootAt, wakes, tokens };
}

/**
 * The rotation of one workflow's Kernel seat, over the watchdog's seams (`openLedger`, `close` the terminal, `replace` through start-workflow,
 * `sender` proving a replacement launchable). `due()` reads the ledger; `rotate(...)` closes the idle seat, records kernel-rotated and starts
 * the replacement; its answer is `rotated` (a completed rotation is not a failure replacement: the Host does not count it toward the
 * replacements an hour allows) or the answer of the step that stopped it.
 */
export function createKernelRotation({ workflowId, openLedger, close, replace, sender, hold = () => null }) {
  const rule = rotationRule('kernel');
  const due = () => openLedger((ledger) => rotationDue(kernelSinceBoot(ledger.db, workflowId), rule)) ?? { due: false, reason: null };
  function rotate({ phase, terminal, dispatch = null, stale = {}, outputAgeMs, rotation }) {
    const launchable = sender();
    const base = { workflowId, phase, terminal, ...stale, outputAgeMs, rotation };
    if (!launchable.ok) return { ok: true, ...base, action: 'replacement-unlaunchable', reason: launchable.reason, error: launchable.error };
    // The seat that works is not closed while no start may run: a launch backing off or held for its cause would leave the workflow without a Kernel.
    const held = hold();
    if (held) return { ok: true, ...base, action: 'replacement-held', reason: `${rotation.reason}; the start is ${held.state} (${held.count} at ${held.step}: ${held.reason ?? 'one cause'}), the seat stays`, hold: held };
    const terminalClosed = close(terminal, dispatch);
    if (!terminalClosed.ok) return { ...base, terminalClosed, ok: false, action: 'kernel-terminal-close-failed', error: terminalClosed.error ?? 'the rotated kernel terminal could not be closed' };
    openLedger((ledger) => ledger.transaction(() => ledger.appendEvent({ workflowId, entityType: 'kernel', entityId: workflowId, kind: rule.event, payload: { terminal, reason: rotation.reason } })));
    const answer = replace({ ...base, terminalClosed, deathReason: `kernel ${terminal} rotated: ${rotation.reason}; a fresh seat reads the ledger` });
    return answer.action === 'restarted' ? { ...answer, action: 'rotated' } : answer;
  }
  return { due, rotate };
}
