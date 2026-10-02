// examples-ci.spec.mjs - every example app runs in the ONE root workflow through a derived matrix and has a Codecov flag over
// the same coverage scope as its own codecov.yml, whose complement is its sonar.coverage.exclusions (scripts/checks/check-examples-ci.mjs, contract change examples-root-ci).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseYaml } from '../../engine/yaml.mjs';
import { APP_QUALITY_FILES, CODECOV, WORKFLOW, appCoverageScope, appQualityTargets, checkExamplesCi, examplesCiMain, exampleApps, exampleImages, renderCodecov } from '../../scripts/checks/check-examples-ci.mjs';
import { readProperties } from '../../scripts/lib/properties.mjs';
import { coverageScopeOf, coverageTargetOf } from '../../scripts/gates/sonar-gate.mjs';
import { braceVariants, globExpression } from '../../scripts/lib/glob.mjs';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const codes = (root) => checkExamplesCi(root).findings.map((finding) => finding.code).sort();

test('the repository: every example app is in the derived matrix and has a flag; the check is clean', () => {
  const apps = exampleApps(ROOT);
  assert.deepEqual(apps, ['ecommerce-app', 'shape-slot']);
  for (const app of apps) assert.equal(JSON.parse(fs.readFileSync(path.join(ROOT, 'examples', app, 'hfs.json'), 'utf8')).kind, 'app');
  assert.ok(!apps.includes('starcistacks-services'), 'a folder without an app hfs.json is not an app');
  assert.deepEqual(checkExamplesCi(ROOT).findings, []);
  const flags = parseYaml(fs.readFileSync(path.join(ROOT, CODECOV), 'utf8')).flag_management.individual_flags;
  assert.deepEqual(flags.map((flag) => flag.name), apps);
  const workflow = parseYaml(fs.readFileSync(path.join(ROOT, WORKFLOW), 'utf8'));
  assert.equal(workflow.jobs.app.strategy.matrix.app, '${{ fromJSON(needs.apps.outputs.apps) }}');
  for (const gone of ['example-unit.yml', 'todo-app-example.yml', 'todo-app-live-e2e.yml']) assert.ok(!fs.existsSync(path.join(ROOT, '.github', 'workflows', gone)), `${gone} is folded in`);
});

test('the root codecov flag of each app is its own codecov.yml scope under examples/<app>/ (one source, no drift)', () => {
  const flags = parseYaml(fs.readFileSync(path.join(ROOT, CODECOV), 'utf8')).flag_management.individual_flags;
  for (const app of exampleApps(ROOT)) {
    const own = parseYaml(fs.readFileSync(path.join(ROOT, 'examples', app, 'codecov.yml'), 'utf8')).coverage.status.project.default.paths;
    const flag = flags.find((entry) => entry.name === app);
    assert.deepEqual(flag.paths, own.map((glob) => `examples/${app}/${glob}`), `${app}: root flag = the app's own codecov.yml paths`);
    assert.deepEqual(flag.paths, appCoverageScope(app, ROOT));
  }
  const rules = parseYaml(fs.readFileSync(path.join(ROOT, CODECOV), 'utf8')).flag_management.default_rules.statuses;
  assert.deepEqual(rules.map((rule) => [rule.type, rule.target]), [['project', '100%'], ['patch', '100%']]);
});

test('every executable be file of each example is a service or matched by a Sonar coverage exclusion, never both, never neither; Sonar and Codecov describe one file set', () => {
  for (const app of exampleApps(ROOT)) {
    const dir = path.join(ROOT, 'examples', app);
    const props = readProperties(path.join(dir, 'sonar-project.properties'));
    assert.ok(!('sonar.coverage.inclusions' in props), `${app}: Sonar has no coverage inclusions`);
    const excluded = props['sonar.coverage.exclusions'].split(',').flatMap(braceVariants).map(globExpression);
    const services = parseYaml(fs.readFileSync(path.join(dir, 'codecov.yml'), 'utf8')).coverage.status.project.default.paths.map(globExpression);
    const files = execFileSync('git', ['ls-files', 'be'], { cwd: dir, encoding: 'utf8' }).trim().split('\n').filter((file) => /^be\/(?:src|apps)\/.*\.[cm]?[jt]sx?$/.test(file));
    assert.ok(files.length > 50, `${app}: the be tree is read`);
    const both = [], neither = [];
    for (const file of files) {
      const service = services.some((glob) => glob.test(file)), out = excluded.some((glob) => glob.test(file));
      if (service && out) both.push(file);
      if (!service && !out) neither.push(file);
    }
    assert.deepEqual(both, [], `${app}: a service is never excluded`);
    assert.deepEqual(neither, [], `${app}: every other executable be file is excluded`);
    // The runtime's own scope (what Sonar measures) is exactly the services Codecov judges.
    const target = coverageTargetOf(coverageScopeOf(props));
    assert.deepEqual(files.filter(target), files.filter((file) => services.some((glob) => glob.test(file))), `${app}: Sonar's coverage set = Codecov's`);
    // Only the unit-tested roles are measured: the services, and the cli commands of the cli feature root.
    assert.ok(files.filter(target).every((file) => file.endsWith('.service.ts') || (file.startsWith('be/src/features/cli/') && file.endsWith('.cli.ts'))));
    assert.ok(files.filter(target).some((file) => file.endsWith('.cli.ts')), `${app}: its cli commands are measured`);
    assert.ok(excluded.some((glob) => glob.test('fe/apps/web/src/app/page.tsx')), `${app}: fe/ is outside coverage`);
  }
});

