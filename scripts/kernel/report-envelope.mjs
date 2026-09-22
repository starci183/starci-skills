// starci/op-report@1 — the op's filed result. `api report` validates the
// envelope before it becomes a durable reports row; the api stamps the
// identity fields (run/task/dispatch/from) from the job row — a worker can
// never claim another job's dispatch. Contract: modules/kernel/
// verdict-contract.yaml §2.

import { readDistJson } from '../../engine/runtime-root.mjs';

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

const ALLOWED_KEYS = new Set(['schema', 'outcome', 'run', 'task', 'dispatch', 'from', 'summary', 'files', 'checks', 'open', 'question', 'blocker', 'branch', 'head']);
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

// validateOpReport(value, {ownedPaths, identity}) — identity fields present in
// the file must match the job's truth (identity = {run, task, dispatch, from});
// absent ones are stamped by the caller. Returns {ok:true, report} or
// {ok:false, reasons[]}.
export function validateOpReport(value, { ownedPaths = [], identity = {} } = {}) {
  const reasons = [];
  const fail = (r) => { reasons.push(r); };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ok: false, reasons: ['report is not a JSON object'] };

  if (value.schema !== undefined && value.schema !== OP_REPORT_SCHEMA) fail(`schema must be ${OP_REPORT_SCHEMA}, got '${value.schema}'`);
  for (const k of Object.keys(value)) if (!ALLOWED_KEYS.has(k)) fail(`unknown field '${k}'`);

  if (!OP_REPORT_OUTCOMES.includes(value.outcome)) fail(`outcome must be one of ${OP_REPORT_OUTCOMES.join('|')}, got '${value.outcome}'`);
  if (!text(value.summary)) fail('summary is required');
  else if (value.summary.replace(/\s+/g, ' ').length > 600) fail('summary exceeds 600 chars');

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

  for (const k of ['run', 'task', 'dispatch', 'from']) {
    if (value[k] !== undefined && identity[k] != null && value[k] !== identity[k]) fail(`identity '${k}' is '${value[k]}' but the job binds '${identity[k]}'`);
  }

  if (reasons.length) return { ok: false, reasons };
  const report = { ...value, schema: OP_REPORT_SCHEMA };
  for (const k of ['run', 'task', 'dispatch', 'from']) if (identity[k] != null) report[k] = identity[k];
  return { ok: true, report };
}
