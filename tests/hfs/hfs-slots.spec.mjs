import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { parseYaml } from '../../engine/yaml.mjs';
import { braceVariants } from '../../scripts/lib/glob.mjs';
import { HfsSlotsError, appRelativeMessages, loadSlotManifest, ruleParams, openHfs, readRepoDeclaration, resolveRepoDeclaration } from '../../scripts/hfs/slots.mjs';

// The slot manifest (knowledge/hfs/slots.yaml) and its resolver. A product is ONE app: the app root holds the slots of profile app
// (hfs.json, README, the one package.json and lockfile, CI, hooks, .starciwork), and be/ and fe/ are its sides, each judged with its
// folder as the root it was when products were split in two repositories (the side view, `openHfs({ declaration, side })`).

const root = path.resolve(import.meta.dirname, '..', '..');
const manifestText = fs.readFileSync(path.join(root, 'knowledge/hfs/slots.yaml'), 'utf8');
const readSchema = (name) => parseYaml(fs.readFileSync(path.join(root, 'modules/schemas', name), 'utf8'));

const Ajv2020 = (() => { const loaded = createRequire(import.meta.url)('ajv/dist/2020.js'); return loaded.default ?? loaded; })();
const ajv = new Ajv2020({ strict: false, allErrors: true, logger: false });
const validateManifestSchema = ajv.compile(readSchema('hfs-slots.schema.yaml'));
const validateRepoSchema = ajv.compile(readSchema('hfs-repo.schema.yaml'));

const BE_SIDE = { apps: [{ name: 'core', kind: 'api' }, { name: 'worker', kind: 'worker' }, { name: 'cli', kind: 'cli' }], optionalSlots: ['be.transport.schedule', 'be.contract.graphql', 'repo.docs'], connections: [{ name: 'primary', envPrefix: 'PRIMARY_DB' }, { name: 'agentos', envPrefix: 'AGENTOS_DB' }] };
const FE_SIDE = { apps: [{ name: 'web', kind: 'next' }, { name: 'admin', kind: 'next' }], optionalSlots: ['repo.packages', 'fe.package.ui'], reads: ['be/contracts/'] };
const app = ({ be = BE_SIDE, fe = FE_SIDE, ...rest } = {}) => ({ hfs: 2, kind: 'app', project: 'nivo', sides: { be, fe }, ...rest });
const APP = app();

const refusal = (fn, code) => assert.throws(fn, (error) => error instanceof HfsSlotsError && error.code === code, `expected ${code}`);
const sideOf = (declaration, side, options = {}) => openHfs({ declaration, side, ...options });

test('the shipped manifest is 2.0.0 and validates against its JSON schema and the loader', () => {
  const doc = parseYaml(manifestText);
  assert.equal(doc.version, '2.0.0');
  assert.equal(validateManifestSchema(doc), true, JSON.stringify(validateManifestSchema.errors));
  const manifest = loadSlotManifest();
  assert.equal(manifest.major, 2);
  for (const slot of manifest.slots) {
    for (const field of ['id', 'profiles', 'path', 'presence', 'tracked', 'tier', 'tests']) assert.notEqual(slot[field], undefined, `${slot.id} lacks ${field}`);
    if (slot.profiles.includes('app')) assert.deepEqual(slot.profiles, ['app'], `${slot.id}: a slot of the app root belongs to no side`);
  }
  assert.equal(new Set(manifest.slots.map((s) => s.id)).size, manifest.slots.length);
});

test('schema and loader agree on a broken manifest', () => {
  const broken = (mutate) => { const doc = parseYaml(manifestText); mutate(doc); return doc; };
  const cases = {
    'slot without a tier': (d) => { delete d.slots[0].tier; },
    'unknown presence': (d) => { d.slots[0].presence = 'sometimes'; },
    'external slot that is not forbidden': (d) => { d.slots.find((s) => s.tracked === 'external').presence = 'optional'; },
    'unknown slot field': (d) => { d.slots[0].colour = 'red'; },
    'retired slot without a successor': (d) => { d.slots[0].retiredIn = 3; },
    'version not semver': (d) => { d.version = '2.0'; },
  };
  for (const [name, mutate] of Object.entries(cases)) {
    const doc = broken(mutate);
    assert.equal(validateManifestSchema(doc), false, `schema accepted: ${name}`);
    const text = JSON.stringify(doc);
    refusal(() => loadSlotManifest({ text }), 'HFS_MANIFEST_INVALID');
  }
});

test('the loader also refuses what only semantics can see', () => {
  const load = (mutate) => { const doc = parseYaml(manifestText); mutate(doc); return () => loadSlotManifest({ text: JSON.stringify(doc) }); };
  refusal(load((d) => { d.slots[1].id = d.slots[0].id; }), 'HFS_MANIFEST_INVALID');
  refusal(load((d) => { d.slots[0].tier = 'nowhere'; }), 'HFS_MANIFEST_INVALID');
  refusal(load((d) => { d.tiers.be.app.mayImport.push('ghost'); }), 'HFS_MANIFEST_INVALID');
  refusal(load((d) => { d.appKinds.be.push('lambda'); }), 'HFS_MANIFEST_INVALID');
  refusal(load((d) => { d.schema = 'starci/hfs-slots@3'; }), 'HFS_MANIFEST_INVALID');
  refusal(load((d) => { d.slots.find((s) => s.id === 'be.transport.http').requires = ['<nope>.module.ts']; }), 'HFS_MANIFEST_INVALID');
  refusal(load((d) => { d.slots.push({ ...d.slots.find((s) => s.id === 'app.readme'), id: 'app.readme-twin' }); }), 'HFS_MANIFEST_INVALID');
  refusal(load((d) => { d.sides.fe.reads = ['contracts']; }), 'HFS_MANIFEST_INVALID');                       // a read is a <side>/<dir>/ path
});

