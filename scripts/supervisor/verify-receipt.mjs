// verify-receipt.mjs - the ONE receipt that makes a runtime commit "verified": `starci runtime verify` writes it, `starci git land` and `starci runtime deploy` read it.
// It binds one exact commit and its tree to BOTH facts a branch needs before it moves toward the host: `check` (the runtime check passed N of N, which proves structure and never runs a spec) and
// `affected` (the specs the change can break, N of N passed for base..tip, from the affected receipt of scripts/supervisor/affected-receipt-file.mjs). A digest ties the fields together, so a hand-written file fails.
// The file lives in the tree it verified: <runtime state dir>/verify/<sha>.json, beside the affected receipts.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { runtimeStateDir } from '../../engine/runtime-root.mjs';
import { readJsonFile } from '../lib/json.mjs';

const VERIFY_SCHEMA = 'starci/verify-receipt@1';
const SHORT = 12;
const RED_SHOWN = 12;
export const short = (sha) => String(sha ?? '').slice(0, SHORT);

/** Where the verify receipt of commit `sha` lives in the tree at `root`. */
const verifyReceiptFile = (root, sha) => path.join(runtimeStateDir(root), 'verify', `${sha}.json`);

const digestOf = (r) => crypto.createHash('sha256').update([r.schema, r.sha, r.tree, r.base, r.at, r.check?.pass, r.check?.total, r.affected?.passed, r.affected?.total, r.affected?.reused, r.node].join('\n')).digest('hex');

/** The receipt record of a finished verification; `check` = {pass, total}, `affected` = {passed, total, reused, files, ms}. */
export function verifyRecord({ sha, tree, base, check, affected, at = Date.now(), nodeVersion = process.version }) {
  const record = { schema: VERIFY_SCHEMA, sha, tree, base, at, node: nodeVersion, check, affected };
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

/** Why `record` does not verify `sha`/`tree` against `base`, or null when it does: the one definition of "verified" (check p/p AND affected N/N for base..sha). */
function verifyProblem(record, { sha, tree, base }) {
  if (record?.schema !== VERIFY_SCHEMA) return 'no verify receipt';
  if (record.digest !== digestOf(record)) return 'the verify receipt does not match its digest (edited by hand)';
  if (record.sha !== sha || record.tree !== tree) return `the verify receipt is for ${short(record.sha)}, not ${short(sha)}`;
  if (record.base !== base) return `the verify receipt proved the affected specs against ${short(record.base)}, not ${short(base)}`;
  const { check, affected } = record;
  if (!(check?.total > 0) || check.pass !== check.total) return `the verify receipt records the check at ${check?.pass}/${check?.total}`;
  if (!(affected?.total >= 0) || affected.passed !== affected.total) return `the verify receipt records the affected specs at ${affected?.passed}/${affected?.total}`;
  return null;
}

/** The verify receipt of `sha` in the tree at `root` when it verifies `sha`/`tree` against `base`: {record} or {problem}. */
export function readVerifyReceipt({ root, sha, tree, base }) {
  const record = readJsonFile(verifyReceiptFile(root, sha), null);
  const problem = verifyProblem(record, { sha, tree, base });
  return problem ? { problem } : { record };
}

/** The one-line verdict a human reads last: `verified <sha>: check p/p, affected N/N of <base>..<sha>` (+ how many of N were reused from a proven run), or `NOT VERIFIED <sha>: <why>`. */
export function verdictOf({ sha, base, check, affected, problems, red = [] }) {
  if (problems.length) {
    const more = red.length > RED_SHOWN ? ` and ${red.length - RED_SHOWN} more` : '';
    const listed = red.length ? ` [red: ${red.slice(0, RED_SHOWN).join(', ')}${more}]` : '';
    return `NOT VERIFIED ${short(sha)}: ${problems.join('; ')}${listed}`;
  }
  const reused = affected.reused > 0 ? ` (${affected.reused} reused from a proven run at an unchanged key)` : '';
  return `verified ${short(sha)}: check ${check.pass}/${check.total}, affected ${affected.passed}/${affected.total} of ${short(base)}..${short(sha)}${reused}`;
}
