#!/usr/bin/env node
// lessons.mjs — the Supervisor's SELF-LEARNING loop (modules/supervisor/supervise.yaml selfLearning; owner,
// 2026-09-28: "self learn - the Supervisor must be able to upgrade .claude from trial and error"; refined: routine
// fixes it lands itself, only IMPORTANT upgrades go to the owner first, owner feedback outweighs self-derived lessons).
//
//   observe     the tick's owed actions (actions.mjs) carry a failure SIGNATURE: an OWED cluster id (owed.mjs labels +
//               distinctive token: check name, file, code), or <class>:<subject> for the rest
//   diagnose    a signature seen >= allocation.supervisorLearning.minRepeats times (cluster size, or a pattern that is
//               a repeat by definition) opens ONE hypothesis: symptom, cause class (gate-defect | brief-gap |
//               runtime-flow | env | contract-churn), evidence refs
//   experiment  `land` - the Supervisor's every change goes through here: the authority tier of the changed files
//               (AUTO lands; PROPOSE is refused - send `propose`), the check guardrail (a changed checker needs a spec
//               with a correct example the check wrongly blocked), the daily cap on autonomous landings, then the
//               land gate (land.mjs), then an experiment record with its baseline
//   measure     every tick (`measureExperiments`): the signature recurring after the land, or a new signature naming
//               a file the fix changed, or a success-rate drop -> revert due (owed action experiment-revert;
//               `revert --apply` makes the revert lane and lands it); quiet for measureMs -> kept
//   learn       every outcome is a lesson event; `export --write` regenerates modules/supervisor/lessons.yaml (committed
//               in a lane); `match` is consulted before diagnosing, and api dispatch injects a matching lesson beside
//               the prior attempt failures of a retry (lessonsForChecks)
//   owner       `feedback` records owner feedback (chat relay, Telegram, draw notes) as lessons with source owner,
//               weight allocation.supervisorLearning.ownerWeight above self-derived ones
//
// Everything is a machine.sqlite sup_learning row (item_id stable, detail_json the full record) with one sup_events
// audit row per change (kinds supervisor-hypothesis, supervisor-experiment, supervisor-experiment-result,
// supervisor-lesson, supervisor-proposal):
//   hypothesis         item hyp:<signature>, the newest hypothesis of the signature
//   experiment         item <exp id>, state measuring | revert-due | kept | reverted | did-not-work
//   experiment-result  item <exp id>:result, the newest verdict (parent the experiment)
//   lesson | owner-feedback | leftover   one item per lesson (owner feedback and GC leftovers by their own kind)
//   proposal           item <prop id>
//
//   node scripts/machine/lessons.mjs list [--json]                      hypotheses, experiments, lessons, proposals
//   node scripts/machine/lessons.mjs match (--signature <s> | --text <t>) [--json]
//   node scripts/machine/lessons.mjs tier --commit <sha>[,<sha>]          the authority tier of a change
//   node scripts/machine/lessons.mjs result --experiment <id> --outcome kept|reverted|did-not-work --reason <text>
//   node scripts/machine/lessons.mjs feedback --text <t> [--signature <s>] [--via chat|telegram|draw-note] [--refs <csv>]
//   (land | revert | propose: scripts/supervisor/lesson-actions.mjs — they call the land gate and the owner push)
//   node scripts/machine/lessons.mjs export [--write]                    modules/supervisor/lessons.yaml
//   node scripts/machine/lessons.mjs tick --items <json> [--json]        the learning pass over the given items (the reconciler's Learning controller)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { allocationSettings } from '../../engine/config.mjs';
import { gitSpawn } from '../api/git/lib.mjs';
import { clipLine } from '../lib/clip.mjs';
import { posixPath } from '../lib/path-key.mjs';
import { SKILL_ROOT, readSupervisor, supervisorEvent, withSupervisor } from './home.mjs';
import { refsOf, supLog } from './sup-log.mjs';
import { LESSONS_FILE, lessonsForChecks, parseLessonsFile } from './lessons-file.mjs';

export { LESSONS_FILE, lessonsForChecks, parseLessonsFile };

