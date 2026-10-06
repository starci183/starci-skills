import path from 'node:path';

/** Human line for one push result. */
export function describePush(r) {
  let detail;
  if (r.hooksOnly) {
    const status = r.hooks === 'green' ? 'green' : String(r.hooks).toUpperCase() + ' ' + (r.error ?? '');
    detail = 'pre-push hook on main ' + status + ' (' + (r.linked?.length ?? 0) + ' local-state link(s))';
  } else if (r.pushed) detail = 'pushed ' + r.ahead + ' commit(s) -> ' + r.head;
  else if (r.wouldPush) detail = 'would push ' + r.ahead;
  else if (r.deferred) detail = 'deferred: ' + r.deferred;
  else if (r.skipped) detail = r.skipped;
  else if (r.refused) {
    const findings = (r.scan?.findings ?? []).map((f) => ' [' + f.file + ':' + (f.line ?? '-') + ' ' + f.pattern + ']').join('');
    const hint = r.hint ? ' - ' + r.hint : '';
    detail = 'REFUSED ' + r.refused + findings + hint;
  } else detail = 'FAILED ' + (r.error ?? '');
  return path.basename(r.repo) + ': ' + detail;
}
