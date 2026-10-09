// critic-settle.mjs - the settle-time half of the Critic for the decision legs (modules/kernel/critic.yaml coverage rows of status covered
// whose kind has a rubric in modules/kernel/critic-rubrics.yaml: scope.define, architecture.decide). `starci kernel settle` refuses a done
// unless the op attached a fresh passing typed verdict (starci/critic-verdict@1, written by `starci work decision-critic`) for exactly the
// decision records it wrote now:
//   op-critic-verdict-missing  no verdict of the op's kind is attached and the runtime has none: the op did not run the Critic
//   gate-newer-than-admission  the same, for a job whose admitted contract never taught the Critic step: the gate is newer than the job, so the op owes nothing
//                              (the settler runs the Critic itself first: scripts/kernel/settle/critic-run.mjs, whose verdict is `runtime` below)
//   CRITIC_VERDICT_STALE       the verdict's digests do not hold every record the op owns now, or every record they cite, or it was
//                              made against another rubric than the declared one (the stale check of critic-verdict.mjs staleRefusal)
//   CRITIC_NO_INDEPENDENT_MEMBER  the verdict names the maker's own provider as its Critic
//   CRITIC_AUTHOR_UNKNOWN      the verdict names no maker, so its independence is not provable
//   op-critic-verdict-failed   the verdict is below the declared minimum: the work is not good yet (policy row error-work); the refusal
//                              text carries every failed check with its evidence and fix, and the next attempt gets it as its failure
// The judgment re-derives pass or fail from the verdict's score against the rubric's declared minimum; the verdict's own pass flag is not read.
// It is recorded as the runtime check `op-proof` (proof independent-critic; runner settler, authority runtime) on the attempt.
import path from 'node:path';
import { pass, recordProofJudgment, refused } from './mechanism-proofs.mjs';
import { oneLine } from '../lib/clip.mjs';
import { readAttached } from './attached-proof.mjs';
import { criticContract, coverageOf } from '../work/critic-contract.mjs';
import { failedCheckLines, staleRefusal } from '../work/critic-verdict.mjs';
import { criticRubrics, kindEntryOf, ownedRelOf, productDigests, productFiles } from '../work/decision-critic-product.mjs';

const CRITIC_VERDICT_SCHEMA = 'starci/critic-verdict@1';
const CRITIC_PROOF = 'independent-critic';
const WORK_ROOT_NAME = '.starciwork';

/** The rubric entry of `op` when its Critic is built (coverage covered) and its rubric is declared, else null: the op owes no decision verdict. */
export function criticOwedBy(op, { contract = criticContract(), rubrics = criticRubrics() } = {}) {
  return coverageOf(op, contract)?.status === 'covered' ? kindEntryOf(op, rubrics) : null;
}

/** The work root, among the job's placement roots, that holds decision records of the entry within `owned`: {workRoot, within} or null. */
function workRootOf({ roots, owned, entry }) {
  const within = owned.map(ownedRelOf).filter((rel) => rel !== null);
  for (const root of roots) {
    const workRoot = path.basename(root) === WORK_ROOT_NAME ? root : path.join(root, WORK_ROOT_NAME);
    if (productFiles({ workRoot, entry, within: within.length ? within : null }).length) return { workRoot, within: within.length ? within : null };
  }
  return null;
}


/** The independence and rubric problems of a verdict, or null. */
function trustProblem(verdict, entry, codes) {
  if (!verdict.maker) return refused({ status: 'red', code: codes.authorUnknown }, 'the verdict names no maker provider, so the independence of its Critic is not provable');
  if (verdict.critic?.provider === verdict.maker) return refused({ status: 'red', code: codes.noIndependentMember }, `the verdict was given by ${verdict.maker}, the provider that made the records; the maker's provider never judges its own product`);
  if (verdict.rubric?.checks !== entry.checks.length || !String(verdict.rubric?.source ?? '').includes(`id=${entry.id}`))
    return refused({ status: 'red', code: codes.verdictStale }, `the verdict was made against another rubric (${verdict.rubric?.source ?? 'none'}, ${verdict.rubric?.checks ?? 0} checks) than the declared one for ${entry.id} (${entry.checks.length} checks)`);
  return null;
}

/**
 * The judgment of a decision leg's verdict: {status, code, detail, findings} - null when the op owes none. `files` are the job's attached
 * files, `roots` its placement roots, `owned` its owned paths. `runtime` is the verdict the runtime's own Critic run recorded (used when the op attached
 * none), `teaches` whether the job's admitted contract told the op to run the Critic. `contract` and `rubrics` default to the tree's.
 */
