// release-sonar-report.mjs - the lint report the Sonar scan of an example imports: `starci app lint --sonar reports/lint.sonar.json` at the app root, the command the managed ci.yml runs
// before its scan (sonar.externalIssuesReportPaths names the file, knowledge/sonar-gate.yaml). Nothing else in the L4 row writes it (the `lint` row is `starci app lint` without the
// report), so the Sonar proof writes it itself, with the app's own installed CLI. The lint exit code is not the verdict here (findings are imported and the gate counts them); the file is.
import fs from 'node:fs';
import path from 'node:path';
import { runNpm } from '../api/npm/run-npm.mjs';

const LINT_REPORT = 'reports/lint.sonar.json';
const TIMEOUT_MS = 20 * 60_000;

/** Write the report for the app in `appDir`: {ok: true} when the file exists afterwards, else {ok: false, reason} with the tail of the lint output. `run` is the npm runner (spec seam). */
export function writeLintReport(appDir, { run = runNpm } = {}) {
  const file = path.join(appDir, LINT_REPORT);
  fs.rmSync(file, { force: true }); // a report of an earlier run is never the report of this one
  const r = run(['exec', '--no-install', '--', 'starci', 'app', 'lint', '--sonar', LINT_REPORT], { cwd: appDir, encoding: 'utf8', timeout: TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024 });
  if (fs.existsSync(file)) return { ok: true };
  const output = `${r.stdout ?? ''}\n${r.stderr ?? ''}\n${r.error?.message ?? ''}`.trim().slice(-400);
  return { ok: false, reason: `starci app lint --sonar ${LINT_REPORT} wrote no report (exit ${r.status ?? 'none'}): ${output}` };
}

/** Remove the report (and its directory when that is left empty): the proof leaves the example's tree as it found it. */
export function removeLintReport(appDir) {
  const file = path.join(appDir, LINT_REPORT);
  fs.rmSync(file, { force: true });
  const dir = path.dirname(file);
  if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
}
