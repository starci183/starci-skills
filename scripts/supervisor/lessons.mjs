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
// Everything is a supervisor-ledger event (never a hand-written ledger):
//   supervisor-hypothesis, supervisor-experiment, supervisor-experiment-result, supervisor-lesson, supervisor-proposal.
//
//   node scripts/supervisor/lessons.mjs list [--json]                      hypotheses, experiments, lessons, proposals
//   node scripts/supervisor/lessons.mjs match (--signature <s> | --text <t>) [--json]
//   node scripts/supervisor/lessons.mjs tier --commit <sha>[,<sha>]          the authority tier of a change
//   node scripts/supervisor/lessons.mjs land --signature <s> --commit <sha>[,<sha>] --lane <name> [--specs <csv>]
//        [--wrongly-blocked <tests/x.spec.mjs>] [--reason <text>] [--json]
//   node scripts/supervisor/lessons.mjs revert --experiment <id> [--apply] [--json]
//   node scripts/supervisor/lessons.mjs result --experiment <id> --outcome kept|reverted|did-not-work --reason <text>
//   node scripts/supervisor/lessons.mjs feedback --text <t> [--signature <s>] [--via chat|telegram|draw-note] [--refs <csv>]
//   node scripts/supervisor/lessons.mjs propose --title <t> --evidence <t> --options <t> --recommendation <t> [--send]
//   node scripts/supervisor/lessons.mjs export [--write]                    modules/supervisor/lessons.yaml
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { allocationSettings } from '../../engine/config.mjs';
import { parseJsonOr } from '../lib/json.mjs';
import { clipLine } from '../lib/clip.mjs';
import { SKILL_ROOT, SUPERVISOR_WF, openSupervisorLedger, supervisorEvent, withSupervisorRead } from './home.mjs';
import { refsOf, supLog } from './sup-log.mjs';
import { LESSONS_FILE, lessonsForChecks, parseLessonsFile } from './lessons-file.mjs';

export { LESSONS_FILE, lessonsForChecks, parseLessonsFile };