test('integration and e2e run on workflow_dispatch only; the automatic steps hold coverage, the upload and Sonar', () => {
  const workflow = parseYaml(fs.readFileSync(path.join(ROOT, WORKFLOW), 'utf8'));
  assert.ok(workflow.on.push && workflow.on.pull_request && workflow.on.workflow_dispatch);
  const steps = workflow.jobs.app.steps;
  for (const layer of ['test:integration', 'test:e2e']) {
    const step = steps.find((entry) => String(entry.run ?? '').includes(layer));
    assert.match(step.if, /github\.event_name == 'workflow_dispatch'/, `${layer} is manual only`);
  }
  const upload = steps.find((entry) => String(entry.uses ?? '').startsWith('codecov/codecov-action@'));
  assert.equal(upload.with.flags, '${{ matrix.app }}');
  assert.match(upload.if, /env\.CODECOV_TOKEN != ''/);
  assert.ok(steps.some((entry) => /CODECOV_TOKEN is not set/.test(String(entry.run ?? '')) && /env\.CODECOV_TOKEN == ''/.test(entry.if)), 'a missing token is said in the log');
  assert.ok(steps.some((entry) => String(entry.uses ?? '').startsWith('SonarSource/sonarqube-scan-action')));
  assert.ok(steps.some((entry) => /no Sonar server is configured/.test(String(entry.run ?? ''))));
  assert.ok(steps.findIndex((entry) => entry.run === 'npm test -- --ci') < steps.indexOf(upload));
  const at = (run) => steps.findIndex((entry) => entry.run === run);
  assert.ok(at('npm run codegen --silent') >= 0 && at('npm run codegen --silent') < at('npm run typecheck') && at('npm run typecheck') < at('npm run build:fe'), 'codegen runs before the type-check and the fe build');
});

/** The hfs.json of a fixture example: one api app and one Next app. */
const declarationOf = (app) => JSON.stringify({ hfs: 2, kind: 'app', project: app, sides: { be: { apps: [{ name: 'core', kind: 'api' }, { name: 'cli', kind: 'cli' }] }, fe: { apps: [{ name: 'web', kind: 'next' }] } } });

/** A fixture runtime: the jest preset, the hfs sync it renders through, and examples/ with the given apps. */
function fixture(t, apps) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-examples-ci-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'packages', 'jest-preset'), { recursive: true });
  for (const file of fs.readdirSync(path.join(ROOT, 'packages', 'jest-preset')).filter((name) => name.endsWith('.cjs')))
    fs.copyFileSync(path.join(ROOT, 'packages', 'jest-preset', file), path.join(root, 'packages', 'jest-preset', file));
  for (const app of apps) {
    fs.mkdirSync(path.join(root, 'examples', app), { recursive: true });
    fs.writeFileSync(path.join(root, 'examples', app, 'hfs.json'), declarationOf(app));
  }
  fs.mkdirSync(path.join(root, 'examples', 'notes'), { recursive: true });
  fs.mkdirSync(path.join(root, '.github', 'workflows'), { recursive: true });
  fs.copyFileSync(path.join(ROOT, WORKFLOW), path.join(root, WORKFLOW));
  examplesCiMain(['--write'], { root, out: () => {} });
  return root;
}

test('a new example app is in the matrix at once, and the check fails until codecov.yml has its flag', (t) => {
  const root = fixture(t, ['alpha']);
  assert.deepEqual(codes(root), []);
  fs.mkdirSync(path.join(root, 'examples', 'beta'));
  fs.writeFileSync(path.join(root, 'examples', 'beta', 'hfs.json'), declarationOf('beta'));
  let printed = '';
  examplesCiMain(['--matrix'], { root, out: (s) => { printed += s; } });
  assert.deepEqual(JSON.parse(printed), ['alpha', 'beta'], 'derived, never listed');
  assert.deepEqual(codes(root), ['EXAMPLES_CI_APP_QUALITY_DRIFT', 'EXAMPLES_CI_APP_QUALITY_DRIFT', 'EXAMPLES_CI_CODECOV_DRIFT']);
  assert.equal(examplesCiMain([], { root, out: () => {} }), 1);
  examplesCiMain(['--write'], { root, out: () => {} });
  assert.deepEqual(codes(root), []);
  assert.match(renderCodecov(root), /- name: beta\n {6}paths:\n {8}- "examples\/beta\/be\/src\/\*\*\/\*\.service\.ts"/);
});

