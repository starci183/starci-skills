// release-l4-wiring.spec.mjs - what the L4 row (scripts/supervisor/release-l4.mjs) is wired to for the release cut: the example installs, the Sonar proof through the
// existing gate with its local stack brought up and put back (release-l4-sonar.mjs), and the Linux parity step (release-linux-parity.mjs). A fake docker and a fake gate
// stand in for the real ones: nothing here starts a container or talks to a Sonar server.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parityOutcome, parityPlan, parityScript, readWorkflows, runParity } from '../../scripts/supervisor/release-linux-parity.mjs';
import { sonarSupplier } from '../../scripts/supervisor/release-l4-sonar.mjs';
import { exampleApps, planL4, runL4 } from '../../scripts/supervisor/release-l4.mjs';
import { cutRelease } from '../../scripts/supervisor/release-cut.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const tmp = (t, label) => {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), `starci-l4-${label}-`)));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  return dir;
};

const WORKFLOWS = [
  { file: 'ci.yml', doc: { jobs: { main: { steps: [
    { uses: 'actions/setup-node@v4', with: { 'node-version': 22 } },
    { name: 'Install', run: 'npm ci' },
    { name: 'Grammar', 'working-directory': 'packages/grammar', run: 'npm ci\nnpm run build' },
    { name: 'Static checks', run: 'npm run check' },
    { name: 'Test suite', run: 'npm test' },
    { name: 'Upload', if: "${{ startsWith(github.ref, 'refs/tags/v') }}", run: 'echo up' },
  ] } } } },
  { file: 'examples.yml', doc: { env: { NODE_VERSION: '22' }, jobs: {
    apps: { steps: [{ run: 'echo "apps=1" >> "$GITHUB_OUTPUT"' }] },
    app: { strategy: { matrix: { app: '${{ fromJSON(needs.apps.outputs.apps) }}' } }, env: { APP_DIR: 'examples/${{ matrix.app }}', SONAR_TOKEN: '${{ secrets.SONAR_TOKEN }}' }, defaults: { run: { 'working-directory': 'examples/${{ matrix.app }}' } }, steps: [
      { name: 'Install root', 'working-directory': '.', run: 'npm ci' },
      { name: 'Install app', run: 'npm ci' },
      { name: 'Typecheck', run: 'npm run typecheck' },
      { name: 'hfs lint', 'working-directory': '.', run: 'node packages/hfs/bin/hfs.mjs lint --repo "$APP_DIR"' },
      { name: 'Unit', run: 'npm test -- --ci' },
      { name: 'Integration', if: "${{ github.event_name == 'workflow_dispatch' }}", run: 'npm run test:integration -- --ci' },
      { name: 'Build', run: 'npm run build:be' },
    ] },
    browser: { if: "${{ github.event_name == 'workflow_dispatch' }}", steps: [{ run: 'npm run test:browser' }] },
    images: { steps: [{ uses: 'docker/build-push-action@v6' }, { name: 'Image', run: 'docker build .' }] },
  } } },
];

test('the parity plan is derived from the workflows: one run per example app, the root install once, the spec suites and the manual, upload, docker, browser and plumbing steps left out with a reason', () => {
  const plan = parityPlan({ workflows: WORKFLOWS, apps: ['shop', 'blog'] });
  assert.equal(plan.image, 'node:22');
  assert.deepEqual(plan.steps.map((s) => [s.dir, s.run]), [
    ['.', 'npm ci'], ['packages/grammar', 'npm ci\nnpm run build'], ['.', 'npm run check'],
    ['examples/shop', 'npm ci'], ['examples/shop', 'npm run typecheck'], ['.', 'node packages/hfs/bin/hfs.mjs lint --repo "$APP_DIR"'], ['examples/shop', 'npm run build:be'],
    ['examples/blog', 'npm ci'], ['examples/blog', 'npm run typecheck'], ['.', 'node packages/hfs/bin/hfs.mjs lint --repo "$APP_DIR"'], ['examples/blog', 'npm run build:be'],
  ]);
  const lint = plan.steps.filter((s) => s.name.includes('hfs lint'));
  assert.deepEqual(lint.map((s) => s.env.APP_DIR), ['examples/shop', 'examples/blog'], 'the job env reaches the step, per app');
  assert.ok(plan.steps.every((s) => !('SONAR_TOKEN' in s.env)), 'a secret never reaches the container');
  const reasons = Object.fromEntries(plan.skipped.map((s) => [s.name.replace(/^.*?: /, ''), s.reason]));
  assert.match(reasons['Test suite'], /spec suite/);
  assert.match(reasons.Upload, /manual or tag-upload/);
  assert.match(reasons.Integration, /manual or tag-upload/);
  assert.match(reasons.Unit, /spec suite/);
  assert.match(reasons.Image, /docker/);
  assert.match(plan.skipped.find((s) => s.name.endsWith('browser')).reason, /manual job/);
  assert.match(plan.skipped.find((s) => s.name.includes('GITHUB_OUTPUT') || s.name.includes('apps=')).reason, /plumbing/);
});

