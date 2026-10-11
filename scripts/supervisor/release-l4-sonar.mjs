// release-l4-sonar.mjs - the Sonar proof of the L4 row (scripts/supervisor/release-l4.mjs): every example app is analysed on SonarCloud with the one SONAR_TOKEN of the runtime's secret.env
// (release-sonarcloud.mjs), by the existing gate (scripts/gates/sonar-local.mjs, the code behind `starci gate sonar`) called in-process: the project is created when absent, the app's lint report is
// written (release-sonar-report.mjs), the scanner submits the analysis and the dashboard of the analysed branch is read (the proof branch, unless the analysis became the project's main); both must PASS (a disabled or blocked Sonar is not a proof).
// The bar is the runtime's own (knowledge/sonar-gate.yaml): the scan row passes when the analysis was processed (the scanner exited 0 and SonarCloud's task succeeded) whatever the gate selected on
// SonarCloud judges - a custom gate may not exist on the plan - and the dashboard row applies the declared thresholds to the measures read from the API (zero bugs, smells and vulnerabilities, every
// hotspot reviewed, duplication, coverage 100 per service file and overall). Nothing is started or stopped on this host.
// The lint report lives in a directory of the temp root made for the proof and is removed when the proof ends or the process is interrupted (scripts/lib/interrupt-cleanup.mjs).
// Async because the gate is. Seams (deps): gate ({config, ensure, scan, dashboard}), settings, lintReport (appDir, file -> {ok, reason}), logDir, reportDir (-> a fresh directory), onInterrupt (the interrupt registration), now.
import fs from 'node:fs';
import path from 'node:path';
import { findInOrder } from '../lib/in-order.mjs';
import { dashboard, scan, scrub } from '../gates/sonar-local.mjs';
import { lintReportDefine, lintReportFile, removeLintReport, writeLintReport } from './release-sonar-report.mjs';
import { onInterrupt } from '../lib/interrupt-cleanup.mjs';
import { makeTempDir } from '../api/fs/make-temp-dir.mjs';
import { PROOF_BRANCH, cloudConfig, ensureCloudProject, hostSettings } from './release-sonarcloud.mjs';
import { tempRoot } from '../../engine/temp-root.mjs';

const SCAN_TIMEOUT_SEC = 60 * 60;

/** The gate's functions as the supplier calls them; `cloud` is {cfg, key, org}, `extra` the scanner defines. */
const GATE = Object.freeze({
  config: (appDir, settings) => cloudConfig(appDir, settings),
  ensure: (cloud, token) => ensureCloudProject(cloud, token),
  scan: (cloud, appDir, extra) => scan(cloud.cfg, { cwd: appDir, key: cloud.key, ensure: false, wait: true, projectGate: true, timeoutSec: SCAN_TIMEOUT_SEC, defines: extra }),
  dashboard: (cloud, appDir, branch) => dashboard(cloud.cfg, { cwd: appDir, key: cloud.key, branch }),
});

/** Whether a scan report counts as an analysis processed on SonarCloud: the scanner exited 0 and SonarCloud's task succeeded, whatever the gate selected there says (a red gate, or NONE on a new project). */
const processed = (report) => report?.scanner?.exitCode === 0 && report.ceTask?.status === 'SUCCESS';

/** The scanner defines of one proof: the organization (the scan adds the project key itself), the lint report in the temp root, and a proof branch when the project already has its main branch. */
const definesOf = (cloud, created, reportFile) => [`-Dsonar.organization=${cloud.org}`, lintReportDefine(reportFile), ...(created ? [] : [`-Dsonar.branch.name=${PROOF_BRANCH}`])];

/**
 * The Sonar proofs of the example apps `apps` ([{name, dir}]): {proofs: {'<app>: sonar': async () => {ok, log, ms}}}.
 */
export function sonarSupplier(apps, deps = {}) {
  const gate = deps.gate ?? GATE;
  const now = deps.now ?? Date.now;
  const logDir = deps.logDir ?? (() => { const dir = path.join(tempRoot(), 'starci-release-l4'); fs.mkdirSync(dir, { recursive: true }); return dir; });

  const reportDir = deps.reportDir ?? (() => makeTempDir('starci-l4-lint-'));

  const prove = (app) => async () => {
    const t0 = now();
    const reportFile = lintReportFile(reportDir());
    const disposeReport = (deps.onInterrupt ?? onInterrupt)(() => removeLintReport(reportFile));
    const log = path.join(logDir(), `sonar-${app.name.replace(/[^\w.-]+/g, '_')}-${t0}.log`);
    const lines = [];
    const finish = (ok) => { removeLintReport(reportFile); disposeReport(); fs.writeFileSync(log, `${lines.join('\n')}\n`); return { ok, log, ms: now() - t0 }; };
    const settings = deps.settings ?? hostSettings();
    let cloud;
    try { cloud = gate.config(app.dir, settings); } catch (error) { lines.push(`sonar config: ${error.message}`); return finish(false); }
    const report = (deps.lintReport ?? writeLintReport)(app.dir, reportFile);
    if (!report.ok) { lines.push(`sonar lint report: ${report.reason}`); return finish(false); }
    const project = await gate.ensure(cloud, settings.SONAR_TOKEN);
    if (project.error) { lines.push(`sonar project: ${project.error}`); return finish(false); }
    const steps = [['scan --project-gate', (dir) => gate.scan(cloud, dir, definesOf(cloud, project.created, reportFile)), processed], ['dashboard', (dir) => gate.dashboard(cloud, dir, project.created ? undefined : PROOF_BRANCH), (r) => r?.outcome === 'pass']];
    const failed = await findInOrder(steps, async ([command, run, passes]) => {
      let outcome;
      try { outcome = await run(app.dir); } catch (error) { lines.push(`== sonar-local ${command} ${app.name}: threw ${scrub(error?.message ?? error)}`); return true; }
      lines.push(`== sonar-local ${command} ${app.name}: ${outcome?.outcome ?? 'no outcome'}`, scrub(JSON.stringify(outcome, null, 2)));
      return !passes(outcome);
    });
    return finish(failed === undefined);
  };

  return { proofs: Object.fromEntries(apps.map((app) => [`${app.name}: sonar`, prove(app)])) };
}
