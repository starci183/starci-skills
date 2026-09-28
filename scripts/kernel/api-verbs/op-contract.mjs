// api op-contract: split from api.mjs.
import { parseJson } from '../../lib/json.mjs';
import { jobOpOf } from '../api-lib/rows.mjs';
import { admittedContractOf, advisoryCodesFor, loadContractChanges } from '../contract-version.mjs';
import { sleepSync } from '../../lib/sleep-sync.mjs';
const OP_CONTRACT_WAIT_MS = 120_000;

export default {
  verb: 'op-contract',
  required: [],
  validate(args, need) { need(args.job || (args.workflow && args.op), 'op-contract needs --job <job_id> or --workflow <id> --op <opId> [--attempt <n>]'); },
  usageInCore: true,
  run({ ledger, args, emit, internals }) {
    const db = ledger.db;
    let workflowId, op, attempt = internals.parseAttempt(args.attempt);
    if (args.job) {
      const job = internals.resolveJob(db, args.job);
      workflowId = job.workflow_id; op = args.op ?? jobOpOf(job);
      if (attempt == null) attempt = job.attempt;
    } else {
      workflowId = args.workflow; op = args.op;
      if (attempt == null) attempt = db.prepare('SELECT MAX(attempt) a FROM contracts WHERE workflow_id=? AND op_id=?').get(workflowId, op)?.a ?? null;
    }
    const read = () => (attempt == null ? null
      : db.prepare('SELECT * FROM contracts WHERE workflow_id=? AND op_id=? AND attempt=?').get(workflowId, op, attempt));
    let row = read();
    // Dispatch commits the contract row together with status running, after the
    // terminal is up, the preamble sent and the model attested (~20s+); a worker
    // whose first action is `api op-contract` lands inside that window and read
    // contract-missing for a row the Kernel saw seconds later (nivo Modules
    // inc-e09140ad9c22, WSPV inc-7f437d11edae). While the job is still leased,
    // wait for the dispatch to commit it instead of answering missing.
    if (!row && args.job && attempt != null) {
      const deadline = Date.now() + OP_CONTRACT_WAIT_MS;
      while (!row && Date.now() < deadline) {
        const status = db.prepare('SELECT status FROM jobs WHERE job_id=?').get(String(args.job))?.status
          ?? db.prepare('SELECT status FROM jobs WHERE workflow_id=? AND op_id=? AND attempt=? ORDER BY updated_at DESC LIMIT 1').get(workflowId, op, attempt)?.status;
        if (status !== 'leased') break;
        sleepSync(1000);
        row = read();
      }
    }
    if (!row) throw Object.assign(new Error(`no contract row for ${workflowId}/${op} attempt ${attempt ?? '(none filed)'}`), { code: 'contract-missing' });
    if (args.json) {
      // The admission this attempt is judged by, and what landed after it: the checks and finding codes
      // those changes added are suspects for this leg (a check script takes --admitted-at <admittedAt>).
      const admission = admittedContractOf(db, { workflow_id: workflowId, op_id: op, attempt: row.attempt });
      const registry = loadContractChanges(internals.skillRoot);
      const advisory = Number.isFinite(admission.at) ? advisoryCodesFor(registry, { admittedAt: admission.at, op, withheld: admission.withheld }) : { codes: [], checks: [], changes: [] };
      emit({ ok: true, workflowId, op, attempt: row.attempt, dispatchId: row.dispatch_id, markdown: row.markdown, context: parseJson(row.context_json), createdAt: row.created_at,
        admission: { admittedAt: admission.at, source: admission.source, withheld: admission.withheld ?? [], runtimeSha: admission.version?.runtimeSha ?? null, digest: admission.version?.digest ?? null, laterChanges: advisory.changes, advisoryChecks: advisory.checks, advisoryCodes: advisory.codes } }, '', true);
    } else {
      process.stdout.write(row.markdown.endsWith('\n') ? row.markdown : `${row.markdown}\n`);
    }
  },
};
