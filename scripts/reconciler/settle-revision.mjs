// settle-revision.mjs — which revision each proof a settle owes was admitted under, and whether the rules that judge it moved since.
//
// An attempt keeps the rules of its admission for its work (modules/kernel/revision-scope.yaml, action `admission`), but `starci kernel settle`
// judges against the LIVE tree (settleJudges in that table lists what each judge reads). This module gives the settle the data to say so: for
// every proof the op owes, the revision it was admitted under, the revision it is judged under, and the files of its judge that changed in
// between. It judges nothing and refuses nothing: the seam that decides what a moved rule means for the attempt (gate-newer-than-admission) reads
// `proofsOwedUnder`.
import { loopOps, loadOpGate } from '../gates/read-digest.mjs';
import { enforcesOp } from '../kernel/sonar-settle.mjs';
import { criticOwedBy } from '../kernel/critic-settle.mjs';
import { proofsOf } from '../kernel/mechanism-proofs.mjs';
import { globExpression, braceVariants } from '../lib/glob.mjs';
import { latestContractOf } from '../machine/contract-version.mjs';
import { parseJson } from '../lib/json.mjs';
import { currentRuntimeRev, revRootOf } from '../kernel/runtime-rev.mjs';
import { changedFiles } from './revision-change.mjs';
import { loadScope } from './revision-scope.mjs';

export const SETTLE_REVISION_EVENT = 'settle-revision-recorded';
const DRAW = 'interface.draw';
const LISTED = 12;

/** Whether the op owes the proof of a judge; the rule of each judge as the settle applies it (scripts/kernel/verbs/shared/settle-preflight.mjs). */
export const OWES = Object.freeze({
  'proof-media': () => true,
  'sonar-gate': (op) => enforcesOp(op),
  'op-gate': (op) => loopOps(loadOpGate()).has(op),
  'op-proof': (op) => proofsOf(op).length > 0,
  'independent-critic': (op) => criticOwedBy(op) !== null,
  'draw-acceptance': (op) => op === DRAW,
  'draw-metrics': (op) => op === DRAW,
  'work-hygiene': () => true,
});

const matcherOf = (patterns) => patterns.flatMap(braceVariants).map(globExpression);

/**
 * The proofs `op` owes at a settle and, per proof, whether its judge's rules moved since the revision the attempt was admitted under:
 * {admitted, judged, known, proofs: [{proof, moved, files, admissionAware}]}. `known` is false when git cannot compare the two revisions (nothing is
 * claimed moved then). `owes` replaces the per-judge ownership rules (specs).
 */
export function proofsOwedUnder(root, op, admitted, judged, { doc = loadScope(root), owes = OWES } = {}) {
  const owed = doc.settleJudges.filter((judge) => owes[judge.proof]?.(op));
  const changed = admitted && judged && admitted !== judged ? changedFiles(root, admitted, judged) : [];
  const known = changed !== null;
  const paths = (changed ?? []).map((entry) => entry.path);
  const proofs = owed.map((judge) => {
    const rules = matcherOf(judge.files);
    const files = paths.filter((file) => rules.some((rx) => rx.test(file)));
    return { proof: judge.proof, moved: files.length > 0, files, admissionAware: judge.admissionAware };
  });
  return { admitted: admitted ?? null, judged: judged ?? null, known, proofs };
}

/** The small payload of the settle record: both revisions, the proofs owed, and only the files of the judges that moved (at most LISTED each). */
export function settleRevisionPayload({ op, attempt, owed }) {
  return { op, attempt, admitted: owed.admitted, judged: owed.judged, known: owed.known, owed: owed.proofs.map((p) => p.proof),
    moved: owed.proofs.filter((p) => p.moved).map((p) => ({ proof: p.proof, count: p.files.length, files: p.files.slice(0, LISTED), admissionAware: p.admissionAware })) };
}

/**
 * Record at settle which revision each proof the job's op owes was admitted under (event settle-revision-recorded on the job). Never throws and
 * never changes the verdict: it is evidence for the seam that decides what a moved rule means. Returns the payload, or null.
 */
export function recordSettleRevision(ledger, job, { op, root = revRootOf() }) {
  try {
    const row = latestContractOf(ledger.db, job.job_id);
    const admitted = parseJson(row?.context_json)?.contract?.runtimeSha ?? null;
    const payload = settleRevisionPayload({ op, attempt: row?.attempt_id ?? null, owed: proofsOwedUnder(root, op, admitted, currentRuntimeRev(root)) });
    ledger.transaction(() => ledger.appendEvent({ workflowId: job.workflow_id, entityType: 'job', entityId: job.job_id, generation: job.generation ?? 0,
      kind: SETTLE_REVISION_EVENT, payload, createdAt: Date.now() }));
    return payload;
  } catch { return null; }
}
