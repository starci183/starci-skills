// examples-ci.spec.mjs - every example app runs in the ONE root workflow through a derived matrix and has a Codecov flag, and a component per service app
// plus platform, over the same coverage scope as its own codecov.yml and be/jest.config.js, whose complement is its sonar.coverage.exclusions (the slot manifest's
// `coverage` field through scripts/hfs/coverage-scope.mjs; scripts/checks/check-examples-ci.mjs, contract change examples-root-ci).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseYaml } from '../../engine/yaml.mjs';
import { APP_QUALITY_FILES, RUNTIME_SONAR, CODECOV, WORKFLOW, appCoverageScope, appQualityTargets, checkExamplesCi, coverageExampleApps, examplesCiMain, exampleApps, exampleHasTests, exampleImages, renderCodecov } from '../../scripts/checks/check-examples-ci.mjs';
import { readProperties } from '../../scripts/lib/properties.mjs';
import { coverageScopeOf, coverageTargetOf } from '../../scripts/gates/sonar-gate.mjs';
import { braceVariants, globExpression } from '../../scripts/lib/glob.mjs';
import { isMeasured } from '../../scripts/hfs/coverage-scope.mjs';
import { RUNTIME_MANIFEST_FILE, loadSlotManifest } from '../../scripts/hfs/slots.mjs';
import { runtimeShapeProblems } from '../../scripts/hfs/manifest-shape.mjs';
import { execFileSync } from 'node:child_process';
import { RUNTIME_FLAG, RUNTIME_LCOV, renderRuntimeSonar, runtimeCodecovPaths, runtimeCoverageNodeArgs, runtimeCoverageScope } from '../../scripts/hfs/runtime-coverage-scope.mjs';
import { coverageArgs } from '../../scripts/gates/runtime-coverage.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const codes = (root) => checkExamplesCi(root).findings.map((finding) => finding.code).sort();

test('the repository: every example app is in the derived matrix and has a flag; the check is clean', () => {
  const apps = exampleApps(ROOT);
  assert.deepEqual(apps, ['ecommerce-app', 'lite-app', 'shape-slot']);
  for (const app of apps) assert.equal(JSON.parse(fs.readFileSync(path.join(ROOT, 'examples', app, 'hfs.json'), 'utf8')).kind, 'app');
  assert.ok(!apps.includes('starcistacks-services'), 'a folder without an app hfs.json is not an app');
  assert.deepEqual(checkExamplesCi(ROOT).findings, []);
  const flags = parseYaml(fs.readFileSync(path.join(ROOT, CODECOV), 'utf8')).flag_management.individual_flags;
  assert.deepEqual(flags.map((flag) => flag.name), [...coverageExampleApps(ROOT), RUNTIME_FLAG]);
  assert.equal(exampleHasTests('lite-app', ROOT), false);
  assert.equal(fs.existsSync(path.join(ROOT, 'examples', 'lite-app', 'codecov.yml')), false);
  const workflow = parseYaml(fs.readFileSync(path.join(ROOT, WORKFLOW), 'utf8'));
  assert.equal(workflow.jobs.app.strategy.matrix.app, '${{ fromJSON(needs.apps.outputs.apps) }}');
  for (const gone of ['example-unit.yml', 'todo' + '-app-example.yml', 'todo' + '-app-live-e2e.yml']) assert.ok(!fs.existsSync(path.join(ROOT, '.github', 'workflows', gone)), `${gone} is folded in`);
});

