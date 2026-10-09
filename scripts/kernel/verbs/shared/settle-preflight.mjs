// The native settle refusal preflight, before any workflow checkpoint effect.
import { EVIDENCE_HOST_PATH } from '../../job-artifacts.mjs';
import { recordSonarJudgment, refusalText } from '../../sonar-settle.mjs';
import { loopRefusalText, proofRefusalText, recordLoopJudgment, recordProofJudgment } from '../../gate-settle.mjs';
import { criticRefusalText, recordCriticJudgment } from '../../critic-settle.mjs';
import { ownedByRuntime } from '../../gate-admission.mjs';
import { refuseVerb } from './verb-exit.mjs';
import { brandProductCheck, recordBrandProduct, requireBrandProduct } from '../../brand-product.mjs';

function mediaPhase(s, settleProofMedia) {
  const media = !s.replay && s.verdict === 'pass' ? settleProofMedia(s.db, s.jobId, s.repo, null, null) : null;
  if (!media) return;
  let advice = 'Rewrite the named evidence with repo-relative paths or <worktree>, <runtime>, <tmp>, <home>, then settle again';
  if (media.code !== EVIDENCE_HOST_PATH) {
    const browser = media.detail.browserRan ? ' and its browser video' : '';
    advice = `Re-dispatch the op to capture its screenshots${browser} into its evidence and name them in report.files, then settle again`;
  }
  refuseVerb(s, { ok: false, jobId: s.jobId, op: media.op, reason: media.code, code: media.code, missing: media.missing, detail: media.detail },
    `settle REFUSED for ${s.jobId} (${media.op}): ${media.code} — missing ${media.missing.join(', ')} (${JSON.stringify(media.detail)}); the job stays ${media.status}. ${advice}`);
}

// The Sonar gate of the code-writing ops: judged from the op's own sonar.json, recorded as the runtime check sonar-gate on
// the attempt (its why carries the code), and a pass that is not green is refused - an unavailable Sonar never passes.
function sonarPhase(s, settleSonarGate) {
  const sonar = s.replay ? null : settleSonarGate(s.db, s.jobId, s.repo);
  if (!sonar) return;
  // A fail or blocked verdict that never reached Sonar (no scan, refused scan) is its own failure: no sonar row muddies its why.
  if (s.verdict !== 'pass' && !['red', 'unavailable'].includes(sonar.judged.status)) sonar.judged.record = false;
  const recorded = sonar.judged.record === false ? { green: sonar.judged.status === 'pass', status: sonar.judged.status, code: sonar.judged.code }
    : recordSonarJudgment(s.ledger, { workflowId: sonar.workflowId, jobId: s.jobId, opId: sonar.op, attemptId: sonar.attemptId, judgment: sonar });
  if (s.verdict === 'pass' && !recorded.green) {
    refuseVerb(s, { ok: false, jobId: s.jobId, op: sonar.op, reason: recorded.code, code: recorded.code, detail: sonar.judged.detail, findings: sonar.judged.findings, sonarStatus: recorded.status, ...(recorded.incidentId ? { incidentId: recorded.incidentId } : {}) },
      refusalText(sonar.op, sonar.judged, s.jobId));
  }
}

// The op loop (READ-CODE-CHECK-FIX-REPORT): judged from the op's own gate JSON and READ digest, recorded as the runtime check
// op-gate on the attempt, and a pass that is red, could not run its tools, or skipped READ is refused.
async function loopPhase(s, settleOpGate) {
  const loop = !s.replay && s.verdict === 'pass' ? await settleOpGate(s.db, s.jobId, s.repo) : null;
  if (!loop) return;
  loop.judged = ownedByRuntime(s.db, s.jobId, loop.judged, { op: loop.op, proof: 'op-gate' });
  const recorded = recordLoopJudgment(s.ledger, { attemptId: loop.attemptId, judgment: loop });
  if (!recorded.green) {
    refuseVerb(s, { ok: false, jobId: s.jobId, op: loop.op, reason: recorded.code, code: recorded.code, detail: loop.judged.detail, findings: loop.judged.findings, gateStatus: recorded.status },
      loopRefusalText(loop.op, loop.judged, s.jobId));
  }
}

// The mechanism proofs (knowledge/op-gate.yaml opProofs): current legs use native output and their READ/manual attachments, recorded as the runtime
// check op-proof on the attempt, and a pass whose mandatory mechanism is missing, red or could not run is refused.
async function proofPhase(s, settleOpProofs) {
  const proofs = !s.replay && s.verdict === 'pass' ? await settleOpProofs(s.db, s.jobId, s.repo) : null;
  if (!proofs) return null;
  proofs.judged = ownedByRuntime(s.db, s.jobId, proofs.judged, { op: proofs.op, proof: 'op-proof' });
  const recorded = recordProofJudgment(s.ledger, { attemptId: proofs.attemptId, judgment: proofs });
  if (!recorded.green) {
    refuseVerb(s, { ok: false, jobId: s.jobId, op: proofs.op, reason: recorded.code, code: recorded.code, proof: proofs.proof, detail: proofs.judged.detail, findings: proofs.judged.findings, proofStatus: recorded.status },
      proofRefusalText(proofs.op, proofs, s.jobId));
  }
  return proofs;
}