test('the repository\'s own workflows give a plan that holds the full check set, the per-app typecheck, hfs lint and builds, and no spec suite', () => {
  const plan = parityPlan({ workflows: readWorkflows(ROOT), apps: exampleApps(ROOT).map((a) => a.name) });
  const runs = plan.steps.map((s) => `${s.dir}: ${s.run.split('\n').join(' && ')}`);
  for (const expected of ['.: npm run check', '.: node scripts/gates/package-clean-test.mjs']) assert.ok(runs.includes(expected), expected);
  for (const app of exampleApps(ROOT).map((a) => a.name)) {
    for (const cmd of ['npm ci', 'npm run typecheck', 'npm run build:be', 'npm run build:fe']) assert.ok(runs.includes(`examples/${app}: ${cmd}`), `${app}: ${cmd}`);
  }
  assert.ok(runs.some((r) => r.startsWith('.: node packages/hfs/bin/hfs.mjs lint')), 'hfs lint');
  assert.ok(!runs.some((r) => /: npm (?:run )?test(?::\w+)?(?: -- .*)?$/.test(r) && !r.startsWith('packages/grammar')), 'no spec suite');
  assert.ok(!runs.some((r) => /docker|playwright/.test(r)), 'no docker or browser step');
});

test('the parity script extracts HEAD from the read-only tar, snapshots it as a git repository, runs each step with its env and marks each step', () => {
  const script = parityScript(parityPlan({ workflows: WORKFLOWS, apps: ['shop'] }));
  assert.match(script, /tar -xf \/in\/src\.tar -C \/work/);
  assert.match(script, /git init -q && git add -A && git -c user\.name=starci/);
  assert.match(script, /run_step 'examples\.yml:app\[shop\]: hfs lint' '\.' <<'__STEP_\d+__'\nexport NODE_VERSION='22'\nexport APP_DIR='examples\/shop'\nnode packages/);
  assert.match(script, /##DONE"\n$/);
  const log = '##STEP a\nok\n##STEP b\nboom\n##FAILED b\n';
  assert.deepEqual(parityOutcome(log), { done: false, failed: 'b', steps: ['a', 'b'] });
  assert.deepEqual(parityOutcome('##STEP a\n##DONE\n'), { done: true, failed: null, steps: ['a'] });
});

/** A fake docker: records every call; `run` writes `output` to the log fd the call is given. */
function fakeDocker({ version = { status: 0, stdout: '27.0' }, status = 0, output = '##STEP a\n##DONE\n', throwOnRun = null } = {}) {
  const calls = { run: [], rm: [], version: 0 };
  return {
    calls,
    version: () => { calls.version += 1; return version; },
    run: (args, opts) => { calls.run.push({ args, opts }); if (throwOnRun) throw throwOnRun; fs.writeSync(opts.stdio[1], output); return { status, stdout: null, stderr: null }; },
    rm: (name) => { calls.rm.push(name); return { status: 0 }; },
  };
}
const parityDeps = (t, docker, extra = {}) => ({ docker, logDir: () => tmp(t, 'plog'), workflows: () => WORKFLOWS, apps: () => ['shop'], archive: (root, file) => { fs.writeFileSync(file, 'tar'); return { ok: true }; }, ...extra });

test('parity: a green container run is ok; the repository is mounted read-only, no port or network is given, and only its own named container is removed', (t) => {
  const docker = fakeDocker();
  const out = runParity('repo', parityDeps(t, docker));
  assert.deepEqual([out.name, out.ok, out.image], ['linux-parity', true, 'node:22'], JSON.stringify(out));
  const [{ args }] = docker.calls.run;
  assert.ok(args.includes('--mount') && args.some((a) => /^type=bind,source=.+,target=\/in,readonly$/.test(a)), 'the mount is read-only');
  assert.ok(!args.some((a) => /^(-p|--publish|--network|--net|-v|--volume|--privileged)$/.test(a)), 'no port, host network, volume or privilege');
  assert.equal(args[args.indexOf('--name') + 1], docker.calls.rm[0], 'it removes exactly the container it named');
  assert.match(docker.calls.rm[0], /^starci-l4-parity-/, 'never a container of anything else');
  assert.deepEqual(args.slice(-3), ['node:22', 'bash', '/in/parity.sh']);
  assert.ok(fs.existsSync(out.log) && out.skipped.length > 0 && out.steps.length > 0);
});

test('parity: a red step fails the row and names the step; a container that dies before the last step is red; no docker daemon is red and never runs', (t) => {
  const red = runParity('repo', parityDeps(t, fakeDocker({ status: 1, output: '##STEP x\nboom\n##FAILED x\n' })));
  assert.deepEqual([red.ok, red.failedStep, red.why], [false, 'x', 'red at x']);
  const early = runParity('repo', parityDeps(t, fakeDocker({ status: 0, output: '##STEP x\n' })));
  assert.equal(early.ok, false, 'exit 0 without the ##DONE marker is not a pass');
  const down = fakeDocker({ version: { status: 1, stderr: 'Cannot connect to the Docker daemon' } });
  const none = runParity('repo', parityDeps(t, down));
  assert.equal(none.ok, false);
  assert.match(none.why, /no docker daemon answers/);
  assert.equal(down.calls.run.length, 0);
  const nowhere = runParity('repo', parityDeps(t, fakeDocker(), { archive: () => ({ ok: false, error: 'not a git repository' }) }));
  assert.match(nowhere.why, /git archive HEAD failed/);
  const empty = runParity('repo', parityDeps(t, fakeDocker(), { workflows: () => [] }));
  assert.match(empty.why, /nothing proves Linux parity/);
});

/** A fake gate + docker for the Sonar supplier: container states by name, and a status that reports UP after `upAfter` polls. */
function fakeSonar({ states, upAfter = 0, scan = 0, dashboard = 0, startStatus = 0 } = {}) {
  const log = [];
  let polls = 0;
  const state = { ...states };
  return {
    log,
    state,
    deps: {
      stackOf: () => ({ docker: 'docker', containers: ['starci-sonarqube-postgres', 'starci-sonarqube'] }),
      docker: {
        inspect: (name) => (state[name] === 'missing' ? { status: 1, stderr: 'no such container' } : { status: 0, stdout: state[name] }),
        start: (names) => { log.push(['start', ...names]); if (startStatus === 0) for (const n of names) state[n] = 'running'; return { status: startStatus, stderr: 'boom' }; },
        stop: (names) => { log.push(['stop', ...names]); for (const n of names) state[n] = 'exited'; return { status: 0 }; },
      },
      run: (args) => {
        log.push(['gate', args[0]]);
        if (args[0] === 'status') return { status: polls++ >= upAfter ? 0 : 2, stdout: '' };
        return { status: args[0] === 'scan' ? scan : dashboard, stdout: `{"outcome":"x"}`, stderr: '' };
      },
      sleep: () => {},
      now: (() => { let n = 0; return () => (n += 1000); })(),
      logDir: null,
    },
  };
}
const APP = { name: 'shop', dir: path.join(os.tmpdir(), 'x', 'examples', 'shop') };

test('sonar: a stopped stack is started (database first), waited for until UP, scanned against the project gate, the dashboard read, and stopped again; nothing else is named', (t) => {
  const fake = fakeSonar({ states: { 'starci-sonarqube-postgres': 'exited', 'starci-sonarqube': 'exited' }, upAfter: 2 });
  fake.deps.logDir = () => tmp(t, 'sonar');
  const { proofs, close } = sonarSupplier([APP], fake.deps);
  const proof = proofs['shop: sonar']();
  assert.equal(proof.ok, true);
  assert.ok(fs.existsSync(proof.log));
  assert.deepEqual(fake.log, [['start', 'starci-sonarqube-postgres', 'starci-sonarqube'], ['gate', 'status'], ['gate', 'status'], ['gate', 'status'], ['gate', 'scan'], ['gate', 'dashboard']]);
  assert.deepEqual(close().stopped, ['starci-sonarqube', 'starci-sonarqube-postgres'], 'the server stops before its database');
  assert.deepEqual(fake.state, { 'starci-sonarqube-postgres': 'exited', 'starci-sonarqube': 'exited' }, 'left as found');
  assert.deepEqual(fake.log.slice(-1), [['stop', 'starci-sonarqube', 'starci-sonarqube-postgres']]);
});

test('sonar: a stack that was running is left running; only the stopped container this run started is stopped again', (t) => {
  const running = fakeSonar({ states: { 'starci-sonarqube-postgres': 'running', 'starci-sonarqube': 'running' } });
  running.deps.logDir = () => tmp(t, 'sonar');
  const a = sonarSupplier([APP], running.deps);
  assert.equal(a.proofs['shop: sonar']().ok, true);
  assert.deepEqual(a.close().stopped, []);
  assert.ok(!running.log.some(([verb]) => verb === 'start' || verb === 'stop'), 'a running stack is never started or stopped');
  const half = fakeSonar({ states: { 'starci-sonarqube-postgres': 'running', 'starci-sonarqube': 'exited' } });
  half.deps.logDir = () => tmp(t, 'sonar');
  const b = sonarSupplier([APP], half.deps);
  assert.equal(b.proofs['shop: sonar']().ok, true);
  assert.deepEqual(half.log.filter(([verb]) => verb !== 'gate'), [['start', 'starci-sonarqube']]);
  assert.deepEqual(b.close().stopped, ['starci-sonarqube']);
  assert.equal(half.state['starci-sonarqube-postgres'], 'running', 'the database stays up');
});

test('sonar: a red scan fails the proof without reading the dashboard; a missing container, a failed start and a server that never comes up fail it, and close still puts back what was started', (t) => {
  const red = fakeSonar({ states: { 'starci-sonarqube-postgres': 'running', 'starci-sonarqube': 'running' }, scan: 1 });
  red.deps.logDir = () => tmp(t, 'sonar');
  const a = sonarSupplier([APP], red.deps);
  assert.equal(a.proofs['shop: sonar']().ok, false);
  assert.ok(!red.log.some(([, what]) => what === 'dashboard'));
  const missing = fakeSonar({ states: { 'starci-sonarqube-postgres': 'missing', 'starci-sonarqube': 'exited' } });
  missing.deps.logDir = () => tmp(t, 'sonar');
  const b = sonarSupplier([APP], missing.deps);
  const miss = b.proofs['shop: sonar']();
  assert.equal(miss.ok, false);
  assert.match(fs.readFileSync(miss.log, 'utf8'), /starci-sonarqube-postgres is missing/);
  assert.ok(!missing.log.some(([verb]) => verb === 'start'), 'nothing is started when a part of the stack does not exist');
  const failed = fakeSonar({ states: { 'starci-sonarqube-postgres': 'exited', 'starci-sonarqube': 'exited' }, startStatus: 1 });
  failed.deps.logDir = () => tmp(t, 'sonar');
  const c = sonarSupplier([APP], failed.deps);
  assert.equal(c.proofs['shop: sonar']().ok, false);
  c.close();
  assert.deepEqual(failed.log.at(-1), ['stop', 'starci-sonarqube', 'starci-sonarqube-postgres'], 'a half-started stack is stopped again');
  const never = fakeSonar({ states: { 'starci-sonarqube-postgres': 'exited', 'starci-sonarqube': 'exited' }, upAfter: 10_000 });
  never.deps.logDir = () => tmp(t, 'sonar');
  never.deps.readyMs = 30_000;
  const d = sonarSupplier([APP], never.deps);
  const slow = d.proofs['shop: sonar']();
  assert.equal(slow.ok, false);
  assert.match(fs.readFileSync(slow.log, 'utf8'), /did not report UP/);
  assert.deepEqual(d.close().stopped, ['starci-sonarqube', 'starci-sonarqube-postgres']);
});

test('L4: the installs run first as a real npm ci (a node_modules link is removed as a link first, a missing lockfile is absent), the Sonar supplier closes after the proofs even when a step throws, and the Linux step ends the row', (t) => {
  const base = tmp(t, 'wire');
  fs.writeFileSync(path.join(base, 'package.json'), JSON.stringify({ name: 'rt', scripts: { test: 'x', check: 'x' } }));
  for (const [name, lock] of [['shop', true], ['blog', false]]) {
    const dir = path.join(base, 'examples', name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'hfs.json'), JSON.stringify({ kind: 'app' }));
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name, scripts: {} }));
    if (lock) fs.writeFileSync(path.join(dir, 'package-lock.json'), '{}');
  }
  const plan = planL4(base, { runtimeRoot: base });
  assert.deepEqual(plan.steps.slice(0, 2).map((s) => [s.name, s.absent ?? false]), [['blog: npm ci', true], ['shop: npm ci', false]], 'the installs come first');
  assert.deepEqual(plan.steps[1].args, ['ci', '--no-audit', '--no-fund']);
  assert.equal(plan.linux, true);
  const order = [];
  const unlinked = [];
  let closed = 0;
  const supplier = { proofs: { 'blog: sonar': () => { order.push('sonar blog'); return { ok: true, log: 'b' }; }, 'shop: sonar': () => { order.push('sonar shop'); return { ok: true, log: 's' }; } }, close: () => { closed += 1; } };
  const out = runL4(base, {
    plan, supplier, unlink: (dir) => { unlinked.push(path.basename(dir)); return true; },
    step: (s) => { order.push(s.name); return { ok: true, log: 'x', ms: 1, text: '' }; },
    parity: () => { order.push('parity'); return { name: 'linux-parity', ok: true, log: 'p', ms: 1, skips: [] }; },
  });
  assert.equal(order[0], 'shop: npm ci');
  assert.deepEqual(unlinked, ['shop'], 'the link guard runs before the install, only for a runnable install');
  assert.deepEqual(order.slice(-3), ['sonar blog', 'sonar shop', 'parity']);
  assert.equal(out.at(-1).name, 'linux-parity');
  assert.equal(closed, 1);
  assert.deepEqual(out.find((s) => s.name === 'blog: npm ci').absent, true);
  assert.throws(() => runL4(base, { plan, supplier, unlink: () => true, parity: null, step: () => { throw new Error('step blew up'); } }), /step blew up/);
  assert.equal(closed, 2, 'the stack is put back even when a step throws');
  const stuck = runL4(base, { plan, supplier, unlink: () => false, parity: null, step: () => ({ ok: true, log: 'x', ms: 1, text: '' }) });
  assert.deepEqual([stuck.find((s) => s.name === 'shop: npm ci').ok, stuck.find((s) => s.name === 'shop: npm ci').why], [false, 'a node_modules link could not be removed']);
});

