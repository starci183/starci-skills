// release-l4-sonar.mjs - the Sonar proof of the L4 row (scripts/supervisor/release-l4.mjs): for every example app, the existing gate
// (scripts/gates/sonar-local.mjs, the code behind `starci gate sonar`) scans the project against the whole-project gate and reads its dashboard;
// both must PASS (a disabled or blocked Sonar is not a proof). The gate's own functions are called in-process (no child `node <script>`); the scanner it
// runs stays inside the gate's own call file. The gate is configured for the stack's LOCAL host (the one the example declares), never the public tunnel host of the environment.
// The local SonarQube stack (the server container and its database container) is brought up for the proof when it is stopped (a paused or restarting container is stopped first),
// waited for by the server's own status and its container (release-sonar-wait.mjs), and left exactly as it was found afterwards: a container that was running stays running, one this run
// started is stopped again. Containers are started and stopped by exact name through the scripts/api/docker call files; no other container of this host is ever named.
// The scan imports the app's lint report, which nothing earlier in L4 writes: the proof writes it first (release-sonar-report.mjs).
// Async because the gate is. Seams (deps): gate ({config, state, scan, dashboard}), lintReport (appDir -> {ok, reason}), docker ({inspect, start, stop}), logs, sleep (ms -> Promise), now, readyMs, pollMs, logDir.
import fs from 'node:fs';
import path from 'node:path';
import { sleep } from '../lib/sleep.mjs';
import { findInOrder } from '../lib/in-order.mjs';
import { dashboard, scan, scrub } from '../gates/sonar-local.mjs';
import { sonarState } from '../gates/sonar-status.mjs';
import { STARTUP, dockerOf, localStackConfig, stateOf } from './release-sonar-stack.mjs';
import { awaitSonarUp, logsOf } from './release-sonar-wait.mjs';
import { removeLintReport, writeLintReport } from './release-sonar-report.mjs';
import { tempRoot } from '../../engine/temp-root.mjs';

const SCAN_TIMEOUT_SEC = 60 * 60;

/** The gate's functions, as the supplier calls them: the config of an app (local host), the server's status, the project-gate scan and the dashboard. */
const GATE = Object.freeze({
  config: localStackConfig,
  state: sonarState,
  scan: (cfg, appDir) => scan(cfg, { cwd: appDir, wait: true, projectGate: true, timeoutSec: SCAN_TIMEOUT_SEC }),
  dashboard: (cfg, appDir) => dashboard(cfg, { cwd: appDir }),
});

const tail = (text, max = 400) => String(text ?? '').trim().slice(-max);

/**
 * The Sonar proofs of the example apps `apps` ([{name, dir}]): {proofs: {'<app>: sonar': async () => {ok, log, ms}}, close}. The stack comes up on the first
 * proof and `close()` (called once by runL4 after the last proof, also after a failure) puts it back as it was.
 */
export function sonarSupplier(apps, deps = {}) {
  const gate = deps.gate ?? GATE;
  const pause = deps.sleep ?? sleep;
  const now = deps.now ?? Date.now;
  const logDir = deps.logDir ?? (() => { const dir = path.join(tempRoot(), 'starci-release-l4'); fs.mkdirSync(dir, { recursive: true }); return dir; });
  const started = [];
  let stack = null;

  /** The reason the stack cannot be started from the states its containers were found in, or null. */
  const unusable = (states) => {
    const bad = states.filter((s) => ['docker-unavailable', 'missing', 'dead', 'removing'].includes(s.state));
    const named = bad.map((s) => `${s.name} is ${s.state}`).join(', ');
    return bad.length ? `the Sonar stack cannot be started: ${named} (ext/sonar/README.md re-creates it)` : null;
  };

  /** Start what is not running, the database first; a paused or crash-looping container is stopped before. The reason it failed, or null. */
  const startDown = (d, states) => {
    const down = states.filter((s) => s.state !== 'running');
    if (!down.length) return null;
    const names = down.map((s) => s.name);
    started.push(...names); // stopped again by close() even when the start failed half way: a stop of a stopped container is harmless
    const stale = down.filter((s) => s.state === 'paused' || s.state === 'restarting').map((s) => s.name);
    if (stale.length) d.stop(stale);
    const r = d.start(names);
    return r.error || r.status !== 0 ? `docker start ${names.join(' ')} failed: ${tail(r.stderr || r.error?.message)}` : null;
  };

  const bringUp = async (cfg) => {
    if (stack) return stack;
    const d = deps.docker ?? dockerOf(cfg.docker);
    const states = [`${cfg.container}-postgres`, cfg.container].map((name) => ({ name, state: stateOf(d.inspect, name) })); // the database first
    const reason = unusable(states) ?? startDown(d, states);
    if (reason) { stack = { ok: false, reason, docker: d }; return stack; }
    const waited = await awaitSonarUp(cfg, { state: gate.state, containerState: () => stateOf(d.inspect, cfg.container), logs: deps.logs ?? logsOf(cfg.docker), sleep: pause, now, readyMs: deps.readyMs ?? STARTUP.readyMs, pollMs: deps.pollMs ?? STARTUP.pollMs });
    stack = waited.ok ? { ok: true, docker: d } : { ok: false, reason: waited.reason, state: waited.state, docker: d };
    return stack;
  };

  const prove = (app) => async () => {
    const t0 = now();
    const log = path.join(logDir(), `sonar-${app.name.replace(/[^\w.-]+/g, '_')}-${t0}.log`);
    const lines = [];
    const finish = (ok) => { removeLintReport(app.dir); fs.writeFileSync(log, `${lines.join('\n')}\n`); return { ok, log, ms: now() - t0 }; };
    let cfg;
    try { cfg = gate.config(app.dir); } catch (error) { lines.push(`sonar config: ${error.message}`); return finish(false); }
    const up = await bringUp(cfg);
    if (!up.ok) { lines.push(`sonar stack: ${up.reason}`); return finish(false); }
    const report = (deps.lintReport ?? writeLintReport)(app.dir);
    if (!report.ok) { lines.push(`sonar lint report: ${report.reason}`); return finish(false); }
    const failed = await findInOrder([['scan --project-gate', gate.scan], ['dashboard', gate.dashboard]], async ([command, run]) => {
      let outcome;
      try { outcome = await run(cfg, app.dir); } catch (error) { lines.push(`== sonar-local ${command} ${app.name}: threw ${scrub(error?.message ?? error)}`); return true; }
      lines.push(`== sonar-local ${command} ${app.name}: ${outcome?.outcome ?? 'no outcome'}`, scrub(JSON.stringify(outcome, null, 2)));
      return outcome?.outcome !== 'pass';
    });
    return finish(failed === undefined);
  };

  /** Leave the stack as found: stop only what this run started, the server before its database. */
  const close = () => {
    if (!stack?.docker || !started.length) return { stopped: [] };
    const names = [...started].reverse();
    stack.docker.stop(names);
    started.length = 0;
    return { stopped: names };
  };

  return { proofs: Object.fromEntries(apps.map((app) => [`${app.name}: sonar`, prove(app)])), close };
}
