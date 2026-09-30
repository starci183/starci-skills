// The tree checks of `hfs check` that read file content or configuration (scripts/lib/hfs-rules): R06 plaintext secrets, R10 the
// .starcistacks shape, R13 the canon steps of CI and pre-push, R14 dependency version skew, R23 the contract snapshot, R47 the
// test topology, and R52 / R59 / R60 the front-end wire, i18n placement and catalog. Each has a violating and a passing tree
// and the finding names its rule's code; the clean repository of tests/_hfs-cli-fixture.mjs is the passing one.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseYaml } from '../engine/yaml.mjs';
import { checkRepo } from '../scripts/lib/hfs-check.mjs';
import { BE, FE, STACKS_DECLARATION, cleanup, gitAdd, writeCleanRepo } from './_hfs-cli-fixture.mjs';

const root = path.resolve(import.meta.dirname, '..');
const pins = parseYaml(fs.readFileSync(path.join(root, 'knowledge/hfs/canon-pins.yaml'), 'utf8')).pins;
const made = [];
const repoOf = (declaration, mutate, options) => {
  const dir = writeCleanRepo(declaration, options);
  made.push(dir);
  if (mutate) mutate(dir);
  return gitAdd(dir);
};
test.after(() => cleanup(made));

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
  const result = checkRepo({ repoRoot: repoOf(BE, (dir) => {
    put(dir, '.env', 'A=1\n');
    put(dir, 'certs/server.pem', 'not a key\n');
    put(dir, 'src/features/orders/application/keys.ts', `export const key = '${AWS_KEY}';\n`);
    put(dir, '.starcistacks/dev/secrets/db.enc', 'password=hunter2\n');
  }) });
  const found = only(result, 'HFS_PLAINTEXT_SECRET');
  assert.deepEqual(found.map((f) => f.path).sort(), ['.env', '.starcistacks/dev/secrets/db.enc', 'certs/server.pem', 'src/features/orders/application/keys.ts']);
  assert.deepEqual(only(result, 'HFS_FORBIDDEN_PRESENT'), [], 'a plaintext env file is one finding, under the secret rule');
  const inline = found.find((f) => f.path.endsWith('keys.ts'));
  assert.equal(inline.pattern, 'aws-access-key');
  assert.equal(inline.line, 1);
  assert.ok(!JSON.stringify(found).includes(AWS_KEY), 'a finding never carries the value');
  assert.match(found.find((f) => f.path === '.starcistacks/dev/secrets/db.enc').message, /not a sops envelope/);
});

test('HFS_PLAINTEXT_SECRET: a sops envelope, a stand-in value and a spec file are clean', () => {
  const result = checkRepo({ repoRoot: repoOf(BE, (dir) => {
    put(dir, '.starcistacks/dev/secrets/db.enc', SOPS_ENVELOPE);
    put(dir, 'src/features/orders/application/pay.ts', "export const password = 'fixture-not-a-real-secret-value';\n");
    put(dir, 'src/features/orders/application/pay.spec.ts', "export const password = 'a-real-looking-value-12345';\n");
  }) });
  assert.deepEqual(only(result, 'HFS_PLAINTEXT_SECRET'), []);
});

// ------------------------------------------------------------------------------------------------ R10 HFS_STACKS_SHAPE

const STANDARD_TREE = ['.starcistacks/dev/README.md', '.starcistacks/dev/environment.json', '.starcistacks/dev/infra/compose/compose.yaml', '.starcistacks/dev/runtime/env/KEYS.md',
  '.starcistacks/dev/runtime/config/app.json', '.starcistacks/dev/seeds/01-schema.sql'];

