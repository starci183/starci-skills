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
import { stepEnv } from '../../scripts/supervisor/release-l4-layers.mjs';
import { exampleApps, passesOf, planL4, runL4, runtimeSpecStep, scriptsOf, sectionOf, skipReport, specEnv, specFilesFor } from '../../scripts/supervisor/release-l4.mjs';
import { testWorldDistProblem } from '../helpers/test-world-dist.mjs';
import { cutRelease } from '../../scripts/supervisor/release-cut.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const NODE_TEST = 'node --import ./tests/setup/low-priority.mjs --import ./tests/setup/isolated-temp.mjs --import ./tests/setup/isolated-registry.mjs --import ./tests/setup/runtime-copies.mjs --test "tests/**/*.spec.mjs"';
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
      { name: 'starci app lint', 'working-directory': '.', run: 'npm run starci --silent -- app lint --cwd "$APP_DIR"' },
      { name: 'Unit', run: 'npm test -- --ci' },
      { name: 'Integration', if: "${{ github.event_name == 'workflow_dispatch' }}", run: 'npm run test:integration -- --ci' },
      { name: 'Build', run: 'npm run build:be' },
    ] },
    browser: { if: "${{ github.event_name == 'workflow_dispatch' }}", steps: [{ run: 'npm run test:browser' }] },
    release: { if: "${{ startsWith(github.ref, 'refs/tags/v') }}", steps: [{ name: 'Create the GitHub Release', run: 'gh release create "$TAG"' }] },
    images: { steps: [{ uses: 'docker/build-push-action@v6' }, { name: 'Image', run: 'docker build .' }] },
  } } },
];

test('the parity plan is derived from the workflows: one run per example app, the root install once, the spec suites and the manual, upload, docker, browser and plumbing steps left out with a reason', () => {
  const plan = parityPlan({ workflows: WORKFLOWS, apps: ['shop', 'blog'] });
  assert.equal(plan.image, 'node:22-trixie', 'the image carries a git as new as the CI runner has');
  assert.deepEqual(plan.steps.map((s) => [s.dir, s.run]), [
    ['.', 'npm ci'], ['packages/grammar', 'npm ci\nnpm run build'], ['.', 'npm run check'],
    ['examples/shop', 'npm ci'], ['examples/shop', 'npm run typecheck'], ['.', 'npm run starci --silent -- app lint --cwd "$APP_DIR"'], ['examples/shop', 'npm run build:be'],
    ['examples/blog', 'npm ci'], ['examples/blog', 'npm run typecheck'], ['.', 'npm run starci --silent -- app lint --cwd "$APP_DIR"'], ['examples/blog', 'npm run build:be'],
  ]);
  const lint = plan.steps.filter((s) => s.name.includes('starci app lint'));
  assert.deepEqual(lint.map((s) => s.env.APP_DIR), ['examples/shop', 'examples/blog'], 'the job env reaches the step, per app');
  assert.ok(plan.steps.every((s) => !('SONAR_TOKEN' in s.env)), 'a secret never reaches the container');
  const reasons = Object.fromEntries(plan.skipped.map((s) => [s.name.replace(/^.*?: /, ''), s.reason]));
  assert.match(reasons['Test suite'], /spec suite/);
  assert.match(reasons.Upload, /manual or tag-upload/);
  assert.match(reasons.Integration, /manual or tag-upload/);
  assert.match(reasons.Unit, /spec suite/);
  assert.match(reasons.Image, /docker/);
  assert.match(plan.skipped.find((s) => s.name.endsWith('browser')).reason, /manual or tag-only job/);
  assert.match(plan.skipped.find((s) => s.name.endsWith(':release')).reason, /tag-only job/, 'the GitHub Release job runs only on a pushed tag, never in the parity container');
  assert.equal(plan.steps.some((s) => s.name.includes('GitHub Release')), false);
  assert.match(plan.skipped.find((s) => s.name.includes('GITHUB_OUTPUT') || s.name.includes('apps=')).reason, /plumbing/);
});

