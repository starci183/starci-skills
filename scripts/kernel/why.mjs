// why.mjs — the owner-facing reason an attempt failed, was blocked, refused, is waiting or was requeued.
//
// Pure and read-only: every function takes an open ledger handle (or its `db`) and reads; nothing here writes, so the
// harness UI imports it exactly like scripts/kernel/progress-state.mjs. The runtime persists the result in
// op_attempts.why_json at settle / dispatch-reject time (`computeWhy` + updateAttempt); `whyOf` returns the stored value
// and computes the same value for a row that has none (an attempt settled before why existed, a read-only opener).
//
// Shape (starci/why@1, docs/why.md):
//   { schema, lang:'vi', state, headline, cause, disagreement|null, next, owner, codes[], refs[], attemptId, opId, tryNo }
// The Vietnamese text comes from modules/kernel/failure-codes.yaml (a flat map keyed by code), from the i18n
// catalog (modules/i18n/messages — the English sources below are translated through scripts/lib/i18n.mjs), and
// from the ledger rows the settle judged: check_runs, the filed report, settle_json. The language is the owner's
// config.yaml `language`; the catalog carries Vietnamese only, so the text is Vietnamese.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';
import { blobPath } from '../../engine/db/blob.mjs';
import { parseJson } from '../lib/json.mjs';
import { translator } from '../lib/i18n.mjs';
import { clipLine } from '../lib/clip.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const WHY_SCHEMA = 'starci/why@1';
const CATALOG_PATH = path.join(root, 'modules', 'kernel', 'failure-codes.yaml');

let catalogCache = null;
/** The catalog: a flat map code -> {title, title_vi, meaning_vi, causes_vi[], nextStep_vi, owner, kind}. */
export function loadCatalog(file = CATALOG_PATH) {
  if (file === CATALOG_PATH && catalogCache) return catalogCache;
  const catalog = parseYaml(fs.readFileSync(file, 'utf8')) ?? {};
  if (file === CATALOG_PATH) catalogCache = catalog;
  return catalog;
}

/** One code explained: the catalog entry, or {code, known:false} for a code the catalog does not carry. */
export function explainCode(code, catalog = loadCatalog()) {
  const e = catalog[code];
  return e ? { code, known: true, ...e } : { code, known: false, title_vi: code, meaning_vi: null, nextStep_vi: null, owner: 'runtime-core', kind: null };
}