test('the root codecov flag of each app is its own codecov.yml scope under examples/<app>/ (one source, no drift)', () => {
  const flags = parseYaml(fs.readFileSync(path.join(ROOT, CODECOV), 'utf8')).flag_management.individual_flags;
  for (const app of coverageExampleApps(ROOT)) {
    const own = parseYaml(fs.readFileSync(path.join(ROOT, 'examples', app, 'codecov.yml'), 'utf8')).coverage.status.project.default.paths;
    const flag = flags.find((entry) => entry.name === app);
    assert.deepEqual(flag.paths, own.map((glob) => `examples/${app}/${glob}`), `${app}: root flag = the app's own codecov.yml paths`);
    assert.deepEqual(flag.paths, appCoverageScope(app, ROOT));
  }
  const liteSonar = readProperties(path.join(ROOT, 'examples', 'lite-app', 'sonar-project.properties'));
  assert.equal('sonar.coverage.inclusions' in liteSonar, false);
  assert.equal('sonar.coverage.exclusions' in liteSonar, false);
  const rules = parseYaml(fs.readFileSync(path.join(ROOT, CODECOV), 'utf8')).flag_management.default_rules.statuses;
  assert.deepEqual(rules.map((rule) => [rule.type, rule.target]), [['project', '100%'], ['patch', '100%']]);
});

test('every executable be file of each full-edition example is measured or matched by a Sonar coverage exclusion, never both, never neither; Sonar and Codecov describe one file set', () => {
  const manifest = loadSlotManifest();
  for (const app of coverageExampleApps(ROOT)) {
    const dir = path.join(ROOT, 'examples', app);
    const props = readProperties(path.join(dir, 'sonar-project.properties'));
    assert.ok(!('sonar.coverage.inclusions' in props), `${app}: Sonar has no coverage inclusions`);
    const excluded = props['sonar.coverage.exclusions'].split(',').flatMap(braceVariants).map(globExpression);
    const roots = parseYaml(fs.readFileSync(path.join(dir, 'codecov.yml'), 'utf8')).coverage.status.project.default.paths.map(globExpression);
    const files = execFileSync('git', ['ls-files', 'be'], { cwd: dir, encoding: 'utf8' }).trim().split('\n').filter((file) => /^be\/(?:src|apps)\/.*\.[cm]?[jt]sx?$/.test(file));
    assert.ok(files.length > 50, `${app}: the be tree is read`);
    const measured = files.filter((file) => isMeasured(manifest, file.slice('be/'.length)));
    const both = [], neither = [];
    for (const file of files) {
      const logic = measured.includes(file), out = excluded.some((glob) => glob.test(file));
      if (logic && out) both.push(file);
      if (!logic && !out) neither.push(file);
    }
    assert.deepEqual(both, [], `${app}: a measured file is never excluded`);
    assert.deepEqual(neither, [], `${app}: every other executable be file is excluded`);
    // The runtime's own scope (what Sonar measures) is exactly the files jest holds at 100, and Codecov's roots contain every one of them.
    const target = coverageTargetOf(coverageScopeOf(props));
    assert.deepEqual(files.filter(target), measured, `${app}: Sonar's coverage set = the measured set`);
    assert.ok(measured.every((file) => roots.some((glob) => glob.test(file))), `${app}: every measured file is under a Codecov root`);
    // Only the logic roles of be/src/modules are measured: never a feature, never a declaration.
    const roles = manifest.ruleParams.be.logicRoles;
    assert.ok(measured.every((file) => file.startsWith('be/src/modules/') && roles.some((role) => file.endsWith(`.${role}.ts`))));
    assert.ok(measured.some((file) => file.endsWith('.service.ts')), `${app}: its services are measured`);
    assert.ok(!files.filter(target).some((file) => file.startsWith('be/src/features/')), `${app}: features are thin and never measured`);
    assert.ok(excluded.some((glob) => glob.test('fe/apps/web/src/app/page.tsx')), `${app}: fe/ is outside coverage`);
  }
});

test('the root codecov.yml holds one component per service app of each example plus its platform, each at 100, and each app\'s own codecov.yml holds the same ones', () => {
  const root = parseYaml(fs.readFileSync(path.join(ROOT, CODECOV), 'utf8'));
  const rules = root.component_management.default_rules.statuses;
  assert.deepEqual(rules.map((rule) => [rule.type, rule.target, rule.threshold]), [['project', '100%', '0%'], ['patch', '100%', '0%']]);
  const ids = root.component_management.individual_components.map((component) => component.component_id);
  assert.deepEqual(ids.filter((id) => id.startsWith('ecommerce-app-')), ['ecommerce-app-identity', 'ecommerce-app-order', 'ecommerce-app-billing', 'ecommerce-app-platform']);
  assert.deepEqual(ids.filter((id) => id.startsWith('shape-slot-')), ['shape-slot-core', 'shape-slot-platform']);
  for (const app of coverageExampleApps(ROOT)) {
    const own = parseYaml(fs.readFileSync(path.join(ROOT, 'examples', app, 'codecov.yml'), 'utf8')).component_management.individual_components;
    const mine = root.component_management.individual_components.filter((component) => component.component_id.startsWith(`${app}-`));
    assert.deepEqual(mine.map((component) => component.paths), own.map((component) => component.paths.map((glob) => `examples/${app}/${glob}`)), `${app}: root components = the app's own`);
  }
});