const selfFile = fileURLToPath(import.meta.url);
export const KINDS = Object.freeze({
  hypothesis: 'supervisor-hypothesis', experiment: 'supervisor-experiment', result: 'supervisor-experiment-result',
  lesson: 'supervisor-lesson', proposal: 'supervisor-proposal',
});
export const one = (s, n = 300) => clipLine(String(s ?? '').replace(/\s+/g, ' '), n);
const norm = posixPath;

/** allocation.supervisorLearning, every number checked. */
export function learningSettings(allocation = allocationSettings()) {
  const s = allocation?.supervisorLearning;
  const need = (k) => { const v = Number(s?.[k]); if (!Number.isFinite(v) || v <= 0) throw Error(`modules/models/runtimes.yaml allocation.supervisorLearning.${k} must be a positive number`); return v; };
  return { minRepeats: need('minRepeats'), measureMs: need('measureMs'), dailyAutoLandCap: need('dailyAutoLandCap'), ownerWeight: need('ownerWeight'), successDrop: need('successDrop') };
}

/* ------------------------------------------------------------ observe + diagnose */

/** The signature of an owed action: its cluster id for OWED clusters, else <class>:<subject without the workflow>. Pure. */
export const signatureOf = (item) => (item.key?.startsWith('owed|') ? item.subject : `${item.class}:${String(item.subject ?? '').replace(/^wf-[^|]+$/, 'workflow')}`);

/** The cause class of a signature from its words. Pure. */
export function causeClassOf(text) {
  const t = String(text ?? '').toLowerCase();
  if (/knowledge-churn|stale-input|contract|schema|re-?stale/.test(t)) return 'contract-churn';
  if (/host|tooling|enametoolong|spawn|timeout|provider|worker-died|repeat-reject|env|quota|orca/.test(t)) return 'env';
  if (/checker|check|lint|gate|scan|validate|acceptance|conformance/.test(t)) return 'gate-defect';
  if (/brief|prompt|instruction|report|asks?\b/.test(t)) return 'brief-gap';
  return 'runtime-flow';
}

/** How many times the item's signature repeated: its cluster size, 2 for a repeat pattern by definition. Pure. */
export const repeatsOf = (item) => Math.max(Number(item.size ?? 1), item.class === 'retry-cap' ? 2 : 1);

/**
 * The hypotheses to open this tick: one per signature repeated >= minRepeats with no open hypothesis or measuring
 * experiment for it. Pure. [{signature, symptom, causeClass, evidence, source: 'self', weight: 1}].
 */
export function newHypotheses(items, state, { minRepeats }) {
  const out = [];
  for (const i of items) {
    const signature = signatureOf(i);
    if (!signature || repeatsOf(i) < minRepeats) continue;
    const s = state.signatures[signature];
    if (s && ['open', 'measuring'].includes(s.status)) continue;
    if (out.some((h) => h.signature === signature)) continue;
    out.push({ signature, symptom: one(i.evidence), causeClass: causeClassOf(`${signature} ${i.evidence}`),
      evidence: [i.key, ...(i.incidents ?? [])].filter(Boolean).slice(0, 12), workflows: String(i.workflowId ?? '').split(',').filter(Boolean), source: 'self', weight: 1 });
  }
  return out;
}

/* ------------------------------------------------------------ the state */

const EMPTY_STATE = () => ({ signatures: {}, experiments: {}, lessons: [], proposals: {} });
const LESSON_KINDS = new Set(['lesson', 'owner-feedback', 'leftover']);

/**
 * The learning state from the sup_learning rows over the machine handle `m`: {signatures: {sig: {status, hypothesis,
 * experiments}}, experiments, lessons, proposals}. Each record carries `seq` (its audit event), so the rows replay in the
 * order they were written.
 */
