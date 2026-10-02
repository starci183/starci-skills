// The tree checks of `hfs check` that read file content or configuration (scripts/hfs/rules): R06 plaintext secrets, R10 the
// .starcistacks shape, R13 the canon steps of CI and pre-push, R14 dependency version skew, R23 the contract snapshot, R47 the
// test topology, and R52 / R59 / R60 the front-end wire, i18n placement and catalog. Each has a violating and a passing tree
// and the finding names its rule's code; the clean app of tests/helpers/hfs-cli-fixture.mjs, checked at its root, is the passing one.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';
import { braceVariants } from '../../scripts/lib/glob.mjs';
import path from 'node:path';
import { parseYaml } from '../../engine/yaml.mjs';
import { APP, TWO_FE_APPS, STACKS_DECLARATION, appOf } from '../helpers/hfs-cli-fixture.mjs';
import { hfsTreeRulesFixture } from '../helpers/hfs-hfs-tree-rules-fixture.mjs';

const root = path.resolve(import.meta.dirname, '..', '..');
const pins = parseYaml(fs.readFileSync(path.join(root, 'knowledge/hfs/canon-pins.yaml'), 'utf8')).pins;
const made = [];
const fixture = hfsTreeRulesFixture();
const { checkRepo, repoOf } = fixture;
test.after(() => {
  fixture.cleanup();
  for (const dir of made) fs.rmSync(dir, { recursive: true, force: true });
});

const put = (dir, relative, text = 'export {};\n') => {
  const target = path.join(dir, ...relative.split('/'));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, text);
};
const drop = (dir, relative) => fs.rmSync(path.join(dir, ...relative.split('/')), { recursive: true, force: true });
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const only = (result, code) => result.findings.filter((f) => f.code === code);
const pathsOf = (result, code) => only(result, code).map((f) => f.path).sort();
const SEALED = 'ENC[AES256_GCM,data:YWJj,iv:ZGVm,tag:Z2hp,type:str]';
const SOPS_ENVELOPE = json({ data: SEALED, sops: { mac: SEALED, age: [] } });
// Assembled at run time so this file never holds a scannable credential itself.
const AWS_KEY = ['AKIA', 'ABCDEFGHIJKLMNOP'].join('');

// ------------------------------------------------------------------------------------------------ R06 HFS_PLAINTEXT_SECRET

test('HFS_PLAINTEXT_SECRET: a tracked env file, a key file, a secret value and an .enc that is no envelope are refused, one finding per file', () => {
  const result = checkRepo({ repoRoot: repoOf(APP, (dir) => {
    put(dir, '.env', 'A=1\n');
    put(dir, 'be/certs/server.pem', 'not a key\n');
    put(dir, 'be/src/features/api/orders/application/keys.ts', `export const key = '${AWS_KEY}';\n`);
    put(dir, '.starcistacks/dev/secrets/db.enc', 'password=hunter2\n');
  }) });
  const found = only(result, 'HFS_PLAINTEXT_SECRET');
  assert.deepEqual(found.map((f) => f.path).sort(), ['.env', '.starcistacks/dev/secrets/db.enc', 'be/certs/server.pem', 'be/src/features/api/orders/application/keys.ts']);
  assert.deepEqual(only(result, 'HFS_FORBIDDEN_PRESENT'), [], 'a plaintext env file is one finding, under the secret rule');
  const inline = found.find((f) => f.path.endsWith('keys.ts'));
  assert.equal(inline.pattern, 'aws-access-key');
  assert.equal(inline.line, 1);
  assert.ok(!JSON.stringify(found).includes(AWS_KEY), 'a finding never carries the value');
  assert.match(found.find((f) => f.path === '.starcistacks/dev/secrets/db.enc').message, /not a sops envelope/);
});

test('HFS_PLAINTEXT_SECRET: a sops envelope, a stand-in value and a spec file are clean', () => {
  const result = checkRepo({ repoRoot: repoOf(APP, (dir) => {
    put(dir, '.starcistacks/dev/secrets/db.enc', SOPS_ENVELOPE);
    put(dir, 'be/src/features/api/orders/application/pay.ts', "export const password = 'fixture-not-a-real-secret-value';\n");
    put(dir, 'be/src/features/api/orders/application/pay.spec.ts', "export const password = 'a-real-looking-value-12345';\n");
  }) });
  assert.deepEqual(only(result, 'HFS_PLAINTEXT_SECRET'), []);
});

