// api check: record independent checks against a filed worker report.
import fs from 'node:fs';
import path from 'node:path';
import { parseJson } from '../../lib/json.mjs';
import { jobOpOf } from '../api-lib/rows.mjs';
import { admittedContractOf, laterChangesFor, loadContractChanges, classifyChecks } from '../contract-version.mjs';
import { isMeasurementLeg } from '../verify-failure.mjs';

export default {
  verb: 'check',
  required: ['job'],
  kernelOnly: true,
  usageInCore: true,
  validate(args, need) {
    need(args.checks != null || args['checks-file'], 'check needs --checks <json> or --checks-file <path>');
  },
  run({ ledger, args, repo, emit, internals }) {
    const { resolveJob, parseAttempt, isCheckResultEnvelope, requireDispatchedReportBinding,
      skillRoot, attributeChecks, buildOpsOf, markMeasured, isPeerBlockedCheck, summarizeCheckEvidence } = internals;
  const db = ledger.db, job = resolveJob(db, args.job);
  const op = args.op ?? jobOpOf(job);
  if (!op) throw Object.assign(new Error(`job ${job.job_id} carries no op identity — pass --op`), { code: 'job-no-op' });
  const attempt = parseAttempt(args.attempt) ?? job.attempt;
  const raw = args.checks ?? (() => {
    const file = [path.resolve(args['checks-file']), path.resolve(repo, args['checks-file'])].find((p) => fs.existsSync(p));
    if (!file) throw Object.assign(new Error(`checks file missing: ${args['checks-file']}`), { code: 'checks-file-missing' });
    return fs.readFileSync(file, 'utf8');
  })();
  const parsed = parseJson(raw);
  if (!isCheckResultEnvelope(parsed)) {
    throw Object.assign(new Error('checks payload must be an object with a non-empty checks[] of {name, exitCode, command?, evidence?} entries'), { code: 'checks-invalid' });
  }
  if (attempt !== job.attempt) {
    throw Object.assign(new Error(`checks attempt ${attempt} does not match job ${job.job_id} attempt ${job.attempt}`), {
      code: 'checks-attempt-mismatch', attempt, jobAttempt: job.attempt,
    });
  }
  const dispatchId = requireDispatchedReportBinding(db, job);
  const reportRow = db.prepare('SELECT dispatch_id FROM reports WHERE workflow_id=? AND dispatch_id=?')
    .get(job.workflow_id, dispatchId);
  if (!reportRow) {
    throw Object.assign(new Error(`job ${job.job_id} has no filed worker report for dispatch ${dispatchId}`), {
      code: 'checks-report-missing', dispatchId,
    });
  }
  // The leg is judged against the contract it was admitted under: a red check (or finding code) a
  // contract change added after that admission is recorded advisory, a suspect and not a refusal
  // (scripts/kernel/contract-version.mjs; modules/kernel/contract-changes.yaml).
  const admitted = admittedContractOf(db, { ...job, op_id: op });
  const laterChanges = laterChangesFor(loadContractChanges(skillRoot), { admittedAt: admitted.at, op, withheld: admitted.withheld });
  parsed.checks = attributeChecks(db, { repo, job: { ...job, op_id: op }, checks: classifyChecks(parsed.checks, laterChanges) });
  // Only the api marks a measurement leg's findings as measured (verify-failure.mjs); a caller's mark is dropped.
  const measurementLeg = isMeasurementLeg(db, { ...job, op_id: op }, { buildOps: buildOpsOf() });
  parsed.checks = parsed.checks.map((check) => { if (!check || typeof check !== 'object') return check; const { measured: _m, ...clean } = check; return measurementLeg ? markMeasured(clean) : clean; });
  const advisoryChecks = parsed.checks.filter((check) => check.advisory).map((check) => ({ name: check.name, changes: check.advisory.changes }));
  const peerBlockedChecks = parsed.checks.filter(isPeerBlockedCheck).map((check) => ({ name: check.name, peers: check.peerBlocked.peers }));
  const checkEvidence = summarizeCheckEvidence(parsed);
  ledger.transaction(() => {
    const now = Date.now();
    db.prepare('INSERT OR REPLACE INTO checks(workflow_id,op_id,attempt,checks_json,created_at) VALUES(?,?,?,?,?)')
      .run(job.workflow_id, op, attempt, JSON.stringify(parsed), now);
    ledger.appendEvent({
      workflowId: job.workflow_id, entityType: 'job', entityId: job.job_id,
      kind: 'checks-recorded', payload: { op, attempt, ...(advisoryChecks.length ? { advisory: advisoryChecks } : {}), ...(peerBlockedChecks.length ? { peerBlocked: peerBlockedChecks } : {}) },
    });
  });
  const out = { ok: true, jobId: job.job_id, workflowId: job.workflow_id, op, attempt, checks: parsed.checks.length, checkEvidence,
    ...(advisoryChecks.length ? { advisory: advisoryChecks, admittedAt: admitted.at } : {}),
    ...(peerBlockedChecks.length ? { peerBlocked: peerBlockedChecks } : {}) };
  emit(out, `checks recorded for ${job.job_id} (op ${op}, attempt ${attempt})${advisoryChecks.length ? `; advisory for this leg (added after it was admitted): ${advisoryChecks.map((c) => `${c.name} [${c.changes.join(',')}]`).join(', ')}` : ''}${peerBlockedChecks.length ? `; peer-blocked (a peer's change, not this op's): ${peerBlockedChecks.map((c) => `${c.name} [${c.peers.map((p) => p.jobId ?? p.commit?.slice(0, 12)).join(',')}]`).join(', ')}` : ''}`, args.json);

  },
};
