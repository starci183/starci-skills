// git-land-verify.mjs — the full runtime check of a land, verify and deploy candidate, with its pass/total counts.
import { fullCheck as fullCheckCall } from './land-full-check.mjs';

const okOf = (r) => !r?.error && r?.status === 0;

/** Convert the human runtime-check summary to the check pass/total trailer counts. */
function checkCounts(text, ok) {
  let pass = 0, total = 0;
  const syntax = /node --check:\s*(\d+) files,\s*(\d+) failed/.exec(text);
  if (syntax) { total += Number(syntax[1]); pass += Number(syntax[1]) - Number(syntax[2]); }
  if (/^OK: runtime HFS /m.test(text)) { total += 1; pass += 1; }
  else if (/^runtime HFS:/m.test(text)) total += 1;
  const self = /self-checks:\s*(\d+) of (\d+) passed/.exec(text);
  if (self) { pass += Number(self[1]); total += Number(self[2]); }
  return total ? { pass, total } : { pass: ok ? 1 : 0, total: 1 };
}

/** Run the candidate's exact `starci runtime check` entry and retain its complete output. */
export function runLandFullCheck(worktree, deps = {}) {
  const runner = deps.runNode
    ? (args, options) => { const r = deps.runNode(args, options); return { ok: okOf(r), stdout: String(r.stdout ?? ''), stderr: String(r.stderr ?? r.error?.message ?? '') }; }
    : undefined;
  const result = (deps.fullCheck ?? fullCheckCall)(worktree, runner);
  if (result.skipped) return { ok: false, output: 'packages/cli/bin/starci.mjs is missing; the full runtime check did not run', pass: 0, total: 1 };
  const counts = checkCounts(result.full, result.ok);
  return { ok: result.ok, output: result.full, ...counts };
}
