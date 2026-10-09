// The brand product's runtime measure shares the draw dispatch resolver and its tree precedence.
import { skillRoot } from '../../engine/runtime-root.mjs';
import { refuse } from '../../engine/refuse.mjs';
import { recordCheck, stageBlob } from '../machine/evidence-store.mjs';
import { resolveGrammarContext, grammarMissingDetail } from './grammar-context.mjs';
import { judgeOf } from './op-judge.mjs';
import { checkRerunRootOf, latestAttemptIdOf } from './verbs/shared/check-evidence.mjs';

const MEASURE = 'brand-consumable';

/** A missing family source belongs to the brand record; runtime knowledge and tools keep their own owner. */
export const grammarGapCause = (missing) => missing.some((entry) => entry.role === 'family-css')
  ? { kind: 'brand-gap', cause: 'record-gap', op: 'brand.decide', field: 'brand.sources' } : null;

/** The same family CSS check dispatch makes, measured over the attempt's actual tree. */
export function brandProductCheck(db, jobId, { repo, env = process.env } = {}) {
  const job = db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId);
  if (!job || !judgeOf(job.op_id).some((judge) => judge.by === 'machine' && judge.measures?.includes(MEASURE))) return null;
  const tree = checkRerunRootOf(db, job, { repo, env });
  const context = resolveGrammarContext({ skillRoot, repo, tree, inputs: 'component-source' });
  const missing = context.missing.filter((entry) => entry.role === 'family-css');
  const detail = missing.length ? `${grammarMissingDetail(missing)}; repair brand.sources before interface.draw`
    : `family CSS resolves for ${context.family ?? 'the brand'}`;
  return { name: MEASURE, exitCode: missing.length ? 1 : 0, command: 'runtime brand product measure', evidence: detail,
    missing, cause: grammarGapCause(missing), cwd: tree };
}

/** Persist the runtime's own measurement, independent of the checks the maker chose to report. */
export function recordBrandProduct(ledger, jobId, check) {
  const output = stageBlob(Buffer.from(JSON.stringify(check)), { mediaType: 'application/json', repoRoots: [check.cwd] });
  ledger.transaction((db) => recordCheck(db, { attemptId: latestAttemptIdOf(db, jobId), name: check.name,
    phase: 'verify', runner: 'settler', command: check.command, cwd: check.cwd, exitCode: check.exitCode,
    status: check.exitCode ? 'fail' : 'pass', output, summary: { entry: check } }));
}

/** A fresh pass measures the product even when a filed check or an earlier measurement claimed green. */
export function requireBrandProduct(db, jobId, options) {
  const check = brandProductCheck(db, jobId, options);
  if (check?.exitCode) throw refuse(`${jobId} brand product cannot feed interface.draw: ${check.evidence}`,
    'grammar-context-missing', { missing: check.missing, cause: check.cause });
  return check;
}

/** The automatic settler observes the mandatory measure before considering the maker's selected checks. */
export async function verifyBrandProduct(db, item, { repo, env, record }) {
  if (item.outcome !== 'done') return null;
  let check;
  try { check = brandProductCheck(db, item.jobId, { repo, env }); }
  catch (error) { return { green: false, unavailable: true, reason: 'checker-unavailable', code: error.code, detail: [error.message] }; }
  if (!check) return null;
  await record({ ...check, output: check, summary: { entry: check } });
  return check.exitCode ? { green: false, reason: 'rerun-red', detail: [check.evidence], checks: { checks: [check] } } : null;
}