export function learningState(m) {
  const rows = m.db.prepare('SELECT kind, item_id, detail_json FROM sup_learning').all()
    .map((r) => { let d = null; try { d = JSON.parse(r.detail_json ?? 'null'); } catch { d = null; } return { kind: r.kind, id: r.item_id, p: d ?? {} }; })
    .sort((a, b) => (a.p.seq ?? 0) - (b.p.seq ?? 0) || (a.p.at ?? 0) - (b.p.at ?? 0));
  const { signatures, experiments, lessons, proposals } = EMPTY_STATE();
  const sig = (s) => (signatures[s] ??= { status: null, hypothesis: null, experiments: [] });
  // An experiment row holds its landing; its result row (the newest verdict) replays at the verdict's own seq.
  for (const r of rows) {
    const p = r.p;
    if (r.kind === 'hypothesis') Object.assign(sig(p.signature), { status: 'open', hypothesis: p });
    else if (r.kind === 'experiment') {
      experiments[p.id] = { ...p, status: 'measuring' };
      sig(p.signature).experiments.push(p.id); sig(p.signature).status = 'measuring';
    } else if (r.kind === 'experiment-result' && experiments[p.id]) {
      experiments[p.id] = { ...experiments[p.id], status: p.outcome, result: p };
      const s = sig(experiments[p.id].signature);
      s.status = p.outcome === 'kept' ? 'kept' : p.outcome === 'revert-due' ? 'measuring' : 'reverted';
      if (p.outcome === 'revert-due') experiments[p.id].status = 'revert-due';
    } else if (LESSON_KINDS.has(r.kind)) lessons.push(p);
    else if (r.kind === 'proposal') proposals[p.id] = p;
  }
  return { signatures, experiments, lessons, proposals };
}
export const readLearning = ({ env = process.env } = {}) => readSupervisor((m) => learningState(m), EMPTY_STATE(), { env });

/** The sup_learning row of one change: {itemId, kind, parentId, title, state}. Pure over `kind` and the payload. */
function learningItem(kind, p) {
  if (kind === KINDS.hypothesis) return { itemId: `hyp:${p.signature}`, kind: 'hypothesis', title: String(p.signature), state: 'open' };
  if (kind === KINDS.experiment) return { itemId: p.id, kind: 'experiment', title: String(p.signature), state: 'measuring', lane: p.lane ?? null, landedSha: p.head ?? null };
  if (kind === KINDS.result) return { itemId: `${p.id}:result`, kind: 'experiment-result', parentId: p.id, title: String(p.signature), state: p.outcome ?? null };
  if (kind === KINDS.proposal) return { itemId: p.id, kind: 'proposal', title: String(p.title ?? p.id), state: p.status ?? 'open' };
  const lessonKind = p.status === 'owner-feedback' ? 'owner-feedback' : p.via === 'gc' ? 'leftover' : 'lesson';
  return { itemId: `les-${crypto.randomUUID()}`, kind: lessonKind, title: String(p.signature ?? p.text ?? 'lesson').slice(0, 200), state: p.status ?? null, lane: p.lane ?? null };
}

/**
 * Record one learning change: its sup_events audit row, then its sup_learning row (detail_json the full record with
 * `at` and `seq`). A result also moves its experiment row's state; a proposal merges into its existing record.
 */
export const write = (env, kind, payload, now = Date.now()) => {
  const item = learningItem(kind, payload);
  withSupervisor((m) => m.transaction(() => {
    const { seq } = supervisorEvent(m, { entityType: 'learning', entityId: payload.id ?? payload.signature ?? kind, kind, payload, now });
    const prior = m.db.prepare('SELECT detail_json, created_at FROM sup_learning WHERE item_id=?').get(item.itemId);
    const merged = kind === KINDS.proposal && prior ? { ...(JSON.parse(prior.detail_json ?? '{}') ?? {}), ...payload } : payload;
    const parentId = item.parentId && m.db.prepare('SELECT 1 FROM sup_learning WHERE item_id=?').get(item.parentId) ? item.parentId : null;
    m.upsert('sup_learning', { item_id: item.itemId, kind: item.kind, parent_id: parentId, title: item.title, state: item.state, source_ref: payload.signature ?? null,
      lane: item.lane ?? null, landed_sha: item.landedSha ?? null, detail_json: { ...merged, at: now, seq }, created_at: prior?.created_at ?? now, updated_at: now }, ['item_id']);
    if (parentId && kind === KINDS.result) m.update('sup_learning', { state: payload.outcome, updated_at: now }, { item_id: parentId });
  }), { env });
  supLog(learningRow(kind, payload, now), { env });
  return payload;
};