test('HFS_STACKS_SHAPE: runtime/files, a sealed file outside secrets/, DESIGN.md, a root k8s and a non-host Sonar are refused', () => {
  const result = checkRepo({ repoRoot: repoOf(BE, (dir) => {
    put(dir, '.starcistacks/dev/runtime/files/key.enc', SOPS_ENVELOPE);
    put(dir, '.starcistacks/dev/runtime/env/app.env.enc', SOPS_ENVELOPE);
    put(dir, '.starcistacks/DESIGN.md', '# design\n');
    put(dir, '.starcistacks/k8s/pod.yaml', 'kind: Pod\n');
    put(dir, '.starcistacks/dev/infra/metadata.json', '{}\n');
    put(dir, '.starcistacks/application-stacks.yaml', STACKS_DECLARATION.replace('owner: host', 'owner: repository'));
  }) });
  assert.deepEqual(pathsOf(result, 'HFS_STACKS_SHAPE'), ['.starcistacks/DESIGN.md', '.starcistacks/application-stacks.yaml', '.starcistacks/dev/infra/metadata.json',
    '.starcistacks/dev/runtime/env/app.env.enc', '.starcistacks/dev/runtime/files/key.enc', '.starcistacks/k8s/pod.yaml']);
  assert.match(only(result, 'HFS_STACKS_SHAPE').find((f) => f.path.endsWith('application-stacks.yaml')).message, /not owned by the host/);
});

test('HFS_STACKS_SHAPE: a service still rooted at .stacks and a declaration with no sonar are refused', () => {
  const stale = checkRepo({ repoRoot: repoOf(BE, (dir) => put(dir, '.starcistacks/application-stacks.yaml', `${STACKS_DECLARATION}  codecov:\n    provider: codecov\n    mode: local\n    stack:\n      repository: demo\n      root: .stacks\n      environment: dev\n`)) });
  assert.match(only(stale, 'HFS_STACKS_SHAPE')[0].message, /retired \.stacks root/);
  const silent = checkRepo({ repoRoot: repoOf(BE, (dir) => put(dir, '.starcistacks/application-stacks.yaml', 'schema: starci/application-stacks@1\nservices:\n  codecov:\n    provider: codecov\n    mode: disabled\n')) });
  assert.match(only(silent, 'HFS_STACKS_SHAPE')[0].message, /no sonar service/);
});

test('HFS_STACKS_SHAPE: the standard tree with a host-owned Sonar is clean', () => {
  const result = checkRepo({ repoRoot: repoOf(BE, (dir) => {
    for (const file of STANDARD_TREE) put(dir, file, file.endsWith('.json') ? '{}\n' : 'x\n');
    put(dir, '.starcistacks/dev/secrets/uat.enc', SOPS_ENVELOPE);
  }) });
  assert.deepEqual(only(result, 'HFS_STACKS_SHAPE'), []);
  assert.equal(result.ok, true, JSON.stringify(result.findings.slice(0, 3)));
});

// ------------------------------------------------------------------------------------------------ R13 HFS_CI_MISSING_CANON

const CI_STEP = '      - name: hfs check\n        run: npm run hfs:report\n';

test('HFS_CI_MISSING_CANON: a CI without the hfs check, a --fast check, another version, a script that is not the check and a pre-push without typecheck or lint are refused', () => {
  const ci = fs.readFileSync(path.join(repoOf(BE), '.github/workflows/ci.yml'), 'utf8');
  assert.ok(ci.includes(CI_STEP), 'the rendered CI runs the check through the hfs:report script');
  const withStep = (line) => ci.replace('run: npm run hfs:report', `run: ${line}`);
  const missing = checkRepo({ repoRoot: repoOf(BE, (dir) => put(dir, '.github/workflows/ci.yml', ci.replace(CI_STEP, ''))) });
  assert.deepEqual(only(missing, 'HFS_CI_MISSING_CANON').map((f) => f.path), ['.github/workflows/ci.yml']);
  const fast = checkRepo({ repoRoot: repoOf(BE, (dir) => put(dir, '.github/workflows/ci.yml', withStep('npx hfs check --fast'))) });
  assert.equal(only(fast, 'HFS_CI_MISSING_CANON').length, 1);
  const drifted = checkRepo({ repoRoot: repoOf(BE, (dir) => put(dir, '.github/workflows/ci.yml', withStep('npx @starci/hfs@0.0.1 check'))) });
  assert.match(only(drifted, 'HFS_CI_MISSING_CANON')[0].message, new RegExp(`pinned at ${pins['@starci/hfs'].version.replace(/\./g, '\.')}`));
  const hollow = checkRepo({ repoRoot: repoOf(BE, (dir) => put(dir, 'package.json', json({ name: 'demo', private: true, scripts: { 'hfs:report': 'echo ok' } }))) });
  assert.equal(only(hollow, 'HFS_CI_MISSING_CANON').length, 1, 'a script that does not run hfs check is no check');
  const prePush = checkRepo({ repoRoot: repoOf(BE, (dir) => put(dir, '.husky/pre-push', '# gate\nnpm run typecheck\nnpx hfs check --fast\n')) });
  assert.deepEqual(only(prePush, 'HFS_CI_MISSING_CANON').map((f) => f.step), ['lint:check']);
});