test('the repository\'s own workflows give a plan that holds the full check set, the per-app typecheck, starci app lint and builds, and no spec suite', () => {
  const plan = parityPlan({ workflows: readWorkflows(ROOT), apps: exampleApps(ROOT).map((a) => a.name) });
  const runs = plan.steps.map((s) => `${s.dir}: ${s.run.split('\n').join(' && ')}`);
  for (const expected of ['.: npm run check', '.: npm run starci --silent -- release clean-test']) assert.ok(runs.includes(expected), expected);
  for (const app of exampleApps(ROOT).map((a) => a.name)) {
    for (const cmd of ['npm ci --ignore-scripts', 'npm run typecheck', 'npm run build:be', 'npm run build:fe']) assert.ok(runs.includes(`examples/${app}: ${cmd}`), `${app}: ${cmd}`);
  }
  assert.ok(runs.some((r) => r.startsWith('.: npm run starci --silent -- app lint')), 'starci app lint');
  assert.ok(!runs.some((r) => /: npm (?:run )?test(?::\w+)?(?: -- .*)?$/.test(r) && !r.startsWith('packages/grammar')), 'no spec suite');
  assert.ok(!runs.some((r) => /docker|playwright/.test(r)), 'no docker or browser step');
});

test('the parity script extracts HEAD from the read-only tar, snapshots it as a git repository, runs each step with its env and marks each step', () => {
  const script = parityScript(parityPlan({ workflows: WORKFLOWS, apps: ['shop'] }));
  assert.match(script, /tar -xf \/in\/src\.tar -C \/opt\/starci-parity\/checkout/);
  assert.match(script, /cd "\/opt\/starci-parity\/checkout\/\$dir"/);
  assert.match(script, /git init -q && git add -A && git -c user\.name=starci/);
  assert.match(script, /run_step 'examples\.yml:app\[shop\]: starci app lint' '\.' <<'__STEP_\d+__'\nexport NODE_VERSION='22'\nexport APP_DIR='examples\/shop'\nnpm run starci/);
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

test('parity: a green container run is ok; the repository is mounted read-only, no port or network is given, and only its own named container is removed', async (t) => {
  const docker = fakeDocker();
  const out = runParity('repo', parityDeps(t, docker));
  assert.deepEqual([out.name, out.ok, out.image], ['linux-parity', true, 'node:22-trixie'], JSON.stringify(out));
  const [{ args }] = docker.calls.run;
  assert.ok(args.includes('--mount') && args.some((a) => /^type=bind,source=.+,target=\/in,readonly$/.test(a)), 'the mount is read-only');
  assert.ok(!args.some((a) => /^(-p|--publish|--network|--net|-v|--volume|--privileged)$/.test(a)), 'no port, host network, volume or privilege');
  assert.equal(args[args.indexOf('--name') + 1], docker.calls.rm[0], 'it removes exactly the container it named');
  assert.match(docker.calls.rm[0], /^starci-l4-parity-/, 'never a container of anything else');
  assert.deepEqual(args.slice(-3), ['node:22-trixie', 'bash', '/in/parity.sh']);
  assert.ok(fs.existsSync(out.log) && out.skipped.length > 0 && out.steps.length > 0);
});

test('parity: a red step fails the row and names the step; a container that dies before the last step is red; no docker daemon is red and never runs', async (t) => {
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

test('L4: the installs run first as a real npm ci (a node_modules link is removed as a link first, a missing lockfile is absent), the Sonar supplier closes after the proofs even when a step throws, and the Linux step ends the row', async (t) => {
  const base = tmp(t, 'wire');
  fs.writeFileSync(path.join(base, 'package.json'), JSON.stringify({ name: 'rt', scripts: { test: NODE_TEST, check: 'x' } }));
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
  const out = (await runL4(base, {
    plan, supplier, unlink: (dir) => { unlinked.push(path.basename(dir)); return true; },
    step: (s) => { order.push(s.name); return { ok: true, log: 'x', ms: 1, text: '' }; },
    parity: () => { order.push('parity'); return { name: 'linux-parity', ok: true, log: 'p', ms: 1, skips: [] }; },
  }));
  assert.equal(order[0], 'shop: npm ci');
  assert.deepEqual(unlinked, ['shop'], 'the link guard runs before the install, only for a runnable install');
  assert.deepEqual(order.slice(-3), ['sonar blog', 'sonar shop', 'parity']);
  assert.equal(out.at(-1).name, 'linux-parity');
  assert.equal(closed, 1);
  assert.deepEqual(out.find((s) => s.name === 'blog: npm ci').absent, true);
  await assert.rejects(() => runL4(base, { plan, supplier, unlink: () => true, parity: null, step: () => { throw new Error('step blew up'); } }), /step blew up/);
  assert.equal(closed, 2, 'the stack is put back even when a step throws');
  const stuck = (await runL4(base, { plan, supplier, unlink: () => false, parity: null, step: () => ({ ok: true, log: 'x', ms: 1, text: '' }) }));
  assert.deepEqual([stuck.find((s) => s.name === 'shop: npm ci').ok, stuck.find((s) => s.name === 'shop: npm ci').why], [false, 'a node_modules link could not be removed']);
});

test('L4: the runtime spec step runs on the example installs with STARCI_REQUIRE_APP_INSTALLS=1, so a scaffold spec fails instead of skipping; no other step carries that env', async (t) => {
  const base = tmp(t, 'specenv');
  fs.writeFileSync(path.join(base, 'package.json'), JSON.stringify({ name: 'rt', scripts: { test: NODE_TEST, check: 'x' } }));
  for (const name of ['shop', 'blog']) {
    const dir = path.join(base, 'examples', name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'hfs.json'), JSON.stringify({ kind: 'app' }));
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name, scripts: {} }));
    fs.writeFileSync(path.join(dir, 'package-lock.json'), '{}');
  }
  const apps = exampleApps(base);
  const plan = planL4(base, { runtimeRoot: base });
  const spec = plan.steps.find((s) => s.name === 'npm test');
  assert.deepEqual(spec.env, specEnv(apps));
  assert.equal(spec.env.STARCI_REQUIRE_APP_INSTALLS, '1');
  assert.deepEqual(spec.env.STARCI_APP_INSTALLS.split(path.delimiter), apps.map((a) => path.join(a.dir, 'node_modules')), 'every example install, in example order');
  assert.deepEqual(plan.steps.filter((s) => s.env).map((s) => s.name), ['npm test'], 'only the spec run is handed the env');
  const seen = {};
  await runL4(base, { plan, supplier: { proofs: {}, close: () => {} }, unlink: () => true, parity: null, step: (s, o) => { seen[s.name] = o.env; return { ok: true, log: 'x', ms: 1, text: '' }; } });
  assert.equal(seen['npm test'].STARCI_REQUIRE_APP_INSTALLS, '1');
  assert.ok(Object.keys(seen['npm test']).length > 2, 'the process env is kept under the two variables');
  assert.equal(seen['npm run check'], undefined, 'the other steps run on the default env');
});