/** The typed log row of one learning event (sup-log.mjs). Pure. */
export function learningRow(kind, p, at) {
  const refs = refsOf({ workflowId: (p.workflows ?? []).join(','), commits: p.commits ?? (p.revertCommit ? [p.revertCommit] : []), experiment: p.id?.startsWith('exp-') ? p.id : null,
    extra: [p.signature ? `signature:${p.signature}` : null, p.id?.startsWith('prop-') ? `proposal:${p.id}` : null] });
  if (kind === KINDS.hypothesis) return { kind: 'decision', at, msg: `hypothesis ${p.signature} [${p.causeClass}]: ${p.symptom}`, data: { markdown: `Hypothesis for **${p.signature}** (cause class ${p.causeClass}, source ${p.source}): ${p.symptom}

Evidence: ${(p.evidence ?? []).join(', ')}` }, refs };
  if (kind === KINDS.experiment) return { kind: 'supervisor.action', at, msg: `experiment ${p.id} landed for ${p.signature} (${p.tier})`, data: { action: 'experiment-land', item: `experiment|${p.id}`, reason: p.reason ?? '', class: 'experiment' }, refs };
  if (kind === KINDS.result) return { kind: 'decision', at, level: p.outcome === 'kept' ? 'info' : 'warn', msg: `experiment ${p.id} ${p.outcome}: ${p.reason ?? ''}`, data: { markdown: `Experiment ${p.id} (${p.signature}): **${p.outcome}** - ${p.reason ?? ''}` }, refs };
  if (kind === KINDS.proposal) return { kind: 'decision', at, msg: `proposal ${p.id} to the owner: ${p.title}`, data: { markdown: `Proposal ${p.id}: ${p.title}

Evidence: ${p.evidence}

Options: ${p.options}

Recommendation: ${p.recommendation}` }, refs };
  if (p.status === 'refused') return { kind: 'warning', at, msg: `land refused for ${p.signature}`, data: { code: 'land-refused', message: p.text ?? 'refused' }, refs };
  return { kind: 'narration', at, msg: `lesson [${p.source}] ${p.signature ?? '-'}: ${p.text ?? ''}`, data: { markdown: String(p.text ?? '') }, refs };
}

/* ------------------------------------------------------------ authority + guardrails */

// PROPOSE-TO-OWNER paths (supervise.yaml selfLearning.tiers.propose): owner rulings, brand direction and brand
// records, knowledge rule meaning (grammar snapshots aside), the kernel contract and op graph, owner caps/budgets.
const PROPOSE_PATHS = [
  [/^modules\/kernel\/owner-rulings\.yaml$/, 'owner rulings'],
  [/^knowledge\/ui\/examples\/brand-direction[^/]*$/, 'brand direction'],
  [/(^|\/)brand[^/]*\/|\.starciwork\/.*brand/, 'brand records'],
  [/^knowledge\/(?!grammars\/)/, 'knowledge rule meaning'],
  [/^modules\/kernel\/(driver-loop|api|verdict-contract)\.yaml$/, 'kernel contract'],
  [/^modules\/ops\/registry\.yaml$|^scripts\/route\/plan-edges\.mjs$/, 'op graph'],
  [/^config(\.example)?\.yaml$/, 'owner caps / budgets'],
];
// Where checks and gates live: the runtime self-checks, the product gates, the HFS engine and the Work judges.
const CHECKER = /^scripts\/(checks|gates|hfs|work\/(validate|draw|ui|brand))\//;

/**
 * The tier of a change from its files ({path, status: A|M|D|R}): 'auto' or 'propose' with the reasons. A deleted
 * checker is removing a gate class: propose. Pure.
 */
export function tierOf(files) {
  const reasons = [];
  for (const f of files) {
    const p = norm(f.path);
    for (const [re, why] of PROPOSE_PATHS) if (re.test(p)) reasons.push(`${why}: ${p}`);
    if (CHECKER.test(p) && f.status === 'D') reasons.push(`removes a gate: ${p}`);
  }
  return { tier: reasons.length ? 'propose' : 'auto', reasons };
}