test('HFS_CI_MISSING_CANON: the rendered CI and pre-push, and the pinned version spelled out, are clean', () => {
  assert.deepEqual(only(checkRepo({ repoRoot: repoOf(BE) }), 'HFS_CI_MISSING_CANON'), []);
  const ci = fs.readFileSync(path.join(repoOf(FE), '.github/workflows/ci.yml'), 'utf8');
  const pinned = checkRepo({ repoRoot: repoOf(FE, (dir) => put(dir, '.github/workflows/ci.yml', ci.replace('run: npm run hfs:report', `run: npx @starci/hfs@${pins['@starci/hfs'].version} check`))) });
  assert.deepEqual(only(pinned, 'HFS_CI_MISSING_CANON'), []);
});

// ------------------------------------------------------------------------------------------------ R14 HFS_DEP_VERSION_SKEW

const withManifests = (web, admin, lock) => (dir) => {
  put(dir, 'apps/web/package.json', json({ name: '@demo/web', private: true, dependencies: { 'next-intl': '4.13.6', ...web } }));
  put(dir, 'apps/admin/package.json', json({ name: '@demo/admin', private: true, dependencies: { 'next-intl': '4.13.6', ...admin } }));
  if (lock) put(dir, 'package-lock.json', json(lock));
};

test('HFS_DEP_VERSION_SKEW: two workspaces at two versions, and a nested lockfile copy of a declared package, are refused', () => {
  const skew = checkRepo({ repoRoot: repoOf(FE, withManifests({ 'left-pad': '1.3.0' }, { 'left-pad': '1.0.0' })) });
  const [finding] = only(skew, 'HFS_DEP_VERSION_SKEW');
  assert.equal(finding.dependency, 'left-pad');
  assert.deepEqual(finding.versions.sort(), ['1.0.0', '1.3.0']);
  const nested = checkRepo({ repoRoot: repoOf(FE, withManifests({ 'left-pad': '1.3.0' }, { 'left-pad': '1.3.0' }, {
    lockfileVersion: 3,
    packages: { '': {}, 'node_modules/left-pad': { version: '1.3.0' }, 'apps/web/node_modules/left-pad': { version: '1.0.0' } },
  })) });
  const [copy] = only(nested, 'HFS_DEP_VERSION_SKEW');
  assert.equal(copy.path, 'package-lock.json');
  assert.equal(copy.lockPath, 'apps/web/node_modules/left-pad');
});

test('HFS_DEP_VERSION_SKEW: one version everywhere, workspace links, and a transitive duplicate nobody declares are clean', () => {
  const result = checkRepo({ repoRoot: repoOf(FE, withManifests({ 'left-pad': '1.3.0', '@demo/kit': 'workspace:*' }, { 'left-pad': '1.3.0', '@demo/kit': 'file:../kit' }, {
    lockfileVersion: 3,
    packages: { '': {}, 'node_modules/left-pad': { version: '1.3.0' }, 'node_modules/semver': { version: '7.6.0' }, 'node_modules/glob/node_modules/semver': { version: '6.3.1' },
      'node_modules/@demo/web': { resolved: 'apps/web', link: true } },
  })) });
  assert.deepEqual(only(result, 'HFS_DEP_VERSION_SKEW'), []);
});

// ------------------------------------------------------------------------------------------------ R23 HFS_CONTRACT_SNAPSHOT_DRIFT

const GRAPHQL = 'src/features/orders/transport/graphql/orders-graphql.module.ts';
const BE_WITH_CONTRACT = { ...BE, optionalSlots: ['be.contract.graphql'] };
const SCHEMA = 'type Query {\n  ping: String\n}\n';