// ------------------------------------------------------------------------------------------------ R10 HFS_STACKS_SHAPE

const STANDARD_TREE = ['.starcistacks/dev/README.md', '.starcistacks/dev/environment.json', '.starcistacks/dev/infra/compose/compose.yaml', '.starcistacks/dev/runtime/env/KEYS.md',
  '.starcistacks/dev/runtime/config/app.json', '.starcistacks/dev/seeds/01-schema.sql', '.starcistacks/dev/infra/metadata.json'];

test('HFS_STACKS_SHAPE: runtime/files, a sealed file outside secrets/, DESIGN.md, a root k8s and a non-host Sonar are refused', () => {
  const result = checkRepo({ repoRoot: repoOf(APP, (dir) => {
    put(dir, '.starcistacks/dev/runtime/files/key.enc', SOPS_ENVELOPE);
    put(dir, '.starcistacks/dev/runtime/env/app.env.enc', SOPS_ENVELOPE);
    put(dir, '.starcistacks/DESIGN.md', '# design\n');
    put(dir, '.starcistacks/k8s/pod.yaml', 'kind: Pod\n');
    put(dir, '.starcistacks/dev/infra/notes.json', '{}\n');
    put(dir, '.starcistacks/application-stacks.yaml', STACKS_DECLARATION.replace('owner: host', 'owner: repository'));
  }) });
  assert.deepEqual(pathsOf(result, 'HFS_STACKS_SHAPE'), ['.starcistacks/DESIGN.md', '.starcistacks/application-stacks.yaml', '.starcistacks/dev/infra/notes.json',
    '.starcistacks/dev/runtime/env/app.env.enc', '.starcistacks/dev/runtime/files/key.enc', '.starcistacks/k8s/pod.yaml']);
  assert.match(only(result, 'HFS_STACKS_SHAPE').find((f) => f.path.endsWith('application-stacks.yaml')).message, /not owned by the host/);
});

test('HFS_STACKS_SHAPE: a service still rooted at .stacks and a declaration with no sonar are refused', () => {
  const stale = checkRepo({ repoRoot: repoOf(APP, (dir) => put(dir, '.starcistacks/application-stacks.yaml', `${STACKS_DECLARATION}  error-tracking:\n    provider: sentry\n    mode: local\n    stack:\n      repository: demo\n      root: .stacks\n      environment: dev\n`)) });
  assert.match(only(stale, 'HFS_STACKS_SHAPE')[0].message, /retired \.stacks root/);
  const silent = checkRepo({ repoRoot: repoOf(APP, (dir) => put(dir, '.starcistacks/application-stacks.yaml', 'schema: starci/application-stacks@1\nservices:\n  error-tracking:\n    provider: sentry\n    mode: disabled\n')) });
  assert.match(only(silent, 'HFS_STACKS_SHAPE')[0].message, /no sonar service/);
});

test('HFS_STACKS_SHAPE: the standard tree with a host-owned Sonar is clean', () => {
  const result = checkRepo({ repoRoot: repoOf(APP, (dir) => {
    for (const file of STANDARD_TREE) put(dir, file, file.endsWith('.json') ? '{}\n' : 'x\n');
    put(dir, '.starcistacks/dev/secrets/uat.enc', SOPS_ENVELOPE);
  }) });
  assert.deepEqual(only(result, 'HFS_STACKS_SHAPE'), []);
  assert.equal(result.ok, true, JSON.stringify(result.findings.slice(0, 3)));
});

test('.starcistacks lives at the app root: a be/.starcistacks or be/.sops.yaml is refused (repo.side-root-forbidden), the root form is clean', () => {
  const side = checkRepo({ repoRoot: repoOf(APP, (dir) => {
    put(dir, 'be/.starcistacks/application-stacks.yaml', STACKS_DECLARATION);
    put(dir, 'be/.starcistacks/dev/secrets/uat.enc', SOPS_ENVELOPE);
    put(dir, 'be/.sops.yaml', 'creation_rules: []\n');
  }) });
  const forbidden = only(side, 'HFS_FORBIDDEN_PRESENT');
  assert.deepEqual(forbidden.map((f) => f.path).sort(), ['be/.sops.yaml', 'be/.starcistacks/application-stacks.yaml', 'be/.starcistacks/dev/secrets/uat.enc']);
  assert.ok(forbidden.every((f) => f.slot === 'repo.side-root-forbidden'), JSON.stringify(forbidden));
  assert.equal(side.ok, false);
  const root = checkRepo({ repoRoot: repoOf(APP) });
  assert.deepEqual(only(root, 'HFS_FORBIDDEN_PRESENT'), []);
  assert.deepEqual(only(root, 'HFS_SLOT_REQUIRED_MISSING'), [], 'the app root .starcistacks/application-stacks.yaml and .sops.yaml satisfy the required slots');
});