test('L4: a fresh CPU and RAM decision reaches the actual runtime process after installs; the package leg is unchanged and the decision is recorded', async (t) => {
  const base = tmp(t, 'concurrency');
  fs.writeFileSync(path.join(base, 'package.json'), JSON.stringify({ scripts: { test: NODE_TEST } }));
  const plan = { steps: [
    { name: 'app: npm ci', cmd: 'npm', args: ['ci'], cwd: base, install: true },
    { name: 'npm test', cmd: 'npm', args: ['test'], cwd: base, env: specEnv([]), evidence: true },
    { name: 'package: npm test', cmd: 'npm', args: ['test'], cwd: base },
  ], proofs: [], linux: false };
  const events = [], seen = [];
  let probes = 0;
  const run = () => runL4(base, {
    plan, proofs: {}, unlink: () => true, parity: null,
    concurrencyDeps: { hostSample: () => {
      events.push('probe');
      probes += 1;
      return { logicalThreads: 12, cpuBusy: probes === 1 ? 0.25 : 0.75, totalRamBytes: 32 * 1024 ** 3, freeRamBytes: 12 * 1024 ** 3 };
    } },
    step: (s, options) => {
      events.push(s.name);
      seen.push({ step: s, options });
      const log = path.join(base, `${seen.length}.log`);
      fs.writeFileSync(log, '✔ runtime proof (1ms)\n');
      return { ok: true, log, ms: 1, text: '✔ runtime proof (1ms)\n' };
    },
  });
  const first = await run();
  assert.deepEqual(events, ['app: npm ci', 'probe', 'npm test', 'package: npm test']);
  assert.equal(probes, 1, 'exactly one fresh probe for the actual runtime spec process');
  assert.equal(seen[1].step.cmd, 'node');
  assert.deepEqual(seen[1].step.args, [
    '--import', './tests/setup/low-priority.mjs', '--import', './tests/setup/isolated-temp.mjs',
    '--import', './tests/setup/isolated-registry.mjs', '--import', './tests/setup/runtime-copies.mjs',
    '--test', '--test-concurrency=4', 'tests/**/*.spec.mjs',
  ], 'the owning script retains its actual preloads and glob, with the selected limit before file arguments');
  assert.equal(seen[1].options.env.STARCI_REQUIRE_ORCA_LIVE, '1');
  assert.equal(seen[2].step, plan.steps[2], 'the existing package leg receives its original command');
  assert.deepEqual(first[1].command, { cmd: 'node', args: seen[1].step.args });
  assert.equal(first[1].concurrency.concurrency, 4);
  assert.deepEqual(first[1].passes, ['runtime proof']);
  assert.match(fs.readFileSync(first[1].log, 'utf8'), /\[concurrency\]\n\{"concurrency":4,"mode":"auto"/);
  const second = await run();
  assert.equal(probes, 2, 'a later spec start samples again instead of reusing the first budget');
  assert.ok(seen[4].step.args.includes('--test-concurrency=1'));
  assert.equal(second[1].concurrency.concurrency, 1);
});

test('L4: the test script of the runtime repository binds - no lifecycle hook, one direct Node command', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const bound = runtimeSpecStep(root, { cmd: 'npm', args: ['test'] }, { concurrency: 4 });
  assert.equal(typeof bound.cmd, 'string');
  assert.ok(bound.args.some((word) => String(word).includes('tests/**/*.spec.mjs')), 'the bound command keeps the suite selection');
});