/**
 * The hard guardrails for an autonomous land. Pure over its inputs; {ok, refusals}.
 *   - tier propose -> refused (send a proposal instead)
 *   - a modified checker (CHECKER: checks, gates, hfs, work judges) needs `wronglyBlocked`: a changed spec under tests/ whose text shows the
 *     correct example the check wrongly blocked ("wrongly blocked" / "wrongly-blocked"); never relax a check to green
 *   - the daily cap on autonomous landings
 */
export function guardLand({ files, wronglyBlocked = null, specText = (f) => '', landedToday = 0, cap }) {
  const refusals = [];
  const t = tierOf(files);
  if (t.tier === 'propose') refusals.push({ code: 'propose-tier', detail: `an IMPORTANT change - propose it to the owner (lesson-actions.mjs propose): ${t.reasons.join('; ')}` });
  const checkers = files.filter((f) => CHECKER.test(norm(f.path)) && f.status !== 'A' && f.status !== 'D');
  if (checkers.length) {
    const spec = wronglyBlocked ? norm(wronglyBlocked) : null;
    const inChange = spec && files.some((f) => norm(f.path) === spec && /^tests\/.+\.spec\.mjs$/.test(spec));
    if (!inChange || !/wrongly[ -]blocked/i.test(specText(spec) ?? '')) {
      refusals.push({ code: 'check-relax-unproven', detail: `changes checker(s) ${checkers.map((f) => norm(f.path)).join(', ')} without a spec in the change that shows the correct example the check wrongly blocked (--wrongly-blocked <tests/x.spec.mjs>, its text naming "wrongly blocked")` });
    }
  }
  if (landedToday >= cap) refusals.push({ code: 'daily-cap', detail: `${landedToday} autonomous landing(s) in the last 24 h reach runtimes.yaml supervisorLearning.dailyAutoLandCap ${cap}` });
  return { ok: refusals.length === 0, tier: t.tier, refusals };
}

export const git = (args, { cwd = SKILL_ROOT } = {}) => {
  const r = gitSpawn('git', args, { cwd, maxBuffer: 64 * 1024 * 1024 });
  return { ok: r.status === 0, out: String(r.stdout ?? '').trim(), err: String(r.stderr ?? '').trim() };
};
/** The files the commits change, with their status letter. */
export function commitFiles(commits, { cwd = SKILL_ROOT } = {}) {
  const map = new Map();
  for (const sha of commits) {
    const r = git(['diff-tree', '--no-commit-id', '--name-status', '-r', '-M', sha], { cwd });
    if (!r.ok) throw Object.assign(new Error(`git diff-tree ${sha}: ${r.err}`), { code: 'commit-unreadable' });
    for (const line of r.out.split(/\r?\n/).filter(Boolean)) {
      const [st, ...rest] = line.split('\t');
      map.set(norm(rest.at(-1)), { path: norm(rest.at(-1)), status: st[0] });
    }
  }
  return [...map.values()];
}
export const landedWithin = (state, { now, ms = 24 * 3_600_000 }) => Object.values(state.experiments).filter((e) => e.tier === 'auto' && now - (e.landedAt ?? e.at) < ms).length;

/* ------------------------------------------------------------ measure */

/**
 * The experiments' verdicts this tick. Pure. `items` are the owed actions now (each with signatureOf, lastAt, evidence);
 * `successRate` the op-health success rate now (op-metrics, when the tick has it). Returns
 * [{id, outcome: 'revert-due'|'kept', reason}] for experiments whose state changes.
 */