// The independent Critic's verdict of a decision leg (scripts/kernel/critic-settle.mjs): a pass without a fresh passing verdict for exactly
// the op's records now is refused, recorded as the runtime check op-proof (independent-critic) on the attempt; a failing verdict is the op's error-work.
function criticPhase(s, settleCriticVerdict) {
  const critic = !s.replay && s.verdict === 'pass' ? settleCriticVerdict(s.db, s.jobId, s.repo) : null;
  if (!critic) return;
  const recorded = recordCriticJudgment(s.ledger, { attemptId: critic.attemptId, judgment: critic });
  if (!recorded.green) {
    refuseVerb(s, { ok: false, jobId: s.jobId, op: critic.op, reason: recorded.code, code: recorded.code, detail: critic.judged.detail, findings: critic.judged.findings, criticStatus: recorded.status },
      criticRefusalText(critic.op, critic.judged, s.jobId));
  }
}

function drawnPhase(s, settleDrawAcceptance) {
  const drawn = !s.replay && s.verdict === 'pass' ? settleDrawAcceptance(s.db, s.jobId, s.repo, null, null) : null;
  if (!drawn) return;
  const codes = [...new Set(drawn.findings.map((f) => f.code))];
  refuseVerb(s, { ok: false, jobId: s.jobId, op: drawn.op, reason: 'draw-not-accepted', codes, findings: drawn.findings.slice(0, 50), findingCount: drawn.findings.length, records: drawn.records },
    `settle REFUSED for ${s.jobId} (${drawn.op}): draw-not-accepted — ${codes.join(', ')} (${drawn.findings.length} finding(s); first: ${drawn.findings[0].detail}); the job stays ${drawn.status}. Every asset the draw binds, adopted ones included, must be a draw-render shape of ui.shapes and never a data status (starci work draw-acceptance --repo <repo> --job ${s.jobId}); redraw, or settle fail`);
}

async function metricsPhase(s, settleDrawMetrics) {
  const measured = !s.replay && s.verdict === 'pass' ? await settleDrawMetrics(s.db, s.jobId, s.repo, null, null) : null;
  if (!measured) return;
  const codes = [...new Set(measured.findings.flatMap((f) => [f.code, ...(f.codes ?? [])]))];
  let loops = '';
  if (measured.loops?.length) {
    const loopNames = measured.loops.map((l) => `${l.loop} best round ${l.best}`).join(', ');
    loops = ` (${loopNames})`;
  }
  refuseVerb(s, { ok: false, jobId: s.jobId, op: measured.op, reason: 'draw-metrics-failed', codes, findings: measured.findings.slice(0, 50), findingCount: measured.findings.length, records: measured.records, loops: measured.loops },
    `settle REFUSED for ${s.jobId} (${measured.op}): draw-metrics-failed — ${codes.join(', ')} (${measured.findings.length} finding(s); first: ${measured.findings[0].detail}); the job stays ${measured.status}. The runtime re-rendered every drawn part and re-ran every machine metric itself (starci work draw-loop verify --ui <record> --repo <repo>): the draw is blocked with these remaining failures and its best round${loops} - redraw through the loop, or settle blocked, never pass`);
}

function hygienePhase(s, settleWorkHygiene) {
  const hygiene = !s.replay && s.verdict === 'pass' ? settleWorkHygiene(s.db, s.jobId, s.repo, null, null) : null;
  if (!hygiene) return;
  const codes = [...new Set(hygiene.findings.map((f) => f.code))];
  refuseVerb(s, { ok: false, jobId: s.jobId, op: hygiene.op, reason: 'work-hygiene-red', codes, findings: hygiene.findings.slice(0, 50), findingCount: hygiene.findings.length, files: hygiene.files },
    `settle REFUSED for ${s.jobId} (${hygiene.op}): work-hygiene-red - ${codes.join(', ')} (${hygiene.findings.length} finding(s); first: ${hygiene.findings[0].file} - ${hygiene.findings[0].detail}); the job stays ${hygiene.status}. Fix the named Work files (a YAML that parses, records that pass starci runtime validate --strict, no literal password or token outside an .enc file; starci work hygiene files --repo <repo> <file>...), rerun the applicable checks and settle again; the runtime checkpoints owned changes after green settle`);
}

/** Run the existing read-only refusal preflight. A prepared settlement retains
 * its frozen decision; a fresh pass returns the exact native proof identity. */
export async function settlePreflight({ ledger, args, repo, emit, internals, replay, verdict, jobId }) {
  const s = { db: ledger.db, ledger, args, repo, emit, replay, verdict, jobId };
  if (!replay && verdict === 'pass') {
    const check = brandProductCheck(s.db, jobId, { repo });
    if (check) recordBrandProduct(ledger, jobId, check);
    requireBrandProduct(s.db, jobId, { repo });
  }
  const { settleProofMedia, settleSonarGate, settleOpGate, settleOpProofs, settleCriticVerdict, settleDrawAcceptance, settleDrawMetrics, settleWorkHygiene } = internals;
  mediaPhase(s, settleProofMedia);
  sonarPhase(s, settleSonarGate);
  await loopPhase(s, settleOpGate);
  const proofs = await proofPhase(s, settleOpProofs);
  criticPhase(s, settleCriticVerdict);
  drawnPhase(s, settleDrawAcceptance);
  await metricsPhase(s, settleDrawMetrics);
  hygienePhase(s, settleWorkHygiene);
  return { proofs };
}
