// git-land-receipt.mjs - the verify receipt gate of `starci git land`: a lane lands only a tip that `starci runtime verify` proved (check AND the affected specs on that exact commit, scripts/supervisor/verify-receipt.mjs).
// The land's own check and bounded spec selection still run after this; they are a second look, never a substitute for the receipt.
import { revParseQuery } from '../api/git/rev-parse-query.mjs';
import { readVerifyReceipt, short } from './verify-receipt.mjs';

/** The note line a land writes for the affected proof, which `starci runtime deploy` reads back: `Affected: <passed>/<total> <base>..<tip>`. */
export const affectedTrailer = ({ record, base, tip }) => `Affected: ${record.affected.passed}/${record.affected.total} ${base}..${tip}`;

/** The verify receipt of `tip` in `worktree` against the land base: {ok, record} or {ok: false, detail} naming the verb that produces it. */
export function landVerifyReceipt({ worktree, tip, base }) {
  if (!base) return { ok: false, detail: `main and ${short(tip)} have no merge base, so no verify receipt can bind the affected specs; run starci runtime verify --base <ref> in ${worktree}` };
  const tree = String(revParseQuery([`${tip}^{tree}`], { cwd: worktree }).stdout ?? '').trim();
  const found = readVerifyReceipt({ root: worktree, sha: tip, tree, base });
  return found.record ? { ok: true, record: found.record } : { ok: false, detail: `${found.problem}; run starci runtime verify --base ${short(base)} in ${worktree}, then land again` };
}