test('HFS_CONTRACT_SNAPSHOT_DRIFT: a back end that serves GraphQL without a committed snapshot is refused', () => {
  const result = checkRepo({ repoRoot: repoOf(BE_WITH_CONTRACT, (dir) => put(dir, GRAPHQL)) });
  assert.deepEqual(only(result, 'HFS_CONTRACT_SNAPSHOT_DRIFT').map((f) => f.path), ['contracts/core/schema.graphql']);
});

test('HFS_CONTRACT_SNAPSHOT_DRIFT: a committed snapshot, and a back end with no GraphQL, are clean', () => {
  const committed = checkRepo({ repoRoot: repoOf(BE_WITH_CONTRACT, (dir) => { put(dir, GRAPHQL); put(dir, 'contracts/core/schema.graphql', SCHEMA); }) });
  assert.deepEqual(only(committed, 'HFS_CONTRACT_SNAPSHOT_DRIFT'), []);
  assert.deepEqual(only(checkRepo({ repoRoot: repoOf(BE) }), 'HFS_CONTRACT_SNAPSHOT_DRIFT'), []);
});

/** A front-end repository `fe` and its sibling back end `be` under one directory; `feCopy` is the front end's copy of the snapshot. */
function siblings({ feCopy, beSnapshot, stacks = '../be', withBackend = true }) {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-contract-'));
  made.push(parent);
  if (withBackend) {
    put(path.join(parent, 'be'), 'contracts/web/schema.graphql', beSnapshot ?? SCHEMA);
  }
  const declaration = { ...FE, apps: [FE.apps[0]], optionalSlots: ['fe.contract.copy'], ...(stacks ? { stacks } : {}) };
  const dir = writeCleanRepo(declaration, { into: parent, name: 'fe' });
  put(dir, 'apps/web/src/modules/api/contract/web.graphql', feCopy);
  put(dir, 'apps/web/package.json', json(WIRED));
  for (const file of ['index.ts', 'client.ts', 'outcome.ts']) put(dir, `apps/web/src/modules/api/${file}`);   // the api module a contract copy makes real
  return checkRepo({ repoRoot: gitAdd(dir) });
}

test('HFS_CONTRACT_SNAPSHOT_DRIFT: a front-end copy that differs from the sibling back end, has no back end snapshot, or names no sibling is refused', () => {
  const drift = siblings({ feCopy: `${SCHEMA}# stale\n` });
  const [finding] = only(drift, 'HFS_CONTRACT_SNAPSHOT_DRIFT');
  assert.equal(finding.path, 'apps/web/src/modules/api/contract/web.graphql');
  assert.match(finding.message, /contract:pull/);
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-contract-'));
  made.push(parent);
  fs.mkdirSync(path.join(parent, 'be'));
  const dir = writeCleanRepo({ ...FE, apps: [FE.apps[0]], optionalSlots: ['fe.contract.copy'], stacks: '../be' }, { into: parent, name: 'fe' });
  put(dir, 'apps/web/src/modules/api/contract/web.graphql', SCHEMA);
  put(dir, 'apps/web/package.json', json(WIRED));
  assert.match(only(checkRepo({ repoRoot: gitAdd(dir) }), 'HFS_CONTRACT_SNAPSHOT_DRIFT')[0].message, /does not exist/);
  assert.match(only(siblings({ feCopy: SCHEMA, stacks: null }), 'HFS_CONTRACT_SNAPSHOT_DRIFT')[0].message, /names no sibling back end/);
});

test('HFS_CONTRACT_SNAPSHOT_DRIFT: an equal copy (line endings folded) is clean, and a sibling that is not checked out is reported, not compared', () => {
  const equal = siblings({ feCopy: SCHEMA.replace(/\n/g, '\r\n') });
  assert.deepEqual(only(equal, 'HFS_CONTRACT_SNAPSHOT_DRIFT'), []);
  const absent = siblings({ feCopy: SCHEMA, withBackend: false });
  const [note] = only(absent, 'HFS_CONTRACT_SNAPSHOT_DRIFT');
  assert.equal(note.level, 'info');
  assert.equal(absent.ok, true, 'a copy that could not be compared does not fail the check');
});

// ------------------------------------------------------------------------------------------------ R47 BE_TEST_TOPOLOGY