test('hfs.json: schema and loader agree', () => {
  assert.equal(validateRepoSchema(APP), true, JSON.stringify(validateRepoSchema.errors));
  const manifest = loadSlotManifest();
  const bad = {
    'missing hfs': { ...APP, hfs: undefined },
    'a standalone back end (profile)': { hfs: 2, profile: 'be', project: 'nivo', apps: [{ name: 'core', kind: 'api' }] },
    'kind other than app': { ...APP, kind: 'be' },
    'one side only': { ...APP, sides: { be: BE_SIDE } },
    'fe with connections': app({ fe: { ...FE_SIDE, connections: [{ name: 'primary', envPrefix: 'PRIMARY_DB' }] } }),
    'connection as a bare string': app({ be: { ...BE_SIDE, connections: ['primary'] } }),
    'no apps on a side': app({ fe: { apps: [] } }),
    'unknown key': { ...APP, owners: ['x'] },
    'unknown side key': app({ be: { ...BE_SIDE, stacks: '../nivo-backend' } }),
    'bad project name': { ...APP, project: 'Nivo Backend' },
  };
  for (const [name, declaration] of Object.entries(bad)) {
    assert.equal(validateRepoSchema(JSON.parse(JSON.stringify(declaration))), false, `schema accepted: ${name}`);
    refusal(() => resolveRepoDeclaration(manifest, declaration), 'HFS_DECLARATION_INVALID');
  }
  // semantic only (the schema cannot state them): one name per database, env keys disjoint across connections, app names unique across sides
  for (const connections of [
    [{ name: 'primary', envPrefix: 'A_DB' }, { name: 'primary', envPrefix: 'B_DB' }],
    [{ name: 'order', envPrefix: 'ORDER' }, { name: 'order-archive', envPrefix: 'ORDER_ARCHIVE' }],
  ]) refusal(() => resolveRepoDeclaration(manifest, app({ be: { ...BE_SIDE, connections } })), 'HFS_DECLARATION_INVALID');
  refusal(() => resolveRepoDeclaration(manifest, app({ fe: { apps: [{ name: 'core', kind: 'next' }] } })), 'HFS_DECLARATION_INVALID');
  assert.deepEqual(resolveRepoDeclaration(manifest, APP, { side: 'be' }).connections, BE_SIDE.connections);
  assert.equal(resolveRepoDeclaration(manifest, APP).profile, 'app');
});

test('a declaration is checked against the manifest, per side', () => {
  const manifest = loadSlotManifest();
  const be = (fields) => app({ be: { ...BE_SIDE, ...fields } });
  refusal(() => resolveRepoDeclaration(manifest, be({ apps: [...BE_SIDE.apps, { name: 'game', kind: 'unity' }] })), 'HFS_DECLARATION_INVALID');
  refusal(() => resolveRepoDeclaration(manifest, be({ apps: [{ name: 'core', kind: 'api' }, { name: 'core', kind: 'cli' }, { name: 'cli', kind: 'cli' }] })), 'HFS_DECLARATION_INVALID');
  refusal(() => resolveRepoDeclaration(manifest, be({ optionalSlots: ['be.feature'] })), 'HFS_DECLARATION_INVALID');          // required, not opt-in
  refusal(() => resolveRepoDeclaration(manifest, be({ optionalSlots: ['be.app.worker'] })), 'HFS_DECLARATION_INVALID');       // implied by an app of its kind
  refusal(() => resolveRepoDeclaration(manifest, be({ optionalSlots: ['fe.package.ui'] })), 'HFS_DECLARATION_INVALID');       // the other side's
  refusal(() => resolveRepoDeclaration(manifest, be({ optionalSlots: ['app.ci-e2e'] })), 'HFS_DECLARATION_INVALID');          // the root's
  refusal(() => resolveRepoDeclaration(manifest, be({ optionalSlots: ['be.made.up'] })), 'HFS_DECLARATION_INVALID');
  refusal(() => resolveRepoDeclaration(manifest, be({ apps: [{ name: 'core', kind: 'worker' }, { name: 'cli', kind: 'cli' }] })), 'HFS_DECLARATION_INVALID');   // no api app
  // connections declared and no cli app: the declaration stands; BE_CLI_REQUIRED (hfs check) names the missing cli app
  assert.doesNotThrow(() => resolveRepoDeclaration(manifest, be({ apps: [{ name: 'core', kind: 'api' }] })));
  refusal(() => resolveRepoDeclaration(manifest, be({ apps: [{ name: 'core', kind: 'api' }, { name: 'migrate', kind: 'migrate' }] })), 'HFS_DECLARATION_INVALID');   // the migrate kind is gone: a cli command migrates
  assert.doesNotThrow(() => resolveRepoDeclaration(manifest, be({ apps: [{ name: 'core', kind: 'api' }], connections: [] })));
  refusal(() => resolveRepoDeclaration(manifest, app({ fe: { ...FE_SIDE, apps: [] } })), 'HFS_DECLARATION_INVALID');
  refusal(() => resolveRepoDeclaration(manifest, app({ fe: { ...FE_SIDE, reads: ['be/src/'] } })), 'HFS_DECLARATION_INVALID');  // only the manifest's reads
  refusal(() => resolveRepoDeclaration(manifest, app({ be: { ...BE_SIDE, reads: ['fe/apps/'] } })), 'HFS_DECLARATION_INVALID');  // the be side reads nothing
  refusal(() => resolveRepoDeclaration(manifest, APP, { side: 'root' }), 'HFS_DECLARATION_INVALID');
});

test('readRepoDeclaration reads the app hfs.json at the app root, the side view from a side folder, and refuses a missing one (never "unavailable")', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-hfs-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const manifest = loadSlotManifest();
  refusal(() => readRepoDeclaration(manifest, dir), 'HFS_DECLARATION_INVALID');
  fs.writeFileSync(path.join(dir, 'hfs.json'), JSON.stringify(APP));
  assert.equal(readRepoDeclaration(manifest, dir).project, 'nivo');
  assert.equal(openHfs({ repoRoot: dir }).repo.profile, 'app');
  for (const side of ['be', 'fe']) {
    fs.mkdirSync(path.join(dir, side));
    const view = openHfs({ repoRoot: path.join(dir, side) }).repo;
    assert.deepEqual([view.profile, view.side], [side, side], `${side}/ is judged with the view of its side`);
  }
  fs.mkdirSync(path.join(dir, 'tools'));
  refusal(() => readRepoDeclaration(manifest, path.join(dir, 'tools')), 'HFS_DECLARATION_INVALID');   // a folder that is no side has no declaration
  fs.writeFileSync(path.join(dir, 'hfs.json'), '{not json');
  refusal(() => readRepoDeclaration(manifest, dir), 'HFS_DECLARATION_INVALID');
});

