// settle-checked-in.mjs — where the checks of a settled attempt ran: the directory each recorded check used, with the commit
// and the tree that directory held. The `op-settled` event carries the list, so a later reader can tell whether "done" stands on
// checks that ran in the workflow's own tree.
import { revParseQuery } from '../../../api/git/rev-parse-query.mjs';

const GIT_TIMEOUT_MS = 20_000;

/** The commit and tree HEAD names in `dir`, or the reason git could not say. */
function headOf(dir, query) {
  const r = query(['HEAD', 'HEAD^{tree}'], { dir, timeout: GIT_TIMEOUT_MS });
  const [commit, tree] = String(r?.stdout ?? '').trim().split(/\s+/);
  if (r?.status === 0 && commit && tree) return { commit, tree };
  return { commit: null, tree: null, error: String(r?.stderr || r?.error?.message || 'git could not name HEAD').trim().slice(0, 120) };
}

/** [{cwd, commit, tree}] for every directory the attempt's kernel or settler checks ran in; [] when no check recorded one; null without an attempt. */
export function checkedInOf(db, attemptId, { query = revParseQuery } = {}) {
  if (attemptId == null) return null;
  const rows = db.prepare("SELECT DISTINCT cwd FROM check_runs WHERE attempt_id=? AND runner IN ('kernel','settler') AND cwd IS NOT NULL ORDER BY cwd").all(attemptId);
  return rows.map((row) => ({ cwd: row.cwd, ...headOf(row.cwd, query) }));
}