test('integration and e2e run on workflow_dispatch only; the automatic steps hold coverage, the upload and Sonar', () => {
  const workflow = parseYaml(fs.readFileSync(path.join(ROOT, WORKFLOW), 'utf8'));
  assert.deepEqual(Object.keys(workflow.on).sort(), ['push', 'workflow_dispatch'], 'CI runs once per release (CI_TRIGGERS_RELEASE_ONLY): a release tag or a person, never a branch push or a pull request');
  assert.deepEqual(workflow.on.push, { tags: ['v*'] });
  const steps = workflow.jobs.app.steps;
  for (const layer of ['test:integration', 'test:e2e']) {
    const step = steps.find((entry) => String(entry.run ?? '').includes(layer));
    assert.match(step.if, /github\.event_name == 'workflow_dispatch'/, `${layer} is manual only`);
  }
  const upload = steps.find((entry) => String(entry.uses ?? '').startsWith('codecov/codecov-action@'));
  assert.equal(upload.with.flags, '${{ matrix.app }}');
  assert.equal(upload.with.use_oidc, true, 'the upload authenticates with the OIDC token');
  assert.equal(upload.with.token, undefined);
  assert.ok(String(upload.if).includes("startsWith(github.ref, 'refs/tags/v')"), 'Codecov uploads only from the release-tag run');
  for (const step of steps.filter((entry) => String(entry.uses ?? '').startsWith('SonarSource/'))) assert.ok(String(step.if).includes("startsWith(github.ref, 'refs/tags/v')"), 'Sonar runs only in the release-tag run');
  assert.doesNotMatch(String(upload.if ?? ''), /secrets|env\./, 'the upload is not guarded by the presence of a secret');
  assert.equal(workflow.jobs.app.permissions['id-token'], 'write');
  assert.match(upload.if, /steps.policy.outputs.tests == 'true'/, 'only an example with generated tests uploads coverage');
  assert.ok(steps.some((entry) => String(entry.uses ?? '').startsWith('SonarSource/sonarqube-scan-action')));
  assert.ok(steps.some((entry) => /SonarCloud is not configured/.test(String(entry.run ?? ''))));
  assert.ok(steps.findIndex((entry) => entry.run === 'npm test -- --ci') < steps.indexOf(upload));
  assert.match(steps.find((entry) => entry.run === 'npm test -- --ci').if, /steps\.policy\.outputs\.tests == 'true'/);
  const at = (run) => steps.findIndex((entry) => entry.run === run);
  assert.ok(at('npm run codegen --silent') >= 0 && at('npm run codegen --silent') < at('npm run typecheck') && at('npm run typecheck') < at('npm run build:fe'), 'codegen runs before the type-check and the fe build');
});

/** The hfs.json of a fixture example: one api app and one Next app. */
const declarationOf = (app) => JSON.stringify({ hfs: 2, kind: 'app', project: app, sides: { be: { apps: [{ name: 'core', kind: 'api' }, { name: 'cli', kind: 'cli' }] }, fe: { apps: [{ name: 'web', kind: 'next' }] } } });