test('a manifest major mismatch is refused, in either direction, with no compatibility window', () => {
  const manifest = loadSlotManifest();
  try {
    resolveRepoDeclaration(manifest, { ...APP, hfs: 1 });
    assert.fail('major 1 was accepted by a 2.x manifest');
  } catch (error) {
    assert.equal(error.code, 'HFS_MANIFEST_MAJOR_MISMATCH');
    assert.deepEqual([error.details.pinned, error.details.manifestMajor], [1, 2]);
  }
  const next = loadSlotManifest({ text: manifestText.replace('schema: starci/hfs-slots@2', 'schema: starci/hfs-slots@3').replace('version: 2.0.0', 'version: 3.0.0') });
  assert.equal(next.major, 3);
  refusal(() => resolveRepoDeclaration(next, APP), 'HFS_MANIFEST_MAJOR_MISMATCH');           // an app pinned to the old major
  assert.equal(resolveRepoDeclaration(next, { ...APP, hfs: 3 }).hfs, 3);
});

test('the app root: its own slots, a side path through the side, and the files of the old repository root forbidden in a side', () => {
  const whole = openHfs({ declaration: APP });
  const owner = (p) => { const c = whole.classifyPath(p); return `${c.status}:${c.slot ?? ''}`; };
  assert.equal(owner('README.md'), 'owned:app.readme');
  assert.equal(owner('hfs.json'), 'owned:app.declaration');
  assert.equal(owner('package.json'), 'owned:app.package-manifest');
  assert.equal(owner('package-lock.json'), 'owned:app.lockfile');
  assert.equal(owner('.prettierrc'), 'owned:app.format-config');
  assert.equal(owner('sonar-project.properties'), 'owned:app.quality-config');
  assert.equal(owner('.husky/pre-push'), 'owned:app.hooks');
  assert.equal(owner('.github/workflows/ci.yml'), 'owned:app.ci');
  assert.equal(owner('scripts/codegen.mjs'), 'owned:app.scripts');
  assert.equal(owner('.starciwork/features/index.yaml'), 'owned:app.starciwork');
  assert.equal(owner('.starcistacks/prod/secrets/db.enc'), 'owned:app.starcistacks');                // the stack tree is the app root's
  assert.equal(owner('.starcistacks/application-stacks.yaml'), 'owned:app.starcistacks');
  assert.equal(owner('.sops.yaml'), 'owned:app.sops');
  assert.equal(owner('.starciwork/worktrees/x/README.md'), 'forbidden:app.worktrees');
  assert.equal(owner('.env.production'), 'forbidden:app.plaintext-env');
  assert.equal(owner('tsconfig.json'), 'forbidden:app.tool-config-local');                       // a tool config belongs to a side
  assert.equal(owner('node_modules/x/index.js'), 'owned:app.build-output');
  // a side path answers through its side, with the side named and the path kept app-relative
  const feature = whole.classifyPath('be/src/features/api/orders/index.ts');
  assert.deepEqual([feature.status, feature.slot, feature.side, feature.path], ['owned', 'be.feature', 'be', 'be/src/features/api/orders/index.ts']);
  assert.equal(whole.ownerOf('be/src/features/api/orders/application/place.handler.ts').root, 'be/src/features/api/orders');
  assert.equal(whole.classifyPath('fe/apps/web/src/modules/cart/index.ts').slot, 'fe.modules');
  assert.equal(whole.sideOf('fe/apps/web/next.config.ts'), 'fe');
  assert.equal(whole.sideOf('README.md'), null);
  // what the old repository root held besides the side's own files is the app root's: a copy in a side is forbidden
  for (const file of ['package.json', 'package-lock.json', 'hfs.json', 'README.md', '.github/workflows/ci.yml', '.starciwork/x.yaml', '.starcistacks/application-stacks.yaml', '.starcistacks/dev/secrets/db.enc', '.sops.yaml', '.prettierrc', 'scripts/x.mjs']) {
    assert.equal(owner(`be/${file}`), 'forbidden:repo.side-root-forbidden', `be/${file}`);
    assert.equal(owner(`fe/${file}`), 'forbidden:repo.side-root-forbidden', `fe/${file}`);
  }
  // required paths: the root's own, then each side's under its folder
  const paths = whole.requiredPaths().paths.map((e) => e.path);
  for (const p of ['README.md', 'hfs.json', 'package.json', 'package-lock.json', '.husky/pre-push', '.github/workflows/ci.yml', '.starciwork/', '.sops.yaml', '.starcistacks/application-stacks.yaml', 'be/', 'fe/', 'be/tsconfig.json', 'be/apps/core/src/', 'fe/tsconfig.json', 'fe/apps/admin/src/modules/i18n/'])
    assert.equal(paths.includes(p), true, `required path missing: ${p}`);
  // nothing crosses sides except the declared reads
  const ok = (a, b) => whole.importAllowed(a, b);
  assert.deepEqual([ok('fe/apps/web/src/modules/api/index.ts', 'be/src/features/api/orders/index.ts').allowed, ok('fe/apps/web/src/modules/api/index.ts', 'be/src/features/api/orders/index.ts').reason], [false, 'crossSide']);
  assert.deepEqual([ok('fe/apps/web/src/modules/api/index.ts', 'be/contracts/core/schema.graphql').allowed, ok('fe/apps/web/src/modules/api/index.ts', 'be/contracts/core/schema.graphql').reason], [true, 'sideRead']);
  assert.equal(ok('be/src/features/api/orders/index.ts', 'fe/apps/web/src/modules/api/index.ts').reason, 'crossSide');
  assert.equal(ok('be/src/features/api/orders/application/a.ts', 'be/src/modules/domain/stock/index.ts').allowed, true, 'inside a side, the side decides');
});