test('BE_TEST_TOPOLOGY: a .test file, a testing/ folder, a second jest configuration and a jest key in package.json are refused', () => {
  const result = checkRepo({ repoRoot: repoOf(BE, (dir) => {
    put(dir, 'src/features/orders/application/place-order.test.ts');
    put(dir, 'src/modules/domain/billing/testing/mock-billing.ts');
    put(dir, 'jest.config.e2e.js');
    put(dir, 'apps/core/jest.config.js');
    put(dir, 'package.json', json({ name: 'demo', private: true, jest: { preset: 'ts-jest' } }));
  }) });
  assert.deepEqual(pathsOf(result, 'BE_TEST_TOPOLOGY'), ['apps/core/jest.config.js', 'jest.config.e2e.js', 'package.json', 'src/features/orders/application/place-order.test.ts', 'src/modules/domain/billing/testing/mock-billing.ts']);
});

test('BE_TEST_TOPOLOGY: unit specs beside their subject, the root jest.config.js and the jest setup file are clean', () => {
  const result = checkRepo({ repoRoot: repoOf(BE, (dir) => {
    put(dir, 'src/features/orders/application/place-order.spec.ts');
    put(dir, 'src/tests/e2e/setup/jest.setup.ts');
  }) });
  assert.deepEqual(only(result, 'BE_TEST_TOPOLOGY'), []);
});

// ------------------------------------------------------------------------------------------------ R52 FE_WIRE_GENERATED

const WEB_MANIFEST = { name: '@demo/web', private: true, dependencies: { 'next-intl': '4.13.6' } };
const WIRED = { ...WEB_MANIFEST, scripts: { codegen: 'graphql-codegen', prebuild: 'npm run codegen', pretypecheck: 'npm run codegen' } };
const WITH_COPY = { ...FE, optionalSlots: ['fe.contract.copy'] };
const COPY = 'apps/web/src/modules/api/contract/web.graphql';

test('FE_WIRE_GENERATED: a contract copy without codegen, or without it before build and typecheck, and stale generated types are refused', () => {
  const none = checkRepo({ repoRoot: repoOf(WITH_COPY, (dir) => put(dir, COPY, 'type Query { a: Int }\n')) });
  assert.match(only(none, 'FE_WIRE_GENERATED')[0].message, /no `codegen` script/);
  const half = checkRepo({ repoRoot: repoOf(WITH_COPY, (dir) => { put(dir, COPY, 'type Query { a: Int }\n'); put(dir, 'apps/web/package.json', json({ ...WEB_MANIFEST, scripts: { codegen: 'graphql-codegen', prebuild: 'npm run codegen' } })); }) });
  assert.deepEqual(only(half, 'FE_WIRE_GENERATED').map((f) => f.script), ['pretypecheck']);
  const dir = repoOf(WITH_COPY, (d) => { put(d, COPY, 'type Query { a: Int }\n'); put(d, 'apps/web/package.json', json(WIRED)); });
  put(dir, 'apps/web/src/modules/api/__generated__/types.ts');
  const old = new Date(Date.now() - 3_600_000);
  fs.utimesSync(path.join(dir, 'apps/web/src/modules/api/__generated__/types.ts'), old, old);
  const stale = checkRepo({ repoRoot: dir });
  assert.deepEqual(only(stale, 'FE_WIRE_GENERATED').map((f) => f.path), ['apps/web/src/modules/api/__generated__']);
});

test('FE_WIRE_GENERATED: codegen wired before build and typecheck, generated types newer than the copy, and an app with no copy are clean', () => {
  const dir = repoOf(WITH_COPY, (d) => { put(d, COPY, 'type Query { a: Int }\n'); put(d, 'apps/web/package.json', json(WIRED)); });
  put(dir, 'apps/web/src/modules/api/__generated__/types.ts');
  const future = new Date(Date.now() + 60_000);
  fs.utimesSync(path.join(dir, 'apps/web/src/modules/api/__generated__/types.ts'), future, future);
  assert.deepEqual(only(checkRepo({ repoRoot: dir }), 'FE_WIRE_GENERATED'), []);
  assert.deepEqual(only(checkRepo({ repoRoot: repoOf(FE) }), 'FE_WIRE_GENERATED'), []);
});