test('L4: runtime binding fails closed for shell commands, lifecycle hooks, and a script that overrides the host budget', (t) => {
  const base = tmp(t, 'script');
  const bind = (scripts) => {
    fs.writeFileSync(path.join(base, 'package.json'), JSON.stringify({ scripts }));
    return runtimeSpecStep(base, { cmd: 'npm', args: ['test'] }, { concurrency: 4 });
  };
  assert.throws(() => bind({ test: 'node --test "tests/**/*.spec.mjs" && echo done' }), /without shell composition/);
  assert.throws(() => bind({ test: 'node --test\necho done' }), /shell line breaks/);
  assert.throws(() => bind({ test: NODE_TEST, pretest: 'node setup.mjs' }), /lifecycle hooks/);
  assert.throws(() => bind({ test: NODE_TEST, posttest: 'node cleanup.mjs' }), /lifecycle hooks/);
  assert.throws(() => bind({ test: 'node --test --test-concurrency=2 "tests/**/*.spec.mjs"' }), /release host budget/);
  assert.throws(() => bind({ test: 'node --test --test-isolation=none "tests/**/*.spec.mjs"' }), /release host budget/);
  assert.throws(() => bind({ test: 'echo test' }), /direct node --test command/);
});

test('L4: a lite app is planned without the test scripts it cannot have, a full app that lacks one is absent and fails the row, and the edition comes from hfs.json', (t) => {
  const base = tmp(t, 'lite');
  fs.writeFileSync(path.join(base, 'package.json'), JSON.stringify({ name: 'rt', scripts: { test: NODE_TEST, check: 'x' } }));
  const lite = ['codegen', 'typecheck', 'lint', 'format:check', 'build:be', 'build:fe', 'docker:build'];
  const full = [...lite, 'typecheck:tests', 'test', 'test:contract', 'test:integration', 'test:e2e'];
  for (const [name, edition, scripts] of [['tiny', 'lite', lite], ['big', undefined, full.filter((s) => s !== 'test:e2e')]]) {
    const dir = path.join(base, 'examples', name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'hfs.json'), JSON.stringify({ kind: 'app', ...(edition ? { edition } : {}) }));
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name, scripts: Object.fromEntries(scripts.map((s) => [s, 'x'])) }));
    fs.writeFileSync(path.join(dir, 'package-lock.json'), '{}');
  }
  for (const layer of ['contract', 'integration', 'e2e']) {
    const folder = path.join(base, 'examples', 'big', 'be', 'src', 'tests', layer);
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, `one.${layer}-spec.ts`), '');
  }
  assert.deepEqual(exampleApps(base).map((a) => [a.name, a.edition]), [['big', 'full'], ['tiny', 'lite']]);
  const plan = planL4(base, { runtimeRoot: base });
  const rows = (app) => plan.steps.filter((s) => s.name.startsWith(`${app}: npm run `)).map((s) => [s.name.replace(`${app}: npm run `, ''), s.absent ?? false]);
  assert.deepEqual(rows('tiny'), lite.map((s) => [s, false]), 'the lite row has the seven scripts and no absent step');
  assert.deepEqual(rows('big').filter(([, absent]) => absent), [['test:e2e', true]], 'a full app that lacks a script is absent, never skipped by silence');
  assert.equal(rows('big').length, 12);
  assert.deepEqual(scriptsOf({ edition: 'full' }).length, 12);
  assert.deepEqual(plan.notPlanned, [], 'an app that holds a spec file in every layer has every row');
});

