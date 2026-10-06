// learning.mjs — the Learning controller (reconciler DESIGN §8.7, §18 step 7; lane rc-workers).
//
//   learning:tick  every resyncMs (30 min), and at once on runtime-invariant-violated: the invariant violations of the
//                  window become learning items with signature `inv:<code>` (one item per code, its size the number of
//                  violations); the owed actions are the Workers controller's.
//                  scripts/machine/lessons.mjs newHypotheses decides which signatures repeated >= minRepeats with no
//                  open hypothesis -> ONE Supervisor DI `hypothesis` per signature; measureExperiments judges the
//                  landed experiments -> ONE Supervisor DI `experiment-revert` per experiment whose revert is due.
//                  Active, it also runs the recording pass (`lessons.mjs` learnTick through ctx.run) so the hypotheses
//                  and verdicts land in the learning log; shadow records would-rows only.
// Pure planner planLearning; numbers: modules/reconciler/learning.yaml and runtimes.yaml allocation.supervisorLearning.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { yamlNumberSettings } from '../../lib/read-yaml.mjs';
import { clipLine } from '../../lib/clip.mjs';
import { ownerLanguage, translator } from '../../lib/i18n.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const LEARNING_FILE = path.join(ROOT, 'modules', 'reconciler', 'learning.yaml');
export const KEY = 'learning:tick';
// resyncMs is the tick cadence (30 min); a runtime-invariant-violated event runs the pass at once. It is idempotent.
export const DEFAULTS = Object.freeze({ resyncMs: 1_800_000, concurrency: 1, windowMs: 86_400_000, decisionDueMs: 3_600_000 });

function learningControllerSettings(file = LEARNING_FILE) {
  return yamlNumberSettings(file, DEFAULTS);
}

/**
 * Violations -> learning items, one per invariant code: {key, class: 'invariant', subject, size, evidence, firstSeenAt,
 * lastAt}. `violations` [{code, dedupeKey, at}] (sla.mjs events), counted inside `windowMs`. Pure.
 */
export function violationItems(violations, { now, windowMs = DEFAULTS.windowMs }) {
  const byCode = new Map();
  for (const v of violations) {
    if (!v?.code || now - Number(v.at ?? now) > windowMs) continue;
    const it = byCode.get(v.code) ?? { key: `owed|inv:${v.code}`, class: 'invariant', subject: `inv:${v.code}`, size: 0, evidence: '', entities: [], firstSeenAt: Number(v.at), lastAt: Number(v.at) };
    it.size += 1;
    it.entities.push(v.dedupeKey ?? v.entity ?? '');
    it.firstSeenAt = Math.min(it.firstSeenAt, Number(v.at)); it.lastAt = Math.max(it.lastAt, Number(v.at));
    byCode.set(v.code, it);
  }
  return [...byCode.values()].map((i) => ({ ...i, evidence: `inv:${i.subject.slice(4)} x${i.size}: ${[...new Set(i.entities)].slice(0, 4).join(', ')}`, incidents: [] }));
}

/**
 * What one pass decides. Pure over `items`, the learning `state` (lessons.mjs learningState) and the helpers
 * `newHypotheses` / `measureExperiments` (injected so a spec can run it without a ledger). {decisions, hypotheses, verdicts}.
 */
export function planLearning({ items, state, settings, now, newHypotheses, measureExperiments, dueMs = DEFAULTS.decisionDueMs, language = ownerLanguage() }) {
  const tr = translator(language);
  const hypotheses = newHypotheses(items, state, { minRepeats: settings.minRepeats });
  const verdicts = measureExperiments(state, { items, now, measureMs: settings.measureMs, successDrop: settings.successDrop });
  const di = (kind, key, summary, entity, evidence) => ({ schema: 'starci/decision-item@1', idempotencyKey: key, kind, decider: 'supervisor', ledger: 'supervisor',
    entity, summary: clipLine(summary, 300), evidence: evidence.filter(Boolean).slice(0, 8).map((ref) => ({ ref: clipLine(ref, 400) })), options: [],
    openedBy: 'learning-controller', openedAt: now, dueAt: now + dueMs, escalateTo: 'owner', escalations: 0, status: 'open' });
  const decisions = [
    ...hypotheses.map((h) => di('hypothesis', `hypothesis:${h.signature}`, tr('New hypothesis: {signature} repeats ({causeClass}): {symptom}', { signature: h.signature, causeClass: h.causeClass, symptom: h.symptom ?? '' }), { type: 'signature', id: h.signature }, [h.symptom, ...(h.evidence ?? [])])),
    ...verdicts.filter((v) => v.outcome === 'revert-due').map((v) => di('experiment-revert', `experiment-revert:${v.id}`, tr('Experiment {id} needs a revert: {reason}', { id: v.id, reason: v.reason }), { type: 'experiment', id: v.id }, [v.reason])),
  ];
  return { decisions, hypotheses, verdicts };
}

export async function reconcileLearning(key, ctx, { settings = learningControllerSettings(), deps = {} } = {}) {
  if (key !== KEY) return { ok: false, key, skipped: 'unknown-key' };
  const now = ctx.now();
  const lessons = deps.lessons ?? await import('../../machine/lessons.mjs');
  let violations = deps.violations;
  if (!violations) {
    try {
      const { readSupervisor } = await import('../../machine/home.mjs');
      violations = readSupervisor((m) => m.db.prepare('SELECT code, entity, violated_at FROM invariant_violations WHERE violated_at>=? ORDER BY violation_id').all(now - settings.windowMs)
        .map((r) => ({ code: r.code, dedupeKey: `${r.code}|${r.entity}`, at: Number(r.violated_at) })), [], { env: ctx.env ?? process.env });
    } catch { violations = []; }
  }
  const items = violationItems(violations, { now, windowMs: settings.windowMs });
  const state = deps.state ?? lessons.readLearning({ env: ctx.env ?? process.env });
  let ls;
  try { ls = deps.learningSettings ?? lessons.learningSettings(); } catch { ls = { minRepeats: 2, measureMs: 86_400_000, successDrop: 0.1 }; }
  const language = deps.language ?? ownerLanguage();
  const plan = planLearning({ items, state, settings: ls, now, newHypotheses: lessons.newHypotheses, measureExperiments: lessons.measureExperiments, dueMs: settings.decisionDueMs, language });
  const opened = [];
  for (const d of plan.decisions) { try { await ctx.openDecision(d); opened.push(d.idempotencyKey); } catch { /* the next pass retries */ } }
  // The recording pass (hypothesis rows, experiment verdicts, lessons) is a write: through ctx.run, so shadow only records it.
  if (plan.hypotheses.length || plan.verdicts.length) await ctx.run('node', ['scripts/machine/lessons.mjs', 'tick', '--items', JSON.stringify(items), '--json'], { timeoutMs: 120_000 });
  return { ok: true, key, items: items.length, hypotheses: plan.hypotheses.map((h) => h.signature), verdicts: plan.verdicts.map((v) => `${v.id}:${v.outcome}`), opened };
}

export default {
  name: 'learning',
  concerns: ['learning.tick'],
  resyncMs: DEFAULTS.resyncMs,
  concurrency: DEFAULTS.concurrency,
  routes: { 'runtime-invariant-violated': () => KEY },
  list: async () => [KEY],
  reconcile: (key, ctx) => reconcileLearning(key, ctx, { settings: learningControllerSettings() }),
};
