// api settle: prove the filed report and independent checks before recording a verdict.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { machineFileFor, openMachine } from '../../../engine/ledger-db.mjs';
import { AWAITING_OWNER } from '../../../engine/admission.mjs';
import { validateOpReport } from '../report-envelope.mjs';
import { foreignReportOwner, ownFiledReportOf } from '../report-owner.mjs';
import { EVENTS as PRODUCT_EVENTS } from '../product-worktree.mjs';
import { terminalShow } from '../../api/orca/terminal-show.mjs';
import { parseJson } from '../../lib/json.mjs';
import { jobOpOf, jobPayloadOf, jobResultOf } from '../api-lib/rows.mjs';
import { WORKER_QUESTION } from '../api-lib/messages.mjs';
import { releaseTypedWaits } from '../api-lib/peers.mjs';
import { closeOperationTerminal } from '../close-op-terminal.mjs';
import { closeAndVerify, orcaAgents, processTable, reapOrphaned } from '../../lib/close-verify.mjs';
import { queueTail as queueSettleTail, startTail as startSettleTail } from '../../reconcile/job-settle.mjs';
import { quitAgent } from '../quit-agent.mjs';
import { OP_REV_DRIFT, opRevDrift, shortRev } from '../runtime-rev.mjs';
import { HANDOVER_APPROVED, HANDOVER_OP, handoverApprovalOf, handoverAskProblem, handoverGateOf } from '../handover.mjs';
import { unbindGuardTerminal } from '../../guards/install.mjs';
import { SEAM_RECONCILED_EVENT } from '../cut-seam.mjs';
import { PROOF_MEDIA_MISSING } from '../job-artifacts.mjs';
import { isMeasurementLeg, measurementSplit } from '../verify-failure.mjs';

