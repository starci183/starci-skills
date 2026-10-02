// starci kernel op-contract: split from cli.mjs.
import { parseJson } from '../../lib/json.mjs';
import { jobOpOf } from './shared/rows.mjs';
import { admittedContractOf, advisoryCodesFor, loadContractChanges } from '../../machine/contract-version.mjs';
import { sleepSync } from '../../lib/sleep-sync.mjs';
const OP_CONTRACT_WAIT_MS = 120_000;

export default {
  verb: 'op-contract',
  required: [],
  validate(args, need) { need(args.job || (args.workflow && args.op), 'op-contract needs --job <job_id> or --workflow <id> --op <opId> [--attempt <n>]'); },
  usageInCore: true,
  run({ ledger, args, emit, internals }) {
    const db = ledger.db;
    // A contract is keyed by its attempt (op_attempts). --attempt names a try number (jobs.try_no): of the job's unit
    // with --job, of the op with --workflow --op; without it the newest attempt answers.
    let workflowId, op, attempt = internals.parseAttempt(args.attempt), job = null;
    if (args.job) {
      job = internals.resolveJob(db, args.job);
      workflowId = job.workflow_id; op = args.op ?? jobOpOf(job);
    } else {
      workflowId = args.workflow; op = args.op;
    }
    const CONTRACT_ROW = 'SELECT c.*, a.dispatch_id, a.job_id AS attempt_job_id, a.try_no AS attempt FROM contracts c JOIN op_attempts a ON a.attempt_id=c.attempt_id';
    const read = () => {
      if (job && (attempt == null || attempt === job.try_no)) return db.prepare(`${CONTRACT_ROW} WHERE a.job_id=? ORDER BY a.attempt_id DESC LIMIT 1`).get(job.job_id) ?? null;
      if (job?.unit_id) return db.prepare(`${CONTRACT_ROW} WHERE a.workflow_id=? AND a.unit_id=? AND a.try_no=? ORDER BY a.attempt_id DESC LIMIT 1`).get(workflowId, job.unit_id, attempt) ?? null;
      return db.prepare(`${CONTRACT_ROW} WHERE a.workflow_id=? AND a.op_id=?${attempt == null ? '' : ' AND a.try_no=?'} ORDER BY a.attempt_id DESC LIMIT 1`)
        .get(...[workflowId, op, ...(attempt == null ? [] : [attempt])]) ?? null;
    };
    if (job && attempt == null) attempt = job.try_no;
    let row = read();
    // Dispatch commits the contract row together with status running, after the
    // terminal is up, the preamble sent and the model attested (~20s+); a worker
    // whose first action is `starci kernel op-contract` lands inside that window and read
    // contract-missing for a row the Kernel saw seconds later (a product's Modules
    // inc-e09140ad9c22, WSPV inc-7f437d11edae). While the job is still leased,
    // wait for the dispatch to commit it instead of answering missing.
    if (!row && job) {
      const deadline = Date.now() + OP_CONTRACT_WAIT_MS;
      while (!row && Date.now() < deadline) {
        const status = db.prepare('SELECT status FROM jobs WHERE job_id=?').get(job.job_id)?.status;
        if (status !== 'leased') break;
        sleepSync(1000);
        row = read();
      }
    }
    if (!row) throw Object.assign(new Error(`no contract row for ${workflowId}/${op} attempt ${attempt ?? '(none filed)'}`), { code: 'contract-missing' });
    if (args.json) {
      // The admission this attempt is judged by, and what landed after it: the checks and finding codes
      // those changes added are suspects for this leg (a check script takes --admitted-at <admittedAt>).
      const admission = admittedContractOf(db, { attempt_id: row.attempt_id });
      const registry = loadContractChanges(internals.skillRoot);
      const advisory = Number.isFinite(admission.at) ? advisoryCodesFor(registry, { admittedAt: admission.at, op, withheld: admission.withheld }) : { codes: [], checks: [], changes: [] };
      emit({ ok: true, workflowId, op, attempt: row.attempt, dispatchId: row.dispatch_id, markdown: row.markdown, context: parseJson(row.context_json), createdAt: row.created_at,
        admission: { admittedAt: admission.at, source: admission.source, withheld: admission.withheld ?? [], runtimeSha: admission.version?.runtimeSha ?? null, digest: admission.version?.digest ?? null, laterChanges: advisory.changes, advisoryChecks: advisory.checks, advisoryCodes: advisory.codes } }, '', true);
    } else {
      process.stdout.write(row.markdown.endsWith('\n') ? row.markdown : `${row.markdown}\n`);
    }
  },
};