test('a hand-written matrix, a per-example workflow, an automatic e2e step and a missing manual trigger are refused', (t) => {
  const root = fixture(t, ['alpha']);
  const file = path.join(root, WORKFLOW);
  const original = fs.readFileSync(file, 'utf8');
  fs.writeFileSync(file, original.replace('app: ${{ fromJSON(needs.apps.outputs.apps) }}', 'app: [alpha]'));
  assert.deepEqual(codes(root), ['EXAMPLES_CI_MATRIX_NOT_DERIVED']);
  fs.writeFileSync(file, original.replace(/\n {8}if: \$\{\{ github\.event_name == 'workflow_dispatch' && contains\(inputs\.layers, 'e2e'\) \}\}/, ''));
  assert.deepEqual(codes(root), ['EXAMPLES_CI_STACK_LAYER_AUTOMATIC']);
  fs.writeFileSync(file, original.replace(/\n {2}workflow_dispatch:\n[\s\S]*?default: integration-and-e2e\n/, '\n'));
  assert.ok(codes(root).includes('EXAMPLES_CI_NO_MANUAL_TRIGGER'));
  fs.writeFileSync(file, original);
  fs.writeFileSync(path.join(root, '.github', 'workflows', 'alpha-e2e.yml'), 'name: alpha\njobs:\n  x:\n    steps:\n      - run: cd examples/alpha && npm test\n');
  assert.deepEqual(codes(root), ['EXAMPLES_CI_STRAY_WORKFLOW']);
});

test('every image of every example is derived from its hfs.json (one per be and fe app) and the images job builds from that output without pushing', (t) => {
  assert.deepEqual(exampleImages(ROOT).map((image) => `${image.app}:${image.file}`), [
    'ecommerce-app:be/apps/identity/Dockerfile', 'ecommerce-app:be/apps/order/Dockerfile', 'ecommerce-app:be/apps/billing/Dockerfile', 'ecommerce-app:be/apps/cli/Dockerfile',
    'ecommerce-app:fe/apps/landing/Dockerfile', 'ecommerce-app:fe/apps/app/Dockerfile',
    'shape-slot:be/apps/core/Dockerfile', 'shape-slot:be/apps/cli/Dockerfile', 'shape-slot:fe/apps/shape-slot/Dockerfile',
  ]);
  const root = fixture(t, ['alpha']);
  let printed = '';
  examplesCiMain(['--images'], { root, out: (s) => { printed += s; } });
  assert.deepEqual(JSON.parse(printed), [{ app: 'alpha', name: 'core', file: 'be/apps/core/Dockerfile' }, { app: 'alpha', name: 'cli', file: 'be/apps/cli/Dockerfile' }, { app: 'alpha', name: 'web', file: 'fe/apps/web/Dockerfile' }]);
  assert.deepEqual(codes(root), []);
  const file = path.join(root, WORKFLOW);
  const original = fs.readFileSync(file, 'utf8');
  fs.writeFileSync(file, original.replace('push: false', 'push: true'));
  assert.deepEqual(codes(root), ['EXAMPLES_CI_IMAGES_NOT_DERIVED']);
  fs.writeFileSync(file, original.replace('include: ${{ fromJSON(needs.apps.outputs.images) }}', 'include: [{ name: core }]'));
  assert.deepEqual(codes(root), ['EXAMPLES_CI_IMAGES_NOT_DERIVED']);
  fs.writeFileSync(file, original.slice(0, original.indexOf('\n  images:')) + '\n');
  assert.deepEqual(codes(root), ['EXAMPLES_CI_IMAGES_NOT_DERIVED']);
});

test('the quality files of each example are rendered from the source preset: the app codecov.yml scope equals the root flag, and a hand edit is refused', (t) => {
  const root = fixture(t, ['alpha']);
  const targets = appQualityTargets('alpha', root);
  assert.deepEqual(targets.map((target) => target.path).sort(), [...APP_QUALITY_FILES].sort());
  for (const target of targets) assert.equal(fs.readFileSync(path.join(root, 'examples', 'alpha', target.path), 'utf8'), target.content);
  assert.deepEqual(codes(root), []);
  const sonar = path.join(root, 'examples', 'alpha', 'sonar-project.properties');
  fs.writeFileSync(sonar, fs.readFileSync(sonar, 'utf8').replace('be/**/*.args.ts,', ''));
  assert.deepEqual(codes(root), ['EXAMPLES_CI_APP_QUALITY_DRIFT']);
  examplesCiMain(['--write'], { root, out: () => {} });
  assert.deepEqual(codes(root), []);
});