// ------------------------------------------------------------------------------------------------ R59 FE_I18N_PLACEMENT

test('FE_I18N_PLACEMENT: no next-intl, no proxy.ts, a middleware.ts, a route file outside [locale], a missing default catalog and a stray catalog are refused', () => {
  const result = checkRepo({ repoRoot: repoOf(FE, (dir) => {
    put(dir, 'apps/web/package.json', json({ name: '@demo/web', private: true }));
    drop(dir, 'apps/web/src/proxy.ts');
    put(dir, 'apps/web/src/middleware.ts');
    put(dir, 'apps/web/src/app/dashboard/page.tsx');
    drop(dir, 'apps/web/src/modules/i18n/messages/vi.json');
    put(dir, 'apps/web/src/modules/i18n/messages/nested/vi.json', '{}');
  }) });
  const found = only(result, 'FE_I18N_PLACEMENT');
  assert.deepEqual(found.map((f) => f.path).sort(), ['apps/web/package.json', 'apps/web/src/app/dashboard/page.tsx', 'apps/web/src/middleware.ts', 'apps/web/src/modules/i18n/messages/nested/vi.json',
    'apps/web/src/modules/i18n/messages/vi.json', 'apps/web/src/proxy.ts']);
  assert.ok(found.every((f) => f.app === 'web'), 'the other app is clean');
});

test('FE_I18N_PLACEMENT: next-intl with proxy.ts, [locale] routes, health probes and the root redirect page are clean', () => {
  const result = checkRepo({ repoRoot: repoOf(FE, (dir) => { put(dir, 'apps/web/src/app/[locale]/settings/page.tsx'); put(dir, 'apps/web/src/app/page.tsx'); }) });
  assert.deepEqual(only(result, 'FE_I18N_PLACEMENT'), []);
  const shared = checkRepo({ repoRoot: repoOf({ ...FE, optionalSlots: ['repo.packages'] }, (dir) => {
    put(dir, 'apps/web/package.json', json({ name: '@demo/web', private: true }));
    put(dir, 'apps/admin/package.json', json({ name: '@demo/admin', private: true }));
    put(dir, 'packages/demo-i18n/package.json', json({ name: '@demo/i18n', private: true, dependencies: { 'next-intl': '4.13.6' } }));
    put(dir, 'packages/demo-i18n/src/index.ts');
    put(dir, 'packages/demo-i18n/tsconfig.json', '{}');
  }) });
  assert.deepEqual(only(shared, 'FE_I18N_PLACEMENT'), [], 'the next-intl stack written once, in the shared i18n package');
});

// ------------------------------------------------------------------------------------------------ R60 FE_I18N_CATALOG

test('FE_I18N_CATALOG: a locale that lacks a key another locale has is refused', () => {
  const result = checkRepo({ repoRoot: repoOf(FE, (dir) => {
    put(dir, 'apps/web/src/modules/i18n/messages/vi.json', json({ home: { title: 'Trang chu' }, only: 'vi' }));
    put(dir, 'apps/web/src/modules/i18n/messages/en.json', json({ home: { title: 'Home', cta: 'Start' } }));
  }) });
  const found = only(result, 'FE_I18N_CATALOG');
  assert.deepEqual(found.map((f) => [f.path, f.missing]), [['apps/web/src/modules/i18n/messages/en.json', ['only']], ['apps/web/src/modules/i18n/messages/vi.json', ['home.cta']]]);
});

test('FE_I18N_CATALOG: catalogs with the same key set, and an app with one catalog, are clean', () => {
  const same = checkRepo({ repoRoot: repoOf(FE, (dir) => {
    put(dir, 'apps/web/src/modules/i18n/messages/vi.json', json({ home: { title: 'Trang chu' } }));
    put(dir, 'apps/web/src/modules/i18n/messages/en.json', json({ home: { title: 'Home' } }));
  }) });
  assert.deepEqual(only(same, 'FE_I18N_CATALOG'), []);
  const single = checkRepo({ repoRoot: repoOf(FE, (dir) => drop(dir, 'apps/web/src/modules/i18n/messages/en.json')) });
  assert.deepEqual(only(single, 'FE_I18N_CATALOG'), []);
});
