// release-sonar-report.mjs - the lint report the Sonar scan of an example imports: `starci app lint --sonar <file>` at the app root, the command the managed ci.yml runs before its scan
// (with `reports/lint.sonar.json` in the app's tree; knowledge/sonar-gate.yaml). Nothing else in the L4 row writes it (the `lint` row is `starci app lint` without the report), so the Sonar proof writes it
// itself, with the app's own installed CLI, into the runtime temp root - never into the tracked tree, where a check reads a file left by an interrupted cut as authored JSON - and hands the scanner its
// path as `sonar.externalIssuesReportPaths`. The lint exit code is not the verdict here (findings are imported and the gate counts them); the file is.
import fs from 'node:fs';
import path from 'node:path';
import { runNpm } from '../api/npm/run-npm.mjs';

const REPORT_NAME = 'lint.sonar.json';
const TIMEOUT_MS = 20 * 60_000;

/** The report file of one proof inside `dir` (a directory of the temp root made for it). */
export const lintReportFile = (dir) => path.join(dir, REPORT_NAME);

/** The scanner define that points the scan at `file`. */
export const lintReportDefine = (file) => `-Dsonar.externalIssuesReportPaths=${file}`;

/** Write the report of the app in `appDir` to the absolute `file`: {ok: true} when the file exists afterwards, else {ok: false, reason} with the tail of the lint output. `run` is the npm runner (spec seam). */
export function writeLintReport(appDir, file, { run = runNpm } = {}) {
  fs.rmSync(file, { force: true }); // a report of an earlier run is never the report of this one
  const r = run(['exec', '--no-install', '--', 'starci', 'app', 'lint', '--sonar', file], { cwd: appDir, encoding: 'utf8', timeout: TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024 });
  if (fs.existsSync(file)) return { ok: true };
  const output = `${r.stdout ?? ''}
${r.stderr ?? ''}
${r.error?.message ?? ''}`.trim().slice(-400);
  return { ok: false, reason: `starci app lint --sonar ${file} wrote no report (exit ${r.status ?? 'none'}): ${output}` };
}

/** Remove the report and the directory made for it. */
export function removeLintReport(file) {
  fs.rmSync(path.dirname(file), { recursive: true, force: true });
}