export default {
  verb: 'settle',
  required: ['job', 'verdict'],
  kernelOnly: true,
  usageInCore: true,
  validate(args, need) {
    need(['pass', 'fail', 'blocked'].includes(args.verdict),
      `settle --verdict must be pass|fail|blocked, got '${args.verdict}'`);
  },
  async run({ ledger, args, repo, emit, internals }) {
    const { runSettleTail, SETTLED, reportDispatchIdOf, skillRoot, requireDispatchedReportBinding, reportOwnedPaths, reportIdentityOf, buildOpsOf, markMeasured, isPeerBlockedCheck, summarizeCheckEvidence, CUT_SET_CLOSING_CHECK, cutSetStateOf, releaseManagedWorker, closeOperationTask, custodyOf, CUT_SLICE_CHECKS, VERDICT_OUTCOMES, agentOfJob, canonSettleFollowUp, enqueueNextStep, failureClassOf, failureShapeOf, ownProductWorktreeOf, reapIfStillLive, recordOpRevDrift, recordSettledAssetSlots, recordSettledGrammarProposals, releasedWhileHeldOf, seamSettleReconciles, settleDrawAcceptance, settleDrawMetrics, settleLanding, settleProofMedia, widenCanonWire } = internals;

  const db = ledger.db, jobId = args.job, verdict = args.verdict;
  let reportAbs = args.report
    ? [path.resolve(args.report), path.resolve(repo, args.report)].find((p) => fs.existsSync(p))
    : null;
  if (args.report && !reportAbs) throw Object.assign(new Error(`report file missing: ${args.report}`), { code: 'report-missing' });
  // --report naming a path another op owns reads this job's own filed report (scripts/kernel/report-owner.mjs).
  if (reportAbs) {
    const settling = db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId);
    const own = settling && foreignReportOwner(db, reportAbs, jobOpOf(settling)) ? ownFiledReportOf(db, jobId) : null;
    if (own && fs.existsSync(own)) reportAbs = own;
  }

  const acceptForeign = typeof args['accept-foreign'] === 'string' ? args['accept-foreign'].split(',').map((p) => p.trim()).filter(Boolean) : [];
  // One guarded read of the named report for everything below - the landed proof and the
  // transaction's filing pass. The existence check above plus a fresh readFileSync in each consumer
  // left a window where the file had vanished and threw raw, an ugly crash instead of a typed
  // refusal (G26): a report that resolved but cannot be read refuses report-unreadable.
  let reportText = null;
  if (reportAbs) {
    try { reportText = fs.readFileSync(reportAbs, 'utf8'); }
    catch { throw Object.assign(new Error(`report file unreadable: ${reportAbs}`), { code: 'report-unreadable' }); }
  }
  const landed = verdict === 'pass' ? settleLanding(db, jobId, repo, reportAbs, acceptForeign, reportText) : null;
  if (landed?.detail?.integration) {
    const settlingJob = db.prepare('SELECT workflow_id FROM jobs WHERE job_id=?').get(jobId);
    const integ = landed.detail.integration;
    if (settlingJob && (landed.ok ? !integ.already : true)) {
      ledger.transaction(() => ledger.appendEvent({ workflowId: settlingJob.workflow_id, entityType: 'job', entityId: jobId, kind: landed.ok ? PRODUCT_EVENTS.integrated : PRODUCT_EVENTS.integrateRefused,
        payload: landed.ok ? integ : { reason: landed.reason, conflicts: (integ.conflicts ?? []).map((c) => c.file), failures: integ.failures ?? null, files: integ.files ?? null, continuation: integ.continuation ?? null } }));
    }
  }
  if (landed?.checked && !landed.ok) {
    const out = { ok: false, jobId, op: landed.op, reason: landed.reason, detail: landed.detail, ...(landed.hint ? { hint: landed.hint } : {}) };
    emit(out, `settle REFUSED for ${jobId} (${landed.op}): ${landed.reason} â€” ${JSON.stringify(landed.detail)}; the job stays ${landed.status}. ${landed.hint ?? `Re-dispatch the owning slice to commit its own paths${landed.pushes ? ' and push' : ''}`}, then settle again`, args.json);
    process.exit(1);
  }

  const media = verdict === 'pass' ? settleProofMedia(db, jobId, repo, reportAbs, reportText) : null;
  if (media) {
    emit({ ok: false, jobId, op: media.op, reason: PROOF_MEDIA_MISSING, code: PROOF_MEDIA_MISSING, missing: media.missing, detail: media.detail },
      `settle REFUSED for ${jobId} (${media.op}): ${PROOF_MEDIA_MISSING} â€” missing ${media.missing.join(', ')} (${JSON.stringify(media.detail)}); the job stays ${media.status}. Re-dispatch the op to capture its screenshots${media.detail.browserRan ? ' and its browser video' : ''} into its evidence and name them in report.files, then settle again`, args.json);
    process.exit(1);
  }

  const drawn = verdict === 'pass' ? settleDrawAcceptance(db, jobId, repo, reportAbs, reportText) : null;
  if (drawn) {
    const codes = [...new Set(drawn.findings.map((f) => f.code))];
    emit({ ok: false, jobId, op: drawn.op, reason: 'draw-not-accepted', codes, findings: drawn.findings.slice(0, 50), findingCount: drawn.findings.length, records: drawn.records },
      `settle REFUSED for ${jobId} (${drawn.op}): draw-not-accepted â€” ${codes.join(', ')} (${drawn.findings.length} finding(s); first: ${drawn.findings[0].detail}); the job stays ${drawn.status}. Every asset the draw binds, adopted ones included, must be a draw-render shape of ui.shapes and never a data status (node scripts/checks/draw-acceptance.mjs --repo <repo> --job ${jobId}); redraw, or settle fail`, args.json);
    process.exit(1);
  }

  const measured = verdict === 'pass' ? await settleDrawMetrics(db, jobId, repo, reportAbs, reportText) : null;
  if (measured) {
    const codes = [...new Set(measured.findings.flatMap((f) => [f.code, ...(f.codes ?? [])]))];
    emit({ ok: false, jobId, op: measured.op, reason: 'draw-metrics-failed', codes, findings: measured.findings.slice(0, 50), findingCount: measured.findings.length, records: measured.records, loops: measured.loops },
      `settle REFUSED for ${jobId} (${measured.op}): draw-metrics-failed â€” ${codes.join(', ')} (${measured.findings.length} finding(s); first: ${measured.findings[0].detail}); the job stays ${measured.status}. The runtime re-rendered every drawn part and re-ran every machine metric itself (node scripts/work/draw-loop.mjs verify --ui <record> --repo <repo>): the draw is blocked with these remaining failures and its best round${measured.loops?.length ? ` (${measured.loops.map((l) => `${l.loop} best round ${l.best}`).join(', ')})` : ''} - redraw through the loop, or settle blocked, never pass`, args.json);
    process.exit(1);
  }

  let machineRefs = [], released = 0, job, reportsConsumed = false, reportFiled = false, reportOutcome = null;
  let checkEvidence = { observed: 0, passed: 0, failed: 0, green: false }, claimOverruled = false;
  let awaitingOwner = false, cutSet = null, handoverApproval = null, peerBlocked = null, nextStep = null;
  ledger.transaction(() => {
    job = db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId);
    if (!job) throw Object.assign(new Error(`unknown job ${jobId}`), { code: 'job-unknown' });
    if (SETTLED.includes(job.status) && job.status !== 'effect_unknown') {
      throw Object.assign(new Error(`job ${jobId} is already settled (${job.status})`), { code: 'job-settled' });
    }
    if (verdict === 'pass') requireDispatchedReportBinding(db, job);
    const payload = jobPayloadOf(job);
    payload.verdict = verdict;
    payload.report = reportAbs;
    payload.settledAt = Date.now();
    const status = verdict === 'pass' ? 'succeeded' : 'failed';
    const checkRow = db.prepare('SELECT checks_json FROM checks WHERE workflow_id=? AND op_id=? AND attempt=?')
      .get(job.workflow_id, jobOpOf(job), job.attempt);
    const checksEnvelope = parseJson(checkRow?.checks_json);
    // A measurement leg (review.verify lint|stales before any build: verify-failure.mjs isMeasurementLeg)
    // completes when its checkers ran: findings they measured are its result, never its failure.
    const measurementLeg = isMeasurementLeg(db, job, { buildOps: buildOpsOf() });
    const recordedChecks = (Array.isArray(checksEnvelope?.checks) ? checksEnvelope.checks : []).map((check) => (measurementLeg ? markMeasured(check) : check));
    checkEvidence = summarizeCheckEvidence(Array.isArray(checksEnvelope?.checks) ? { ...checksEnvelope, checks: recordedChecks } : checksEnvelope);
    const result = { verdict, report: reportAbs, at: payload.settledAt, checkEvidence, ...(landed?.checked ? { landed: landed.detail } : {}) };
    // Every red check was a peer's change (api check peerBlocked): the attempt is the peer's to
    // unblock, not this op's failure - retry accounting spends no business attempt on it
    // (engine/admission.mjs retryDisposition) and the routes hand it to the peer.
    const peerChecks = recordedChecks.filter(isPeerBlockedCheck);
    if (peerChecks.length && checkEvidence.failed === 0) {
      result.peerBlocked = { checks: peerChecks.map((check) => check.name), peers: peerChecks.flatMap((check) => check.peerBlocked.peers ?? []),
        routes: [...new Set(peerChecks.flatMap((check) => check.peerBlocked.routes ?? []))] };
    }
    // The worker's claim is the reports row keyed by its dispatch. No row yet:
    // a --report file that is itself a valid op-report@1 envelope is filed on
    // the job's behalf first; anything else (markdown, absent â€” a dead worker)
    // settles on the kernel's verdict alone.
    const dispatchId = reportDispatchIdOf(db, job);
    const row = db.prepare('SELECT * FROM reports WHERE workflow_id=? AND dispatch_id=?').get(job.workflow_id, dispatchId);
    let envelope = null;
    if (row) envelope = parseJson(row.report_json);
    if (!row && reportAbs) {
      const valid = validateOpReport(parseJson(reportText), { ownedPaths: reportOwnedPaths(db, job, repo), identity: reportIdentityOf(db, job) });
      const malformedHandoverAsk = valid.ok && jobOpOf(job) === HANDOVER_OP && valid.report.outcome === 'ask' && handoverAskProblem(valid.report.question);
      if (valid.ok && !malformedHandoverAsk) {
        envelope = valid.report;
        db.prepare('INSERT OR REPLACE INTO reports(workflow_id,dispatch_id,op_id,attempt,generation,outcome,report_json,from_terminal,consumed_at,created_at) VALUES(?,?,?,?,?,?,?,?,NULL,?)')
          .run(job.workflow_id, dispatchId, jobOpOf(job), job.attempt, job.generation, envelope.outcome, JSON.stringify(envelope), job.worker_id ?? null, payload.settledAt);
      }
    }
    if (envelope?.outcome) {
      reportOutcome = envelope.outcome;
      reportFiled = true;
      const measuredSplit = measurementLeg ? measurementSplit([...recordedChecks, ...(Array.isArray(envelope.checks) ? envelope.checks : [])]) : null;
      if (measurementLeg && verdict === 'fail' && envelope.outcome === 'failed' && !measuredSplit.errors.length && !args['tool-error']) {
        throw Object.assign(new Error(`${jobId} is a measurement leg (${jobOpOf(job)} mode ${payload.params?.mode}, no build settled before it): its checkers ran and measured ${measuredSplit.findings.length} red check(s) of findings (${[...new Set(measuredSplit.findings.map((c) => c.name))].join(', ') || 'none'}) - that IS the measurement, not a failure. Settle --verdict pass (the report's findings become the input of the legs after it), or --tool-error when a checker did not actually run`), {
          code: 'measurement-findings-are-the-result', findings: measuredSplit.findings.map((c) => ({ name: c.name, exitCode: c.exitCode })) });
      }
      if (!VERDICT_OUTCOMES[verdict].includes(envelope.outcome)) {
        if (verdict === 'fail' && envelope.outcome === 'done' && checkEvidence.failed > 0) {
          claimOverruled = true;
          result.claimOverruled = true;
        } else if (verdict === 'pass' && measurementLeg && envelope.outcome === 'failed' && !measuredSplit.errors.length) {
          // A measurement filed as `failed` only because it found findings (nivo fe-canon review.verify a1-a4).
          result.measurement = { leg: 'measurement', reportOutcome: 'failed', readAs: 'done', findings: measuredSplit.findings.map((c) => c.name) };
        } else {
          throw Object.assign(new Error(`verdict '${verdict}' cannot settle a report of outcome '${envelope.outcome}'`), { code: 'verdict-outcome-mismatch' });
        }
      }
    }
    // An ask is a wait on the owner, not a failed attempt: the row settles (the
    // worker is released and the next attempt is a new job), but the recorded
    // verdict says what happened and retry accounting spends no business attempt
    // on it (engine/admission.mjs retryDisposition).
    if (verdict === 'blocked' && reportOutcome === 'ask') {
      awaitingOwner = true;
      Object.assign(result, { verdict: AWAITING_OWNER, kernelVerdict: verdict, askDispatchId: dispatchId });
    }
    if (verdict === 'pass') {
      if (reportOutcome !== 'done' && !result.measurement) {
        throw Object.assign(new Error(`pass requires a filed done report for ${jobId}`), { code: 'pass-report-missing' });
      }
      if (!checkEvidence.green) {
        throw Object.assign(new Error(`pass requires independently recorded green checks for ${jobId}`), { code: 'checks-not-green' });
      }
      if (payload.cut) {
        // Every slice pass records its scoped postcondition and the unchanged
        // inventory. The pass that CLOSES the set - every other ordinal's
        // latest job already settled succeeded, whichever ordinal settles last
        // - additionally records full-regression-final: the unchanged full
        // gates run once over the whole cut set before it counts done
        // (inc-751dd1ac4492; verdict-contract.yaml cutSetAuthority).
        cutSet = cutSetStateOf(db, { workflowId: job.workflow_id, op: jobOpOf(job), cut: payload.cut, ownJobId: jobId });
        const closesSet = cutSet.open.length === 0;
        const requiredNames = closesSet ? [...CUT_SLICE_CHECKS, CUT_SET_CLOSING_CHECK] : CUT_SLICE_CHECKS;
        const missing = requiredNames.filter((name) => !recordedChecks.some((check) => check?.name === name && check.exitCode === 0));
        if (missing.length) {
          const why = closesSet
            ? `this pass closes cut set ${cutSet.id} (every other ordinal of ${cutSet.total} settled succeeded), so the unchanged full gates run over the whole set and record ${CUT_SET_CLOSING_CHECK}`
            : `ordinal(s) ${cutSet.open.join(',')} of cut set ${cutSet.id} are still open, so this slice records its scoped checks and the set's last pass records ${CUT_SET_CLOSING_CHECK}`;
          throw Object.assign(new Error(`cut pass for ${jobId} missing required green checks: ${missing.join(', ')} â€” ${why}`), {
            code: 'cut-checks-missing', cut: payload.cut, missing,
          });
        }
        result.cutSet = { id: cutSet.id, total: cutSet.total, closesSet, open: cutSet.open };
      }
    }
    // A handover.review pass is the owner's approval turned into a ledger fact:
    // it settles only on the owner's approve receipt for the latest handover
    // ask with no business settle after it (scripts/kernel/handover.mjs). A
    // delegated answer never approves.
    if (verdict === 'pass' && jobOpOf(job) === HANDOVER_OP) {
      const approval = handoverApprovalOf(db, job.workflow_id, { attempt: job.attempt });
      if (!approval.approved) {
        throw Object.assign(new Error(`handover.review ${jobId} cannot settle pass: ${approval.reason}`), { code: 'handover-not-approved' });
      }
      handoverApproval = approval;
      result.handoverApproval = { dispatchId: approval.ask.dispatchId, answeredBy: approval.ask.answeredBy, receiptPath: approval.ask.receiptPath };
    }
    peerBlocked = result.peerBlocked ?? null;
    machineRefs = db.prepare('SELECT machine_ref FROM leases WHERE job_id=? AND machine_ref IS NOT NULL').all(jobId).map((r) => r.machine_ref);
    released = db.prepare('DELETE FROM leases WHERE job_id=?').run(jobId).changes;
    db.prepare('UPDATE jobs SET status=?, payload_json=?, result_json=?, lease_token=NULL, deadline=NULL, updated_at=? WHERE job_id=?')
      .run(status, JSON.stringify(payload), JSON.stringify(result), payload.settledAt, jobId);
    // Integrating the verdict consumes the job's reports row â€” the durable
    // workerâ†’kernel signal is spent exactly once (dispatch_id is the worker's
    // handle, falling back to the job id when none was ever bound).
    reportsConsumed = db.prepare('UPDATE reports SET consumed_at=? WHERE workflow_id=? AND dispatch_id=? AND consumed_at IS NULL')
      .run(payload.settledAt, job.workflow_id, reportDispatchIdOf(db, job)).changes > 0;
    // A question the settled worker asked through Orca has no one left to answer.
    db.prepare("UPDATE inbox SET status='done', disposition_json=?, applied_at=? WHERE workflow_id=? AND kind=? AND status='pending' AND json_extract(payload_json,'$.jobId')=?")
      .run(JSON.stringify({ reason: 'job-settled' }), payload.settledAt, job.workflow_id, WORKER_QUESTION, jobId);
    ledger.appendEvent({
      workflowId: job.workflow_id, entityType: 'job', entityId: jobId,
      kind: 'op-settled', payload: { verdict, status, report: reportAbs, reportFiled, reportOutcome, checkEvidence, claimOverruled, awaitingOwner, leasesReleased: released, machineRefs, reportsConsumed, ...(result.cutSet ? { cutSet: result.cutSet } : {}), ...(result.peerBlocked ? { peerBlocked: result.peerBlocked } : {}) },
    });
    // A failed attempt never leaves the frontier without its next step (enqueueNextStep).
    if (verdict === 'fail' && !peerBlocked) {
      const failure = reportFiled && !claimOverruled ? failureClassOf(db, job, envelope, recordedChecks) : null;
      if (failure) result.failureClass = failure;
      nextStep = enqueueNextStep(ledger, { ...job, payload_json: JSON.stringify(payload) },
        { shape: failureShapeOf({ reportFiled, reportOutcome, claimOverruled, failureClass: failure?.class ?? null, op: jobOpOf(job) }), envelope, repo, failure });
      if (failure) db.prepare('UPDATE jobs SET result_json=json_set(result_json, \'$.failureClass\', json(?)) WHERE job_id=?').run(JSON.stringify(failure), jobId);
      if (nextStep?.kind === 'peer-blocked') peerBlocked = jobResultOf(db.prepare('SELECT result_json FROM jobs WHERE job_id=?').get(jobId)).peerBlocked ?? null;
    }
    // A passed canon slice's owedToWire findings are the canon-wire leg's to land (verdict-contract owedToWire).
    if (verdict === 'pass' && payload.cut && String(payload.params?.canonFamilies ?? '').trim() && payload.params?.canonWire !== true && Array.isArray(envelope?.owedToWire) && envelope.owedToWire.length) {
      try {
        const prefix = String((payload.owned_paths ?? []).find((p) => typeof p === 'string' && /^[^/]+\/(?:apps|packages)\//.test(p)) ?? '').replace(/^([^/]+\/).*$/, '$1');
        const owed = [...new Set(envelope.owedToWire.map((o) => String(o.path).replace(/\\/g, '/').replace(/\/+$/, '')).map((p) => (prefix && !p.startsWith(prefix) ? `${prefix}${p}` : p)))];
        const wire = widenCanonWire(ledger, { ...job, payload_json: JSON.stringify(payload) }, payload, owed, []);
        if (wire) db.prepare("UPDATE jobs SET result_json=json_set(result_json, '$.owedToWire', json(?)) WHERE job_id=?").run(JSON.stringify({ paths: owed, wireJob: wire.jobId }), jobId);
      } catch (error) {
        ledger.appendEvent({ workflowId: job.workflow_id, entityType: 'job', entityId: jobId, kind: 'canon-follow-up-failed', payload: { error: String(error?.message ?? error).slice(0, 400) } });
      }
    }
    // A canon slice that settled blocked with a filed report is never a dead end (canonSettleFollowUp):
    // its committed part continues, its relocation grants widen, its shared/config/public-entry needs go to the wire.
    if (verdict === 'blocked' && reportFiled && !claimOverruled && payload.cut && !nextStep) {
      try { nextStep = canonSettleFollowUp(ledger, { ...job, payload_json: JSON.stringify(payload) }, payload, envelope) ?? null; } catch (error) {
        ledger.appendEvent({ workflowId: job.workflow_id, entityType: 'job', entityId: jobId, kind: 'canon-follow-up-failed', payload: { error: String(error?.message ?? error).slice(0, 400) } });
      }
    }
    // The owner's approval, recorded after the settle it rides on so it is
    // newer than every business settle (api finish reads it: handoverGateOf).
    if (handoverApproval) {
      ledger.appendEvent({
        workflowId: job.workflow_id, entityType: 'job', entityId: jobId,
        kind: HANDOVER_APPROVED, payload: {
          jobId, dispatchId: handoverApproval.ask.dispatchId, answeredBy: handoverApproval.ask.answeredBy,
          at: handoverApproval.ask.answeredAt, askJobId: handoverApproval.ask.jobId, receiptPath: handoverApproval.ask.receiptPath,
          lastBusinessSettleSeq: handoverApproval.lastBusinessSettleSeq,
        },
      });
    }
    // The set is done only here: its last pass recorded the whole-set gate.
    if (result.cutSet?.closesSet) {
      ledger.appendEvent({
        workflowId: job.workflow_id, entityType: 'job', entityId: jobId,
        kind: 'cut-set-closed', payload: { op: jobOpOf(job), cut: payload.cut, closedBy: jobId, ordinal: payload.cut.ordinal, check: CUT_SET_CLOSING_CHECK },
      });
    }
    // A stub-built sibling is reconciled with the real seam without a redo (cut-seam.mjs): by its own settle
    // checks when it settles after the seam passed, and every one still owed by the closing pass's
    // full-regression-final, which ran the unchanged full gates over the whole set on the real seam.
    if (verdict === 'pass' && payload.cut) {
      for (const item of seamSettleReconciles(db, { job, jobId, payload, closesSet: Boolean(result.cutSet?.closesSet) })) {
        ledger.appendEvent({ workflowId: job.workflow_id, entityType: 'job', entityId: item.jobId, kind: SEAM_RECONCILED_EVENT,
          payload: { op: jobOpOf(job), cutId: String(payload.cut.id), exitCode: 0, via: item.via, seamJobId: item.seamJobId, by: jobId } });
      }
    }
  });

  // Mirror of releaseTwoPhase's machine half: lease rows are gone; now release
  // the paired machine tokens. Best-effort â€” a missing machine db never fails
  // the settle (the ledger row is already the record).
  let machineReleased = 0;
  if (machineRefs.length) {
    try {
      const machine = openMachine({ file: machineFileFor() });
      try { machineReleased = machine.release(machineRefs).released; } finally { machine.close(); }
    } catch { /* ledger settle stands; machine TTLs expire on their own */ }
  }

  // The settled op's Orca terminal is released with its leases â€” worker_id is
  // the handle. Runs after the settled state is written; a close failure
  // never un-settles.
  // Managed jobs hold a Dispatch id in worker_id, not a terminal handle â€” they
  // take the worker-stop/-release path below, never terminal close.
  const settledPayload = jobPayloadOf(job);
  const managed = settledPayload?.managed ?? null;
  // A worker released while this settle was held (reconcile --release-worker) is already gone: its
  // recorded proof is the release, and nothing is quit, closed or released again.
  const releasedEarlier = releasedWhileHeldOf(settledPayload);
  let terminalClosed = null;
  if (releasedEarlier && !managed) {
    terminalClosed = { ...(settledPayload.terminalClosed ?? { handle: job.worker_id ?? null, ok: true }), releasedWhileHeld: true,
      custody: { state: 'released', proof: 'released-while-held', at: releasedEarlier.at ?? null } };
  } else if ((job.worker_id || settledPayload.launchTerminal?.handle) && !managed) {
    // A job settled before its dispatch bound a worker still closes the terminal that dispatch created.
    const workerHandle = job.worker_id ?? settledPayload.launchTerminal.handle;
    // The agents inside Orca terminals before the close: one that lingers outside Orca afterwards ran in this one.
    let agentsBefore = null;
    try { const t = processTable(); agentsBefore = t ? orcaAgents(t) : null; } catch { agentsBefore = null; }
    const quit = quitAgent({ handle: workerHandle, agent: agentOfJob(settledPayload) });
    const closed = closeOperationTerminal(workerHandle);
    terminalClosed = { handle: workerHandle, ok: closed.ok === true, ...(closed.tab ? { tab: closed.tab } : {}), ...(quit ? { quit } : {}), ...(closed.error ? { error: closed.error } : {}) };
    const reaped = reapIfStillLive(db, job, settledPayload, workerHandle, repo);
    if (reaped) terminalClosed.reaped = reaped;
    terminalClosed.custody = custodyOf({ release: { ok: closed.ok === true }, agentHandle: workerHandle });
    // The close is verified, never assumed (owner 2026-09-28, gc.mjs): a worker terminal that still reads connected
    // after the close is closed again and read back (close-verify.mjs), and the proof or the failure is the receipt.
    const connectedAfter = terminalClosed.custody?.state === 'retained'
      || (closed.ok === true && (() => { try { const s = terminalShow({ terminal: workerHandle }); return s?.ok && s.connected === true; } catch { return false; } })());
    if (connectedAfter) {
      const verified = closeAndVerify(workerHandle, { tree: false });
      terminalClosed.verified = verified;
      terminalClosed.ok = verified?.ok === true;
      if (verified?.ok) terminalClosed.custody = { state: 'released', proof: `verified-${verified.proof}` };
    } else terminalClosed.verified = { ok: terminalClosed.custody?.state === 'released', proof: terminalClosed.custody?.proof ?? null };
    // A closed tab whose agent process lingers does not count (owner 2026-09-28): the lingering tree is killed and read back.
    try {
      const tree = reapOrphaned(agentsBefore);
      if (tree.checked) {
        terminalClosed.tree = tree;
        if (tree.remaining !== 0) { terminalClosed.ok = false; terminalClosed.verified = { ...terminalClosed.verified, ok: false, reason: 'process-tree-lingers' }; }
      }
    } catch { /* the terminal proof stands; the tick GC reaps a lingering tree */ }
  }

  // Managed settle â€” calls.yaml settle-dispatch: releaseManagedWorker below.
  const managedWorker = !managed?.dispatchId ? null
    : releasedEarlier ? { ...(settledPayload.managedWorker ?? { dispatchId: managed.dispatchId }), releasedWhileHeld: true,
      custody: { state: 'released', proof: 'released-while-held', at: releasedEarlier.at ?? null } }
    : releaseManagedWorker(db, job, settledPayload, repo);
  // The worker's terminal guard binding (runtime/guards/terminals/<handle>.json) dies with its
  // terminal: unbind it at settle too, not only inside the close, so a worker released while held,
  // a close that predated binding cleanup, or a failed close that still left the terminal gone never
  // leaves the binding to the seven-day prune. Removing a missing file is a no-op.
  const guardUnbound = [];
  for (const handle of [managed ? managed.agentTerminalHandle : job.worker_id].filter(Boolean)) {
    try { if (unbindGuardTerminal({ skillRoot, handle })) guardUnbound.push(handle); } catch { /* pruned by age later */ }
  }
  // The op's Orca Task is closed with its worker. Settling only the worker
  // left every finished operation as an open Task in the workflow Run, which
  // is what the owner saw as ticked [Op] rows sitting at the sidebar root
  // (fable.md orca-hierarchy, row 3). A close failure never un-settles the
  // job; the ledger row is already the record.
  const taskClosed = closeOperationTask(db, job, settledPayload);

  // The worker receipt is kept with the Task proof: settle's stdout is the
  // only other place it lived, and an orphaned op terminal left no trace.
  if (taskClosed || managedWorker || terminalClosed) {
    const stored = parseJson(db.prepare('SELECT payload_json FROM jobs WHERE job_id=?').get(jobId)?.payload_json) ?? {};
    db.prepare('UPDATE jobs SET payload_json=?, updated_at=? WHERE job_id=?')
      .run(JSON.stringify({ ...stored, ...(taskClosed ? { taskClosed } : {}), ...(managedWorker ? { managedWorker } : {}), ...(terminalClosed ? { terminalClosed } : {}) }), Date.now(), jobId);
  }

  // released -> worktree-removed (DESIGN Â§16.7): an isolated op's worktree is removed right after its worker is released,
  // off the settle's path (product-worktree.mjs reap: salvage + assert, junctions unlinked, verified removal); the
  // settler's productWorktreeDuty is the backstop, the leftover sweep logs whatever both missed as a bug.
  if (ownProductWorktreeOf(db.prepare('SELECT job_id, payload_json FROM jobs WHERE job_id=?').get(jobId) ?? job) && !process.env.NODE_TEST_CONTEXT) {
    try {
      spawn(process.execPath, [path.join(skillRoot, 'scripts', 'kernel', 'product-worktree.mjs'), 'reap', '--repo', repo, '--job', jobId, '--json'],
        { detached: true, stdio: 'ignore', windowsHide: true }).unref();
    } catch { /* the settler reaps it */ }
  }

  // LIGHT SETTLE, HEAVY WORK ASYNC (owner ruling settle-runtime-service): everything above is the settle's
  // synchronous core (verdict, leases, worker release, next-step enqueue, ledger events). The tail - session
  // retention, the Telegram media, the input re-baseline, artifact indexing with its evidence copy and typed logs -
  // runs in a detached `api settle-tail` (scripts/kernel/api-verbs/settle-tail.mjs) queued under the ledger's
  // settle-tail/ dir: it can neither block nor fail the settle, and a failed run is logged and retried by the
  // settler (scripts/reconcile/job-settle.mjs retryDueTails). Under the test runner, or with --sync-tail, it runs inline.
  let tail, sessionReleased = null, artifacts = null;
  if (process.env.NODE_TEST_CONTEXT || args['sync-tail']) {
    tail = await runSettleTail(ledger, db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId) ?? job, repo, { verdict });
    ({ sessionReleased, artifacts } = tail);
    tail = { mode: 'sync', ok: tail.ok };
  } else {
    let queued = null, pid = null;
    try { queued = queueSettleTail(repo, jobId); pid = startSettleTail(repo, jobId); } catch (error) { queued = { error: String(error?.message ?? error) }; }
    tail = { mode: 'async', queued: typeof queued === 'string' ? queued : null, pid, ...(queued?.error ? { error: queued.error } : {}) };
  }

  const grammarProposals = recordSettledGrammarProposals(ledger, job, repo);
  const assetSlots = recordSettledAssetSlots(ledger, job, repo);
  const revDrift = recordOpRevDrift(ledger, job);
  const status = verdict === 'pass' ? 'succeeded' : 'failed';
  const out = { ok: true, jobId, verdict, status, awaitingOwner, artifacts, ...(grammarProposals.length ? { grammarProposals: grammarProposals.map(({ name, file, complete }) => ({ name, file, complete })) } : {}), ...(assetSlots.owed.length ? { assetSlotsOwed: assetSlots.owed.map(({ key, html, requested }) => ({ key, html, requested })) } : {}), ...(assetSlots.filled.length ? { assetSlotsFilled: assetSlots.filled.map(({ key, sha256 }) => ({ key, sha256 })) } : {}), report: reportAbs, reportFiled, reportOutcome, checkEvidence, claimOverruled, ...(peerBlocked ? { peerBlocked } : {}), ...(nextStep ? { nextStep } : {}), ...(handoverApproval ? { handoverApproved: { dispatchId: handoverApproval.ask.dispatchId, answeredBy: handoverApproval.ask.answeredBy } } : {}), ...(cutSet ? { cutSet: { id: cutSet.id, total: cutSet.total, closesSet: cutSet.open.length === 0, open: cutSet.open } } : {}), leasesReleased: released, machineRefsReleased: machineReleased, reportsConsumed, terminalClosed, taskClosed, ...(guardUnbound.length ? { guardUnbound } : {}), ...(managedWorker ? { managedWorker } : {}), ...(sessionReleased ? { sessionReleased } : {}), ...(landed?.checked ? { landed: landed.detail } : {}), ...(revDrift ? { opRevDrift: revDrift } : {}), tail };
  if (revDrift) console.error(`api settle WARN ${OP_REV_DRIFT}: ${jobId} (${revDrift.op}) was dispatched under runtime rev ${shortRev(revDrift.from)}; its op contract changed on main by ${shortRev(revDrift.to)}: ${revDrift.files.join(', ')} - judged as admitted, never refused`);
  // A typed --until-job wait on this job, in any workflow of the ledger, may hold now: release it and
  // wake that Kernel instead of leaving it to the next watchdog tick (gate-conditions.mjs).
  const typedReleased = releaseTypedWaits(ledger, { repo, wake: true, self: job.workflow_id }).resolved;
  if (typedReleased.length) out.autoResolved = typedReleased.map(({ incidentId, workflowId: waiter, evidence, wake }) => ({ incidentId, workflowId: waiter, evidence, ...(wake ? { wake } : {}) }));
  emit(out, `settled ${jobId} verdict=${verdict}${awaitingOwner ? ` (${AWAITING_OWNER}: no business attempt spent)` : ''}${peerBlocked ? ` (peer-blocked ${peerBlocked.checks.join(', ')}${verdict === 'pass' ? '' : ': no business attempt spent'}; hand it to the peer: ${peerBlocked.routes.join(' ; ')})` : ''} status=${status}${nextStep ? ` next=${nextStep.kind}${nextStep.jobs?.length ? ` ${nextStep.jobs.join(',')}` : ''}${nextStep.incidentId ? ` ${nextStep.incidentId}` : ''} (${nextStep.reason})` : ''} (leases released: ${released}${reportsConsumed ? ', report consumed' : ''}${terminalClosed ? `, terminal ${terminalClosed.handle} closed=${terminalClosed.ok}` : ''}${taskClosed ? `, task ${taskClosed.taskId} ${taskClosed.status} ok=${taskClosed.ok}` : ''}${managedWorker ? `, worker ${managedWorker.dispatchId} stop=${managedWorker.stop?.ok ?? '-'} release=${managedWorker.release?.ok ?? '-'} custody=${managedWorker.custody?.state ?? 'unknown'}${managedWorker.custody?.proof ? ` (${managedWorker.custody.proof})` : ''}` : ''}${sessionReleased ? `, session ${sessionReleased.released ? `archived ${sessionReleased.files?.length ?? 0} file(s)` : `release skipped (${sessionReleased.reason})`}` : ''}${out.cutSet ? `, cut ${out.cutSet.id} ${out.cutSet.closesSet ? 'CLOSED' : `open ${out.cutSet.open.join(',')}`}` : ''})`, args.json);

  },
};