test('the cut runs the default L4 row with its wiring: a red Linux step is a red suite and blocks the cut; the heavy part runs inside the host lock', (t) => {
  const base = tmp(t, 'cut');
  const calls = [];
  const steps = [{ name: 'npm test', ok: true, log: 'a', ms: 1, skips: [] }, { name: 'linux-parity', ok: false, log: 'p.log', ms: 1, skips: [] }];
  const fakeGit = ([verb, ...args]) => {
    if (verb === 'symbolic-ref') return { ok: true, stdout: 'main', stderr: '' };
    if (verb === 'status') return { ok: true, stdout: '', stderr: '' };
    if (verb === 'rev-parse') return { ok: true, stdout: 'abc', stderr: '' };
    if (verb === 'tag') return { ok: true, stdout: '', stderr: '' };
    if (verb === 'ls-remote') return { ok: true, stdout: '', stderr: '' };
    throw new Error(`unexpected git ${verb} ${args.join(' ')}`);
  };
  const changelog = '## [1.0.0-alpha.4] - 2026-10-04\n\n- done\n';
  const out = cutRelease({ repo: base, tag: 'v1.0.0-alpha.4', deps: { git: fakeGit, changelog: () => changelog, lock: (work) => { calls.push('lock'); return work(); }, suite: () => steps, push: () => { throw new Error('never pushed'); } } });
  assert.deepEqual([out.ok, out.verdict], [false, 'suite-red']);
  assert.match(out.why, /linux-parity red/);
  assert.deepEqual(calls, ['lock']);
});