export function measureExperiments(state, { items = [], now = Date.now(), measureMs, successRate = null, successDrop = 0.1 }) {
  const out = [];
  for (const e of Object.values(state.experiments)) {
    if (e.status !== 'measuring') continue;
    const since = e.landedAt ?? e.at;
    const recurred = items.filter((i) => signatureOf(i) === e.signature && (i.lastAt ?? i.firstSeenAt ?? now) > since);
    const touched = (e.files ?? []).map((f) => path.posix.basename(f)).filter((b) => b.length > 4);
    const regressions = items.filter((i) => signatureOf(i) !== e.signature && (i.firstSeenAt ?? now) > since && touched.some((b) => String(i.evidence ?? '').includes(b)));
    const drop = successRate != null && e.baseline?.successRate != null && e.baseline.successRate - successRate >= successDrop;
    if (recurred.length || regressions.length || drop) {
      out.push({ id: e.id, outcome: 'revert-due', reason: [recurred.length ? `signature ${e.signature} recurred after the land (${recurred.map((i) => i.key).join(', ')})` : null,
        regressions.length ? `new signature(s) naming a changed file: ${regressions.map((i) => i.key).join(', ')}` : null,
        drop ? `success rate ${e.baseline.successRate} -> ${successRate}` : null].filter(Boolean).join('; ') });
    } else if (now - since >= measureMs) out.push({ id: e.id, outcome: 'kept', reason: `no recurrence of ${e.signature} and no regression for ${Math.round((now - since) / 3_600_000)} h` });
  }
  return out;
}

/** The tick's learning pass: open hypotheses, judge experiments, record lessons. Returns {hypotheses, verdicts, revertDue}. */
export function learnTick({ items, env = process.env, now = Date.now(), successRate = null, settings = learningSettings() }) {
  const state = readLearning({ env });
  const hypotheses = newHypotheses(items, state, settings);
  for (const h of hypotheses) write(env, KINDS.hypothesis, h, now);
  const verdicts = measureExperiments(state, { items, now, measureMs: settings.measureMs, successRate, successDrop: settings.successDrop });
  for (const v of verdicts) {
    const e = state.experiments[v.id];
    write(env, KINDS.result, { id: v.id, signature: e.signature, outcome: v.outcome, reason: v.reason }, now);
    if (v.outcome === 'kept') write(env, KINDS.lesson, { signature: e.signature, source: 'self', weight: 1, status: 'kept', cause: state.signatures[e.signature]?.hypothesis?.causeClass ?? null,
      fix: e.commits, effect: v.reason, text: `${e.signature}: fixed by ${e.commits.map((c) => c.slice(0, 9)).join(',')} (${e.reason ?? 'no reason recorded'}) - ${v.reason}` }, now);
  }
  const after = readLearning({ env });
  const revertDue = Object.values(after.experiments).filter((e) => e.status === 'revert-due');
  return { hypotheses, verdicts, revertDue, openHypotheses: Object.entries(after.signatures).filter(([, s]) => s.status === 'open').map(([k]) => k) };
}

/* ------------------------------------------------------------ revert */

/* ------------------------------------------------------------ lessons: owner feedback, match, export */

export function recordFeedback({ text, signature = null, via = 'chat', refs = [], env = process.env, now = Date.now(), settings = learningSettings() }) {
  if (!String(text ?? '').trim()) throw Object.assign(new Error('feedback needs --text'), { code: 'feedback-empty' });
  return write(env, KINDS.lesson, { signature, source: 'owner', via, weight: settings.ownerWeight, status: 'owner-feedback', text: one(text, 1000), refs }, now);
}

/**
 * A leftover the tick GC (gc.mjs) had to collect is a bug in the owner that should have closed it (owner 2026-09-28:
 * each Kernel closes its own ops' terminals at settle, the Supervisor closes its own [Worker]s; the GC sweeps what
 * slipped past both). One self-derived lesson per leftover class and per `dedupeMs` (default a day), signature
 * gc-leftover:<klass>, naming the owner step at fault and examples; also the signature a hypothesis opens on.
 * Returns the lesson payload, or null when one was recorded within dedupeMs.
 */
