// decision-log.mjs — the Kernel's decision log (guardrail d): one row per idea, hypothesis -> action key -> metric -> keep|revert.
// `starci kernel decide` opens an entry by hand (hypothesis mode) and `starci kernel decide --item` opens one for every answer it
// executes from the menu; both write the same event and the same typed log row.
import { recordKernel, newId } from './kernel-authority.mjs';
import { DECISION_KIND, DECISION_RESULT_KIND, opJobsOf, unitsOf } from './progress-rca.mjs';

/** The progress counters an entry is judged against: units done and total, done in the last hour, ops running. */
export const snapshotOf = (db, workflowId, now = Date.now()) => {
  const units = unitsOf(opJobsOf(db, workflowId)).filter((u) => u.state !== 'dropped');
  const done = units.filter((u) => u.state === 'done');
  return { at: now, unitsDone: done.length, unitsTotal: units.length, doneLastHour: done.filter((u) => u.doneAt >= now - 3_600_000).length,
    running: units.reduce((n, u) => n + u.open.filter((j) => j.status !== 'queued').length, 0) };
};

/** Opens an entry; `extra` rides in its payload (a menu answer names its item and choice there). Returns {id, baseline, payload}. */
export function openEntry({ ledger, repo, workflowId, hypothesis, actionKey, metric, command = null, extra = {}, now = Date.now() }) {
  const id = newId('dec');
  const baseline = snapshotOf(ledger.db, workflowId, now);
  const payload = { hypothesis: String(hypothesis), actionKey, metric: String(metric), command, baseline, ...extra };
  const commandText = command ? `\n\nCommand: \`${command}\`` : '';
  recordKernel(ledger, { workflowId, entityType: 'decision', entityId: id, kind: DECISION_KIND, repo, payload,
    msg: `decision ${id} ${actionKey}: ${hypothesis}`, markdown: `Decision **${id}**\n\nHypothesis: ${hypothesis}\n\nAction: \`${actionKey}\`${commandText}\n\nMetric: ${metric}\n\nBaseline: ${JSON.stringify(baseline)}` });
  return { id, baseline, payload };
}

/** Closes an entry with keep or revert and what the metric showed. */
export function closeEntry({ ledger, repo, workflowId, entry, result, observed, now = Date.now() }) {
  const after = snapshotOf(ledger.db, workflowId, now);
  recordKernel(ledger, { workflowId, entityType: 'decision', entityId: entry.id, kind: DECISION_RESULT_KIND, repo,
    payload: { result, observed: String(observed), after, before: entry.baseline ?? null },
    msg: `decision ${entry.id} ${result}: ${observed}`, markdown: `Decision **${entry.id}** (${entry.actionKey}) -> **${result}**\n\nObserved: ${observed}\n\nBefore: ${JSON.stringify(entry.baseline ?? null)}\nAfter: ${JSON.stringify(after)}`,
    level: result === 'keep' ? 'info' : 'warn' });
  return after;
}