test('BE side: which slot owns a path', () => {
  const be = sideOf(APP, 'be');
  const owner = (p) => { const c = be.classifyPath(p); return `${c.status}:${c.slot ?? ''}`; };
  assert.equal(owner('README.md'), 'forbidden:repo.side-root-forbidden');
  assert.equal(owner('apps/core/src/main.ts'), 'owned:be.app.api');
  assert.equal(owner('apps/worker/src/app.module.ts'), 'owned:be.app.worker');
  assert.equal(owner('apps/cli/src/main.ts'), 'owned:be.app.cli');
  assert.equal(owner('src/features/cli/migrate/subs/run.cli.ts'), 'owned:be.cli');
  assert.equal(owner('src/features/cli/migrate/subs/run.cli.spec.ts'), 'owned:be.cli');
  assert.equal(owner('src/features/orders/index.ts').startsWith('owned:'), false, 'a feature lives under its trigger kind: src/features/api/<feature>');
  assert.equal(owner('src/features/api/orders/index.ts'), 'owned:be.feature');
  assert.equal(owner('src/features/api/orders/application/place.handler.ts'), 'owned:be.feature.application');
  assert.equal(owner('src/features/api/orders/application/support/price-lines.ts'), 'owned:be.feature.application.support');
  assert.equal(owner('src/features/api/orders/application/support/price-lines.spec.ts'), 'owned:be.feature.application.support');
  assert.equal(owner('src/features/api/orders/transport/http/place.controller.ts'), 'owned:be.transport.http');
  assert.equal(owner('src/features/api/orders/transport/schedule/sweep.job.ts'), 'owned:be.transport.schedule');
  assert.equal(owner('src/features/cli/migrate/subs/run.cli.ts'), 'owned:be.cli');
  assert.equal(owner('src/features/api/orders/transport/message/paid.consumer.ts'), 'not-enabled:be.transport.message');     // opt-in, not declared
  assert.equal(owner('src/modules/domain/orders/orders.service.ts'), 'owned:be.domain');
  assert.equal(owner('src/modules/domain/orders/errors/orders.error.ts'), 'owned:be.errors');
  assert.equal(owner('src/modules/integrations/stripe/errors/stripe.error.ts'), 'owned:be.errors');
  assert.equal(owner('src/modules/platform/database/persistence/migrations/20260101000000-init.ts'), 'owned:be.persistence');
  assert.equal(owner('src/modules/platform/config/index.ts'), 'owned:be.platform');
  assert.equal(owner('src/tests/e2e/orders/place.e2e-spec.ts'), 'owned:be.tests.e2e');
  assert.equal(owner('src/tests/world/use-test-world.ts'), 'owned:be.tests.world');
  assert.equal(owner('contracts/core/schema.graphql'), 'owned:be.contract.graphql');
  assert.equal(owner('contracts/core/openapi.json'), 'not-enabled:be.contract.openapi');
  assert.equal(owner('.starcistacks/prod/secrets/db.enc'), 'forbidden:repo.side-root-forbidden');   // be/.starcistacks: the stack tree is the app root's
  assert.equal(owner('docs/adr/0001-use-nest.md'), 'owned:repo.docs');
  assert.equal(owner('e2e/probe.spec.ts'), 'forbidden:be.root-e2e');
  assert.equal(owner('.env.production'), 'forbidden:repo.plaintext-env');
  assert.equal(owner('node_modules/x/index.js'), 'owned:repo.build-output');
  assert.equal(owner('apps/core/src/.next/x'), 'owned:be.app.api');   // the deeper slot: app source owns its subtree
  // a Windows spelling and a directory spelling reach the same slot
  assert.equal(owner('src\\features\\api\\orders\\index.ts'), 'owned:be.feature');
  assert.equal(owner('src/features/api/orders/'), 'owned:be.feature');
  assert.equal(be.ownerOf('src/features/api/orders/application/place.handler.ts').root, 'src/features/api/orders');
  assert.equal(be.classifyPath('e2e/probe.spec.ts').goesTo.startsWith('src/tests/e2e/'), true);
});

test('BE side: tracked, tier, required files', () => {
  const be = sideOf(APP, 'be');
  assert.equal(be.isTracked('src/features/api/orders/index.ts'), true);
  assert.equal(be.trackingOf('apps/core/dist/main.js'), 'ignored');
  assert.equal(be.isTracked('apps/core/dist/main.js'), false);
  assert.equal(be.trackingOf('.eslintcache'), 'external');
  assert.equal(be.trackingOf('nul'), 'external');
  assert.equal(be.trackingOf('nothing/here.txt'), null);
  assert.equal(be.isTracked('nothing/here.txt'), false);
  assert.equal(be.tierOf('apps/core/src/main.ts'), 'app');
  assert.equal(be.tierOf('src/modules/domain/orders/persistence/orders.repository.ts'), 'domain');       // inherits the owner's tier
  assert.equal(be.tierOf('src/modules/platform/database/persistence/x.ts'), 'platform');
  assert.equal(be.tierOf('tsconfig.json'), 'none');
  assert.deepEqual(be.requiredFiles('src/features/api/orders/index.ts'), ['src/features/api/orders/index.ts', 'src/features/api/orders/orders.module.ts', 'src/features/api/orders/application/']);
  assert.deepEqual(be.requiredFiles('src/features/api/orders/transport/http/a.controller.ts'), ['src/features/api/orders/transport/http/orders-http.module.ts']);
  assert.deepEqual(be.requiredFiles('apps/core/src/main.ts'), ['apps/core/src/main.ts', 'apps/core/src/app.module.ts']);
  assert.deepEqual(be.requiredFiles('src/modules/domain/orders/persistence/x.ts'), ['src/modules/domain/orders/persistence/connection.ts']);
  const { paths, minimums } = be.requiredPaths();
  const has = (p) => paths.some((e) => e.path === p);
  for (const p of ['tsconfig.json', 'tsconfig.build.json', 'nest-cli.json',
    'apps/core/src/', 'src/modules/platform/config/', 'src/modules/platform/logging/', 'src/modules/platform/errors/', 'src/modules/platform/primitives/'])
    assert.equal(has(p), true, `required path missing: ${p}`);
  for (const p of ['README.md', 'hfs.json', 'package-lock.json', '.husky/pre-push', '.github/workflows/ci.yml', '.starciwork/', '.sops.yaml', '.starcistacks/application-stacks.yaml']) assert.equal(has(p), false, `${p} is the app root's, not the side's`);
  assert.equal(has('apps/worker/src/'), false, 'an opt-in app is not required');
  assert.equal(has('jest.config.e2e.js'), false);
  assert.deepEqual(minimums.map((m) => m.slot).sort(), ['be.app.api', 'be.feature']);
  // the cli app is required by BE_CLI_REQUIRED (hfs check), not by the slot: with or without a connection, no cli path is a slot requirement of an app that declares none
  const noDb = sideOf(app({ be: { ...BE_SIDE, apps: [{ name: 'core', kind: 'api' }], connections: [] } }), 'be');
  assert.equal(noDb.requiredPaths().paths.some((e) => e.slot === 'be.app.cli'), false);
});