test('L4: a full app is planned only the test rows its files can run, each omission is named with its reason, and a layer that holds a spec file keeps its row', (t) => {
  const base = tmp(t, 'layers');
  fs.writeFileSync(path.join(base, 'package.json'), JSON.stringify({ name: 'rt', scripts: { test: NODE_TEST, check: 'x' } }));
  const dir = path.join(base, 'examples', 'slim');
  fs.mkdirSync(path.join(dir, 'be', 'src', 'tests'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'hfs.json'), JSON.stringify({ kind: 'app' }));
  fs.writeFileSync(path.join(dir, 'package-lock.json'), '{}');
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'slim', scripts: Object.fromEntries(scriptsOf({ edition: 'full' }).map((script) => [script, 'x'])) }));
  fs.writeFileSync(path.join(dir, 'be', 'src', 'tests', 'tsconfig.json'), '{}');
  const rows = () => planL4(base, { runtimeRoot: base }).steps.filter((s) => s.name.startsWith('slim: npm run ')).map((s) => s.name.replace('slim: npm run ', ''));
  const bare = planL4(base, { runtimeRoot: base });
  assert.deepEqual(rows().filter((row) => row.startsWith('test') || row === 'typecheck:tests'), ['test'], 'unit is the only test row of an app without a test file');
  assert.deepEqual(bare.notPlanned.map((row) => row.name), ['slim: npm run typecheck:tests', 'slim: npm run test:contract', 'slim: npm run test:integration', 'slim: npm run test:e2e']);
  assert.ok(bare.notPlanned.every((row) => row.why.includes('holds no')), 'each omission says why');
  fs.mkdirSync(path.join(dir, 'be', 'src', 'tests', 'e2e', 'area'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'be', 'src', 'tests', 'e2e', 'area', 'flow.e2e-spec.ts'), '');
  assert.deepEqual(rows().filter((row) => row.startsWith('test') || row === 'typecheck:tests'), ['typecheck:tests', 'test', 'test:e2e'], 'one spec file brings its layer and the tests typecheck back');
  const plan = planL4(base, { runtimeRoot: base });
  assert.deepEqual(plan.notPlanned.map((row) => row.name), ['slim: npm run test:contract', 'slim: npm run test:integration']);
  assert.ok(plan.steps.filter((s) => s.name.startsWith('slim: npm run ')).every((s) => s.nextBuild === true), 'every example script runs with the SWC cache env');
});

