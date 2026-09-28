// starci/op-report@1 — the op's filed result. `api report` validates the
// envelope before it becomes a durable reports row; the api stamps the
// identity fields (run/task/dispatch/from) from the job row — a worker can
// never claim another job's dispatch. Contract: modules/kernel/
// verdict-contract.yaml §2.

import { readDistJson } from '../../engine/runtime-root.mjs';
import { policyCommits } from './settle-landed.mjs';
import { claimsProblems } from './proof-integrity.mjs';

export const OP_REPORT_SCHEMA = 'starci/op-report@1';
export const OP_REPORT_OUTCOMES = ['done', 'partial', 'failed', 'ask', 'blocked'];
// modules/models/kinds.yaml `vocabularies.blockers` is the one authority: the route table
// that dispatches on a blocker kind and the envelope that accepts one read the
// same list. Missing or misshapen, the envelope refuses to load at all.
export const BLOCKER_KINDS = (() => {
  const blockers = readDistJson('modules', 'models', 'kinds.yaml')?.vocabularies?.blockers;
  if (!Array.isArray(blockers) || !blockers.length || blockers.some((k) => typeof k !== 'string' || !k.trim())) {
    throw new Error('modules/models/kinds.yaml vocabularies.blockers must be a non-empty list of kind names');
  }
  return blockers;
})();