test('BE side: import direction', () => {
  const be = sideOf(APP, 'be');
  const ok = (a, b) => be.importAllowed(a, b);
  assert.equal(ok('src/features/api/orders/application/place.handler.ts', 'src/modules/domain/stock/index.ts').allowed, true);
  assert.equal(ok('src/features/api/orders/application/place.handler.ts', 'src/features/api/orders/orders.module.ts').reason, 'sameOwner');
  assert.deepEqual([ok('src/features/api/orders/application/a.ts', 'src/features/api/billing/index.ts').allowed, ok('src/features/api/orders/application/a.ts', 'src/features/api/billing/index.ts').reason], [false, 'tierDirection']);   // feature never imports feature
  assert.equal(ok('src/features/api/orders/application/a.ts', 'src/modules/domain/stock/stock.service.ts').reason, 'notPublicEntry');          // cross-owner targets index.ts
  assert.equal(ok('src/modules/platform/config/index.ts', 'src/modules/domain/stock/index.ts').reason, 'tierDirection');                   // platform never imports domain
  assert.equal(ok('src/modules/domain/stock/index.ts', 'src/modules/domain/pricing/index.ts').allowed, true);                              // domain may (acyclic is a graph rule)
  assert.equal(ok('src/modules/integrations/stripe/index.ts', 'src/modules/domain/stock/index.ts').reason, 'tierDirection');
  assert.equal(ok('apps/core/src/app.module.ts', 'src/features/api/orders/index.ts').allowed, true);
  assert.equal(ok('apps/core/src/app.module.ts', 'apps/worker/src/app.module.ts').reason, 'crossApp');                                     // apps never import each other
  assert.equal(ok('src/tests/e2e/orders/place.e2e-spec.ts', 'src/tests/world/use-test-world.ts').allowed, true);
  assert.equal(ok('src/tests/e2e/orders/place.e2e-spec.ts', 'apps/core/src/app.module.ts').allowed, true);                                  // an app's public entry is app.module.ts
  assert.equal(ok('src/tests/e2e/orders/place.e2e-spec.ts', 'apps/core/src/main.ts').reason, 'notPublicEntry');
  assert.equal(ok('src/tests/fixtures/orders.ts', 'src/features/api/orders/index.ts').reason, 'tierDirection');                                // fixtures never import a feature
  assert.equal(ok('src/features/api/orders/index.ts', 'tsconfig.json').reason, 'untiered');
  const unknown = ok('src/features/api/orders/index.ts', 'src/whatever/x.ts');
  assert.deepEqual([unknown.allowed, unknown.reason, unknown.code], [false, 'unowned', 'HFS_SLOT_UNDECLARED']);
  assert.equal(ok('src/features/api/orders/transport/message/a.ts', 'src/features/api/orders/index.ts').reason, 'slotNotEnabled');
});

test('FE side with two apps', () => {
  const fe = sideOf(APP, 'fe');
  const owner = (p) => fe.classifyPath(p).slot;
  assert.equal(owner('apps/web/next.config.ts'), 'fe.app.next');
  assert.equal(owner('apps/web/tsconfig.json'), 'fe.app.next');
  assert.equal(owner('apps/admin/package.json'), 'fe.app.next', 'each fe app is an npm workspace with its own package.json');
  assert.equal(owner('apps/web/public/logo.svg'), 'fe.app-optional');
  assert.equal(fe.classifyPath('apps/web/vitest.config.ts').status, 'no-slot', 'the fe side has no test configuration slot: FE_NO_TESTS owns the path');
  assert.equal(owner('apps/web/src/app/[locale]/page.tsx'), 'fe.route');
  assert.equal(owner('apps/web/src/features/pages/Home/index.tsx'), 'fe.feature');
  assert.equal(owner('apps/web/src/components/blocks/Header/component.tsx'), 'fe.components');
  assert.equal(owner('apps/web/src/hooks/orders/useOrders.ts'), 'fe.hooks');
  assert.equal(owner('apps/web/src/modules/api/client.ts'), 'fe.transport.client');
  assert.equal(owner('apps/web/src/modules/api/contract/core.graphql'), 'fe.modules.api', 'no contract copy slot: the fe side reads be/contracts/ in place');
  assert.equal(owner('apps/web/src/modules/api/read/orders.ts'), 'fe.modules.api');
  assert.equal(owner('apps/web/src/modules/i18n/messages/en.json'), 'fe.modules.i18n');
  assert.equal(owner('apps/web/src/modules/brand/brand.css'), 'fe.modules.brand');
  assert.equal(owner('apps/web/src/modules/cart/index.ts'), 'fe.modules');
  assert.equal(owner('packages/nivo-ui/src/index.ts'), 'fe.package.ui');
  assert.equal(fe.classifyPath('e2e/checkout/pay.e2e-spec.ts').status, 'no-slot', 'the fe side has no e2e slot');
  assert.equal(owner('apps/web/Dockerfile'), 'repo.app-image');
  assert.equal(fe.classifyPath('src/index.ts').status, 'no-slot');                              // the fe side has no root src/
  assert.equal(owner('.starciwork/x.yaml'), 'repo.side-root-forbidden');                       // Work records are the app root's
  assert.equal(fe.ownerOf('apps/admin/src/modules/cart/index.ts').root, 'apps/admin/src/modules/cart');
  assert.equal(fe.classifyPath('apps/admin/src/modules/cart/index.ts').bindings.app, 'admin');
  // required paths are expanded per declared app
  const paths = fe.requiredPaths().paths.map((e) => e.path);
  for (const name of ['web', 'admin']) for (const p of [`apps/${name}/package.json`, `apps/${name}/next.config.ts`, `apps/${name}/tsconfig.json`, `apps/${name}/src/app/[locale]/layout.tsx`, `apps/${name}/src/modules/i18n/`, `apps/${name}/src/modules/routes/`, `apps/${name}/src/modules/config/`])
    assert.equal(paths.includes(p), true, `missing ${p}`);
  assert.equal(paths.includes('apps/web/src/modules/api/'), false, 'the transport may live in the shared api package; FE_TRANSPORT_OWNER counts the clients');
  assert.equal(fe.classifyPath('tsconfig.e2e.json').status, 'no-slot', 'the front-end e2e tsconfig is no managed file');
  // the tool configuration of the fe side: managed files and the forbidden ones (a turbo.json is the app root's task graph, app.task-graph)
  for (const file of ['tsconfig.json', 'eslint.config.mjs', 'stylelint.config.mjs']) assert.equal(owner(file), 'fe.tool-config', file);
  for (const file of ['tsconfig.json', 'eslint.config.mjs', 'stylelint.config.mjs']) assert.equal(paths.includes(file), true, `${file} is required`);
  for (const file of ['vitest.config.ts', 'vitest.setup.ts', 'playwright.config.ts']) assert.equal(fe.classifyPath(file).status, 'no-slot', file);
  for (const file of ['turbo.json', '.eslintrc.json', '.eslintignore', 'eslint.config.js', '.stylelintrc.json', 'stylelint.config.cjs', '.prettierrc.json', '.lintstagedrc.json']) assert.equal(owner(file), 'fe.tool-config-local', file);
  for (const file of ['package.json', 'package-lock.json', '.prettierrc', '.prettierignore']) assert.equal(owner(file), 'repo.side-root-forbidden', `${file} is the app root's`);
  assert.equal(fe.slot('fe.tool-config-local').presence, 'forbidden');
  assert.equal(fe.slot('fe.tool-config').managedBy, 'tool-config');
  assert.equal(fe.classifyPath('tsconfig.build.json').status, 'no-slot', 'a tsconfig.build.json has no owner in the fe side');
  // import direction, cross-app and layers
  const ok = (a, b) => fe.importAllowed(a, b);
  assert.equal(ok('apps/web/src/features/pages/Home/index.tsx', 'apps/web/src/components/blocks/Header/index.tsx').allowed, true);
  assert.equal(ok('apps/web/src/features/pages/Home/index.tsx', 'apps/admin/src/components/blocks/Header/index.tsx').reason, 'crossApp');
  assert.equal(ok('apps/web/src/features/pages/Home/index.tsx', 'apps/web/src/features/pages/Cart/index.tsx').reason, 'tierDirection');
  assert.equal(ok('apps/web/src/components/blocks/Header/component.tsx', 'apps/web/src/components/leaves/Button/index.tsx').allowed, true);
  assert.equal(ok('apps/web/src/components/leaves/Button/component.tsx', 'apps/web/src/components/blocks/Header/index.tsx').reason, 'layerOrder');
  assert.equal(ok('apps/web/src/components/blocks/Header/component.tsx', 'apps/web/src/components/leaves/Button/component.tsx').reason, 'notPublicEntry');
  assert.equal(ok('apps/web/src/hooks/orders/useOrders.ts', 'apps/web/src/modules/api/index.ts').allowed, true);
  assert.equal(ok('apps/web/src/modules/api/client.ts', 'apps/web/src/hooks/orders/useOrders.ts').reason, 'tierDirection');
  // components reach foundation modules (config, routes, i18n, types) but never the api transport or a data module
  for (const capability of ['config', 'routes', 'i18n', 'types']) assert.equal(ok('apps/web/src/components/leaves/Button/index.tsx', `apps/web/src/modules/${capability}/index.ts`).allowed, true, capability);
  assert.equal(ok('apps/web/src/components/leaves/Button/index.tsx', 'apps/web/src/modules/api/index.ts').reason, 'tierDirection');
  assert.equal(ok('apps/web/src/components/leaves/Button/index.tsx', 'apps/web/src/modules/query/index.ts').reason, 'tierDirection');
  assert.equal(ok('apps/web/src/features/pages/Home/index.tsx', 'apps/web/src/modules/query/index.ts').allowed, true);
  // hooks reach another domain only through its public index
  assert.equal(ok('apps/web/src/hooks/orders/useOrders.ts', 'apps/web/src/hooks/cart/index.ts').allowed, true);
  assert.equal(ok('apps/web/src/hooks/orders/useOrders.ts', 'apps/web/src/hooks/cart/useCart.ts').reason, 'notPublicEntry');
  assert.equal(ok('apps/web/src/hooks/orders/useOrders.ts', 'apps/web/src/hooks/orders/useOrderList.ts').reason, 'sameOwner');
  assert.equal(ok('apps/web/src/modules/config/index.ts', 'apps/web/src/modules/api/index.ts').reason, 'tierDirection');
  assert.equal(ok('apps/web/src/features/pages/Home/index.tsx', 'packages/nivo-ui/src/index.ts').allowed, true);
  assert.equal(ok('packages/nivo-ui/src/button.ts', 'apps/web/src/modules/api/index.ts').reason, 'tierDirection');
  assert.equal(fe.slotEnabled(fe.slot('fe.package.ui')), true);
  assert.equal(sideOf(app({ fe: { ...FE_SIDE, optionalSlots: [] } }), 'fe').classifyPath('packages/nivo-ui/src/index.ts').status, 'not-enabled');
});

