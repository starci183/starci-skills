// starci/op-report@1 — the op's filed result. `api report` validates the
// envelope before it becomes a durable reports row; the api stamps the
// identity fields (run/task/dispatch/from) from the job row — a worker can
// never claim another job's dispatch. Contract: modules/kernel/
// verdict-contract.yaml §2.

import { readDistJson } from '../../engine/runtime-root.mjs';
import { policyCommits } from './settle-landed.mjs';

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

const ALLOWED_KEYS = new Set(['schema', 'outcome', 'run', 'task', 'dispatch', 'from', 'summary', 'files', 'checks', 'open', 'question', 'blocker', 'branch', 'head', 'credentialPending']);
const text = (v) => typeof v === 'string' && v.trim().length > 0;
const normalizePath = (p) => String(p).replace(/\\/g, '/').replace(/\/{2,}/g, '/').replace(/^\.\//, '').replace(/\/+$/, '');

const underOwned = (file, ownedPaths) => {
  if (!ownedPaths.length) return true; // no declared write set → nothing to check against
  const f = normalizePath(file);
  return ownedPaths.some((own) => {
    const o = normalizePath(typeof own === 'string' ? own : own?.path);
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
  (Array.isArray(value?.question?.options) ? value.question.options : []).forEach((o, i) => scan(`question.options[${i}]`, typeof o === 'string' ? o : o?.label));
  scan('blocker.detail', value?.blocker?.detail);
  (Array.isArray(value?.open) ? value.open : []).forEach((o, i) => scan(`open[${i}]`, o));
  const marks = fields.map(([label, text]) => [label, (text.match(LOSSY_MARK) ?? []).length]).filter(([, n]) => n > 0);
  const total = marks.reduce((sum, [, n]) => sum + n, 0);
  return total >= 3 || fields.some(([, text]) => text.includes("\uFFFD")) ? marks.map(([label]) => label) : [];
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

  if (value.files !== undefined) {
    if (!Array.isArray(value.files) || value.files.some((f) => !text(f)) || new Set(value.files).size !== value.files.length) fail('files must be an array of unique path strings');
    else for (const f of value.files) if (!underOwned(f, ownedPaths)) fail(`file '${f}' is outside owned_paths`);
  }
  if (value.checks !== undefined) {
    if (!Array.isArray(value.checks)) fail('checks must be an array');
    else value.checks.forEach((c, i) => {
      if (!c || typeof c !== 'object' || !text(c.name) || !text(c.command) || !Number.isInteger(c.exitCode)) fail(`checks[${i}] needs {name, command, exitCode}`);
      else if (c.evidence !== undefined && String(c.evidence).length > 400) fail(`checks[${i}].evidence exceeds 400 chars`);
    });
  }
  if (value.outcome === 'partial' && (!Array.isArray(value.open) || !value.open.length || value.open.some((o) => !text(o)))) fail("outcome 'partial' requires a nonempty open[] of unfinished items");
  if (value.outcome === 'ask' && (!value.question || !text(value.question.text))) fail("outcome 'ask' requires question.text");
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