const selfFile = fileURLToPath(import.meta.url);
export const KINDS = Object.freeze({
  hypothesis: 'supervisor-hypothesis', experiment: 'supervisor-experiment', result: 'supervisor-experiment-result',
  lesson: 'supervisor-lesson', proposal: 'supervisor-proposal',
});
export const CAUSE_CLASSES = Object.freeze(['gate-defect', 'brief-gap', 'runtime-flow', 'env', 'contract-churn']);
const one = (s, n = 300) => clipLine(String(s ?? '').replace(/\s+/g, ' '), n);
const norm = (f) => String(f ?? '').replace(/\\/g, '/').replace(/^\.\//, '');

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

/** Fold the learning events into {signatures: {sig: {status, hypothesis, experiments}}, experiments, lessons, proposals}. */
export function learningState(db) {
  const rows = db.prepare(`SELECT kind, payload_json, created_at FROM events WHERE workflow_id=? AND kind IN (${Object.values(KINDS).map(() => '?').join(',')}) ORDER BY seq`)
    .all(SUPERVISOR_WF, ...Object.values(KINDS));
  const signatures = {}, experiments = {}, lessons = [], proposals = {};
  const sig = (s) => (signatures[s] ??= { status: null, hypothesis: null, experiments: [] });
  for (const r of rows) {
    const p = { ...(parseJsonOr(r.payload_json, {}) ?? {}), at: r.created_at };
    if (r.kind === KINDS.hypothesis) Object.assign(sig(p.signature), { status: 'open', hypothesis: p });
    else if (r.kind === KINDS.experiment) { experiments[p.id] = { ...p, status: 'measuring' }; sig(p.signature).experiments.push(p.id); sig(p.signature).status = 'measuring'; }
    else if (r.kind === KINDS.result && experiments[p.id]) {
      experiments[p.id] = { ...experiments[p.id], status: p.outcome, result: p };
      const s = sig(experiments[p.id].signature);
      s.status = p.outcome === 'kept' ? 'kept' : p.outcome === 'revert-due' ? 'measuring' : 'reverted';
      if (p.outcome === 'revert-due') experiments[p.id].status = 'revert-due';
    } else if (r.kind === KINDS.lesson) lessons.push(p);
    else if (r.kind === KINDS.proposal) proposals[p.id] = { ...(proposals[p.id] ?? {}), ...p };
  }
  return { signatures, experiments, lessons, proposals };
}
export const readLearning = ({ env = process.env } = {}) => withSupervisorRead((db) => learningState(db), { signatures: {}, experiments: {}, lessons: [], proposals: {} }, { env });

const write = (env, kind, payload, now = Date.now()) => {
  const ledger = openSupervisorLedger({ env });
  try { ledger.transaction(() => supervisorEvent(ledger, { entityType: 'learning', entityId: payload.id ?? payload.signature ?? kind, kind, payload, now })); }
  finally { ledger.close(); }
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
const CHECKER = /^scripts\/checks\//;

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
 *   - a modified checker (scripts/checks/**) needs `wronglyBlocked`: a changed spec under tests/ whose text shows the
 *     correct example the check wrongly blocked ("wrongly blocked" / "wrongly-blocked"); never relax a check to green
 *   - the daily cap on autonomous landings
 */
export function guardLand({ files, wronglyBlocked = null, specText = (f) => '', landedToday = 0, cap }) {
  const refusals = [];
  const t = tierOf(files);
  if (t.tier === 'propose') refusals.push({ code: 'propose-tier', detail: `an IMPORTANT change - propose it to the owner (lessons.mjs propose): ${t.reasons.join('; ')}` });
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

const git = (args, { cwd = SKILL_ROOT } = {}) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
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
const landedWithin = (state, { now, ms = 24 * 3_600_000 }) => Object.values(state.experiments).filter((e) => e.tier === 'auto' && now - (e.landedAt ?? e.at) < ms).length;

/**
 * Guard, land through the gate, record the experiment. `landFn` is land.mjs land (a spec stubs it). Returns
 * {ok, refused?, land?, experiment?}.
 */
export async function landExperiment({ signature, commits, lane, specs = [], wronglyBlocked = null, reason = null, env = process.env, now = Date.now,
  landFn = null, filesOf = commitFiles, readSpec = (rel, sha) => git(['show', `${sha}:${rel}`]).out, settings = learningSettings(), baseline = null }) {
  if (!signature || !commits?.length || !lane) throw Object.assign(new Error('land needs --signature, --commit and --lane'), { code: 'land-incomplete' });
  const files = filesOf(commits);
  const state = readLearning({ env });
  const guard = guardLand({ files, wronglyBlocked, specText: (rel) => commits.map((c) => readSpec(rel, c)).join('\n'), landedToday: landedWithin(state, { now: now() }), cap: settings.dailyAutoLandCap });
  if (!guard.ok) {
    write(env, KINDS.lesson, { signature, source: 'self', weight: 1, status: 'refused', text: `land refused: ${guard.refusals.map((r) => r.code).join(', ')}`, commits, lane, refusals: guard.refusals }, now());
    return { ok: false, refused: guard.refusals, tier: guard.tier };
  }
  const doLand = landFn ?? (await import('./land.mjs')).land;
  const landed = await doLand({ commits, specs, lane, env });
  if (!landed?.ok) return { ok: false, land: landed };
  const id = `exp-${crypto.createHash('sha1').update(`${signature}|${commits.join(',')}`).digest('hex').slice(0, 10)}`;
  const experiment = write(env, KINDS.experiment, { id, signature, commits, head: landed.head ?? null, lane, tier: guard.tier, files: files.map((f) => f.path), specs,
    reason: one(reason, 500), landedAt: now(), baseline: baseline ?? null }, now());
  return { ok: true, land: landed, experiment };
}

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

/**
 * The revert lane of an experiment: a worktree on lane/revert-<id> off main, `git revert --no-commit` of its commits
 * newest first, a contract-changes entry covering reverted contract files, one commit, the land gate, the result.
 * `apply` false only plans. Seams: git, landFn, lanesRoot.
 */
export async function revertExperiment({ id, apply = false, env = process.env, now = Date.now, landFn = null, root = SKILL_ROOT, lanes = null }) {
  const state = readLearning({ env });
  const e = state.experiments[id];
  if (!e) throw Object.assign(new Error(`no experiment ${id}`), { code: 'experiment-unknown' });
  const name = `revert-${id}`;
  const lanesDir = lanes ?? (await import('../lib/hk-lanes.mjs')).lanesRoot({ env });
  const dir = path.join(lanesDir, name);
  const plan = { id, signature: e.signature, commits: e.commits, lane: name, dir };
  if (!apply) return { ok: true, planned: true, ...plan };
  const step = (args, cwd = dir) => { const r = git(args, { cwd }); if (!r.ok) throw Object.assign(new Error(`git ${args.join(' ')}: ${r.err}`), { code: 'revert-git' }); return r.out; };
  step(['worktree', 'add', dir, '-b', `lane/${name}`, 'main'], root);
  try {
    for (const sha of [...e.commits].reverse()) step(['revert', '--no-commit', sha]);
    const changed = step(['diff', '--cached', '--name-only']).split(/\r?\n/).filter(Boolean).map(norm);
    const { governedPaths, CONTRACT_CHANGES } = await import('./land.mjs');
    const governed = governedPaths(changed);
    if (governed.length) {
      const file = path.join(dir, CONTRACT_CHANGES);
      const entry = [`  - id: ${name}`, `    effectiveAt: '${new Date(now()).toISOString()}'`,
        `    summary: "Supervisor self-learning revert of experiment ${id} (${e.signature}): ${one(state.experiments[id].result?.reason ?? 'measured no improvement', 300).replace(/"/g, "'")}. Adds no check or finding code"`,
        '    reach: new-legs', '    paths:', ...governed.map((p) => `      - ${p}`), ''].join('\n');
      fs.appendFileSync(file, `${fs.readFileSync(file, 'utf8').endsWith('\n') ? '' : '\n'}${entry}`);
      step(['add', CONTRACT_CHANGES]);
    }
    step(['commit', '-q', '-m', `revert(self-learning): ${e.signature} - experiment ${id} did not work\n\nReverts ${e.commits.join(', ')}: ${one(state.experiments[id].result?.reason ?? '', 400)}\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`]);
    const sha = step(['rev-parse', 'HEAD']);
    const doLand = landFn ?? (await import('./land.mjs')).land;
    const landed = await doLand({ commits: [sha], lane: name, env });
    write(env, KINDS.result, { id, signature: e.signature, outcome: landed?.ok ? 'reverted' : 'revert-due', reason: landed?.ok ? `reverted by ${sha.slice(0, 9)}` : `revert land failed: ${one(landed?.error ?? landed?.reason ?? JSON.stringify(landed), 200)}`, revertCommit: sha }, now());
    if (landed?.ok) write(env, KINDS.lesson, { signature: e.signature, source: 'self', weight: 1, status: 'reverted', fix: e.commits, effect: state.experiments[id].result?.reason ?? null,
      text: `${e.signature}: ${e.commits.map((c) => c.slice(0, 9)).join(',')} did not work (${state.experiments[id].result?.reason ?? ''}); reverted by ${sha.slice(0, 9)}` }, now());
    return { ok: landed?.ok === true, ...plan, revertCommit: sha, land: landed };
  } finally {
    // The revert worktree never gets a node_modules link, so removing it cannot follow a junction.
    git(['worktree', 'remove', '--force', dir], { cwd: root });
    git(['worktree', 'prune'], { cwd: root });
    git(['branch', '-D', `lane/${name}`], { cwd: root });
  }
}

/* ------------------------------------------------------------ lessons: owner feedback, match, export */

export function recordFeedback({ text, signature = null, via = 'chat', refs = [], env = process.env, now = Date.now(), settings = learningSettings() }) {
  if (!String(text ?? '').trim()) throw Object.assign(new Error('feedback needs --text'), { code: 'feedback-empty' });
  return write(env, KINDS.lesson, { signature, source: 'owner', via, weight: settings.ownerWeight, status: 'owner-feedback', text: one(text, 1000), refs }, now);
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
  return ['# lessons.yaml - GENERATED by `node scripts/supervisor/lessons.mjs export --write` from the supervisor ledger',
    '# (supervise.yaml selfLearning). Never hand-edit: record lessons with lessons.mjs (feedback, land, measured results).',
    'schema: starci/supervisor-lessons@1', 'lessons:',
    ...rows.flatMap((l) => [`  - signature: ${q(l.signature ?? '')}`, `    source: ${l.source}`, `    weight: ${l.weight ?? 1}`, `    status: ${l.status}`,
      ...(l.cause ? [`    cause: ${l.cause}`] : []), ...(l.fix?.length ? [`    fix: [${l.fix.map((c) => q(String(c).slice(0, 12))).join(', ')}]`] : []),
      `    at: '${new Date(l.at ?? 0).toISOString()}'`, `    text: ${q(l.text)}`]),
  ].join('\n').replace(/lessons:$/, 'lessons: []') + '\n';
}

/* ------------------------------------------------------------ proposals (PROPOSE-TO-OWNER) */

export async function propose({ title, evidence, options, recommendation, send = false, env = process.env, now = Date.now, push = null }) {
  if (![title, evidence, options, recommendation].every((x) => String(x ?? '').trim())) throw Object.assign(new Error('propose needs --title, --evidence, --options and --recommendation'), { code: 'proposal-incomplete' });
  const id = `prop-${crypto.createHash('sha1').update(`${title}|${now()}`).digest('hex').slice(0, 8)}`;
  const text = [`StarCi .claude upgrade proposal ${id}: ${one(title, 200)}`, `Evidence: ${one(evidence, 800)}`, `Options: ${one(options, 600)}`, `Recommendation: ${one(recommendation, 400)}`,
    'Other work continues meanwhile. Reply in chat or Telegram with your choice.'].join('\n');
  let telegram = null;
  if (send) telegram = await (push ?? (await import('./stall-alert.mjs')).ownerPush)(text, { env });
  write(env, KINDS.proposal, { id, title: one(title, 200), evidence: one(evidence, 800), options: one(options, 600), recommendation: one(recommendation, 400), status: 'open', sent: Boolean(telegram?.ok && !telegram?.skipped) }, now());
  return { ok: true, id, text, telegram };
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
    } else if (verb === 'land') {
      const r = await landExperiment({ signature: value('signature'), commits: csv(value('commit')), lane: value('lane'), specs: csv(value('specs')), wronglyBlocked: value('wrongly-blocked'), reason: value('reason') });
      print(r, r.ok ? `landed ${r.experiment.id} (${r.experiment.signature}); measuring` : r.refused ? `REFUSED ${r.refused.map((x) => `${x.code}: ${x.detail}`).join(' | ')}` : `land failed: ${JSON.stringify(r.land).slice(0, 400)}`);
      if (!r.ok) process.exitCode = 1;
    } else if (verb === 'revert') {
      const r = await revertExperiment({ id: value('experiment'), apply: argv.includes('--apply') });
      print(r, r.planned ? `would revert ${r.commits.join(',')} in lane ${r.lane} (--apply)` : r.ok ? `reverted ${r.id} by ${r.revertCommit}` : `revert failed: ${JSON.stringify(r.land).slice(0, 400)}`);
      if (!r.ok) process.exitCode = 1;
    } else if (verb === 'result') {
      const e = readLearning().experiments[value('experiment')];
      if (!e || !['kept', 'reverted', 'did-not-work'].includes(value('outcome')) || !value('reason')) throw Object.assign(new Error('result needs a known --experiment, --outcome kept|reverted|did-not-work and --reason'), { code: 'result-incomplete' });
      write(process.env, KINDS.result, { id: e.id, signature: e.signature, outcome: value('outcome'), reason: one(value('reason'), 500) });
      print({ ok: true }, `recorded ${value('outcome')} for ${e.id}`);
    } else if (verb === 'feedback') {
      const r = recordFeedback({ text: value('text'), signature: value('signature'), via: value('via') ?? 'chat', refs: csv(value('refs')) });
      print(r, `owner lesson recorded (weight ${r.weight})`);
    } else if (verb === 'propose') {
      const r = await propose({ title: value('title'), evidence: value('evidence'), options: value('options'), recommendation: value('recommendation'), send: argv.includes('--send') });
      print(r, `${r.id} recorded${r.telegram ? ` (telegram ${r.telegram.ok ? r.telegram.skipped ?? 'sent' : 'FAILED'})` : ''}\n${r.text}`);
    } else if (verb === 'export') {
      const text = lessonsYaml(readLearning());
      if (argv.includes('--write')) { fs.writeFileSync(path.join(process.cwd(), LESSONS_FILE), text); console.log(`wrote ${LESSONS_FILE} in ${process.cwd()} (commit it in a lane)`); }
      else process.stdout.write(text);
    } else {
      console.error('use: lessons.mjs list | match | tier | land | revert | result | feedback | propose | export (see the header)');
      process.exitCode = 2;
    }
  } catch (error) {
    console.error(`lessons: ${error?.message ?? error}`);
    process.exitCode = /incomplete|empty|unknown/.test(error?.code ?? '') ? 2 : 1;
  }
}
