// draft-hold.mjs - a person's draft in a seat's input box wins (owner ruling 2026-10-09). A wake refused because text sits in the Kernel's input box (delivery
// `foreign-input`: words the runtime never typed; `draft-stuck`: a box that shrank but would not empty) is recorded once as `kernel-wake-draft-held` and is NOT a missed
// wake: the runtime never replaces, rotates or clears a seat that holds a draft, and never types over it. After the seat's wake-repeat bound (modules/reconciler/seat-cost.yaml
// kernel.wakeRepeatMs) ONE Supervisor Decision Item says that the seat cannot be woken; it closes by itself when a wake is delivered again.
import { readModuleJson } from '../../engine/runtime-root.mjs';

export const DRAFT_HELD_EVENT = 'kernel-wake-draft-held';
export const DRAFT_ITEM_KIND = 'seat-draft-held';
export const DRAFT_CLEARED_EVENT = 'kernel-wake-draft-cleared';
const ENDS_EPISODE = [`'kernel-woken'`, `'${DRAFT_CLEARED_EVENT}'`].join(',');
const DRAFT_DELIVERIES = Object.freeze(['foreign-input', 'draft-stuck']);

/** Whether a wake proof was refused for a draft in the input box. */
export const draftRefused = (proof) => proof?.ok === false && DRAFT_DELIVERIES.includes(proof.delivery);

/** The bound after which the Supervisor is told: the seat's wake-repeat time. */
export const draftBoundMs = (read = readModuleJson) => Number(read('modules', 'reconciler', 'seat-cost.yaml')?.kernel?.wakeRepeatMs);

/** The draft episode standing now, or null: {since, lastAt, refusals, terminal, delivery, draft}. It ends with the next delivered wake or with the draft being gone. */
export function draftEpisode(db, workflowId) {
  const woken = db.prepare(`SELECT MAX(created_at) AS at FROM events WHERE workflow_id=? AND kind IN (${ENDS_EPISODE})`).get(workflowId)?.at ?? 0;
  const rows = db.prepare('SELECT created_at, payload_json FROM events WHERE workflow_id=? AND kind=? AND created_at>? ORDER BY seq').all(workflowId, DRAFT_HELD_EVENT, woken);
  if (!rows.length) return null;
  const last = JSON.parse(rows.at(-1).payload_json);
  return { since: rows[0].created_at, lastAt: rows.at(-1).created_at, refusals: rows.length, terminal: last.terminal ?? null, delivery: last.delivery ?? null, draft: last.draft ?? null };
}

/** Record the refusal of a wake for a draft: once per episode (a later refusal of the same episode adds nothing). */
export function recordDraftHeld(ledger, { workflowId, terminal, proof }) {
  if (draftEpisode(ledger.db, workflowId)) return null;
  const payload = { terminal, delivery: proof.delivery, draft: String(proof.draft ?? '').slice(0, 200) };
  ledger.transaction(() => ledger.appendEvent({ workflowId, entityType: 'kernel', entityId: workflowId, kind: DRAFT_HELD_EVENT, payload }));
  return payload;
}

/** How many items of this episode the Supervisor already answered (a wait snoozes the item for another bound). */
export const answeredItems = (db, workflowId, since) => Number(db.prepare("SELECT COUNT(*) AS n FROM decision_items WHERE workflow_id=? AND kind=? AND idempotency_key LIKE ? AND status<>'open' AND status<>'claimed'")
  .get(workflowId, DRAFT_ITEM_KIND, `${DRAFT_ITEM_KIND}:${workflowId}:${since}:%`)?.n ?? 0);

/** Record that the draft is gone (the seat's input box reads empty) while an episode stood; the episode ends. */
export function recordDraftCleared(ledger, { workflowId, terminal }) {
  if (!draftEpisode(ledger.db, workflowId)) return false;
  ledger.transaction(() => ledger.appendEvent({ workflowId, entityType: 'kernel', entityId: workflowId, kind: DRAFT_CLEARED_EVENT, payload: { terminal } }));
  return true;
}

/** What the Workflow controller reads of a workflow per pass: {episode, answered, boundMs}, or null when no draft stands. */
export function draftFactsOf(db, workflowId, { boundMs = draftBoundMs() } = {}) {
  const episode = draftEpisode(db, workflowId);
  return episode ? { episode, answered: answeredItems(db, workflowId, episode.since), boundMs } : null;
}
