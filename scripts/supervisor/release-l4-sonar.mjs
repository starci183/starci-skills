// release-l4-sonar.mjs - the Sonar proof of the L4 row (scripts/supervisor/release-l4.mjs): every example app is analysed on SonarCloud with the one SONAR_TOKEN of the runtime's secret.env
// (release-sonarcloud.mjs), by the existing gate (scripts/gates/sonar-local.mjs, the code behind `starci gate sonar`) called in-process: the project is created when absent, the app's lint report is
// written (release-sonar-report.mjs), the scanner submits the analysis and the dashboard is read; both must PASS (a disabled or blocked Sonar is not a proof).
// The bar is the runtime's own (knowledge/sonar-gate.yaml): the scan row passes when the analysis was processed (the scanner exited 0 and SonarCloud's task succeeded) whatever the gate selected on
// SonarCloud judges - a custom gate may not exist on the plan - and the dashboard row applies the declared thresholds to the measures read from the API (zero bugs, smells and vulnerabilities, every
// hotspot reviewed, duplication, coverage 100 per service file and overall). Nothing is started or stopped on this host.
// Async because the gate is. Seams (deps): gate ({config, ensure, scan, dashboard}), secrets, lintReport (appDir -> {ok, reason}), logDir, now.
import fs from 'node:fs';
import path from 'node:path';
import { findInOrder } from '../lib/in-order.mjs';
import { dashboard, scan, scrub } from '../gates/sonar-local.mjs';
import { removeLintReport, writeLintReport } from './release-sonar-report.mjs';
import { PROOF_BRANCH, cloudConfig, ensureCloudProject, hostSecrets } from './release-sonarcloud.mjs';
import { tempRoot } from '../../engine/temp-root.mjs';

const SCAN_TIMEOUT_SEC = 60 * 60;

/** The gate's functions as the supplier calls them; `cloud` is {cfg, key, org}, `extra` the scanner defines. */
const GATE = Object.freeze({
  config: (appDir, secrets) => cloudConfig(appDir, secrets),
  ensure: (cloud, token) => ensureCloudProject(cloud, token),
  scan: (cloud, appDir, extra) => scan(cloud.cfg, { cwd: appDir, key: cloud.key, ensure: false, wait: true, projectGate: true, timeoutSec: SCAN_TIMEOUT_SEC, defines: extra }),
  dashboard: (cloud, appDir) => dashboard(cloud.cfg, { cwd: appDir, key: cloud.key }),
});

/** Whether a scan report counts as an analysis processed on SonarCloud: a pass, or a fail of the server's own gate on an analysis the scanner submitted and SonarCloud finished. */
const processed = (report) => report?.outcome === 'pass' || (report?.outcome === 'fail' && report.scanner?.exitCode === 0 && report.ceTask?.status === 'SUCCESS' && Boolean(report.projectGate?.status));

/** The scanner defines of one proof: the organization, the project key, and a proof branch when the project already has its main branch. */
const definesOf = (cloud, created) => [`-Dsonar.organization=${cloud.org}`, `-Dsonar.projectKey=${cloud.key}`, ...(created ? [] : [`-Dsonar.branch.name=${PROOF_BRANCH}`])];

/**
 * The Sonar proofs of the example apps `apps` ([{name, dir}]): {proofs: {'<app>: sonar': async () => {ok, log, ms}}}.
 */
export function sonarSupplier(apps, deps = {}) {
  const gate = deps.gate ?? GATE;
  const now = deps.now ?? Date.now;
  const logDir = deps.logDir ?? (() => { const dir = path.join(tempRoot(), 'starci-release-l4'); fs.mkdirSync(dir, { recursive: true }); return dir; });

  const prove = (app) => async () => {
    const t0 = now();
    const log = path.join(logDir(), `sonar-${app.name.replace(/[^\w.-]+/g, '_')}-${t0}.log`);
    const lines = [];
    const finish = (ok) => { removeLintReport(app.dir); fs.writeFileSync(log, `${lines.join('\n')}\n`); return { ok, log, ms: now() - t0 }; };
    const secrets = deps.secrets ?? hostSecrets();
    let cloud;
    try { cloud = gate.config(app.dir, secrets); } catch (error) { lines.push(`sonar config: ${error.message}`); return finish(false); }
    const report = (deps.lintReport ?? writeLintReport)(app.dir);
    if (!report.ok) { lines.push(`sonar lint report: ${report.reason}`); return finish(false); }
    const project = await gate.ensure(cloud, secrets.SONAR_TOKEN);
    if (project.error) { lines.push(`sonar project: ${project.error}`); return finish(false); }
    const steps = [['scan --project-gate', (dir) => gate.scan(cloud, dir, definesOf(cloud, project.created)), processed], ['dashboard', (dir) => gate.dashboard(cloud, dir), (r) => r?.outcome === 'pass']];
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