const clip = (s, n = 220) => clipLine(s, n);
/** A Windows or POSIX absolute path shortened to its last three segments (the owner reads names, not temp roots). */
const shortPaths = (s) => String(s ?? '').replaceAll(/(?:[A-Za-z]:)?[\\/](?:[^\s"'\\/:*?<>|]+[\\/])+([^\s"'\\/:*?<>|]+[\\/][^\s"'\\/:*?<>|]+[\\/][^\s"'\\/:*?<>|]+|[^\s"'\\/:*?<>|]+)/g, '…/$1').replaceAll('\\', '/');
const BRACKET = /\[([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)\]/g;
const BARE_CODE = /\b([A-Z][A-Z0-9]*_[A-Z0-9]+(?:_[A-Z0-9]+)*)\b/g;
const uniq = (list) => [...new Set(list.filter((x) => typeof x === 'string' && x))];
const many = (db, sql, ...args) => db.prepare(sql).all(...args);
const one = (db, sql, ...args) => db.prepare(sql).get(...args) ?? null;

/* ------------------------------------------------------------ what a red check said */

const readBlobText = (sha, limit = 256 * 1024) => {
  if (!sha) return null;
  try {
    const file = blobPath(sha);
    if (!file) return null;
    const fd = fs.openSync(file, 'r');
    try { const buf = Buffer.alloc(Math.min(limit, fs.fstatSync(fd).size)); fs.readSync(fd, buf, 0, buf.length, 0); return buf.toString('utf8'); } finally { fs.closeSync(fd); }
  } catch { return null; }
};

const takeTokens = (text, codes) => { for (const m of String(text ?? '').matchAll(BRACKET)) codes.push(m[1]); };

const summaryEvidence = (summary) => {
  if (typeof summary.evidence === 'string') return summary.evidence;
  if (typeof summary.entry?.evidence === 'string') return summary.entry.evidence;
  return null;
};

const listItemFacts = (item, codes, lines) => {
  const line = typeof item === 'string' ? item : item?.detail ?? item?.message ?? item?.text ?? '';
  if (typeof item === 'object' && item?.code) codes.push(item.code);
  if (line) { lines.push(String(line)); takeTokens(line, codes); }
};

const docFacts = (doc, codes, lines) => {
  const items = [...(Array.isArray(doc.refused) ? doc.refused : []), ...(Array.isArray(doc.findings) ? doc.findings : [])];
  for (const item of items) listItemFacts(item, codes, lines);
  if (Array.isArray(doc.codes)) codes.push(...doc.codes);
  if (doc.status === 'unavailable') { codes.push('check-status:unavailable'); lines.push(String(doc.reason ?? doc.message ?? 'checker unavailable on this machine')); }
  for (const issue of Array.isArray(doc.issues) ? doc.issues : []) {
    if (!issue?.code) continue;
    codes.push(issue.code);
    if (issue.detail || issue.message) lines.push(String(issue.detail ?? issue.message));
  }
};

const textFacts = (text, codes, lines) => {
  const first = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 5);
  for (const l of first) { lines.push(l); takeTokens(l, codes); }
};

const blobFacts = (row, readBlob, codes, lines) => {
  for (const sha of [row.output_sha, row.stdout_sha]) {
    const text = readBlob(sha);
    if (!text) continue;
    const doc = parseJson(text, null);
    if (doc && typeof doc === 'object') docFacts(doc, codes, lines);
    else textFacts(text, codes, lines);
    if (lines.length) break;
  }
};

/**
 * Parse one check_runs row into {name, runner, authority, status, exit, declaredExit, codes[], lines[], failing[], evidence}.
 * `codes`/`lines` come from summary_json (codes, evidence, failing) and from the check's stdout/output blob
 * (a refused[] / findings[] list, or `[CODE]` tokens in plain text).
 */
export function checkFacts(row, readBlob = readBlobText) {
  const summary = parseJson(row.summary_json, null) ?? {};
  const codes = [...(Array.isArray(summary.codes) ? summary.codes : [])];
  const lines = [];
  const evidence = summaryEvidence(summary);
  if (evidence) takeTokens(evidence, codes);
  if (RED.has(row.status) && /not re-verifiable/i.test(evidence ?? '')) codes.push('check-not-reverifiable');
  if (row.status === 'unavailable') codes.push('check-status:unavailable');
  blobFacts(row, readBlob, codes, lines);
  return {
    name: row.name, runner: row.runner, authority: row.authority, status: row.status, phase: row.phase,
    exit: row.exit_code ?? null, declaredExit: row.declared_exit_code ?? null,
    codes: uniq(codes), lines, failing: Array.isArray(summary.failing) ? summary.failing : [], evidence,
  };
}

const RED = new Set(['fail', 'error']);

/** Catalog kebab codes named as whole tokens in a check's evidence text (a parity reason, a settle reason). */
const kebabTokens = (text, catalog) => [...new Set(String(text).match(/\b[a-z][a-z0-9]*(?:-[a-z0-9]+)+\b/g) ?? [])].filter((t) => catalog[t]);

/* ------------------------------------------------------------ the sentence builders */

// The why text is owner-facing Vietnamese (starci/why@1 lang 'vi'): every literal below is an English source whose
// `vi` lives in modules/i18n/messages, translated at build time.
const tr = translator('vi');

const isScratch = (text) => /starci-job-scratch/i.test(String(text ?? ''));
const scratchNote = tr("the op's scratch directory (starci-job-scratch) is deleted when the op files its report, so the path no longer exists when the runtime re-runs it");

// A trailing " [code-tag]" stripped off a line without a backtracking regex.
const stripTrailTag = (text) => {
  const s = String(text);
  const end = s.replace(/\s+$/, '');
  if (!end.endsWith(']')) return s;
  const open = end.lastIndexOf('[');
  if (open < 0 || !/^[A-Z][A-Z0-9_]+$/.test(end.slice(open + 1, -1))) return s;
  return end.slice(0, open).replace(/\s+$/, '');
};

/** The one-line human reading of a red check: its first refused line without absolute paths, else its evidence. */
function checkDetail(fact) {
  if (fact.lines.length && fact.lines.some(isScratch) && fact.codes.includes('TARGET_MISSING')) return scratchNote;
  const raw = fact.lines[0] ?? fact.evidence ?? '';
  return clip(stripTrailTag(shortPaths(raw)), 200);
}

const nextTry = (unit, tryNo) => (unit ? tr('try {n} of {budget}', { n: Number(tryNo) + 1, budget: unit.try_budget }) : tr('try {n}', { n: Number(tryNo) + 1 }));

const retryNext = ({ step, unit, tryNo }) => ({ text: tr('Kernel will re-dispatch the op ({next}{route}).', { next: nextTry(unit, tryNo), route: step.limit ? tr(', route {route} {firing}/{limit}', { route: step.route, firing: step.firing, limit: step.limit }) : '' }), owner: 'op-retry' });
const repairNext = ({ step }) => ({ text: tr('Kernel dispatches a root-cause repair op first, then re-runs this op (route {route}{jobs}).', { route: step.route, jobs: step.jobs?.length ? `, ${step.jobs.length} job` : '' }), owner: step.owner?.op ? `other-op:${step.owner.op}` : 'runtime-core' });
const ownerGateNext = ({ step }) => ({ text: tr('Waiting on the owner to decide: {reason}', { reason: clip(step.reason ?? step.classReason, 200) }), owner: 'owner' });
const supervisorGateNext = ({ step }) => ({ text: tr('Waiting on the Supervisor to handle incident {id}: {reason}', { id: step.incidentId ?? '', reason: clip(step.reason, 200) }).trim(), owner: 'supervisor' });
const peerRootText = (rootCause) => ` (${clip(typeof rootCause === 'string' ? rootCause : JSON.stringify(rootCause), 120)})`;
const peerNext = ({ step }) => ({ text: tr('The root cause is elsewhere{root}; this op spends no try and waits for that side to fix it.', { root: step.rootCause ? peerRootText(step.rootCause) : '' }), owner: 'runtime-core' });
const deferredNext = ({ step }) => ({ text: tr('Deferred to the final review: {reason}', { reason: clip(step.reason, 200) }), owner: 'owner' });
const noneNext = ({ step }) => ({ text: tr('No automatic next step: {reason}', { reason: clip(step.reason, 200) }), owner: 'supervisor' });
const NEXT_BY_KIND = { retry: retryNext, repair: repairNext, 'owner-gate': ownerGateNext, 'supervisor-gate': supervisorGateNext, 'peer-blocked': peerNext, 'root-elsewhere': peerNext, deferred: deferredNext, none: noneNext };

/** What happens now, from the recorded next step of the failed job (enqueueNextStep) and the unit's try budget. */
function nextOf({ step, unit, tryNo, primary, catalog }) {
  const c = primary ? catalog[primary] : null;
  const byKind = Object.hasOwn(NEXT_BY_KIND, step?.kind) ? NEXT_BY_KIND[step.kind] : null;
  if (byKind) return byKind({ step, unit, tryNo });
  if (unit && Number(unit.tries) >= Number(unit.try_budget)) return { text: tr('All {budget} tries of this work are used up; waiting on the owner or the Supervisor to decide.', { budget: unit.try_budget }), owner: 'owner' };
  if (c?.nextStep_vi) return { text: c.nextStep_vi, owner: c.owner };
  return { text: tr('Kernel will decide the next step.'), owner: 'runtime-core' };
}

const REFS = (attempt, checks, report) => {
  const refs = [];
  for (const c of checks) refs.push({ kind: 'check', name: c.name, runner: c.runner, status: c.status });
  if (report?.reportId != null) refs.push({ kind: 'report', reportId: report.reportId });
  if (attempt.head_sha) refs.push({ kind: 'commit', sha: attempt.head_sha });
  return refs;
};

const catalogLine = (code, catalog) => {
  const e = catalog[code];
  return e ? `${e.title_vi}: ${e.meaning_vi}` : null;
};

// A refused launch: the host would not start the op; nothing ran, no try is spent.
const refusedWhy = ({ attempt, settle, catalog, done }) => {
  const codes = [settle.signal, settle.reason === 'dispatch-rejected' ? 'dispatch-rejected' : null].filter(Boolean);
  const unknownEffect = attempt.end_state === 'effect-unknown';
  const stepText = settle.step ? tr(' (step {step}{signal})', { step: settle.step, signal: settle.signal ? `, ${settle.signal}` : '' }) : '';
  const detail = clip(shortPaths(settle.detail ?? settle.message ?? settle.error ?? tr('no detail')), 260);
  const line = catalogLine(settle.signal, catalog);
  const nextText = unknownEffect ? tr('The worker may have run partway: reconcile verifies the state before re-dispatching; not counted against the tries.') : tr('Not counted against the tries; the work returns to the queue and Kernel re-dispatches it.');
  return done(unknownEffect ? 'requeued' : 'dispatch-rejected', {
    headline: tr('The op could not be launched{step}; the runtime refused at dispatch time.', { step: stepText }),
    cause: detail + (line ? ` — ${line}` : ''),
    next: nextText, owner: catalog[settle.signal]?.owner ?? 'runtime-core', codes });
};

const deadStateWhy = ({ attempt, settle, done }) => {
  if (attempt.end_state === 'worker-dead') {
    return done('worker-dead', {
      headline: tr('The op worker died mid-run and could not file its result.'),
      cause: settle.reason ? clip(settle.reason) : tr('The worker terminal or process vanished before the op filed its report.'),
      next: tr('Reconcile clears the lease and re-dispatches the op; Kernel will re-run it.'), owner: 'runtime-core', codes: [settle.reason ?? 'worker-died-no-report'] });
  }
  if (attempt.end_state === 'requeued') {
    return done('requeued', {
      headline: tr('This run was cancelled and put back in the queue, with no verdict yet.'),
      cause: clip(settle.reason ?? tr('the runtime requeued the work after the worker was gone')),
      next: tr('The work returns to the queue; Kernel re-dispatches it, not counted against the tries.'), owner: 'runtime-core', codes: [settle.reason] });
  }
  if (attempt.end_state === 'cancelled' || attempt.verdict === 'cancelled' || attempt.verdict === 'dropped') {
    return done('cancelled', {
      headline: tr('This run was cancelled.'),
      cause: clip(settle.reason ?? tr('the workflow was archived or the work dropped')),
      next: tr('There is no next step for this run.'), owner: 'runtime-core', codes: [settle.reason] });
  }
  return null;
};

// Waiting on the owner: the op ended with a question.
const askWhy = ({ rep, done }) => {
  const q = rep.question?.text ?? '';
  return done('awaiting-owner', {
    headline: tr('The op paused to ask the owner{q}', { q: q ? `: ${clip(q, 200)}` : '.' }),
    cause: tr('The op needs a decision or information only the owner has; this is a wait, not a failure.'),
    next: tr('Waiting for the owner to answer. Once answered, Kernel re-dispatches the op; this question does not count against the tries.'), owner: 'owner', codes: [] });
};

const blockerCodes = (detail, catalog) => uniq([...String(detail).matchAll(BRACKET)].map((m) => m[1])
  .concat([...String(detail).matchAll(BARE_CODE)].map((m) => m[1]).filter((c) => catalog[c])));

// Blocked by what the op itself declared.
const blockedWhy = ({ rep, step, unit, attempt, catalog, done }) => {
  const b = rep.blocker ?? {};
  const kindKey = b.kind ? `blocker:${b.kind}` : null;
  const found = blockerCodes(b.detail ?? '', catalog);
  const primary = found[0] ?? kindKey;
  const kindEntry = kindKey ? catalog[kindKey] : null;
  const next = nextOf({ step, unit, tryNo: attempt.try_no, primary: kindKey, catalog });
  const kindText = kindEntry ? ` (${kindEntry.title_vi.replace(/^[^:]+:\s*/, '')})` : '';
  const related = found.length ? tr('Related codes: {codes}.', { codes: found.slice(0, 4).map((c) => `${catalog[c]?.title_vi ?? c} (${c})`).join('; ') }) : null;
  return done('blocked', {
    headline: tr('The op reported blocked{kind}: {detail}', { kind: kindText, detail: clip(shortPaths(b.detail ?? rep.summary ?? ''), 230) }),
    cause: [kindEntry?.meaning_vi, related].filter(Boolean).join(' ') || tr('The op declared it cannot continue.'),
    next: next.text, owner: kindEntry?.owner ?? next.owner, codes: [kindKey, ...found].filter((c) => c && (catalog[c] || c === primary)) });
};

const detailClause = (detail) => {
  if (!detail) return null;
  return `${detail.charAt(0).toUpperCase()}${detail.slice(1)}${detail.endsWith('.') ? '' : '.'}`;
};

const disagreementOf = (red, declared, detail) => {
  const detailText = detail ? `: ${detail}` : '';
  if (declared != null && declared !== 0) {
    const rerun = red.authority === 'runtime' ? tr('; the runtime re-ran it and it also exited {exit}', { exit: red.exit ?? declared }) : '';
    return tr('The op reported done but its own check {name} was declared exit {declared} (red){rerun}{detail}.', { name: red.name, declared, rerun, detail: detailText });
  }
  return tr('The op declared check {name} exited 0 (green) in its own working directory; the runtime re-ran it after the report was filed and it exited {exit}{detail}.', { name: red.name, exit: red.exit ?? 1, detail: detailText });
};

const overruledWhy = ({ checks, red, detail, primary, next, codes, catalog, done }) => {
  const own = checks.find((c) => c.name === red.name && c.authority === 'declared');
  const declared = own?.declaredExit ?? red.declaredExit ?? null;
  const verb = tr(red.authority === 'runtime' ? 're-ran' : 're-read');
  const cause = [detailClause(detail), primary ? catalogLine(primary, catalog) : null].filter(Boolean).join(' ') || tr("The runtime's independent check did not pass.");
  const owner = primary && catalog[primary] && next.owner === 'op-retry' ? catalog[primary].owner : next.owner;
  return done('failed', {
    headline: tr('The op reported done but the runtime {verb} check {name} and it is red{tag}.', { verb, name: red.name, tag: primary ? ` (${primary})` : '' }),
    cause, disagreement: disagreementOf(red, declared, detail), next: next.text, owner, codes });
};

const peerBlockedWhy = ({ settle, codes, done }) => {
  const peers = (settle.peerBlocked.peers ?? []).join(', ');
  return done('failed', {
    headline: tr('A check went red because of changes by another workflow, not a fault of this op.'),
    cause: tr('The red checks ({checks}) come from changes by {peers}.', { checks: (settle.peerBlocked.checks ?? []).join(', '), peers: peers || tr('a peer') }),
    next: tr('Wait for that side to fix it; this run spends no try.'), owner: 'runtime-core', codes });
};

const saidOf = (outcome) => {
  if (outcome === 'failed') return tr('The op reported itself failed');
  if (outcome === 'partial') return tr('The op only completed a part');
  return tr('The runtime scored it failed (the op reported {outcome})', { outcome: outcome ?? tr('unknown') });
};

const failureClassCodes = (failureClass) => failureClass?.class ? [`failure-class:${failureClass.class}`] : [];

const scoredWhy = ({ rep, outcome, red, detail, primary, next, codes, settle, done }) => {
  const redNote = red ? tr('; check {name} is red{tag}', { name: red.name, tag: primary ? ` (${primary})` : '' }) : '';
  const headline = `${saidOf(outcome)}${redNote}: ${clip(shortPaths(rep.summary ?? detail ?? ''), 200)}`.replace(/: $/, '.');
  const classNote = settle.failureClass?.reason ? tr('Class: {class} — {reason}', { class: settle.failureClass.class, reason: clip(settle.failureClass.reason, 160) }) : null;
  const cause = [detailClause(detail), primary ? catalogLine(primary, catalog) : null, classNote].filter(Boolean).join(' ') || tr('The runtime found no passing check for this run.');
  const codeList = codes.length ? codes : failureClassCodes(settle.failureClass);
  return done('failed', { headline, cause, next: next.text, owner: next.owner, codes: codeList });
};

// Failed: the runtime's verdict is fail.
const failWhy = (w) => {
  const { checks, settle, outcome, attempt, step, unit, catalog } = w;
  const runtimeRed = checks.filter((c) => c.authority === 'runtime' && RED.has(c.status));
  const declaredRed = checks.find((c) => c.authority === 'declared' && RED.has(c.status));
  const red = runtimeRed[0] ?? declaredRed ?? null;
  const codes = uniq([...(red?.codes ?? []), ...runtimeRed.slice(1).flatMap((c) => c.codes)]);
  const primary = codes.find((c) => catalog[c]) ?? codes[0] ?? null;
  const next = nextOf({ step, unit, tryNo: attempt.try_no, primary, catalog });
  const detail = red ? checkDetail(red) : '';
  const f = { ...w, red, codes, primary, next, detail };
  if (!w.report && outcome == null) {
    return w.done('failed', {
      headline: tr('The op ended without filing a report, so the runtime scored it failed.'),
      cause: settle.reason ? clip(settle.reason) : tr('The worker stopped or exited before filing its report.'),
      next: next.text, owner: next.owner === 'op-retry' ? 'op-retry' : next.owner, codes: ['worker-died-no-report'] });
  }
  const claimOverruled = settle.claimOverruled === true || (outcome === 'done' && attempt.verdict === 'fail');
  if (claimOverruled && red) return overruledWhy(f);
  if (settle.peerBlocked) return peerBlockedWhy(f);
  return scoredWhy(f);
};

/**
 * The why of one attempt from already-read facts. `ctx`: {attempt, checks[] (checkFacts), report (row {report_id, report_json}|null),
 * settle (parsed settle_json), unit (work_units row|null), catalog}. Returns null for an attempt that needs no explanation
 * (passed, or still running).
 */
export function buildWhy(ctx) {
  const { attempt, unit = null, catalog = loadCatalog() } = ctx;
  const checks = ctx.checks ?? [];
  const settle = ctx.settle ?? {};
  const rep = ctx.report ? parseJson(ctx.report.report_json, {}) : {};
  const outcome = attempt.report_outcome ?? rep.outcome ?? null;
  const step = settle.nextStep ?? parseJson(attempt.next_step, null);
  const base = { schema: WHY_SCHEMA, lang: 'vi', attemptId: attempt.attempt_id, opId: attempt.op_id, tryNo: attempt.try_no };
  const reportRef = ctx.report ? { reportId: ctx.report.report_id } : null;
  // Key order is the reading order: headline first (a reader that prints one line prints the headline).
  const done = (state, { headline, cause, disagreement = null, next, owner, codes, extraRefs = [] }) => ({
    headline, state, cause, disagreement, next, owner,
    codes: uniq(codes), refs: [...REFS(attempt, checks.filter((c) => RED.has(c.status) || c.authority === 'runtime'), reportRef), ...extraRefs],
    ...base,
  });

  // Passed, or still running: nothing to explain.
  if (attempt.verdict === 'pass') return null;
  const w = { attempt, checks, settle, rep, outcome, step, unit, catalog, done, report: ctx.report };

  // A refused launch: the host would not start the op; nothing ran, no try is spent.
  if (settle.reason === 'dispatch-rejected' || (attempt.end_state && ['requeued', 'effect-unknown'].includes(attempt.end_state) && settle.step)) return refusedWhy(w);
  const ended = deadStateWhy(w);
  if (ended) return ended;
  if (attempt.verdict === 'blocked' && outcome === 'ask') return askWhy(w);
  if (attempt.verdict === 'blocked') return blockedWhy(w);
  if (attempt.verdict === 'fail' || attempt.verdict === 'partial') return failWhy(w);

  // Reported, not yet judged: a wait.
  if (attempt.settled_at == null && (attempt.reported_at != null || outcome)) {
    return done('waiting-settle', {
      headline: tr('The op filed its report and is waiting for the runtime or Kernel verdict.'),
      cause: tr('The report ({outcome}) is recorded; the independent checks are not final yet.', { outcome: outcome ?? tr('unclear') }),
      next: tr('The runtime settles automatically; if a Kernel decision is needed, Kernel handles it on the next pass.'), owner: 'runtime-core', codes: [] });
  }
  return null;
}

/* ------------------------------------------------------------ reading the ledger */

const handleDb = (h) => (h?.db ?? h);

/** Gather the facts of one attempt row and build its why (never stored). */
export function computeWhy(ledger, attemptRow, { catalog = loadCatalog(), readBlob = readBlobText } = {}) {
  const db = handleDb(ledger);
  const attempt = typeof attemptRow === 'object' ? attemptRow : one(db, 'SELECT * FROM op_attempts WHERE attempt_id=?', attemptRow);
  if (!attempt) return null;
  const checks = many(db, 'SELECT name,phase,runner,authority,status,exit_code,declared_exit_code,summary_json,stdout_sha,output_sha FROM check_runs WHERE attempt_id=? ORDER BY check_id', attempt.attempt_id)
    .map((row) => checkFacts(row, readBlob));
  for (const c of checks) for (const key of kebabTokens(`${c.evidence ?? ''} ${c.lines.join(' ')}`, catalog)) if (!c.codes.includes(key)) c.codes.push(key);
  const report = one(db, 'SELECT report_id, report_json FROM reports WHERE attempt_id=?', attempt.attempt_id);
  const unit = attempt.unit_id ? one(db, 'SELECT tries, try_budget, state FROM work_units WHERE workflow_id=? AND unit_id=?', attempt.workflow_id, attempt.unit_id) : null;
  return buildWhy({ attempt, checks, report, settle: parseJson(attempt.settle_json, {}) ?? {}, unit, catalog });
}

/** The why of an attempt: the stored op_attempts.why_json, else computed now. Read-only. */
export function whyOf(ledger, attemptRow, options) {
  const db = handleDb(ledger);
  const attempt = typeof attemptRow === 'object' ? attemptRow : one(db, 'SELECT * FROM op_attempts WHERE attempt_id=?', attemptRow);
  if (!attempt) return null;
  const stored = attempt.why_json ? parseJson(attempt.why_json, null) : null;
  return stored ?? computeWhy(db, attempt, options);
}

/** The whys of a workflow's attempts that need one (failed, blocked, waiting, refused), newest first. */
export function whysOfWorkflow(ledger, workflowId, { limit = 100, ...options } = {}) {
  const db = handleDb(ledger);
  const out = [];
  for (const a of many(db, 'SELECT * FROM op_attempts WHERE workflow_id=? ORDER BY attempt_id DESC LIMIT ?', workflowId, limit * 3)) {
    const why = whyOf(db, a, options);
    if (why) out.push(why);
    if (out.length >= limit) break;
  }
  return out;
}

/** A leg's (op's) why: the latest attempt of the op that has one, or null when its latest attempt passed. */
export function whyOfOp(ledger, workflowId, opId, options) {
  const db = handleDb(ledger);
  const latest = one(db, 'SELECT * FROM op_attempts WHERE workflow_id=? AND op_id=? AND dispatched_at IS NOT NULL ORDER BY attempt_id DESC LIMIT 1', workflowId, opId);
  return latest ? whyOf(db, latest, options) : null;
}

/* ------------------------------------------------------------ what the Kernel wrote down */

/**
 * The Kernel's own notes of a workflow, oldest first: decisions (events kernel-decision, closed by kernel-decision-result)
 * and proposals for shared .claude (events kernel-proposal). [{kind:'decision'|'proposal', id, at, status, headline, ...}].
 * Table events (entity_type 'decision' | 'kernel-proposal', entity_id = the note id, payload_json), so the UI reads them
 * without starci kernel status.
 */
const decisionStatus = (result) => {
  if (result === 'keep') return 'kept';
  if (result === 'revert') return 'reverted';
  return result ?? 'closed';
};

const NOTE_WRITERS = {
  'kernel-decision': (e, p, notes) => notes.set(e.entity_id, { kind: 'decision', id: e.entity_id, at: Number(e.created_at), status: 'open',
    headline: clip(p.hypothesis, 240), actionKey: p.actionKey ?? null, metric: p.metric ?? null, observed: null }),
  'kernel-decision-result': (e, p, notes) => {
    const n = notes.get(e.entity_id);
    if (n) Object.assign(n, { status: decisionStatus(p.result), observed: clip(p.observed, 240), closedAt: Number(e.created_at) });
  },
  'kernel-proposal': (e, p, notes) => notes.set(e.entity_id, { kind: 'proposal', id: e.entity_id, at: Number(e.created_at), status: p.status ?? 'open',
    headline: clip(p.title, 240), evidence: clip(p.evidence, 400), tier: p.tier ?? null, files: Array.isArray(p.files) ? p.files.slice(0, 20) : [] }),
};

export function kernelNotesOf(ledger, workflowId, { limit = 50 } = {}) {
  const db = handleDb(ledger);
  const notes = new Map();
  for (const e of many(db, "SELECT kind, entity_id, payload_json, created_at FROM events WHERE workflow_id=? AND kind IN ('kernel-decision','kernel-decision-result','kernel-proposal') ORDER BY seq", workflowId)) {
    NOTE_WRITERS[e.kind]?.(e, parseJson(e.payload_json, {}) ?? {}, notes);
  }
  return [...notes.values()].slice(-limit);
}