/** A fixture runtime: the jest preset, the starci app sync it renders through, and examples/ with the given apps. */
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
  assert.deepEqual(codes(root), ['EXAMPLES_CI_APP_QUALITY_DRIFT', 'EXAMPLES_CI_APP_QUALITY_DRIFT', 'EXAMPLES_CI_APP_QUALITY_DRIFT', 'EXAMPLES_CI_CODECOV_DRIFT']);
  assert.equal(examplesCiMain([], { root, out: () => {} }), 1);
  examplesCiMain(['--write'], { root, out: () => {} });
  assert.deepEqual(codes(root), []);
  assert.match(renderCodecov(root), /- name: beta\n {6}paths:\n {8}- "examples\/beta\/be\/src\/modules\/domain\/\*\/\*\*"/);
  assert.match(renderCodecov(root), /- component_id: beta-platform\n/);
});

test('a hand-written matrix, a per-example workflow, an automatic e2e step and a missing manual trigger are refused', (t) => {
  const root = fixture(t, ['alpha']);
  const file = path.join(root, WORKFLOW);
  const original = fs.readFileSync(file, 'utf8');
  fs.writeFileSync(file, original.replace('app: ${{ fromJSON(needs.apps.outputs.apps) }}', 'app: [alpha]'));
  assert.deepEqual(codes(root), ['EXAMPLES_CI_MATRIX_NOT_DERIVED']);
  fs.writeFileSync(file, original.replace(/\n {8}if: .*contains\(inputs\.layers, 'e2e'\).*$/m, ''));
  assert.deepEqual(codes(root), ['EXAMPLES_CI_STACK_LAYER_AUTOMATIC']);
  fs.writeFileSync(file, original.replace(/\n {2}workflow_dispatch:\n[\s\S]*?default: integration-and-e2e\n/, '\n'));
  assert.ok(codes(root).includes('EXAMPLES_CI_NO_MANUAL_TRIGGER'));
  fs.writeFileSync(file, original);
  fs.writeFileSync(path.join(root, '.github', 'workflows', 'alpha-e2e.yml'), 'name: alpha\njobs:\n  x:\n    steps:\n      - run: cd examples/alpha && npm test\n');
  assert.deepEqual(codes(root), ['EXAMPLES_CI_STRAY_WORKFLOW']);
});