test('classification reports the folder kind and the role of a file from the slot manifest', () => {
  const fe = sideOf(APP, 'fe');
  const at = (p) => fe.classifyPath(p);
  assert.equal(at('apps/web/src/components/leaves/Button/index.tsx').kind, 'leaves');
  assert.equal(at('apps/web/src/components/blocks/Header/component.tsx').kind, 'blocks');
  assert.equal(at('apps/web/src/components/blocks/Header/component.tsx').role, 'drawing');
  assert.equal(at('apps/web/src/components/blocks/leaves/index.tsx').kind, 'blocks', 'a component named like a layer is still in its own layer');
  assert.equal(at('apps/web/src/features/overlays/Cart/classNames.ts').kind, 'overlays');
  assert.equal(at('apps/web/src/features/overlays/Cart/classNames.ts').role, 'styles');
  assert.equal(at('packages/nivo-ui/src/leaves/X/index.tsx').kind, 'leaves');
  assert.equal(at('packages/nivo-ui/src/leaves/X/index.tsx').role, 'entry');
  assert.equal(at('packages/nivo-ui/src/index.ts').kind, undefined);
  assert.equal(at('apps/web/src/modules/components/x.ts').kind, undefined, 'a folder named components inside a module is not a component layer');
  assert.equal(at('apps/web/src/hooks/orders/orders.shared.ts').role, 'shared');
  assert.equal(at('apps/web/src/hooks/orders/index.ts').role, 'entry');
  assert.equal(at('apps/web/src/hooks/orders/useOrders.ts').role, undefined);
  assert.equal(at('apps/web/src/app/[locale]/cart/page.tsx').role, 'page');
  assert.equal(openHfs({ declaration: APP }).classifyPath('fe/apps/web/src/app/[locale]/cart/page.tsx').role, 'page', 'the app resolver keeps the side answer');
});

test('BE side: test kinds agree folder with suffix, and the retired e2e/world folder is forbidden', () => {
  const be = sideOf(APP, 'be');
  const owner = (p) => { const c = be.classifyPath(p); return `${c.status}:${c.slot ?? ''}`; };
  assert.equal(owner('src/tests/integration/inbox/claim.integration-spec.ts'), 'owned:be.tests.integration');
  assert.equal(owner('src/tests/contract/stripe/charge.contract-spec.ts'), 'owned:be.tests.contract');
  assert.equal(owner('src/tests/world/fakes/stripe/server.ts').split(':')[0], 'owned');
  const retired = be.classifyPath('src/tests/e2e/world/use-e2e-world.ts');
  assert.equal(retired.status, 'forbidden');
  assert.equal(retired.slot, 'be.tests.e2e-world-retired');
  assert.equal(retired.goesTo.startsWith('src/tests/world/'), true);
  assert.equal(owner('src/tests/e2e/world/orders.e2e-spec.ts'), 'forbidden:be.tests.e2e-world-retired');
  assert.equal(owner('src/tests/e2e/orders/place.e2e-spec.ts'), 'owned:be.tests.e2e');
  // folder <-> suffix: a spec of the other kind matches no slot
  assert.equal(be.classifyPath('src/tests/integration/inbox/claim.e2e-spec.ts').status, 'no-slot');
  assert.equal(be.classifyPath('src/tests/e2e/orders/place.integration-spec.ts').status, 'no-slot');
  assert.equal(be.classifyPath('src/tests/contract/stripe/charge.e2e-spec.ts').status, 'no-slot');
});

