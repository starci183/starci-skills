// decision-resolution.mjs — what a Decision Item of the Kernel offers as answers. A job item (settle-nongreen, checks-needed,
// retry-decision) reads the job, its report and its last refusal and offers typed options; every option is a list of Kernel verb
// steps ({verb, args}) that `starci kernel decide` executes in-process (scripts/kernel/verbs/shared/menu-decide.mjs) and that
// `starci kernel decisions --next` prints as commands. One definition: the printed command is the rendering of the step.
import { parseJsonOr } from '../lib/json.mjs';
import { SETTLED_JOB_LIST } from '../../engine/admission.mjs';
import { kernelDecisionItems } from './reported-jobs.mjs';

/** Kinds whose entity is a reported job: live only while the settler still hands that job to the Kernel. */
export const JOB_KINDS = new Set(['settle-nongreen', 'checks-needed', 'retry-decision']);

/** The job items the settler hands to the Kernel now, by job id; null when the ledger cannot say. */
export const pendingJobsOf = (db, workflowId, now) => { try { return new Map(kernelDecisionItems(db, workflowId, { now }).map((i) => [i.jobId, i])); } catch { return null; } };

/** Whether a retry-decision item still waits: its job is settled failed (or waits on the owner) and no later try of its unit exists. */
const retryDecisionLive = (db, jobId) => {
  const row = db.prepare('SELECT status, unit_id, try_no FROM jobs WHERE job_id=?').get(jobId);
  if (!row || !['failed', 'awaiting_owner'].includes(row.status)) return false;
  return !db.prepare('SELECT 1 FROM jobs WHERE retry_of=? OR (unit_id IS NOT NULL AND unit_id=? AND try_no>?) LIMIT 1').get(jobId, row.unit_id, row.try_no);
};

/**
 * Whether a DI still waits on the Kernel. A settle-nongreen or checks-needed item lives while the settler hands its job to the
 * Kernel; a retry-decision item concerns a settled job, so it lives while that job has no later try.
 */
export const liveFor = (d, pending, db) => {
  if (!(JOB_KINDS.has(d.kind) && d.entity?.type === 'job')) return true;
  if (d.kind === 'retry-decision') return retryDecisionLive(db, d.entity.id);
  return !(pending && !pending.has(d.entity.id));
};

