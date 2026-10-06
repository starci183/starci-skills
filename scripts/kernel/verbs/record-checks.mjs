// starci kernel record-checks: record independent checks against a filed worker report.
import fs from 'node:fs';
import path from 'node:path';
import { parseJson } from '../../lib/json.mjs';
import { jobOpOf } from './shared/rows.mjs';
import { classifyChecks } from '../../machine/contract-version.mjs';
import { isMeasurementLeg } from '../verify-failure.mjs';
import { classifyCheck, rerunCheck, settlerSettings } from '../settle/job-settle.mjs';
import { checkVerdictOf } from '../settle/check-verdict.mjs';
import { latestAttemptIdOf, recordEnvelopeChecks } from './shared/check-evidence.mjs';
import { readEnv } from '../../lib/env.mjs';
import { observationContextOf, observeCheck, stageObservation } from '../mechanism-observation.mjs';
import { withWorkflowLock } from '../workflow-checkpoint.mjs';

export default {
  verb: 'record-checks',
  required: ['job'],
  kernelOnly: true,
  usageInCore: true,
  validate(args, need) {
    need(args.checks != null || args['checks-file'], 'record-checks needs --checks <json> or --checks-file <path>');
  },
  run({ ledger, args, repo, emit, internals }) {
    const { resolveJob, parseAttempt, isCheckResultEnvelope, requireDispatchedReportBinding,
      skillRoot, attributeChecks, buildOpsOf, markMeasured, isPeerBlockedCheck, summarizeCheckEvidence } = internals;
  const db = ledger.db, job = resolveJob(db, args.job);
  const op = args.op ?? jobOpOf(job);
  if (!op) throw Object.assign(new Error(`job ${job.job_id} carries no op identity — pass --op`), { code: 'job-no-op' });
  const attempt = parseAttempt(args.attempt) ?? job.try_no;
  const raw = args.checks ?? (() => {
    const file = [path.resolve(args['checks-file']), path.resolve(repo, args['checks-file'])].find((p) => fs.existsSync(p));
    if (!file) throw Object.assign(new Error(`checks file missing: ${args['checks-file']}`), { code: 'checks-file-missing' });
    return fs.readFileSync(file, 'utf8');
  })();
  const parsed = parseJson(raw);
  if (!isCheckResultEnvelope(parsed)) {
    throw Object.assign(new Error('checks payload must be an object with a non-empty checks[] of {name, exitCode, command?, evidence?} entries'), { code: 'checks-invalid' });
  }
  if (attempt !== job.try_no) {
    throw Object.assign(new Error(`checks attempt ${attempt} does not match job ${job.job_id} try ${job.try_no}`), {
      code: 'checks-attempt-mismatch', attempt, jobAttempt: job.try_no,
    });
  }
  const attemptId = latestAttemptIdOf(db, job.job_id);
  if (attemptId == null) throw Object.assign(new Error(`job ${job.job_id} was never dispatched: no attempt to record checks for`), { code: 'checks-report-missing' });
  const dispatchId = requireDispatchedReportBinding(db, job);
  const reportRow = db.prepare('SELECT dispatch_id FROM reports WHERE attempt_id=?').get(attemptId);
  if (!reportRow) {
    throw Object.assign(new Error(`job ${job.job_id} has no filed worker report for dispatch ${dispatchId}`), {
      code: 'checks-report-missing', dispatchId,
    });
  }
  const observations = new Map(), context = observationContextOf(db, job, { repo, skillRoot });
  // H8: a verdict reads only the RAW exit a runtime runner observed. The settler passes what it re-ran itself; any
  // other caller's check whose command the runtime can re-run IS re-run here, its declared exit kept as evidence; a
  // command the runtime cannot re-run is recorded authority 'declared': its red counts, its green never does.
  const settler = readEnv('STARCI_CALLER') === 'runtime-settler';
  if (!settler) {
    const { rerunTimeoutMs } = settlerSettings();
    parsed.checks = parsed.checks.map((check) => {
      const cls = classifyCheck(check, { skillRoot, mechanical: Boolean(context) });
      if (cls.kind !== 'runtime') return { ...check, authority: 'declared' };
      const invoke = (target) => rerunCheck(cls, { repo: target, timeoutMs: rerunTimeoutMs });
      const r = cls.mechanical && context ? observeCheck(cls, context, invoke) : invoke(repo);
      observations.set(String(check.name), stageObservation(r, [repo, ...(context?.roots ?? [])]));
      const v = checkVerdictOf(r);
      return { ...check, authority: 'runtime', declaredExitCode: check.exitCode, exitCode: Number.isInteger(r.exitCode) ? r.exitCode : 127,
        ...(v.verdict === 'unavailable' ? { unavailable: true } : {}), evidence: `starci kernel record-checks re-run: raw exit ${r.exitCode} (declared ${check.exitCode}) ${r.tail ?? ''}`.slice(0, 1000) };
    });
  } else parsed.checks = parsed.checks.map((check) => ({ ...check, authority: 'runtime' }));
  parsed.checks = attributeChecks(db, { repo, job: { ...job, op_id: op }, checks: classifyChecks(parsed.checks) });
  // Only the api marks a measurement leg's findings as measured (verify-failure.mjs); a caller's mark is dropped.
  const measurementLeg = isMeasurementLeg(db, { ...job, op_id: op }, { buildOps: buildOpsOf() });
  parsed.checks = parsed.checks.map((check) => {
    if (!check || typeof check !== 'object') return check;
    const clean = { ...check };
    delete clean.measured;
    return measurementLeg ? markMeasured(clean) : clean;
  });
  const peerBlockedChecks = parsed.checks.filter(isPeerBlockedCheck).map((check) => ({ name: check.name, peers: check.peerBlocked.peers }));
  const checkEvidence = summarizeCheckEvidence(parsed);
  withWorkflowLock({ db, ledger, repo, env: process.env }, { workflowId: job.workflow_id }, () => ledger.transaction(() => {
    const now = Date.now();
    // One check_runs row per check (runner kernel, or settler for the runtime settler) - a re-record is a new run_seq.
    // The settler already recorded each re-run it measured (job-settle.mjs recordSettlerCheck): only its composed
    // checks (cut-regression-inventory, a parity red) are new rows here.
    const already = settler ? new Set(db.prepare("SELECT DISTINCT name FROM check_runs WHERE attempt_id=? AND runner='settler'").all(attemptId).map((r) => r.name)) : new Set();
    recordEnvelopeChecks(db, { attemptId, checks: parsed.checks.filter((c) => !already.has(String(c.name))), runner: settler ? 'settler' : 'kernel', observations, now });
    ledger.appendEvent({
      workflowId: job.workflow_id, entityType: 'job', entityId: job.job_id,
      kind: 'checks-recorded', attemptId, payload: { op, attempt, attemptId, ...(peerBlockedChecks.length ? { peerBlocked: peerBlockedChecks } : {}) },
    });
  }));
  const out = { ok: true, jobId: job.job_id, workflowId: job.workflow_id, op, attempt, checks: parsed.checks.length, checkEvidence,
    ...(peerBlockedChecks.length ? { peerBlocked: peerBlockedChecks } : {}) };
  const peerName = (c) => `${c.name} [${c.peers.map((p) => p.jobId ?? p.commit?.slice(0, 12)).join(',')}]`;
  const peerBlocked = peerBlockedChecks.length ? `; peer-blocked (a peer's change, not this op's): ${peerBlockedChecks.map(peerName).join(', ')}` : '';
  emit(out, `checks recorded for ${job.job_id} (op ${op}, attempt ${attempt})${peerBlocked}`, args.json);

  },
};