export function judgeCriticVerdict({ op, files, roots, owned = [], runtime = null, teaches = true, contract = criticContract(), rubrics = criticRubrics() }) {
  const entry = criticOwedBy(op, { contract, rubrics });
  if (!entry) return null;
  const attached = readAttached(files, CRITIC_VERDICT_SCHEMA, (doc) => doc.op === op && doc.kind === op) ?? (runtime ? { doc: runtime, file: 'runtime-critic-run' } : null);
  if (!attached && !teaches) return refused({ status: 'missing', code: 'gate-newer-than-admission' }, `the Critic gate of ${op} is newer than this job: its admitted contract never told the op to run the Critic, so the runtime owes the verdict (the settler runs the Critic over the reported records; nothing is asked of the op)`);
  if (!attached) return refused({ status: 'missing', code: 'op-critic-verdict-missing' }, `no Critic verdict (schema ${CRITIC_VERDICT_SCHEMA}, kind ${op}) is attached: run starci work decision-critic --kind ${op} --root <app> --out <STARCI_JOB_SCRATCH>/critic-verdict.json after the records are written, and attach it`);
  const verdict = attached.doc;
  const trust = trustProblem(verdict, entry, contract.codes);
  if (trust) return trust;
  const found = workRootOf({ roots, owned, entry });
  if (!found) return refused({ status: 'red', code: contract.codes.verdictStale }, `no decision record of ${op} was found under the job's placement to compare the verdict with`);
  const now = productDigests({ workRoot: found.workRoot, entry, inputs: rubrics.inputs, within: found.within });
  const stale = staleRefusal((verdict.product ?? []).map((p) => p.sha256), now.product.map((p) => p.sha256))
    ?? (now.inputs.length ? staleRefusal((verdict.inputs ?? []).map((p) => p.sha256), now.inputs.map((p) => p.sha256)) : null);
  if (stale) return refused({ status: 'red', code: stale.code }, `${stale.detail}: the records changed after the Critic judged them (or it judged fewer than the op owns); run starci work decision-critic again over the current records`);
  const score = Number(verdict.beauty);
  if (!Number.isFinite(score) || score < entry.minimum) {
    const lines = failedCheckLines(verdict.checks);
    return refused({ status: 'red', code: 'op-critic-verdict-failed' }, `the Critic scored ${Number.isFinite(score) ? score : 'nothing'}, the minimum for ${op} is ${entry.minimum}; failed checks: ${lines.map((l) => l.split(':')[0]).join(', ') || 'none named'}. ${oneLine(verdict.summary ?? '', 300)}`, lines);
  }
  return pass();
}

/** Record the judgment on the attempt as the runtime check op-proof (proof independent-critic). Each call adds one check run; the latest decides. */
export const recordCriticJudgment = (ledger, { attemptId, judgment, now = Date.now() }) =>
  recordProofJudgment(ledger, { attemptId, judgment: { proofs: [CRITIC_PROOF], proof: CRITIC_PROOF, judged: judgment.judged }, now });

// What the refusal ends with, by code.
const nextOf = (code, op) => {
  if (code === 'op-critic-verdict-failed') return `This is error-work: the work is not good yet. Fix every failed check named above in the records (each carries its fix), then run starci work decision-critic --kind ${op} again and attach the new verdict; the same critique is the failure the next attempt is fed.`;
  if (code === 'gate-newer-than-admission') return 'Nothing is asked of the op or the Kernel: the settler runs the Critic over the reported records itself and judges the settle with its verdict.';
  if (code === 'op-critic-verdict-missing') return `Run starci work decision-critic --kind ${op} over the records you wrote and attach critic-verdict.json; if it reports a hold (CRITIC_NO_INDEPENDENT_MEMBER, CRITIC_UNAVAILABLE, CRITIC_QUOTA_OUT), settle blocked with that code - never done.`;
  return `Run starci work decision-critic --kind ${op} again over the current records and attach the new verdict.`;
};

/** What `starci kernel settle` prints when it refuses a done the Critic's verdict does not allow. */
export function criticRefusalText(op, judged, jobId) {
  const lines = judged.findings.length ? ` Failed checks: ${judged.findings.join(' | ')}.` : '';
  return `settle REFUSED for ${jobId} (${op}): ${judged.code} - ${judged.detail}.${lines} The job stays reported. ${nextOf(judged.code, op)}`;
}