test('an unknown path is reported with its nearest slot and HFS_SLOT_UNDECLARED, in a side and at the app root', () => {
  const be = sideOf(APP, 'be');
  const stray = be.classifyPath('src/tests/e2e/orders/place.ts');
  assert.deepEqual([stray.status, stray.code], ['no-slot', 'HFS_SLOT_UNDECLARED']);
  assert.equal(stray.nearest.slot, 'be.tests.e2e');
  assert.equal(stray.nearest.matchedPrefix, 'src/tests/e2e/orders');
  assert.equal(stray.nearest.expectedNext, '*.e2e-spec.ts');
  const invented = be.classifyPath('src/helpers/util.ts');
  assert.equal(invented.status, 'no-slot');
  assert.equal(invented.nearest.matchedPrefix, 'src');
  const rootFile = be.classifyPath('LICENSE');
  assert.equal(rootFile.status, 'no-slot');
  assert.equal(rootFile.nearest.matchedDepth, 0);
  assert.equal(be.classifyPath('src/tests/e2e/orders/place.ts').path, 'src/tests/e2e/orders/place.ts');
  const whole = openHfs({ declaration: APP });
  const appStray = whole.classifyPath('be/src/helpers/util.ts');
  assert.deepEqual([appStray.status, appStray.path, appStray.nearest.matchedPrefix], ['no-slot', 'be/src/helpers/util.ts', 'be/src']);
  assert.equal(whole.classifyPath('LICENSE').status, 'no-slot');
});

test('be.feature.application.support is an optional feature-tier slot inside application/, opt-out by absence', () => {
  const manifest = loadSlotManifest();
  const slot = manifest.slots.find((s) => s.id === 'be.feature.application.support');
  assert.ok(slot, 'the support slot exists');
  assert.equal(slot.path, 'src/features/api/<feature>/application/support/');
  assert.equal(slot.presence, 'optional');
  assert.equal(slot.tier, 'feature');
  assert.equal(slot.tests, 'none');
  assert.equal(slot.owner, undefined, 'support is not an owner: it belongs to the enclosing feature');
  const be = sideOf(APP, 'be');
  assert.equal(be.classifyPath('src/features/api/orders/application/place.handler.ts').slot, 'be.feature.application');
  assert.equal(be.classifyPath('src/features/api/orders/application/support/price-lines.ts').slot, 'be.feature.application.support');
});

test('be.cli is the cli feature root: a feature-tier owner at src/features/cli/, its specs beside its commands; no feature transport is a command line', () => {
  const manifest = loadSlotManifest();
  const slot = manifest.slots.find((s) => s.id === 'be.cli');
  assert.ok(slot, 'the cli feature root slot exists');
  assert.equal(slot.path, 'src/features/cli/');
  assert.equal(slot.tier, 'feature');
  assert.equal(slot.owner, true);
  assert.equal(slot.tests, 'unit-beside');
  assert.deepEqual(slot.requires, ['index.ts', 'cli.module.ts']);
  for (const gone of ['cli.module-definition.ts', '<group>/<group>.module-definition.ts', '<group>/<group>.options.ts', '<group>/<group>.decorators.ts']) assert.equal(slot.allows.includes(gone), false, `${gone}: the cli feature root is static`);
  assert.ok(manifest.appKinds.be.includes('cli'), 'the cli app kind exists');
  assert.equal(manifest.appKinds.be.includes('migrate'), false, 'the migrate kind is gone: the cli migrate command migrates');
  assert.equal(manifest.slots.some((s) => s.id === 'be.feature.transport.cli'), false, 'no feature transport is a command line');
  const cli = sideOf(APP, 'be');
  assert.equal(cli.classifyPath('src/features/cli/migrate/subs/run.cli.ts').slot, 'be.cli');
  assert.equal(cli.classifyPath('src/features/cli/migrate/subs/run.cli.ts').status, 'owned');
  assert.equal(cli.classifyPath('src/features/api/orders/transport/cli/import.cli.ts').slot === 'be.cli', false);
});

