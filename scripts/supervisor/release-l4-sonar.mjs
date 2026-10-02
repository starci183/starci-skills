// release-l4-sonar.mjs - the Sonar proof of the L4 row (scripts/supervisor/release-l4.mjs): for every example app, the existing gate
// (scripts/gates/sonar-local.mjs, the code behind `starci gate sonar`) scans the project against the whole-project gate and reads its dashboard;
// both must pass. The local SonarQube stack (the server container and its database container) is brought up for the proof when it is stopped,
// waited for until its status is UP, and left exactly as it was found afterwards: a container that was running stays running, one this run started is stopped again.
// Containers are started and stopped by exact name through the scripts/api/docker call files; no other container (no other container of this host) is ever named.
// Seams (deps): run (the gate: args -> {status, stdout, stderr}), docker ({inspect, start, stop}), stackOf (appDir -> {docker, containers}), sleep, now, logDir.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runNode } from '../api/node/run-node.mjs';
import { containerInspect } from '../api/docker/container-inspect.mjs';
import { containerLifecycle } from '../api/docker/container-lifecycle.mjs';
import { sleepSync } from '../lib/sleep-sync.mjs';
import { resolveConfig } from '../gates/sonar-local.mjs';

const GATE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'gates', 'sonar-local.mjs');
const SCAN_TIMEOUT_MS = 60 * 60_000;
const READY_MS = 5 * 60_000;
const READY_POLL_MS = 5_000;

/** The containers of one app's local Sonar stack, in start order (the database first): {docker, containers}. */
function sonarStackOf(appDir) {
  const cfg = resolveConfig({ cwd: appDir });
  return { docker: cfg.docker, containers: [`${cfg.container}-postgres`, cfg.container] };
}

/** The gate as a child: `node scripts/gates/sonar-local.mjs <args>` -> {status, stdout, stderr}. */
const runGate = (args, { cwd, timeout }) => runNode([GATE, ...args], { cwd, timeout, maxBuffer: 64 * 1024 * 1024 });

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

/** The tail of a text, for a refusal message. */
const tail = (text, max = 400) => String(text ?? '').trim().slice(-max);

/**
 * The Sonar proofs of the example apps of `repo`: {proofs: {'<app>: sonar': () => {ok, log, ms}}, close}. The stack comes up on the first proof and `close()`
 * (called once by runL4 after the last proof, also after a failure) puts it back as it was.
 */
export function sonarSupplier(apps, deps = {}) {
  const run = deps.run ?? runGate;
  const sleep = deps.sleep ?? sleepSync;
  const now = deps.now ?? Date.now;
  const logDir = deps.logDir ?? (() => { const dir = path.join(os.tmpdir(), 'starci-release-l4'); fs.mkdirSync(dir, { recursive: true }); return dir; });
  const started = [];
  let stack = null;

  const bringUp = (app) => {
    if (stack) return stack;
    const { docker, containers } = (deps.stackOf ?? sonarStackOf)(app.dir);
    const d = deps.docker ?? dockerOf(docker);
    const states = containers.map((name) => ({ name, state: stateOf(d.inspect, name) }));
    const unusable = states.filter((s) => s.state === 'docker-unavailable' || s.state === 'missing');
    if (unusable.length) { stack = { ok: false, reason: `the Sonar stack cannot be started: ${unusable.map((s) => `${s.name} is ${s.state}`).join(', ')}` }; return stack; }
    const down = states.filter((s) => s.state !== 'running').map((s) => s.name);
    if (down.length) {
      started.push(...down); // stopped again by close() even when the start failed half way: a stop of a stopped container is harmless
      const r = d.start(down);
      if (r.error || r.status !== 0) { stack = { ok: false, reason: `docker start ${down.join(' ')} failed: ${tail(r.stderr || r.error?.message)}`, docker: d }; return stack; }
    }
    // The server answers `status` with exit 0 only when SonarQube reports UP.
    const deadline = now() + (deps.readyMs ?? READY_MS);
    let up = run(['status', '--cwd', app.dir], { cwd: app.dir, timeout: 60_000 }).status === 0;
    while (!up && now() < deadline) {
      sleep(deps.pollMs ?? READY_POLL_MS);
      up = run(['status', '--cwd', app.dir], { cwd: app.dir, timeout: 60_000 }).status === 0;
    }
    stack = up ? { ok: true, docker: d } : { ok: false, reason: 'SonarQube did not report UP in time after its containers started', docker: d };
    return stack;
  };

  const prove = (app) => () => {
    const t0 = now();
    const dir = logDir();
    const log = path.join(dir, `sonar-${app.name.replace(/[^\w.-]+/g, '_')}-${t0}.log`);
    const lines = [];
    const finish = (ok) => { fs.writeFileSync(log, `${lines.join('\n')}\n`); return { ok, log, ms: now() - t0 }; };
    const up = bringUp(app);
    if (!up.ok) { lines.push(`sonar stack: ${up.reason}`); return finish(false); }
    for (const command of [['scan', '--cwd', app.dir, '--project-gate', '--wait'], ['dashboard', '--cwd', app.dir]]) {
      const r = run(command, { cwd: app.dir, timeout: SCAN_TIMEOUT_MS });
      lines.push(`== sonar-local ${command[0]} ${app.name}: exit ${r.status ?? r.error?.message}`, String(r.stdout ?? '').trim(), tail(r.stderr, 2000));
      if (r.status !== 0) return finish(false);
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