const ALLOWED_KEYS = new Set(['schema', 'outcome', 'run', 'task', 'dispatch', 'from', 'summary', 'files', 'checks', 'open', 'question', 'blocker', 'branch', 'head', 'credentialPending', 'rootCause', 'claims', 'failureClass', 'seamAssumptions', 'owedToWire']);
// Why a failed attempt failed (scripts/kernel/verify-failure.mjs): the route table keys failed routes on it.
// The api derives it from the evidence and accepts a stated one only where the evidence does not contradict it.
export const FAILURE_CLASSES = ['environment', 'tool', 'findings', 'product', 'deterministic', 'transient'];
const text = (v) => typeof v === 'string' && v.trim().length > 0;
const normalizePath = (p) => String(p).replace(/\\/g, '/').replace(/\/{2,}/g, '/').replace(/^\.\//, '').replace(/\/+$/, '');

const underOwned = (file, ownedPaths) => {
  if (!ownedPaths.length) return true; // no declared write set → nothing to check against
  const f = normalizePath(file);
  return ownedPaths.some((own) => {
    // A trailing /** spells the same directory prefix (engine/admission.mjs normalizeOwnedPath).
    // The compare is literal, so App Router names ([lang], [...slug], (group)) match themselves.
    const o = normalizePath(typeof own === 'string' ? own : own?.path).replace(/\/\*\*$/, '');
    return o && (f === o || f.startsWith(o + '/'));
  });
};

// A report file written in a legacy code page (Windows PowerShell 5.1
// Set-Content, a native-exe argument) reaches the ledger with every
// non-ASCII letter replaced by '?' ("Ch?n tuy?n c?ng khai"), and an owner ask
// is then served unreadable. Text that lost its characters is refused, never
// stored: the words cannot be recovered from the ledger afterwards.
const LOSSY_MARK = /\p{L}\?\p{L}|\?\?\p{L}|\uFFFD/gu;
export function lossyTextFields(value) {
  const fields = [];
  const scan = (label, v) => { if (typeof v === 'string') fields.push([label, v]); };
  scan('summary', value?.summary);
  scan('question.text', value?.question?.text);
  scan('question.recommendedReason', value?.question?.recommendedReason);
  (Array.isArray(value?.question?.options) ? value.question.options : []).forEach((o, i) => scan(`question.options[${i}]`, typeof o === 'string' ? o : o?.label));
  scan('blocker.detail', value?.blocker?.detail);
  (Array.isArray(value?.open) ? value.open : []).forEach((o, i) => scan(`open[${i}]`, o));
  const marks = fields.map(([label, text]) => [label, (text.match(LOSSY_MARK) ?? []).length]).filter(([, n]) => n > 0);
  const total = marks.reduce((sum, [, n]) => sum + n, 0);
  return total >= 3 || fields.some(([, text]) => text.includes("\uFFFD")) ? marks.map(([label]) => label) : [];
}

// op/files (lane op-verify): the build op that owns the fix and the files it repairs, when the node alone
// (an op, or a Work record id such as impl.<feature>.<repo>.<name>) does not say them.
const ROOT_CAUSE_KEYS = new Set(['node', 'self', 'category', 'claim', 'evidence', 'counterCheck', 'expectedFix', 'recheck', 'op', 'files']);
/** Why a report's rootCause {node, self?, category, claim, evidence[], counterCheck?, expectedFix?, recheck?, op?, files?} is malformed: [reason]. */
export function rootCauseProblems(rc) {
  if (!rc || typeof rc !== 'object' || Array.isArray(rc)) return ['rootCause must be an object {node, self?, category, claim, evidence[], counterCheck?, expectedFix?, recheck?}'];
  const out = [];
  for (const k of Object.keys(rc)) if (!ROOT_CAUSE_KEYS.has(k)) out.push(`rootCause has unknown field '${k}'`);
  if (!text(rc.node)) out.push('rootCause.node is required: the op (op or op#instance) whose output caused the failure');
  if (rc.self !== undefined && typeof rc.self !== 'boolean') out.push('rootCause.self must be a boolean');
  for (const k of ['category', 'claim']) if (!text(rc[k])) out.push(`rootCause.${k} is required`);
  if (text(rc.claim) && rc.claim.length > 600) out.push('rootCause.claim exceeds 600 chars');
  if (!Array.isArray(rc.evidence) || !rc.evidence.length || rc.evidence.some((e) => !text(e) || e.length > 400)) out.push('rootCause.evidence must be a nonempty array of strings of at most 400 chars');
  for (const k of ['counterCheck', 'expectedFix', 'recheck']) {
    if (rc[k] !== undefined && (!text(rc[k]) || rc[k].length > 600)) out.push(`rootCause.${k} must be a nonempty string of at most 600 chars`);
  }
  if (rc.op !== undefined && (!text(rc.op) || !/^[a-z]+(\.[a-z]+)+$/.test(rc.op))) out.push('rootCause.op must be an op kind such as backend.implement');
  if (rc.files !== undefined && (!Array.isArray(rc.files) || rc.files.some((f) => !text(f) || f.length > 300) || rc.files.length > 60)) out.push('rootCause.files must be an array of at most 60 repository paths (repository:<id>/<path> for another checkout)');
  return out;
}

// validateOpReport(value, {ownedPaths, identity, commitPolicy?}) — identity
// fields present in the file must match the job's truth (identity = {run,
// task, dispatch, from}); absent ones are stamped by the caller. A committing
// commitPolicy (the op manifest's policy.commitPolicy) makes `head` required
// on done|partial. Returns {ok:true, report} or {ok:false, reasons[]}.
const SHA = /^[0-9a-f]{7,40}$/i;
export function validateOpReport(value, { ownedPaths = [], identity = {}, commitPolicy = null } = {}) {
  const reasons = [];
  const fail = (r) => { reasons.push(r); };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ok: false, reasons: ['report is not a JSON object'] };

  if (value.schema !== undefined && value.schema !== OP_REPORT_SCHEMA) fail(`schema must be ${OP_REPORT_SCHEMA}, got '${value.schema}'`);
  for (const k of Object.keys(value)) if (!ALLOWED_KEYS.has(k)) fail(`unknown field '${k}'`);

  if (!OP_REPORT_OUTCOMES.includes(value.outcome)) fail(`outcome must be one of ${OP_REPORT_OUTCOMES.join('|')}, got '${value.outcome}'`);
  if (!text(value.summary)) fail('summary is required');
  else if (value.summary.replace(/\s+/g, ' ').length > 600) fail('summary exceeds 600 chars');

  // A build op codes on a placeholder when a credential is missing and names the
  // variables here; only the live-proof leg waits for the real values
  // (modules/ops/_common.yaml "Bounded finish and blockers").
  if (value.credentialPending !== undefined && (!Array.isArray(value.credentialPending)
    || value.credentialPending.some((v) => typeof v !== 'string' || !/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(v))))
    fail('credentialPending must be an array of env var or custody key names');

  // rootCause names the node the report blames; settle routes a failure whose node is another op's to a
  // read-only root verify of it (scripts/kernel/api.mjs enqueueNextStep).
  if (value.rootCause !== undefined) for (const r of rootCauseProblems(value.rootCause)) fail(r);
  // claims name what the job's artifacts prove (scripts/kernel/proof-integrity.mjs): indexed with them at settle.
  if (value.claims !== undefined) for (const r of claimsProblems(value.claims)) fail(r);
  if (value.failureClass !== undefined && !FAILURE_CLASSES.includes(value.failureClass)) fail(`failureClass must be one of ${FAILURE_CLASSES.join('|')}`);
  if (value.failureClass !== undefined && value.outcome !== 'failed') fail("failureClass belongs to outcome 'failed' only");
  // seamAssumptions: what a cut sibling that ran on a stub assumed of its unlanded seam
  // (scripts/kernel/cut-seam.mjs); the Kernel's cut-seam-reconcile re-verifies them once the seam lands.
  if (value.seamAssumptions !== undefined && (!Array.isArray(value.seamAssumptions)
    || value.seamAssumptions.some((a) => !a || typeof a !== 'object' || Array.isArray(a) || !text(a.symbol) || !text(a.assumption) || (a.file !== undefined && !text(a.file)))))
    fail('seamAssumptions must be an array of {symbol, assumption, file?}');

  // owedToWire: a canon slice's residual findings that only its cut's canon-wire leg can land (a shared-root
  // registration, config, public entry or consumer outside its owned paths; modules/ops/ops/code.refactor.yaml
  // SCOPE_WIDENING). The brief always named it; the envelope refused it, so slices could not declare it
  // (wf-nivo-fe-canon-mujek980 op-code.refactor-c54caae5fb overruled for 'missing the formal owedToWire').
  if (value.owedToWire !== undefined && (!Array.isArray(value.owedToWire)
    || value.owedToWire.some((o) => !o || typeof o !== 'object' || Array.isArray(o) || !text(o.path) || !text(o.finding) || Object.keys(o).some((k) => !['path', 'finding', 'file', 'ruleId'].includes(k)))))
    fail('owedToWire must be an array of {path, finding, file?, ruleId?}');
  if (value.files !== undefined) {
    if (!Array.isArray(value.files) || value.files.some((f) => !text(f)) || new Set(value.files).size !== value.files.length) fail('files must be an array of unique path strings');
    else for (const f of value.files) if (!underOwned(f, ownedPaths)) fail(`file '${f}' is outside owned_paths`);
  }
  if (value.checks !== undefined) {
    if (!Array.isArray(value.checks)) fail('checks must be an array');
    else value.checks.forEach((c, i) => {
      if (!c || typeof c !== 'object' || !text(c.name) || !text(c.command) || !Number.isInteger(c.exitCode)) fail(`checks[${i}] needs {name, command, exitCode}`);
      else if (c.evidence !== undefined && String(c.evidence).length > 400) fail(`checks[${i}].evidence exceeds 400 chars`);
      else if (c.failing !== undefined && (!Array.isArray(c.failing) || c.failing.some((f) => !text(f)))) fail(`checks[${i}].failing must be an array of file paths`);
      for (const field of ['stdoutPath', 'stderrPath', 'outputPath', 'cwd'])
        if (c?.[field] !== undefined && !text(c[field])) fail(`checks[${i}].${field} must be a nonempty path`);
      if (c?.phase !== undefined && !['before', 'after', 'verify', 'parity', 'integrate'].includes(c.phase))
        fail(`checks[${i}].phase must be before|after|verify|parity|integrate`);
      for (const field of ['startedAt', 'finishedAt'])
        if (c?.[field] !== undefined && (!Number.isInteger(c[field]) || c[field] < 0)) fail(`checks[${i}].${field} must be an epoch millisecond integer`);
      if (Number.isInteger(c?.startedAt) && Number.isInteger(c?.finishedAt) && c.finishedAt < c.startedAt)
        fail(`checks[${i}].finishedAt precedes startedAt`);
      // The checker could not run (tool missing, host down): infra, never red (H7). exitCode still records what the shell returned.
      if (c?.unavailable !== undefined && typeof c.unavailable !== 'boolean') fail(`checks[${i}].unavailable must be a boolean`);
    });
  }
  if (value.outcome === 'partial' && (!Array.isArray(value.open) || !value.open.length || value.open.some((o) => !text(o)))) fail("outcome 'partial' requires a nonempty open[] of unfinished items");
  if (value.outcome === 'ask' && (!value.question || !text(value.question.text))) fail("outcome 'ask' requires question.text");
  // question.recommended: the 0-based index of the option the op recommends, with
  // question.recommendedReason saying why (config.yaml asks.autoAcceptRecommended
  // may answer the ask with it; scripts/kernel/ask-recommendation.mjs).
  if (value.question && typeof value.question === 'object') {
    const q = value.question, count = Array.isArray(q.options) ? q.options.length : 0;
    if (q.recommended !== undefined && q.recommended !== null
      && (!Number.isInteger(q.recommended) || q.recommended < 0 || q.recommended >= count)) {
      fail(`question.recommended must be the 0-based index of one of question.options (0..${Math.max(count - 1, 0)}), got ${JSON.stringify(q.recommended)}`);
    }
    if (q.recommendedReason !== undefined && q.recommendedReason !== null) {
      if (typeof q.recommendedReason !== 'string') fail('question.recommendedReason must be a string');
      else if (q.recommendedReason.length > 600) fail('question.recommendedReason exceeds 600 chars');
      else if (q.recommended === undefined || q.recommended === null) fail('question.recommendedReason needs question.recommended: the index of the option it recommends');
    }
  }
  if (value.outcome === 'blocked' && (!value.blocker || !BLOCKER_KINDS.includes(value.blocker.kind) || !text(value.blocker.detail))) fail(`outcome 'blocked' requires blocker {kind <- ${BLOCKER_KINDS.join('|')}, detail}`);

  if (policyCommits(commitPolicy) && ['done', 'partial'].includes(value.outcome)) {
    if (value.head === undefined) fail(`outcome '${value.outcome}' of a committing op requires head: put \`git rev-parse HEAD\` of the checkout holding your owned paths into \`head\` and re-file`);
    else if (typeof value.head !== 'string' || !SHA.test(value.head.trim())) fail(`head must be a 7-40 character hex commit sha, got '${value.head}': put \`git rev-parse HEAD\` of the checkout holding your owned paths into \`head\` and re-file`);
  }

  const lossy = lossyTextFields(value);
  if (lossy.length) fail(`text in ${lossy.join(', ')} lost its non-ASCII characters ('?' inside words): write the report file as UTF-8 (Node fs.writeFileSync, or PowerShell Out-File -Encoding utf8 / [IO.File]::WriteAllText) and file it again`);

  for (const k of ['run', 'task', 'dispatch', 'from']) {
    if (value[k] !== undefined && identity[k] != null && value[k] !== identity[k]) fail(`identity '${k}' is '${value[k]}' but the job binds '${identity[k]}'`);
  }

  if (reasons.length) return { ok: false, reasons };
  const report = { ...value, schema: OP_REPORT_SCHEMA };
  for (const k of ['run', 'task', 'dispatch', 'from']) if (identity[k] != null) report[k] = identity[k];
  return { ok: true, report };
}