test('HFS_STACKS_SHAPE: the slot allows list and the custody .gitignore rules (stacks-layout.yaml gitignoreRules) agree: every tracked member the shape allows is un-ignored', () => {
  const slots = parseYaml(fs.readFileSync(path.join(root, 'knowledge/hfs/slots.yaml'), 'utf8')).slots;
  const layout = parseYaml(fs.readFileSync(path.join(root, 'modules/schemas/stacks-layout.yaml'), 'utf8'));
  const allows = slots.find((slot) => slot.id === 'app.starcistacks').allows;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-stacks-ignore-'));
  made.push(dir);
  execFileSync('git', ['init', '-q'], { cwd: dir });
  fs.writeFileSync(path.join(dir, '.gitignore'), `${layout.custody.gitignoreRules.join('\n')}\n`);
  // A custody member (runtime/{config,env}, secrets) is ignored by design; every other allowed entry is a tracked source file.
  const tracked = allows.filter((entry) => !/^<env>\/(?:runtime|secrets)\//.test(entry)).flatMap((entry) => braceVariants(entry))
    .map((entry) => `.starcistacks/${entry.replace('<env>', 'dev').replace('**', 'sub/file.yaml')}`);
  assert.ok(tracked.includes('.starcistacks/dev/infra/metadata.json') && tracked.length > 5, tracked.join(', '));
  for (const file of tracked) assert.equal(spawnSync('git', ['check-ignore', '-q', '--no-index', '--', file], { cwd: dir }).status, 1, `${file} is allowed by the app.starcistacks slot but the custody rules ignore it`);
  assert.equal(spawnSync('git', ['check-ignore', '-q', '--no-index', '--', '.starcistacks/dev/infra/compose/.env'], { cwd: dir }).status, 0, 'a value file stays ignored');
});

// ------------------------------------------------------------------------------------------------ R13 HFS_CI_MISSING_CANON

const CI_STEP = '      - name: lint\n        run: npm run lint -- --sonar reports/lint.sonar.json\n';

test('HFS_CI_MISSING_CANON: a CI without the hfs lint, another version, and a script that is not the lint are refused', () => {
  const ci = fs.readFileSync(path.join(repoOf(APP), '.github/workflows/ci.yml'), 'utf8');
  assert.ok(ci.includes(CI_STEP), 'the rendered CI runs the one lint through the lint script');
  const withStep = (line) => ci.replace('run: npm run lint -- --sonar reports/lint.sonar.json', `run: ${line}`);
  const missing = checkRepo({ repoRoot: repoOf(APP, (dir) => put(dir, '.github/workflows/ci.yml', ci.replace(CI_STEP, ''))) });
  assert.deepEqual(only(missing, 'HFS_CI_MISSING_CANON').map((f) => f.path), ['.github/workflows/ci.yml']);
  const check = checkRepo({ repoRoot: repoOf(APP, (dir) => put(dir, '.github/workflows/ci.yml', withStep('npx hfs check'))) });
  assert.equal(only(check, 'HFS_CI_MISSING_CANON').length, 1, 'hfs check is not the lint entry');
  const drifted = checkRepo({ repoRoot: repoOf(APP, (dir) => put(dir, '.github/workflows/ci.yml', withStep('npx @starci/hfs@0.0.1 lint'))) });
  assert.match(only(drifted, 'HFS_CI_MISSING_CANON')[0].message, new RegExp(`pinned at ${pins['@starci/hfs'].version.replace(/\./g, '\.')}`));
  const hollow = checkRepo({ repoRoot: repoOf(APP, (dir) => put(dir, 'package.json', json({ name: 'demo', private: true, dependencies: { 'next-intl': pins['next-intl'].version }, scripts: { lint: 'echo ok' } }))) });
  assert.equal(only(hollow, 'HFS_CI_MISSING_CANON').length, 1, 'a script that does not run hfs lint is no lint');
  const prePush = checkRepo({ repoRoot: repoOf(APP, (dir) => put(dir, '.husky/pre-push', '# the release gate check, no lint\nexit 0\n')) });
  assert.deepEqual(only(prePush, 'HFS_CI_MISSING_CANON'), [], 'the push hook is the release gate check, not a lint or typecheck step');
});

test('HFS_CI_MISSING_CANON: the rendered CI and pre-push, and the pinned version spelled out, are clean', () => {
  assert.deepEqual(only(checkRepo({ repoRoot: repoOf(APP) }), 'HFS_CI_MISSING_CANON'), []);
  const ci = fs.readFileSync(path.join(repoOf(TWO_FE_APPS), '.github/workflows/ci.yml'), 'utf8');
  const pinned = checkRepo({ repoRoot: repoOf(TWO_FE_APPS, (dir) => put(dir, '.github/workflows/ci.yml', ci.replace('run: npm run lint -- --sonar reports/lint.sonar.json', `run: npx @starci/hfs@${pins['@starci/hfs'].version} lint`))) });
  assert.deepEqual(only(pinned, 'HFS_CI_MISSING_CANON'), []);
});

// ------------------------------------------------------------------------------------------------ R14 HFS_DEP_VERSION_SKEW

/** An app whose fe side opts into two ui workspace packages (fe/packages/*), the only nested package.json an app has. */
const WITH_PACKAGES = appOf({ fe: { apps: [{ name: 'web', kind: 'next' }], optionalSlots: ['fe.package.ui'] } });
const ROOT = (extra = {}) => json({ name: 'demo', private: true, workspaces: ['fe/packages/*'], dependencies: { 'next-intl': pins['next-intl'].version }, ...extra });
const withManifests = (web, admin, lock, root = {}) => (dir) => {
  put(dir, 'package.json', ROOT(root));
  put(dir, 'fe/packages/web-ui/package.json', json({ name: '@demo/web-ui', private: true, dependencies: { ...web } }));
  put(dir, 'fe/packages/admin-ui/package.json', json({ name: '@demo/admin-ui', private: true, dependencies: { ...admin } }));
  if (lock) put(dir, 'package-lock.json', json(lock));
};

test('HFS_DEP_VERSION_SKEW: two workspaces at two versions, and a nested lockfile copy of a declared package, are refused', () => {
  const skew = checkRepo({ repoRoot: repoOf(WITH_PACKAGES, withManifests({ 'left-pad': '1.3.0' }, { 'left-pad': '1.0.0' })) });
  const [finding] = only(skew, 'HFS_DEP_VERSION_SKEW');
  assert.equal(finding.dependency, 'left-pad');
  assert.deepEqual(finding.versions.sort(), ['1.0.0', '1.3.0']);
  const nested = checkRepo({ repoRoot: repoOf(WITH_PACKAGES, withManifests({ 'left-pad': '1.3.0' }, { 'left-pad': '1.3.0' }, {
    lockfileVersion: 3,
    packages: { '': {}, 'node_modules/left-pad': { version: '1.3.0' }, 'fe/packages/web-ui/node_modules/left-pad': { version: '1.0.0' } },
  })) });
  const [copy] = only(nested, 'HFS_DEP_VERSION_SKEW');
  assert.equal(copy.path, 'package-lock.json');
  assert.equal(copy.lockPath, 'fe/packages/web-ui/node_modules/left-pad');
});

test('HFS_DEP_VERSION_SKEW: a bundled copy inside its parent (inBundle) is not a nested copy the workspace keeps', () => {
  // The former false positive of a fresh scaffold: @tailwindcss/oxide-wasm32-wasi bundles tslib, so npm writes
  // node_modules/@tailwindcss/oxide-wasm32-wasi/node_modules/tslib (inBundle) next to the hoisted tslib; nothing in the app can move it.
  const result = checkRepo({ repoRoot: repoOf(WITH_PACKAGES, withManifests({ tslib: '2.8.1' }, { tslib: '2.8.1' }, {
    lockfileVersion: 3,
    packages: { '': {}, 'node_modules/tslib': { version: '2.8.1' }, 'node_modules/@tailwindcss/oxide-wasm32-wasi': { version: '4.3.3', bundleDependencies: ['tslib'] },
      'node_modules/@tailwindcss/oxide-wasm32-wasi/node_modules/tslib': { version: '2.8.1', inBundle: true } },
  })) });
  assert.deepEqual(only(result, 'HFS_DEP_VERSION_SKEW'), []);
});

test('HFS_DEP_VERSION_SKEW: one version everywhere, workspace links, and a transitive duplicate nobody declares are clean', () => {
  const result = checkRepo({ repoRoot: repoOf(WITH_PACKAGES, withManifests({ 'left-pad': '1.3.0', '@demo/kit': 'workspace:*' }, { 'left-pad': '1.3.0', '@demo/kit': 'file:../kit' }, {
    lockfileVersion: 3,
    packages: { '': {}, 'node_modules/left-pad': { version: '1.3.0' }, 'node_modules/semver': { version: '7.6.0' }, 'node_modules/glob/node_modules/semver': { version: '6.3.1' },
      'node_modules/@demo/web-ui': { resolved: 'fe/packages/web-ui', link: true } },
  })) });
  assert.deepEqual(only(result, 'HFS_DEP_VERSION_SKEW'), []);
});

test('HFS_DEP_VERSION_SKEW: a dependency declared at another version than the root overrides pin is refused, an agreeing pin and a $ reference are clean', () => {
  const rootWith = (overrides) => withManifests({ 'left-pad': '1.3.0' }, { 'left-pad': '1.3.0' }, null, { overrides });
  const off = checkRepo({ repoRoot: repoOf(WITH_PACKAGES, rootWith({ 'left-pad': '1.0.0' })) });
  const [finding] = only(off, 'HFS_DEP_VERSION_SKEW');
  assert.equal(finding.dependency, 'left-pad');
  assert.equal(finding.pinned, '1.0.0');
  assert.deepEqual(finding.versions, ['1.3.0']);
  for (const overrides of [{ 'left-pad': '1.3.0' }, { 'left-pad': '$left-pad' }, { semver: '7.6.0', glob: { semver: '6.3.1' } }]) {
    assert.deepEqual(only(checkRepo({ repoRoot: repoOf(WITH_PACKAGES, rootWith(overrides)) }), 'HFS_DEP_VERSION_SKEW'), [], JSON.stringify(overrides));
  }
});

// ------------------------------------------------------------------------------------------------ R23 HFS_CONTRACT_SNAPSHOT_DRIFT

const GRAPHQL = 'be/src/features/api/orders/transport/graphql/orders-graphql.module.ts';
const WITH_CONTRACT = appOf({ be: { apps: [{ name: 'core', kind: 'api' }], optionalSlots: ['be.contract.graphql'] }, fe: { apps: [{ name: 'web', kind: 'next' }], reads: ['be/contracts/'] } });
const SCHEMA = 'type Query {\n  ping: String\n}\n';
const SNAPSHOT = 'be/contracts/core/schema.graphql';
const COMPOSES_GRAPHQL = (dir) => put(dir, 'be/apps/core/src/app.module.ts', 'import { GraphqlModule } from "@modules/platform/graphql";\nexport const modules = [GraphqlModule];\n');

test('HFS_CONTRACT_SNAPSHOT_DRIFT: a back end that serves GraphQL without a committed snapshot is refused', () => {
  const result = checkRepo({ repoRoot: repoOf(WITH_CONTRACT, (dir) => { put(dir, GRAPHQL); COMPOSES_GRAPHQL(dir); }) });
  assert.deepEqual(only(result, 'HFS_CONTRACT_SNAPSHOT_DRIFT').map((f) => f.path), [SNAPSHOT]);
});

test('HFS_CONTRACT_SNAPSHOT_DRIFT: an api app whose root module composes no GraphQL needs no snapshot, whatever the repository carries', () => {
  const result = checkRepo({ repoRoot: repoOf(WITH_CONTRACT, (dir) => { put(dir, GRAPHQL); put(dir, 'be/apps/core/src/app.module.ts'); }) });
  assert.deepEqual(only(result, 'HFS_CONTRACT_SNAPSHOT_DRIFT'), []);
});

test('HFS_CONTRACT_SNAPSHOT_DRIFT: a committed snapshot, and a back end with no GraphQL, are clean', () => {
  const committed = checkRepo({ repoRoot: repoOf(WITH_CONTRACT, (dir) => { put(dir, GRAPHQL); COMPOSES_GRAPHQL(dir); put(dir, SNAPSHOT, SCHEMA); }) });
  assert.deepEqual(only(committed, 'HFS_CONTRACT_SNAPSHOT_DRIFT'), []);
  assert.deepEqual(only(checkRepo({ repoRoot: repoOf(APP) }), 'HFS_CONTRACT_SNAPSHOT_DRIFT'), []);
});

// ------------------------------------------------------------------------------------------------ R47 BE_TEST_TOPOLOGY

test('BE_TEST_TOPOLOGY: a .test file, a testing/ folder, a second jest configuration and a jest key in package.json are refused', () => {
  const result = checkRepo({ repoRoot: repoOf(APP, (dir) => {
    put(dir, 'be/src/features/api/orders/application/place-order.test.ts');
    put(dir, 'be/src/modules/domain/billing/testing/mock-billing.ts');
    put(dir, 'be/jest.config.e2e.js');
    put(dir, 'be/apps/core/jest.config.js');
    put(dir, 'package.json', json({ name: 'demo', private: true, dependencies: { 'next-intl': pins['next-intl'].version }, jest: { preset: 'ts-jest' } }));
  }) });
  assert.deepEqual(pathsOf(result, 'BE_TEST_TOPOLOGY'), ['be/apps/core/jest.config.js', 'be/jest.config.e2e.js', 'be/src/features/api/orders/application/place-order.test.ts', 'be/src/modules/domain/billing/testing/mock-billing.ts', 'package.json']);
});

test('BE_TEST_TOPOLOGY: unit specs beside their subject, the be jest.config.js and the jest setup file are clean', () => {
  const result = checkRepo({ repoRoot: repoOf(APP, (dir) => {
    put(dir, 'be/src/features/api/orders/application/place-order.spec.ts');
    put(dir, 'be/src/tests/world/global-setup.ts');
  }) });
  assert.deepEqual(only(result, 'BE_TEST_TOPOLOGY'), []);
});

// ------------------------------------------------------------------------------------------------ R52 FE_WIRE_GENERATED

const GENERATED = 'fe/apps/web/src/modules/api/__generated__';

test('FE_WIRE_GENERATED: be contract snapshots with no codegen script at the root, and generated types older than a snapshot, are refused', () => {
  const none = checkRepo({ repoRoot: repoOf(WITH_CONTRACT, (dir) => { put(dir, SNAPSHOT, SCHEMA); put(dir, 'package.json', ROOT()); }) });
  assert.deepEqual(only(none, 'FE_WIRE_GENERATED').map((f) => f.path), ['package.json']);
  assert.match(only(none, 'FE_WIRE_GENERATED')[0].message, /no `codegen` script/);
  const dir = repoOf(WITH_CONTRACT, (d) => put(d, SNAPSHOT, SCHEMA));
  put(dir, `${GENERATED}/types.ts`);
  const old = new Date(Date.now() - 3_600_000);
  fs.utimesSync(path.join(dir, `${GENERATED}/types.ts`), old, old);
  const stale = checkRepo({ repoRoot: dir });
  assert.deepEqual(only(stale, 'FE_WIRE_GENERATED').map((f) => f.path), [GENERATED]);
});

test('FE_WIRE_GENERATED: generated types newer than the snapshots, and an app with no snapshot, are clean', () => {
  const dir = repoOf(WITH_CONTRACT, (d) => put(d, SNAPSHOT, SCHEMA));
  put(dir, `${GENERATED}/types.ts`);
  const future = new Date(Date.now() + 60_000);
  fs.utimesSync(path.join(dir, `${GENERATED}/types.ts`), future, future);
  assert.deepEqual(only(checkRepo({ repoRoot: dir }), 'FE_WIRE_GENERATED'), []);
  assert.deepEqual(only(checkRepo({ repoRoot: repoOf(APP) }), 'FE_WIRE_GENERATED'), []);
});

// ------------------------------------------------------------------------------------------------ R59 FE_I18N_PLACEMENT

test('FE_I18N_PLACEMENT: no next-intl, no proxy.ts, a middleware.ts, a route file outside [locale], a missing default catalog and a stray catalog are refused', () => {
  const result = checkRepo({ repoRoot: repoOf(TWO_FE_APPS, (dir) => {
    // no fe workspace declares next-intl (each fe app is a workspace with its own package.json, R144)
    for (const app of ['web', 'admin']) put(dir, `fe/apps/${app}/package.json`, json({ name: `@demo/${app}`, private: true }));
    drop(dir, 'fe/apps/web/src/proxy.ts');
    put(dir, 'fe/apps/web/src/middleware.ts');
    put(dir, 'fe/apps/web/src/app/dashboard/page.tsx');
    drop(dir, 'fe/apps/web/src/modules/i18n/messages/vi.json');
    put(dir, 'fe/apps/web/src/modules/i18n/messages/nested/vi.json', '{}');
  }) });
  const found = only(result, 'FE_I18N_PLACEMENT');
  assert.deepEqual(found.map((f) => f.path).sort(), ['fe/apps/web/src/app/dashboard/page.tsx', 'fe/apps/web/src/middleware.ts', 'fe/apps/web/src/modules/i18n/messages/nested/vi.json',
    'fe/apps/web/src/modules/i18n/messages/vi.json', 'fe/apps/web/src/proxy.ts', 'package.json']);
  assert.ok(found.filter((f) => f.path !== 'package.json').every((f) => f.app === 'web'), 'the other app is clean');
});

test('FE_I18N_PLACEMENT: next-intl with proxy.ts, [locale] routes, health probes and the root redirect page are clean', () => {
  const result = checkRepo({ repoRoot: repoOf(APP, (dir) => { put(dir, 'fe/apps/web/src/app/[locale]/settings/page.tsx'); put(dir, 'fe/apps/web/src/app/page.tsx'); }) });
  assert.deepEqual(only(result, 'FE_I18N_PLACEMENT'), []);
  const shared = checkRepo({ repoRoot: repoOf(appOf({ fe: { apps: [{ name: 'web', kind: 'next' }], optionalSlots: ['fe.package.i18n'] } }), (dir) => {
    put(dir, 'package.json', json({ name: 'demo', private: true, workspaces: ['fe/packages/*'] }));
    put(dir, 'fe/packages/demo-i18n/package.json', json({ name: '@demo/i18n', private: true, dependencies: { 'next-intl': pins['next-intl'].version } }));
    put(dir, 'fe/packages/demo-i18n/src/index.ts');
    put(dir, 'fe/packages/demo-i18n/tsconfig.json', '{}');
  }) });
  assert.deepEqual(only(shared, 'FE_I18N_PLACEMENT'), [], 'the next-intl stack written once, in the shared i18n package');
});

// ------------------------------------------------------------------------------------------------ R60 FE_I18N_CATALOG

test('FE_I18N_CATALOG: a locale that lacks a key another locale has is refused', () => {
  const result = checkRepo({ repoRoot: repoOf(APP, (dir) => {
    put(dir, 'fe/apps/web/src/modules/i18n/messages/vi.json', json({ home: { title: 'Trang chu' }, only: 'vi' }));
    put(dir, 'fe/apps/web/src/modules/i18n/messages/en.json', json({ home: { title: 'Home', cta: 'Start' } }));
  }) });
  const found = only(result, 'FE_I18N_CATALOG');
  assert.deepEqual(found.map((f) => [f.path, f.missing]), [['fe/apps/web/src/modules/i18n/messages/en.json', ['only']], ['fe/apps/web/src/modules/i18n/messages/vi.json', ['home.cta']]]);
});

test('FE_I18N_CATALOG: catalogs with the same key set, and an app with one catalog, are clean', () => {
  const same = checkRepo({ repoRoot: repoOf(APP, (dir) => {
    put(dir, 'fe/apps/web/src/modules/i18n/messages/vi.json', json({ home: { title: 'Trang chu' } }));
    put(dir, 'fe/apps/web/src/modules/i18n/messages/en.json', json({ home: { title: 'Home' } }));
  }) });
  assert.deepEqual(only(same, 'FE_I18N_CATALOG'), []);
  const single = checkRepo({ repoRoot: repoOf(APP, (dir) => drop(dir, 'fe/apps/web/src/modules/i18n/messages/en.json')) });
  assert.deepEqual(only(single, 'FE_I18N_CATALOG'), []);
});
