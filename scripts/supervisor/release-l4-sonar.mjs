// release-l4-sonar.mjs - the Sonar proof of the L4 row (scripts/supervisor/release-l4.mjs): for every example app, the existing gate
// (scripts/gates/sonar-local.mjs, the code behind `starci gate sonar`) scans the project against the whole-project gate and reads its dashboard;
// both must PASS (a disabled or blocked Sonar is not a proof). The gate's own functions are called in-process (no child `node <script>`); the scanner it
// runs stays inside the gate's own call file. The local SonarQube stack (the server container and its database container) is brought up for the proof when
// it is stopped, waited for until the server answers UP, and left exactly as it was found afterwards: a container that was running stays running, one this run
// started is stopped again. Containers are started and stopped by exact name through the scripts/api/docker call files; no other container of this host is ever named.
// Async because the gate is. Seams (deps): gate ({config, up, scan, dashboard}), docker ({inspect, start, stop}), sleep (ms -> Promise), now, readyMs, pollMs, logDir.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { containerInspect } from '../api/docker/container-inspect.mjs';
import { containerLifecycle } from '../api/docker/container-lifecycle.mjs';
import { sleep } from '../lib/sleep.mjs';
import { dashboard, resolveConfig, scan, scrub } from '../gates/sonar-local.mjs';
import { sonarUp } from '../gates/sonar-status.mjs';

const READY_MS = 5 * 60_000;
const READY_POLL_MS = 5_000;
const SCAN_TIMEOUT_SEC = 60 * 60;

/** The gate's functions, as the supplier calls them: the config of an app, whether the server is UP, the project-gate scan and the dashboard. */
const GATE = Object.freeze({
  config: (appDir) => resolveConfig({ cwd: appDir }),
  up: sonarUp,
  scan: (cfg, appDir) => scan(cfg, { cwd: appDir, wait: true, projectGate: true, timeoutSec: SCAN_TIMEOUT_SEC }),
  dashboard: (cfg, appDir) => dashboard(cfg, { cwd: appDir }),
});

const dockerOf = (docker) => ({
  inspect: (name) => containerInspect(name, '{{.State.Status}}', { docker }),
  start: (names) => containerLifecycle('start', names, { docker }),
  stop: (names) => containerLifecycle('stop', names, { docker }),
});

/** The state of one container: 'running', another docker state, or 'missing' / 'docker-unavailable'. */
function stateOf(inspect, name) {
  const r = inspect(name);
  if (r.error) return 'docker-unavailable';
  if (r.status !== 0) return 'missing';
  return String(r.stdout ?? '').trim() || 'unknown';
}

const tail = (text, max = 400) => String(text ?? '').trim().slice(-max);

/**
 * The Sonar proofs of the example apps `apps` ([{name, dir}]): {proofs: {'<app>: sonar': async () => {ok, log, ms}}, close}. The stack comes up on the first
 * proof and `close()` (called once by runL4 after the last proof, also after a failure) puts it back as it was.
 */
export function sonarSupplier(apps, deps = {}) {
  const gate = deps.gate ?? GATE;
  const pause = deps.sleep ?? sleep;
  const now = deps.now ?? Date.now;
  const logDir = deps.logDir ?? (() => { const dir = path.join(os.tmpdir(), 'starci-release-l4'); fs.mkdirSync(dir, { recursive: true }); return dir; });
  const started = [];
  let stack = null;

  const bringUp = async (cfg) => {
    if (stack) return stack;
    const containers = [`${cfg.container}-postgres`, cfg.container]; // the database first
    const d = deps.docker ?? dockerOf(cfg.docker);
    const states = containers.map((name) => ({ name, state: stateOf(d.inspect, name) }));
    const unusable = states.filter((s) => s.state === 'docker-unavailable' || s.state === 'missing');
    if (unusable.length) {
      const unavailable = unusable.map((s) => `${s.name} is ${s.state}`).join(', ');
      stack = { ok: false, reason: `the Sonar stack cannot be started: ${unavailable}` };
      return stack;
    }
    const down = states.filter((s) => s.state !== 'running').map((s) => s.name);
    if (down.length) {
      started.push(...down); // stopped again by close() even when the start failed half way: a stop of a stopped container is harmless
      const r = d.start(down);
      if (r.error || r.status !== 0) { stack = { ok: false, reason: `docker start ${down.join(' ')} failed: ${tail(r.stderr || r.error?.message)}`, docker: d }; return stack; }
    }
    const deadline = now() + (deps.readyMs ?? READY_MS);
    let up = await gate.up(cfg);
    while (!up && now() < deadline) {
      await pause(deps.pollMs ?? READY_POLL_MS);
      up = await gate.up(cfg);
    }
    stack = up ? { ok: true, docker: d } : { ok: false, reason: 'SonarQube did not report UP in time after its containers started', docker: d };
    return stack;
  };

  const prove = (app) => async () => {
    const t0 = now();
    const log = path.join(logDir(), `sonar-${app.name.replace(/[^\w.-]+/g, '_')}-${t0}.log`);
    const lines = [];
    const finish = (ok) => { fs.writeFileSync(log, `${lines.join('\n')}\n`); return { ok, log, ms: now() - t0 }; };
    let cfg;
    try { cfg = gate.config(app.dir); } catch (error) { lines.push(`sonar config: ${error.message}`); return finish(false); }
    const up = await bringUp(cfg);
    if (!up.ok) { lines.push(`sonar stack: ${up.reason}`); return finish(false); }
    for (const [command, run] of [['scan --project-gate', gate.scan], ['dashboard', gate.dashboard]]) {
      let report;
      try { report = await run(cfg, app.dir); } catch (error) { lines.push(`== sonar-local ${command} ${app.name}: threw ${scrub(error?.message ?? error)}`); return finish(false); }
      lines.push(`== sonar-local ${command} ${app.name}: ${report?.outcome ?? 'no outcome'}`, scrub(JSON.stringify(report, null, 2)));
      if (report?.outcome !== 'pass') return finish(false);
    }
    return finish(true);
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
