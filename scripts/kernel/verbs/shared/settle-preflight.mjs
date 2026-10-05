// The native settle refusal preflight, before any workflow checkpoint effect.
import { EVIDENCE_HOST_PATH } from '../../job-artifacts.mjs';
import { recordSonarJudgment, refusalText } from '../../sonar-settle.mjs';
import { loopRefusalText, proofRefusalText, recordLoopJudgment, recordProofJudgment } from '../../gate-settle.mjs';

/** Run the existing read-only refusal preflight. A prepared settlement retains
 * its frozen decision; a fresh pass returns the exact native proof identity. */
export async function settlePreflight({ ledger, args, repo, emit, internals, replay, verdict, jobId }) {
  const db = ledger.db;
  const { settleProofMedia, settleSonarGate, settleOpGate, settleOpProofs, settleDrawAcceptance, settleDrawMetrics, settleWorkHygiene } = internals;
  const media = !replay && verdict === 'pass' ? settleProofMedia(db, jobId, repo, null, null) : null;
  if (media) {
    emit({ ok: false, jobId, op: media.op, reason: media.code, code: media.code, missing: media.missing, detail: media.detail },
      `settle REFUSED for ${jobId} (${media.op}): ${media.code} — missing ${media.missing.join(', ')} (${JSON.stringify(media.detail)}); the job stays ${media.status}. ${media.code === EVIDENCE_HOST_PATH ? 'Rewrite the named evidence with repo-relative paths or <worktree>, <runtime>, <tmp>, <home>, then settle again' : `Re-dispatch the op to capture its screenshots${media.detail.browserRan ? ' and its browser video' : ''} into its evidence and name them in report.files, then settle again`}`, args.json);
    process.exit(1);
  }

  // The Sonar gate of the code-writing ops: judged from the op's own sonar.json, recorded as the runtime check sonar-gate on
  // the attempt (its why carries the code), and a pass that is not green is refused - an unavailable Sonar never passes.
  const sonar = replay ? null : settleSonarGate(db, jobId, repo);
  if (sonar) {
    // A fail or blocked verdict that never reached Sonar (no scan, refused scan) is its own failure: no sonar row muddies its why.
    if (verdict !== 'pass' && !['red', 'unavailable'].includes(sonar.judged.status)) sonar.judged.record = false;
    const recorded = sonar.judged.record === false ? { green: sonar.judged.status === 'pass', status: sonar.judged.status, code: sonar.judged.code } : recordSonarJudgment(ledger, { workflowId: sonar.workflowId, jobId, opId: sonar.op, attemptId: sonar.attemptId, judgment: sonar });
    if (verdict === 'pass' && !recorded.green) {
      emit({ ok: false, jobId, op: sonar.op, reason: recorded.code, code: recorded.code, detail: sonar.judged.detail, findings: sonar.judged.findings, sonarStatus: recorded.status, ...(recorded.incidentId ? { incidentId: recorded.incidentId } : {}) },
        refusalText(sonar.op, sonar.judged, jobId), args.json);
      process.exit(1);
    }
  }

  // The op loop (READ-CODE-CHECK-FIX-REPORT): judged from the op's own gate JSON and READ digest, recorded as the runtime check
  // op-gate on the attempt, and a pass that is red, could not run its tools, or skipped READ is refused.
  const loop = !replay && verdict === 'pass' ? await settleOpGate(db, jobId, repo) : null;
  if (loop) {
    const recorded = recordLoopJudgment(ledger, { attemptId: loop.attemptId, judgment: loop });
    if (!recorded.green) {
      emit({ ok: false, jobId, op: loop.op, reason: recorded.code, code: recorded.code, detail: loop.judged.detail, findings: loop.judged.findings, gateStatus: recorded.status },
        loopRefusalText(loop.op, loop.judged, jobId), args.json);
      process.exit(1);
    }
  }

  // The mechanism proofs (knowledge/op-gate.yaml opProofs): current legs use native output and their READ/manual attachments, recorded as the runtime
  // check op-proof on the attempt, and a pass whose mandatory mechanism is missing, red or could not run is refused.
  const proofs = !replay && verdict === 'pass' ? await settleOpProofs(db, jobId, repo) : null;
  if (proofs) {
    const recorded = recordProofJudgment(ledger, { attemptId: proofs.attemptId, judgment: proofs });
    if (!recorded.green) {
      emit({ ok: false, jobId, op: proofs.op, reason: recorded.code, code: recorded.code, proof: proofs.proof, detail: proofs.judged.detail, findings: proofs.judged.findings, proofStatus: recorded.status },
        proofRefusalText(proofs.op, proofs, jobId), args.json);
      process.exit(1);
    }
  }

  const drawn = !replay && verdict === 'pass' ? settleDrawAcceptance(db, jobId, repo, null, null) : null;
  if (drawn) {
    const codes = [...new Set(drawn.findings.map((f) => f.code))];
    emit({ ok: false, jobId, op: drawn.op, reason: 'draw-not-accepted', codes, findings: drawn.findings.slice(0, 50), findingCount: drawn.findings.length, records: drawn.records },
      `settle REFUSED for ${jobId} (${drawn.op}): draw-not-accepted — ${codes.join(', ')} (${drawn.findings.length} finding(s); first: ${drawn.findings[0].detail}); the job stays ${drawn.status}. Every asset the draw binds, adopted ones included, must be a draw-render shape of ui.shapes and never a data status (starci work draw-acceptance --repo <repo> --job ${jobId}); redraw, or settle fail`, args.json);
    process.exit(1);
  }

  const measured = !replay && verdict === 'pass' ? await settleDrawMetrics(db, jobId, repo, null, null) : null;
  if (measured) {
    const codes = [...new Set(measured.findings.flatMap((f) => [f.code, ...(f.codes ?? [])]))];
    emit({ ok: false, jobId, op: measured.op, reason: 'draw-metrics-failed', codes, findings: measured.findings.slice(0, 50), findingCount: measured.findings.length, records: measured.records, loops: measured.loops },
      `settle REFUSED for ${jobId} (${measured.op}): draw-metrics-failed — ${codes.join(', ')} (${measured.findings.length} finding(s); first: ${measured.findings[0].detail}); the job stays ${measured.status}. The runtime re-rendered every drawn part and re-ran every machine metric itself (starci work draw-loop verify --ui <record> --repo <repo>): the draw is blocked with these remaining failures and its best round${measured.loops?.length ? ` (${measured.loops.map((l) => `${l.loop} best round ${l.best}`).join(', ')})` : ''} - redraw through the loop, or settle blocked, never pass`, args.json);
    process.exit(1);
  }

  const hygiene = !replay && verdict === 'pass' ? settleWorkHygiene(db, jobId, repo, null, null) : null;
  if (hygiene) {
    const codes = [...new Set(hygiene.findings.map((f) => f.code))];
    emit({ ok: false, jobId, op: hygiene.op, reason: 'work-hygiene-red', codes, findings: hygiene.findings.slice(0, 50), findingCount: hygiene.findings.length, files: hygiene.files },
      `settle REFUSED for ${jobId} (${hygiene.op}): work-hygiene-red - ${codes.join(', ')} (${hygiene.findings.length} finding(s); first: ${hygiene.findings[0].file} - ${hygiene.findings[0].detail}); the job stays ${hygiene.status}. Fix the named Work files (a YAML that parses, records that pass starci runtime validate --strict, no literal password or token outside an .enc file; starci work hygiene files --repo <repo> <file>...), rerun the applicable checks and settle again; the runtime checkpoints owned changes after green settle`, args.json);
    process.exit(1);
  }

  return { proofs };
}