export const GC_LEFTOVER_OWNERS = Object.freeze({
  'op-worker': 'the Kernel settle path (scripts/kernel/cli.mjs settle: quit + close + close-verify of the op worker terminal)',
  'kernel': 'api finish/archive (closeKernelTerminal -> close-verify.mjs closeSelfSafe) or the kernel replace in scripts/kernel/start-workflow.mjs',
  'sup-worker': 'the Supervisor worker lifecycle (scripts/supervisor/workers.mjs closeWorkerTerminal at report/cancel/land)',
  'supervisor-seat': 'the Supervisor seat replace (scripts/supervisor/start-supervisor.mjs)',
  'idle-shell': 'whatever created a bare shell terminal and never closed it (terminal create without --command, or an agent that exited)',
});
export function recordLeftover({ klass, count = 1, examples = [], env = process.env, now = Date.now(), dedupeMs = 24 * 3_600_000 }) {
  const signature = `gc-leftover:${klass}`;
  const recent = readLearning({ env }).lessons.some((l) => l.signature === signature && now - (l.at ?? 0) < dedupeMs);
  if (recent) return null;
  const owner = GC_LEFTOVER_OWNERS[klass] ?? 'its creator';
  return write(env, KINDS.lesson, { signature, source: 'self', via: 'gc', weight: 1, status: 'observed',
    text: one(`GC collected ${count} leftover ${klass} terminal(s)/tree(s) the owner step should have closed: ${owner}. Examples: ${examples.slice(0, 3).join('; ') || '-'}. A leftover is a bug in that step - fix the step, do not rely on the GC.`, 1000),
    refs: [] }, now);
}

/** Lessons relevant to a signature or text, owner first, then by weight and recency. Pure. */
export function matchLessons(lessons, { signature = null, text = null, limit = 5 } = {}) {
  const words = new Set(String(text ?? '').toLowerCase().match(/[a-z0-9][a-z0-9._-]{3,}/g) ?? []);
  const score = (l) => {
    if (signature && l.signature === signature) return 100;
    const hay = `${l.signature ?? ''} ${l.text ?? ''}`.toLowerCase();
    return [...words].filter((w) => hay.includes(w)).length;
  };
  return lessons.filter((l) => l.status !== 'refused').map((l) => ({ l, s: score(l) })).filter((x) => x.s > 0)
    .sort((a, b) => (b.l.weight ?? 1) * b.s - (a.l.weight ?? 1) * a.s || (b.l.at ?? 0) - (a.l.at ?? 0)).slice(0, limit).map((x) => x.l);
}

/** The versioned lessons file's text from the state (kept, reverted and owner lessons). */
export function lessonsYaml(state) {
  const q = (s) => JSON.stringify(String(s ?? ''));
  const rows = state.lessons.filter((l) => ['kept', 'reverted', 'owner-feedback'].includes(l.status));
  return ['# lessons.yaml - GENERATED by `node scripts/machine/lessons.mjs export --write` from machine.sqlite sup_learning',
    '# (supervise.yaml selfLearning). Never hand-edit: record lessons with lessons.mjs (feedback, land, measured results).',
    'schema: starci/supervisor-lessons@1', 'lessons:',
    ...rows.flatMap((l) => [`  - signature: ${q(l.signature ?? '')}`, `    source: ${l.source}`, `    weight: ${l.weight ?? 1}`, `    status: ${l.status}`,
      ...(l.cause ? [`    cause: ${l.cause}`] : []), ...(l.fix?.length ? [`    fix: [${l.fix.map((c) => q(String(c).slice(0, 12))).join(', ')}]`] : []),
      `    at: '${new Date(l.at ?? 0).toISOString()}'`, `    text: ${q(l.text)}`]),
  ].join('\n').replace(/lessons:$/, 'lessons: []') + '\n';
}

/** The digest block (actions.mjs ownerDigest): experiments kept/reverted and open proposals since `since`. Pure. */
export function learningDigest(state, { since = 0 } = {}) {
  const results = Object.values(state.experiments).filter((e) => ['kept', 'reverted', 'revert-due'].includes(e.status) && (e.result?.at ?? 0) > since);
  const measuring = Object.values(state.experiments).filter((e) => e.status === 'measuring');
  const open = Object.values(state.proposals).filter((p) => p.status === 'open');
  const owner = state.lessons.filter((l) => l.source === 'owner' && (l.at ?? 0) > since);
  const lines = [];
  if (results.length || measuring.length) lines.push(`Self-learning: ${results.filter((e) => e.status === 'kept').length} kept, ${results.filter((e) => e.status === 'reverted').length} reverted, ${measuring.length} measuring`);
  for (const e of results) lines.push(`- ${e.status} ${e.signature} (${(e.commits ?? []).map((c) => c.slice(0, 9)).join(',')}): ${one(e.result?.reason, 140)}`);
  if (owner.length) lines.push(`Owner feedback learned: ${owner.length}`);
  if (open.length) { lines.push(`Proposals waiting on you (${open.length}):`); for (const p of open) lines.push(`- ${p.id} ${p.title} -> ${one(p.recommendation, 120)}`); }
  return lines;
}