const q = (v) => (/[\s"'|;&<>]/.test(String(v)) ? `'${String(v).replaceAll("'", String.fromCodePoint(39, 92, 39, 39))}'` : String(v));

/** One step as the command line a person would type. */
export const commandLine = (step, repo) => ['starci kernel', step.verb, `--repo ${q(repo)}`,
  ...Object.entries(step.args).map(([key, value]) => (value === true ? `--${key}` : `--${key} ${q(value)}`))].join(' ');

const lastRefusalsOf = (db, jobId) => db.prepare("SELECT kind, payload_json FROM events WHERE entity_type='job' AND entity_id=? AND (kind LIKE '%-refused' OR kind LIKE '%needs-kernel') ORDER BY seq DESC LIMIT 6").all(jobId)
  .map((e) => ({ kind: e.kind, ...parseJsonOr(e.payload_json) }));
const reportOf = (db, dispatchId) => {
  if (!dispatchId) return null;
  const r = db.prepare('SELECT outcome, report_json FROM reports WHERE dispatch_id=? ORDER BY rowid DESC LIMIT 1').get(dispatchId);
  return r ? { outcome: r.outcome, ...parseJsonOr(r.report_json) } : null;
};
const appOf = (p) => /(?:^|\/)((?:apps|packages)\/[^/]+)/.exec(String(p).replaceAll('\\', '/'))?.[1] ?? '.';

/** The steps that close a still-open attempt as a failure: the refusal as a recorded red check (a done claim), then the settle. */
const closeSteps = ({ outcome, code, failures, jobId }) => {
  const verdict = outcome === 'blocked' || outcome === 'ask' ? 'blocked' : 'fail';
  if (outcome !== 'done') return [{ verb: 'settle', args: { job: jobId, verdict } }];
  const evidence = `${code}: ${failures.join('; ').replace(/\s+/g, ' ').slice(0, 200) || 'refused by the runtime'}`;
  return [{ verb: 'record-checks', args: { job: jobId, checks: JSON.stringify([{ name: code, command: 'runtime settle', exitCode: 1, evidence }]) } },
    { verb: 'settle', args: { job: jobId, verdict } }];
};

/** The facts of one job item: the job, its newest refusal and report, and the paths a retry should own. */
function jobFacts(db, di, { now }) {
  const jobId = di.entity.id, wf = di.workflowId;
  const job = db.prepare('SELECT job_id, op_id, status, payload_json FROM jobs WHERE job_id=?').get(jobId);
  const payload = parseJsonOr(job?.payload_json);
  const pending = pendingJobsOf(db, wf, now)?.get(jobId) ?? null;
  const refusal = lastRefusalsOf(db, jobId).find((r) => r.kind !== 'job-settle-needs-kernel') ?? null;
  const report = reportOf(db, pending?.dispatchId);
  const code = pending?.reason === 'settle-refused' ? (pending.detail?.[0] ?? refusal?.reason ?? 'settle-refused') : (pending?.reason ?? refusal?.reason ?? 'needs-kernel-decision');
  const outcome = pending?.outcome ?? report?.outcome ?? null;
  const owned = (payload.owned_paths ?? []).map(String);
  // Owned paths may carry the product repo's folder (my-app/apps/...) while a report names repo-relative files.
  const repoPrefix = owned.map((p) => p.replaceAll('\\', '/').match(/^([^/]+\/)(?:apps|packages|src)\//)?.[1]).find(Boolean) ?? '';
  const withPrefix = (p) => (repoPrefix && !String(p).startsWith(repoPrefix) && /^(apps|packages|src)\//.test(String(p)) ? `${repoPrefix}${p}` : String(p));
  const failing = [...new Set([...(refusal?.files ?? []), ...(refusal?.continuation?.files ?? []), ...((report?.owedToWire ?? []).map((o) => o?.path).filter(Boolean))].map(withPrefix))].slice(0, 20);
  return { jobId, wf, job, payload, pending, refusal, report, code, outcome, failing, owned, paths: [...new Set([...owned, ...failing])],
    open: Boolean(job) && !SETTLED_JOB_LIST.includes(job.status), failures: (refusal?.failures ?? []).map(String) };
}

/** The typed options of one job item: [{key, title, steps}]. Settling the open attempt comes first, then the retry that owns the failing files. */
function jobOptions(facts, di) {
  const { jobId, wf, job, payload, code, outcome, failing, paths, open, failures, refusal } = facts;
  const op = job?.op_id ?? facts.pending?.op ?? '<op>';
  const what = String(payload.displayWhat ?? payload.title ?? jobId);
  const params = { ...payload.params, ...(refusal?.continuation?.resumeFrom ? { resumeFrom: refusal.continuation.resumeFrom } : {}) };
  const close = open ? closeSteps({ outcome, code, failures, jobId }) : [];
  const enqueue = (ps, tag) => ({ verb: 'enqueue', args: { workflow: wf, op, paths: ps.join(','), 'retry-of': jobId,
    ...(Object.keys(params).length ? { params: JSON.stringify(params) } : {}), what: `${tag}: ${what}`.slice(0, 40), ...(di.id ? { resolves: di.id } : {}) } });
  const options = [];
  if (open) options.push({ key: 'settle-fail', title: `settle it ${close.at(-1).args.verdict}: the route table queues the next step of its lineage`, steps: close });
  options.push({ key: 'continue', title: `continue on the current base with the failing files added (${failing.length} file(s))`, steps: [...close, enqueue(paths, 'continue')] });
  const apps = [...new Set(paths.map(appOf))];
  if (apps.length > 1) options.push({ key: 'split-per-app', title: `split it per app (${apps.join(', ')})`, steps: [...close, ...apps.slice(0, 4).map((a) => enqueue(paths.filter((p) => appOf(p) === a), a.split('/').pop()))] });
  if (open && outcome === 'done') options.push({ key: 'accept', title: 'accept it: the settle pass re-runs integration and parity on the current tip (only when the blocker the refusal names has since landed)', steps: [{ verb: 'settle', args: { job: jobId, verdict: 'pass' } }] });
  return options;
}

/**
 * One DI in answer form: {id, kind, summary, jobId, code, what, commands: [{key, title, run, steps}], options, resolve}. A job item
 * carries every typed option in `options` and the first three as `commands`; any other item offers its own `options` as commands.
 */
export function resolutionOf(db, di, { repo = '<repo>', now = Date.now() } = {}) {
  const wf = di.workflowId;
  const base = { id: di.id, kind: di.kind, summary: di.summary };
  const resolve = (verb) => `starci kernel decisions --repo ${q(repo)} --resolve ${di.id} --by kernel:${wf} --verb ${q(verb)}`;
  if (!(JOB_KINDS.has(di.kind) && di.entity?.type === 'job')) {
    const opts = (di.options ?? []).slice(0, 3).map((o, i) => ({ key: o.key ?? `option-${i + 1}`, title: o.title ?? o.key ?? '', run: o.verb ?? '' }));
    return { ...base, jobId: null, code: di.kind, what: di.summary, commands: opts, options: [], resolve: resolve(opts[0]?.run || '<what you ran>') };
  }
  const facts = jobFacts(db, di, { now });
  const { jobId, job, pending, report, code, outcome, failing, failures } = facts;
  const oneLine = String(report?.summary ?? di.summary).replace(/\s+/g, ' ').slice(0, 160);
  const reported = facts.open || Boolean(pending);
  const opId = job?.op_id ?? pending?.op ?? '<op>';
  const cause = failures.length ? ` (${failures[0].replace(/s+/g, ' ').slice(0, 80)})` : '';
  const whatLine = reported ? `${opId} ${jobId} reported ${outcome ?? '?'}; refused ${code}${cause}: ${oneLine}` : di.summary;
  const options = jobOptions(facts, di).map((option) => ({ ...option, run: option.steps.map((step) => commandLine(step, repo)).join(' ; ') }));
  return { ...base, jobId, op: job?.op_id ?? pending?.op ?? null, code, outcome, what: whatLine, failing, commands: options.slice(0, 3), options, resolve: resolve('<the option you ran>') };
}