test('growth is a minor: adding a slot changes no existing answer; every slot pattern owns its own sample', () => {
  const grown = loadSlotManifest({ text: manifestText.replace('version: 2.0.0', 'version: 2.1.0').replace('\n# Checks that read this manifest', `
  - id: be.transport.grpc
    profiles: [be]
    path: "src/features/api/<feature>/transport/grpc/"
    presence: opt-in
    tracked: tracked
    tier: feature
    tests: unit-beside
    since: 2.1.0

# Checks that read this manifest`) });
  assert.equal(grown.minor, 1);
  const before = sideOf(APP, 'be');
  const after = sideOf(app({ be: { ...BE_SIDE, optionalSlots: [...BE_SIDE.optionalSlots, 'be.transport.grpc'] } }), 'be', { manifest: grown });
  for (const p of ['src/features/api/orders/index.ts', 'apps/core/src/main.ts', 'src/modules/domain/a/errors/x.error.ts', 'tsconfig.json', '.env'])
    assert.equal(after.classifyPath(p).slot, before.classifyPath(p).slot);
  assert.equal(after.classifyPath('src/features/api/orders/transport/grpc/a.ts').status, 'owned');
  assert.equal(before.classifyPath('src/features/api/orders/transport/grpc/a.ts').status, 'owned', 'the feature slot owns the subtree until the new slot is declared');
  assert.equal(after.classifyPath('src/features/api/orders/transport/grpc/a.ts').slot, 'be.transport.grpc');

  // every variant of every slot, filled with sample names, is owned by that slot and never ambiguous: the root's and each side's
  const manifest = loadSlotManifest();
  const bare = app({ be: { ...BE_SIDE, optionalSlots: [] }, fe: { ...FE_SIDE, optionalSlots: [] } });
  for (const profile of ['app', 'be', 'fe']) {
    const resolver = profile === 'app' ? openHfs({ declaration: bare }) : sideOf(bare, profile);
    const apps = profile === 'app' ? [] : bare.sides[profile].apps;
    const kindOf = (slot) => apps.find((a) => a.kind === slot.appKind)?.name;
    // app.sides answers only for the side folders themselves; what lies below them is the sides' (sampled under be and fe).
    for (const slot of manifest.slots.filter((s) => s.profiles.includes(profile) && s.id !== 'app.sides')) {
      for (const variant of braceVariants(slot.path)) {
        const sample = variant.replace(/<app>/g, kindOf(slot) ?? 'core').replace(/<[^>]+>/g, 'sample').replace(/\*\*\//g, '').replace(/\*\*/g, 'a/b').replace(/\*/g, 'x') + (variant.endsWith('/') ? 'file.ts' : '');
        const c = resolver.classifyPath(sample);
        assert.notEqual(c.status, 'ambiguous', `${profile}: ${sample} (${slot.id}) is ambiguous between ${c.candidates}`);
        assert.notEqual(c.status, 'no-slot', `${profile}: ${sample} (${slot.id}) matches no slot`);
        if (slot.appKind === undefined) assert.equal(c.slot, slot.id, `${profile}: ${sample} owned by ${c.slot}, expected ${slot.id}`);
      }
    }
  }
});

test('the failure catalog explains the new codes in Vietnamese', () => {
  const catalog = parseYaml(fs.readFileSync(path.join(root, 'modules/kernel/failure-codes.yaml'), 'utf8'));
  for (const code of ['HFS_SLOT_UNDECLARED', 'HFS_MANIFEST_MAJOR_MISMATCH', 'HFS_MANIFEST_INVALID', 'HFS_DECLARATION_INVALID']) {
    assert.ok(catalog[code], `${code} has no catalog entry`);
    for (const field of ['title_vi', 'meaning_vi', 'nextStep_vi']) assert.match(catalog[code][field], /[À-ỹ]/, `${code}.${field} is not Vietnamese`);
  }
});

test('ruleParams: the parameters the canon lint lanes read, per side', () => {
  const manifest = loadSlotManifest();
  const be = ruleParams(manifest, 'be');
  assert.equal('globalModules' in be, false, 'the @Global allowlist is retired: no module is global from inside itself');
  assert.deepEqual(be.fileLines, { soft: 500, hardGrowth: true });
  assert.deepEqual(be.duplicateBlock, { lines: 8, tokens: 60 });
  const fe = ruleParams(manifest, 'fe');
  assert.deepEqual(fe.fileLines, { soft: 500, hardGrowth: true });
  assert.deepEqual(fe.duplicateBlock, { lines: 8, tokens: 60 });
  assert.equal('clientModule' in fe, false, 'the transport client is a slot (fe.transport.client, fe.package.api.client), not a parameter');
  assert.equal(manifest.slots.find((s) => s.id === 'be.domain').budget.indexExports, 60);
  assert.equal(manifest.slots.find((s) => s.id === 'be.feature').budget.indexExports, 60);
  assert.deepEqual(sideOf(APP, 'be').ruleParams(), be);
  assert.deepEqual(sideOf(APP, 'fe').ruleParams(), fe);
  assert.equal(openHfs({ declaration: APP }).ruleParams(), null, 'the app root has no rule parameters of its own');
  refusal(() => ruleParams(manifest, 'app'), 'HFS_MANIFEST_INVALID');
  assert.throws(() => { ruleParams(manifest, 'be').fileLines.soft = 1; }, TypeError);
  // the transport client and the Outcome union are slots of their own, in an app or in the shared api package
  const feHfs = sideOf(app({ fe: { ...FE_SIDE, optionalSlots: ['repo.packages', 'fe.package.ui', 'fe.package.api', 'fe.package.i18n'] } }), 'fe');
  assert.equal(feHfs.classifyPath('apps/web/src/modules/api/client.ts').slot, 'fe.transport.client');
  assert.equal(feHfs.classifyPath('apps/web/src/modules/api/outcome.ts').slot, 'fe.transport.outcome');
  assert.equal(feHfs.classifyPath('packages/nivo-api/src/client.ts').slot, 'fe.package.api.client');
  assert.equal(feHfs.classifyPath('packages/nivo-api/src/outcome.ts').slot, 'fe.package.api.outcome');
  assert.equal(feHfs.classifyPath('packages/nivo-api/src/graphql.ts').slot, 'fe.package.api');
  assert.equal(feHfs.classifyPath('packages/nivo-i18n/src/app.ts').slot, 'fe.package.i18n');
  // schema and loader agree that ruleParams is required and closed
  for (const mutate of [(d) => { delete d.ruleParams; }, (d) => { d.ruleParams.be.fileLines.soft = 0; }, (d) => { d.ruleParams.fe.extra = 1; }, (d) => { delete d.ruleParams.fe.duplicateBlock; }, (d) => { delete d.ruleParams.be.duplicateBlock; }, (d) => { d.ruleParams.fe.duplicateBlock = { lines: 1, tokens: 60 }; }, (d) => { d.ruleParams.be.duplicateBlockLines = 25; }]) {
    const doc = parseYaml(manifestText); mutate(doc);
    assert.equal(validateManifestSchema(doc), false);
    refusal(() => loadSlotManifest({ text: JSON.stringify(doc) }), 'HFS_MANIFEST_INVALID');
  }
});

test('appRelativeMessages: a side finding message names its paths from the app root, like the finding path', (t) => {
  const side = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-side-'));
  t.after(() => fs.rmSync(side, { recursive: true, force: true }));
  for (const dir of ['apps', 'src']) fs.mkdirSync(path.join(side, dir));
  fs.writeFileSync(path.join(side, 'tsconfig.json'), '{}');
  const message = appRelativeMessages('fe', side);
  assert.equal(message('apps/web/src/app/page.tsx mounts 0 owners; see src/x.ts and tsconfig.json.'), 'fe/apps/web/src/app/page.tsx mounts 0 owners; see fe/src/x.ts and fe/tsconfig.json.');
  assert.equal(message("declared in 'apps/a.ts' and `src/b.ts`"), "declared in 'fe/apps/a.ts' and `fe/src/b.ts`");
  // an import specifier, a path already app-relative and a bare word are left alone
  assert.equal(message('import @/features/x or ../../src/y from fe/apps/a.ts; every apps'), 'import @/features/x or ../../src/y from fe/apps/a.ts; every apps');
  assert.equal(message(undefined), undefined);
});