/* ------------------------------------------------------------ CLI */

if (process.argv[1] && path.resolve(process.argv[1]) === selfFile) {
  const argv = process.argv.slice(2);
  const verb = argv[0];
  const value = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] ?? null : null; };
  const csv = (v) => String(v ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const asJson = argv.includes('--json');
  const print = (r, human) => console.log(asJson ? JSON.stringify(r) : human);
  try {
    if (verb === 'list') {
      const s = readLearning();
      print(s, [`hypotheses open: ${Object.entries(s.signatures).filter(([, x]) => x.status === 'open').map(([k]) => k).join(', ') || '-'}`,
        ...Object.values(s.experiments).map((e) => `experiment ${e.id} [${e.status}] ${e.signature} ${(e.commits ?? []).map((c) => c.slice(0, 9)).join(',')} lane ${e.lane}`),
        `lessons: ${s.lessons.length} (${s.lessons.filter((l) => l.source === 'owner').length} from the owner)`,
        ...Object.values(s.proposals).map((p) => `proposal ${p.id} [${p.status}] ${p.title}`)].join('\n'));
    } else if (verb === 'match') {
      const r = matchLessons(readLearning().lessons, { signature: value('signature'), text: value('text') });
      print(r, r.map((l) => `[${l.source} w${l.weight ?? 1} ${l.status}] ${l.signature ?? '-'}: ${l.text}`).join('\n') || 'no matching lesson');
    } else if (verb === 'tier') {
      const r = tierOf(commitFiles(csv(value('commit'))));
      print(r, `${r.tier}${r.reasons.length ? `: ${r.reasons.join('; ')}` : ''}`);
    } else if (verb === 'result') {
      const e = readLearning().experiments[value('experiment')];
      if (!e || !['kept', 'reverted', 'did-not-work'].includes(value('outcome')) || !value('reason')) throw Object.assign(new Error('result needs a known --experiment, --outcome kept|reverted|did-not-work and --reason'), { code: 'result-incomplete' });
      write(process.env, KINDS.result, { id: e.id, signature: e.signature, outcome: value('outcome'), reason: one(value('reason'), 500) });
      print({ ok: true }, `recorded ${value('outcome')} for ${e.id}`);
    } else if (verb === 'feedback') {
      const r = recordFeedback({ text: value('text'), signature: value('signature'), via: value('via') ?? 'chat', refs: csv(value('refs')) });
      print(r, `owner lesson recorded (weight ${r.weight})`);
    } else if (verb === 'tick') {
      const items = JSON.parse(value('items') ?? '[]');
      if (!Array.isArray(items)) throw Object.assign(new Error('tick needs --items <json array>'), { code: 'tick-items' });
      const r = learnTick({ items });
      print(r, `hypotheses ${r.hypotheses.length}, verdicts ${r.verdicts.length}, revert due ${r.revertDue.length}`);
    } else if (verb === 'export') {
      const text = lessonsYaml(readLearning());
      if (argv.includes('--write')) { fs.writeFileSync(path.join(process.cwd(), LESSONS_FILE), text); console.log(`wrote ${LESSONS_FILE} in ${process.cwd()} (commit it in a lane)`); }
      else process.stdout.write(text);
    } else {
      console.error('use: lessons.mjs list | match | tier | result | feedback | tick | export (see the header; land | revert | propose: scripts/supervisor/lesson-actions.mjs)');
      process.exitCode = 2;
    }
  } catch (error) {
    console.error(`lessons: ${error?.message ?? error}`);
    process.exitCode = /incomplete|empty|unknown/.test(error?.code ?? '') ? 2 : 1;
  }
}
