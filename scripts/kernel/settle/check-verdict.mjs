// check-verdict.mjs — the one verdict of one check run: pass | red | unavailable (H7, H8).
//
// A checker that could not run (its tool missing, its inputs unresolvable, a timeout, a crash before it measured) is
// an INFRASTRUCTURE problem: `unavailable`, never red, so it never rolls an integration back, never opens a
// continuation and never fails an attempt. The checker's own status word decides that when it writes one
// (gate.mjs exits 2 when a tool could not run; canon-scan answers status unresolved); a bare exit code reads
// 0 -> pass, 124 (timeout) / 127 (spawn failure) -> unavailable, anything else -> red. A run is `pass` only with raw
// exit 0 (DBTREE check_runs: no pass with a raw exit != 0) - a status word never lifts a red exit to green.
const UNAVAILABLE = new Set(['unavailable', 'unresolved', 'invalid', 'error', 'timeout', 'not-run', 'not_run', 'skipped-unavailable']);
const RED = new Set(['findings', 'fail', 'failed', 'red', 'new-findings']);

/** The status word a run carries: its own `status`, else its JSON output's `slice.status` or `status`. */
function statusWordOf(run) {
  for (const value of [run?.status, run?.output?.slice?.status, run?.output?.status]) {
    if (typeof value === 'string' && value.trim()) return value.trim().toLowerCase();
  }
  return null;
}

/** {verdict: pass|red|unavailable, exitCode, word} of one run {exitCode, status?, output?}. */
export function checkVerdictOf(run) {
  const exitCode = Number.isInteger(run?.exitCode) ? run.exitCode : null;
  const word = statusWordOf(run);
  if (word && UNAVAILABLE.has(word)) return { verdict: 'unavailable', exitCode, word };
  if (exitCode === null || exitCode === 124 || exitCode === 127) return { verdict: 'unavailable', exitCode, word };
  if (exitCode !== 0) return { verdict: 'red', exitCode, word };
  if (word && RED.has(word)) return { verdict: 'red', exitCode, word };
  return { verdict: 'pass', exitCode, word };
}

/** The check_runs.status of a run (the ledger's vocabulary: pass | fail | unavailable). */
export const checkRunStatusOf = (run) => ({ pass: 'pass', red: 'fail', unavailable: 'unavailable' })[checkVerdictOf(run).verdict];