test('L4: a step that builds a Next app runs with the SWC cache and telemetry off over its own env, any other step with its own env only', (t) => {
  const cache = path.join(tmp(t, 'swc'), 'cache');
  const env = stepEnv({ nextBuild: true, env: { KEEP: 'a' } }, { STARCI_SWC_CACHE: cache, BASE: 'b' });
  assert.equal(env.SWC_NATIVE_BINDING_CACHE, cache);
  assert.equal(env.NEXT_TELEMETRY_DISABLED, '1');
  assert.deepEqual([env.KEEP, env.BASE], ['a', 'b']);
  assert.deepEqual(stepEnv({ env: { KEEP: 'a' } }, { BASE: 'b' }), { BASE: 'b', KEEP: 'a' });
});

test('evidence rule: the log readers know the passed tests of both reporters and the part of the container log one step printed', () => {
  const spec = '✔ bash completion has valid syntax (43ms)\n﹣ zsh completion has valid syntax (0.1ms) # zsh binary is unavailable\n  ✔ nested pass (1.5ms)\n✖ red one (2ms)\n';
  assert.deepEqual(passesOf(spec), ['bash completion has valid syntax', 'nested pass']);
  assert.deepEqual(passesOf('ok 1 - fine\nok 2 - skipped one # SKIP no shell\nnot ok 3 - broken\nok 4 - later # TODO later\n    ok 5 - nested fine\n'), ['fine', 'nested fine']);
  const log = '##STEP linux-parity: install\nnpm ok\n##STEP linux-specs: 2 spec file(s) the host run skipped tests of\n✔ zsh completion has valid syntax (3ms)\n﹣ x (1ms) # no powershell\n##STEP later\nafter\n##DONE\n';
  assert.equal(sectionOf(log, 'linux-specs'), '✔ zsh completion has valid syntax (3ms)\n﹣ x (1ms) # no powershell');
  assert.equal(sectionOf(log, 'absent'), '');
  assert.equal(sectionOf('##STEP linux-specs: last\nlast line\n##DONE', 'linux-specs'), 'last line');
});

test('evidence rule: a skip that passed in another leg is covered and listed with where; a declared skip stays declared; a skip no leg ran, or one that only passed in its own step, fails', () => {
  const steps = [
    { name: 'npm test', ok: true, skips: [{ name: 'zsh completion has valid syntax', reason: 'zsh binary is unavailable' }, { name: 'symlinked log', reason: 'EPERM' }, { name: 'draw-layer paints', reason: 'no browser' }, { name: 'only here', reason: 'no docker' }, { name: 'same name', reason: 'x' }], passes: ['bash ok', 'same name', 'PowerShell parse'] },
    { name: 'linux-parity', ok: true, skips: [{ name: 'PowerShell parse', reason: 'powershell.exe is unavailable' }], passes: ['zsh completion has valid syntax', 'symlinked log'] },
  ];
  const report = skipReport(steps);
  assert.deepEqual(report.covered, [
    { name: 'zsh completion has valid syntax', skippedIn: 'npm test', passedIn: 'linux-parity' },
    { name: 'symlinked log', skippedIn: 'npm test', passedIn: 'linux-parity' },
    { name: 'PowerShell parse', skippedIn: 'linux-parity', passedIn: 'npm test' },
  ], 'each leg covers the other');
  assert.deepEqual(report.declared, ['draw-layer paints']);
  assert.deepEqual(report.failures.map((k) => [k.name, k.class]), [['only here', 'infrastructure'], ['same name', 'undeclared']], 'a pass in the skipping step itself is no second leg');
});