test('every deployable image is derived from hfs.json (full be+fe, lite be only) and the images job builds it without pushing', (t) => {
  assert.deepEqual(exampleImages(ROOT).map((image) => `${image.app}:${image.file}`), [
    'ecommerce-app:be/apps/identity/Dockerfile', 'ecommerce-app:be/apps/order/Dockerfile', 'ecommerce-app:be/apps/billing/Dockerfile', 'ecommerce-app:be/apps/cli/Dockerfile',
    'ecommerce-app:fe/apps/landing/Dockerfile', 'ecommerce-app:fe/apps/app/Dockerfile',
    'lite-app:be/apps/api/Dockerfile', 'lite-app:be/apps/cli/Dockerfile',
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

test('the quality files of each example are rendered from the source slot manifest: the app codecov.yml scope equals the root flag, and a hand edit is refused', (t) => {
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

test('the runtime is measured by one scope: the codecov runtime flag (informational), the root sonar-project.properties, the coverage producer and the main-and-tag-run ci.yml all read it', () => {
  const codecov = parseYaml(fs.readFileSync(path.join(ROOT, CODECOV), 'utf8'));
  const flag = codecov.flag_management.individual_flags.find((entry) => entry.name === RUNTIME_FLAG);
  assert.deepEqual(flag.paths, runtimeCodecovPaths());
  assert.deepEqual(flag.statuses, [{ type: 'project', informational: true }, { type: 'patch', informational: true }], 'no invented threshold: informational until a baseline exists');
  assert.deepEqual(codecov.coverage.status.project.default.flags, coverageExampleApps(ROOT), 'the overall status reads the example flags only');
  for (const glob of runtimeCodecovPaths()) assert.ok(runtimeCoverageNodeArgs().includes(`--test-coverage-include=${glob}`), `the producer measures ${glob}`);
  const sonar = readProperties(path.join(ROOT, RUNTIME_SONAR));
  assert.equal(sonar['sonar.projectKey'], undefined, 'the key and the organization come from repository variables, never a typed value');
  assert.equal(sonar['sonar.organization'], undefined);
  assert.equal(sonar['sonar.javascript.lcov.reportPaths'], RUNTIME_LCOV);
  for (const source of sonar['sonar.sources'].split(',')) assert.ok(fs.existsSync(path.join(ROOT, source)), `${source} exists`);
  assert.ok(coverageArgs().includes(`--test-reporter-destination=${RUNTIME_LCOV}`));
  assert.ok(fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8').split('\n').includes('/coverage/'), 'coverage/ is git-ignored');
  const ci = parseYaml(fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'ci.yml'), 'utf8')).jobs['check-and-test'];
  assert.equal(ci.permissions['id-token'], 'write');
  assert.ok(!ci.steps.some((step) => step.run === 'npm test'), 'the suite runs once, under coverage');
  assert.ok(ci.steps.some((step) => step.run === 'npm run starci --silent -- gate runtime-coverage'));
  const upload = ci.steps.find((step) => String(step.uses ?? '').startsWith('codecov/codecov-action@'));
  assert.equal(upload.with.flags, RUNTIME_FLAG);
  assert.equal(upload.with.files, RUNTIME_LCOV);
  assert.equal(upload.if, '${{ !cancelled() }}', 'Codecov uploads from every run (main push, release tag, dispatch), also after a red test');
  const sonarSteps = ci.steps.filter((step) => String(step.uses ?? '').startsWith('SonarSource/'));
  assert.equal(sonarSteps.length, 1, 'one scan step that also waits for the quality gate');
  const scan = sonarSteps[0];
  assert.ok(String(scan.if).includes("github.ref == 'refs/heads/main'"), 'Sonar scans the branch main only, never a tag ref');
  for (const setting of ['SONAR_TOKEN', 'SONAR_ORGANIZATION', 'SONAR_PROJECT_KEY']) assert.ok(String(scan.if).includes(`env.${setting} != ''`), `the scan needs ${setting}`);
  assert.equal(ci.env.SONAR_HOST_URL, 'https://sonarcloud.io', 'the runtime job scans SonarCloud, never the self-hosted server of examples.yml');
  assert.equal(ci.env.SONAR_ORGANIZATION, '${{ vars.SONAR_ORGANIZATION }}');
  assert.equal(ci.env.SONAR_PROJECT_KEY, '${{ vars.SONAR_PROJECT_KEY }}');
  assert.match(String(scan.with.args), /-Dsonar\.qualitygate\.wait=true/);
  assert.equal(ci.steps[0].with['fetch-depth'], 0, 'the scan reads the full history');
  const skipped = ci.steps.find((step) => /Sonar skipped/.test(String(step.name ?? '')));
  assert.ok(skipped, 'missing settings are announced, never a silent pass');
  for (const setting of ['secrets.SONAR_TOKEN', 'vars.SONAR_ORGANIZATION', 'vars.SONAR_PROJECT_KEY']) assert.ok(String(skipped.run).includes(setting), `the notice can name ${setting}`);
  assert.ok(ci.steps.indexOf(skipped) > ci.steps.indexOf(scan));
  const packages = ci.steps.find((step) => step.run === 'npm run starci --silent -- release clean-test');
  assert.ok(packages, 'every package suite runs from a clean install in the job');
  assert.equal(packages.if, '${{ !cancelled() }}', 'a red static check or coverage step does not hide a red package suite');
  assert.ok(ci.steps.indexOf(packages) > ci.steps.indexOf(upload));
});

test('the root sonar-project.properties of the runtime is a render: a hand edit is refused and --write restores it', (t) => {
  const root = fixture(t, ['alpha']);
  assert.deepEqual(codes(root), []);
  fs.writeFileSync(path.join(root, RUNTIME_SONAR), 'sonar.projectKey=other\n');
  assert.deepEqual(codes(root), ['EXAMPLES_CI_APP_QUALITY_DRIFT']);
  examplesCiMain(['--write'], { root, out: () => {} });
  assert.deepEqual(codes(root), []);
});

const runtimeManifest = () => structuredClone(loadSlotManifest({ file: path.join(ROOT, RUNTIME_MANIFEST_FILE) }));
const setCoverage = (manifest, id, coverage) => { manifest.slots.find((slot) => slot.id === id).coverage = coverage; return manifest; };

test('the runtime scope follows its slot manifest: flipping a slot coverage changes the producer, the codecov paths and the sonar render', () => {
  const base = runtimeManifest();
  assert.ok(runtimeCodecovPaths(base).includes('scripts/hfs/**/*.mjs'));
  assert.ok(renderRuntimeSonar(base).includes(',scripts/hfs,'));
  const flipped = setCoverage(runtimeManifest(), 'runtime.hfs', 'none');
  assert.ok(!runtimeCodecovPaths(flipped).includes('scripts/hfs/**/*.mjs'), 'a none slot is not a codecov path');
  assert.ok(!runtimeCoverageNodeArgs(flipped).includes('--test-coverage-include=scripts/hfs/**/*.mjs'), 'the producer stops measuring it');
  assert.ok(!renderRuntimeSonar(flipped).includes(',scripts/hfs,'), 'sonar stops analysing it');
  const promoted = setCoverage(runtimeManifest(), 'runtime.contracts', 'required');
  assert.ok(runtimeCodecovPaths(promoted).includes('modules/cli/**/*.mjs'), 'a required slot is measured');
});

test('the runtime scope: a none slot inside a required directory is excluded, a required slot of a non-source file is refused, the vendored yaml and the generated catalog stay out', () => {
  const nested = runtimeManifest();
  nested.slots.push({ id: 'runtime.ui-api-fixtures', profiles: ['runtime'], path: 'ui/api/fixtures/', presence: 'optional', tracked: 'tracked', tier: 'none', tests: 'none', coverage: 'none' });
  const scope = runtimeCoverageScope(nested);
  assert.ok(scope.excludes.includes('ui/api/fixtures/**'), 'the none slot inside ui/api/ is excluded');
  assert.ok(!runtimeCoverageScope(runtimeManifest()).excludes.includes('ui/api/fixtures/**'));
  const real = runtimeCoverageScope(runtimeManifest());
  assert.ok(!real.include.includes('engine/yaml.mjs') && real.excludes.includes('packages/cli/src/catalog.generated.mjs'));
  const bad = runtimeManifest();
  bad.slots.push({ id: 'runtime.ui-data', profiles: ['runtime'], path: 'ui/data.json', presence: 'optional', tracked: 'tracked', tier: 'none', tests: 'none', coverage: 'required' });
  assert.throws(() => runtimeCoverageScope(bad), /not a \*\.mjs source/);
});

test('a tracked runtime slot declares coverage required or none, and an ignored slot declares none at all', () => {
  const missing = runtimeManifest();
  delete missing.slots.find((slot) => slot.id === 'runtime.hfs').coverage;
  assert.match(runtimeShapeProblems(missing).join('\n'), /runtime\.hfs: coverage must be one of required, none/);
  const ignored = runtimeManifest();
  ignored.slots.find((slot) => slot.tracked === 'ignored').coverage = 'none';
  assert.match(runtimeShapeProblems(ignored).join('\n'), /coverage belongs to a tracked slot/);
});

test('the lister job refuses a missing sync-runtime step and a listing swallowed inside echo', (t) => {
  const root = fixture(t, ['alpha']);
  const file = path.join(root, WORKFLOW);
  const original = fs.readFileSync(file, 'utf8');
  assert.deepEqual(codes(root), []);
  const withoutSync = original.replace(/ {6}- name: Generate the packages' runtime copies\n {8}run: npm run starci --silent -- release sync-runtime\n/, '');
  assert.notEqual(withoutSync, original);
  fs.writeFileSync(file, withoutSync);
  assert.deepEqual(codes(root), ['EXAMPLES_CI_LISTER_UNSAFE']);
  const swallowed = original.replace(/apps=\$\((npm run starci[^\n]*)\)\n\s+echo "apps=\$apps"/, 'echo "apps=$($1)"');
  assert.notEqual(swallowed, original);
  fs.writeFileSync(file, swallowed);
  assert.deepEqual(codes(root), ['EXAMPLES_CI_LISTER_UNSAFE']);
});
