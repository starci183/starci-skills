// verify-receipt.mjs - the ONE receipt that makes a runtime commit "verified": `starci runtime verify` writes it, `starci git land` and `starci runtime deploy` read it.
// It binds one exact commit, its tree and the ROOT the specs ran in to BOTH facts a branch needs before it moves toward the host: `check` (the runtime check passed N of N, which proves structure and never runs a
// spec) and `affected` (the specs the change can break, from the affected receipt of scripts/supervisor/affected-receipt-file.mjs). A digest ties the fields together, so a hand-written file fails.
// Two readings of the same receipt, one rule each:
//   complete   every selected spec passed (passed = total, none left): what a deploy and a release need
//   land       0 failed among those run, the specs the lane changed all ran, and the count not started inside the time budget is recorded: what a land needs on a shared, busy host
// The file lives in the tree it verified: <runtime state dir>/verify/<sha>.json, beside the affected receipts.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { runtimeStateDir } from '../../engine/runtime-root.mjs';
import { readJsonFile } from '../lib/json.mjs';
import { sameResolvedPath } from '../lib/path-key.mjs';

const VERIFY_SCHEMA = 'starci/verify-receipt@1';
const SHORT = 12;
const RED_SHOWN = 12;
export const short = (sha) => String(sha ?? '').slice(0, SHORT);

/** The one rule of where specs ran: a receipt that names no root, or another tree's root, is that tree's proof and never `root`'s. Both the deploy receipt and the verify receipt use it. */
export const judgedIn = (recorded, root) => typeof recorded === 'string' && recorded !== '' && sameResolvedPath(recorded, root);

const verifyReceiptFile = (root, sha) => path.join(runtimeStateDir(root), 'verify', `${sha}.json`);

const digestOf = (r) => crypto.createHash('sha256').update([r.schema, r.sha, r.tree, r.root, r.base, r.at, r.check?.pass, r.check?.total, r.affected?.passed, r.affected?.total, r.affected?.failed,
  r.affected?.notStarted, r.affected?.changedSpecsRan, r.affected?.reused, r.node].join('\n')).digest('hex');

/** The receipt record of a finished verification; `check` = {pass, total}, `affected` = {passed, total, failed, notStarted, changedSpecsRan, reused, files, ms}. */
export function verifyRecord({ sha, tree, root, base, check, affected, at = Date.now(), nodeVersion = process.version }) {
  const record = { schema: VERIFY_SCHEMA, sha, tree, root: path.resolve(root), base, at, node: nodeVersion, check, affected: { failed: 0, notStarted: 0, changedSpecsRan: true, ...affected } };
  return { ...record, digest: digestOf(record) };
}

/** Writes `record` (tmp + rename: a reader never sees a torn file); returns the file. */
export function writeVerifyReceipt(root, record) {
  const file = verifyReceiptFile(root, record.sha);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(record, null, 2)}\n`);
  fs.renameSync(tmp, file);
  return file;
}

function affectedProblem(affected, need) {
  const { passed, total, failed, notStarted } = affected ?? {};
  if (!(total >= 0) || failed !== 0) return `the verify receipt records ${failed} failed among the affected specs`;
  if (need === 'complete') return passed === total && notStarted === 0 ? null : `the verify receipt records the affected specs at ${passed}/${total} (${notStarted} not started): a deploy needs all of them`;
  if (passed + notStarted !== total) return `the verify receipt records the affected specs at ${passed}/${total} with ${notStarted} not started`;
  return affected.changedSpecsRan ? null : 'the verify receipt records a spec the lane changed that was not run';
}

/** Why `record` does not verify `sha`/`tree` against `base` in `root` for `need` ('complete' or 'land'), or null when it does. */
function verifyProblem(record, { sha, tree, base, root, need }) {
  if (record?.schema !== VERIFY_SCHEMA) return 'no verify receipt';
  if (record.digest !== digestOf(record)) return 'the verify receipt does not match its digest (edited by hand)';
  if (record.sha !== sha || record.tree !== tree) return `the verify receipt is for ${short(record.sha)}, not ${short(sha)}`;
  if (record.base !== base) return `the verify receipt proved the affected specs against ${short(record.base)}, not ${short(base)}`;
  if (!judgedIn(record.root, root)) return `the verify receipt's specs ran in ${record.root ?? 'no named tree'}, not in ${root}`;
  const { check } = record;
  if (!(check?.total > 0) || check.pass !== check.total) return `the verify receipt records the check at ${check?.pass}/${check?.total}`;
  return affectedProblem(record.affected, need);
}

/** The verify receipt of `sha` in the tree at `root` when it verifies `sha`/`tree` against `base` for `need` (default 'complete'): {record} or {problem}. */
export function readVerifyReceipt({ root, sha, tree, base, need = 'complete' }) {
  const record = readJsonFile(verifyReceiptFile(root, sha), null);
  const problem = verifyProblem(record, { sha, tree, base, root, need });
  return problem ? { problem } : { record };
}

/**
 * The one-line verdict a human reads last. Verified: `verified <sha>: check p/p, affected N/N of <base>..<sha>`. Partial (nothing red, the lane's own specs ran, some not started inside the budget):
 * `PARTIAL <sha>: ... M not started (budget); fit to land, not to deploy`. Otherwise `NOT VERIFIED <sha>: <why> [red: files]`.
 */
export function verdictOf({ sha, base, check, affected, problems, red = [] }) {
  if (problems.length) {
    const more = red.length > RED_SHOWN ? ` and ${red.length - RED_SHOWN} more` : '';
    const listed = red.length ? ` [red: ${red.slice(0, RED_SHOWN).join(', ')}${more}]` : '';
    return `NOT VERIFIED ${short(sha)}: ${problems.join('; ')}${listed}`;
  }
  const range = `${short(base)}..${short(sha)}`;
  if (affected.notStarted > 0) return `PARTIAL ${short(sha)}: check ${check.pass}/${check.total}, affected ${affected.passed}/${affected.total} passed, 0 failed, ${affected.notStarted} not started (budget) of ${range}; fit to land, not to deploy or release`;
  const reused = affected.reused > 0 ? ` (${affected.reused} reused from a proven run at an unchanged key)` : '';
  return `verified ${short(sha)}: check ${check.pass}/${check.total}, affected ${affected.passed}/${affected.total} of ${range}${reused}`;
}