test('the parity script runs the host-skipped spec files after the planned steps with the shells installed inside the container only; no spec step without files', () => {
  const plan = { image: 'node:22', steps: [{ name: 'ci: Install', dir: '.', run: 'npm ci', env: {} }], skipped: [] };
  const without = parityScript(plan);
  assert.ok(!without.includes('apt-get') && !without.includes('linux-specs'));
  const script = parityScript({ ...plan, specs: ['tests/cli/completions.spec.mjs', "tests/it's/odd.spec.mjs"] });
  assert.ok(script.indexOf('run_step \'ci: Install\'') < script.indexOf('linux-specs: 2 spec file(s)'), 'after the planned steps');
  assert.ok(script.indexOf('linux-specs') < script.indexOf('echo "##DONE"'), 'before the done marker');
  assert.match(script, /apt-get install -y -qq zsh fish/);
  assert.match(script, /node --import \.\/tests\/setup\/low-priority\.mjs --import \.\/tests\/setup\/isolated-temp\.mjs --import \.\/tests\/setup\/isolated-registry\.mjs --import \.\/tests\/setup\/runtime-copies\.mjs --test --test-reporter=spec 'tests\/cli\/completions\.spec\.mjs' 'tests\/it'\\''s\/odd\.spec\.mjs'/);
});

test('specFilesFor finds the spec files that hold a test title as literal text and names the titles it cannot find', (t) => {
  const base = tmp(t, 'files');
  const put = (file, text) => { fs.mkdirSync(path.dirname(path.join(base, file)), { recursive: true }); fs.writeFileSync(path.join(base, file), text); };
  put('tests/cli/completions.spec.mjs', "test('zsh completion has valid syntax', () => {});\ntest('fish completion has valid syntax', () => {});\n");
  put('tests/housekeeping/hk-logs.spec.mjs', "test('a symlinked log file is skipped, never deleted through', () => {});\ntest('it\\'s quoted', () => {});\n");
  put('tests/node_modules/x/ignored.spec.mjs', "test('zsh completion has valid syntax', () => {});\n");
  put('tests/helpers/not-a-spec.mjs', "zsh completion has valid syntax\n");
  const found = specFilesFor(base, ['zsh completion has valid syntax', 'a symlinked log file is skipped, never deleted through', "it's quoted", 'the packed ${name} loads']);
  assert.deepEqual(found.files, ['tests/cli/completions.spec.mjs', 'tests/housekeeping/hk-logs.spec.mjs']);
  assert.deepEqual(found.unmatched, ['the packed ${name} loads']);
  assert.deepEqual(specFilesFor(path.join(base, 'absent'), ['x']), { files: [], unmatched: ['x'] });
});

test('L4 evidence: the Linux leg is handed the spec files of the host run\'s skipped tests, its log is read back, and a test that ran in neither leg fails the row', async (t) => {
  const base = tmp(t, 'evidence');
  fs.writeFileSync(path.join(base, 'package.json'), JSON.stringify({ name: 'rt', scripts: { test: NODE_TEST, check: 'x' } }));
  fs.mkdirSync(path.join(base, 'tests', 'cli'), { recursive: true });
  fs.writeFileSync(path.join(base, 'tests', 'cli', 'completions.spec.mjs'), "test('zsh completion has valid syntax', () => {});\ntest('a title only the host skipped', () => {});\n");
  const plan = planL4(base, { runtimeRoot: base });
  const hostLog = '✔ bash completion has valid syntax (3ms)\n﹣ zsh completion has valid syntax (0.1ms) # zsh binary is unavailable\n﹣ a title only the host skipped (0.1ms) # no shell\n﹣ a template title 1 (0.1ms) # no shell\n';
  const seen = {};
  const leg = (passes) => (repo, deps) => {
    seen.specs = deps.specs;
    const log = path.join(base, 'parity.log');
    fs.writeFileSync(log, `##STEP linux-parity: install\nok\n##STEP linux-specs: ${deps.specs.length} spec file(s)\n${passes}\n##DONE\n`);
    return { name: 'linux-parity', ok: true, log, ms: 1, skips: [] };
  };
  const run = (parity) => runL4(base, { plan, supplier: { proofs: {}, close: () => {} }, unlink: () => true, parity, step: (s) => ({ ok: true, log: 'x', ms: 1, text: s.name === 'npm test' ? hostLog : '' }) });
  const out = await run(leg('✔ zsh completion has valid syntax (30ms)\n﹣ PowerShell parse (0.1ms) # powershell.exe is unavailable'));
  assert.deepEqual(seen.specs, ['tests/cli/completions.spec.mjs'], 'the files that hold the skipped titles, once');
  const linux = out.at(-1);
  assert.deepEqual([linux.passes, linux.skips.map((k) => k.name), linux.unmatched.sort()], [['zsh completion has valid syntax'], ['PowerShell parse'], ['a template title 1']]);
  const report = skipReport(out);
  assert.deepEqual(report.covered.map((c) => c.name), ['zsh completion has valid syntax']);
  assert.deepEqual(report.failures.map((k) => k.name).sort(), ['PowerShell parse', 'a template title 1', 'a title only the host skipped'], 'executed in no leg: the title the Linux run did not pass, the one nothing found, and the Linux-only skip no host pass covers');
  const quiet = await runL4(base, { plan, supplier: { proofs: {}, close: () => {} }, unlink: () => true, parity: () => ({ name: 'linux-parity', ok: true, log: null, ms: 1, skips: [] }), step: () => ({ ok: true, log: 'x', ms: 1, text: '✔ all fine (1ms)\n' }) });
  assert.deepEqual(quiet.at(-1).specs, [], 'no host skip, no spec step');
  assert.deepEqual(skipReport(quiet).failures, []);
});

test('the cut runs the default L4 row with its wiring: a red Linux step is a red suite and blocks the cut; the heavy part runs inside the host lock', async (t) => {
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
  const out = (await cutRelease({ repo: base, tag: 'v1.0.0-alpha.4', deps: { host: () => [], sonarCloud: async () => [], git: fakeGit, findings: () => [], changelog: () => changelog, lock: (work) => { calls.push('lock'); return work(); }, suite: () => steps, push: () => { throw new Error('never pushed'); } } }));
  assert.deepEqual([out.ok, out.verdict], [false, 'suite-red']);
  assert.match(out.why, /linux-parity red/);
  assert.deepEqual(calls, ['lock']);
});

test('L4: a test-world package in the checkout is built after the installs and before the runtime suite; a stale or absent build is named by the helper', (t) => {
  const base = tmp(t, 'testworld');
  fs.writeFileSync(path.join(base, 'package.json'), JSON.stringify({ name: 'rt', scripts: { test: NODE_TEST, check: 'x' } }));
  assert.equal(planL4(base, { runtimeRoot: base }).steps.some((s) => s.name === 'test-world: npm run build'), false, 'no package, no build step');
  const producer = path.join(base, 'packages', 'test-world');
  fs.mkdirSync(path.join(producer, 'src'), { recursive: true });
  fs.writeFileSync(path.join(producer, 'package.json'), JSON.stringify({ name: '@starci/test-world', types: 'dist/index.d.ts' }));
  fs.writeFileSync(path.join(producer, 'tsconfig.json'), '{}');
  fs.writeFileSync(path.join(producer, 'src', 'index.ts'), 'export {};\n');
  const names = planL4(base, { runtimeRoot: base }).steps.map((s) => s.name);
  assert.ok(names.indexOf('test-world: npm run build') >= 0 && names.indexOf('test-world: npm run build') < names.indexOf('npm test'), 'built before the suite that borrows it');
  assert.match(testWorldDistProblem(producer), /build is absent/);
  fs.mkdirSync(path.join(producer, 'dist'));
  const built = path.join(producer, 'dist', 'index.d.ts');
  fs.writeFileSync(built, 'export {};\n');
  const old = new Date(Date.now() - 60_000);
  fs.utimesSync(built, old, old);
  assert.match(testWorldDistProblem(producer), /older than its source/);
  fs.utimesSync(built, new Date(), new Date());
  assert.equal(testWorldDistProblem(producer), null);
});
