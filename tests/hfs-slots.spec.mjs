import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { parseYaml } from '../engine/yaml.mjs';
import { braceVariants } from '../scripts/lib/glob.mjs';
import { HfsSlotsError, loadSlotManifest, openHfs, readRepoDeclaration, resolveRepoDeclaration } from '../scripts/lib/hfs-slots.mjs';

const root = path.resolve(import.meta.dirname, '..');
const manifestText = fs.readFileSync(path.join(root, 'knowledge/hfs/slots.yaml'), 'utf8');
const readSchema = (name) => parseYaml(fs.readFileSync(path.join(root, 'modules/schemas', name), 'utf8'));

const Ajv2020 = (() => { const loaded = createRequire(import.meta.url)('ajv/dist/2020.js'); return loaded.default ?? loaded; })();
const ajv = new Ajv2020({ strict: false, allErrors: true, logger: false });
const validateManifestSchema = ajv.compile(readSchema('hfs-slots.schema.yaml'));
const validateRepoSchema = ajv.compile(readSchema('hfs-repo.schema.yaml'));

const BE = { hfs: 2, profile: 'be', project: 'nivo', apps: [{ name: 'core', kind: 'api' }, { name: 'worker', kind: 'worker' }, { name: 'migrate', kind: 'migrate' }], optionalSlots: ['be.transport.schedule', 'be.contract.graphql', 'repo.docs'], connections: ['primary', 'agentos'] };
const FE = { hfs: 2, profile: 'fe', project: 'nivo', apps: [{ name: 'web', kind: 'next' }, { name: 'admin', kind: 'next' }], optionalSlots: ['repo.packages', 'fe.package.ui'] };

const refusal = (fn, code) => assert.throws(fn, (error) => error instanceof HfsSlotsError && error.code === code, `expected ${code}`);

test('the shipped manifest is 2.0.0 and validates against its JSON schema and the loader', () => {
  const doc = parseYaml(manifestText);
  assert.equal(doc.version, '2.0.0');
  assert.equal(validateManifestSchema(doc), true, JSON.stringify(validateManifestSchema.errors));
  const manifest = loadSlotManifest();
  assert.equal(manifest.major, 2);
  for (const slot of manifest.slots) {
    for (const field of ['id', 'profiles', 'path', 'presence', 'tracked', 'tier', 'tests']) assert.notEqual(slot[field], undefined, `${slot.id} lacks ${field}`);
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
  refusal(load((d) => { d.slots.push({ ...d.slots.find((s) => s.id === 'repo.readme'), id: 'repo.readme-twin' }); }), 'HFS_MANIFEST_INVALID');
});

test('hfs.json: schema and loader agree', () => {
  assert.equal(validateRepoSchema(BE), true, JSON.stringify(validateRepoSchema.errors));
  assert.equal(validateRepoSchema(FE), true, JSON.stringify(validateRepoSchema.errors));
  const manifest = loadSlotManifest();
  const bad = {
    'missing hfs': { ...BE, hfs: undefined },
    'fe with connections': { ...FE, connections: ['primary'] },
    'no apps': { ...BE, apps: [] },
    'unknown key': { ...BE, owners: ['x'] },
    'bad project name': { ...BE, project: 'Nivo Backend' },
  };
  for (const [name, declaration] of Object.entries(bad)) {
    assert.equal(validateRepoSchema(JSON.parse(JSON.stringify(declaration))), false, `schema accepted: ${name}`);
    refusal(() => resolveRepoDeclaration(manifest, declaration), 'HFS_DECLARATION_INVALID');
  }
});

test('a declaration is checked against the manifest', () => {
  const manifest = loadSlotManifest();
  refusal(() => resolveRepoDeclaration(manifest, { ...BE, apps: [...BE.apps, { name: 'game', kind: 'unity' }] }), 'HFS_DECLARATION_INVALID');
  refusal(() => resolveRepoDeclaration(manifest, { ...BE, apps: [{ name: 'core', kind: 'api' }, { name: 'core', kind: 'cli' }, { name: 'migrate', kind: 'migrate' }] }), 'HFS_DECLARATION_INVALID');
  refusal(() => resolveRepoDeclaration(manifest, { ...BE, optionalSlots: ['be.feature'] }), 'HFS_DECLARATION_INVALID');          // required, not opt-in
  refusal(() => resolveRepoDeclaration(manifest, { ...BE, optionalSlots: ['be.app.worker'] }), 'HFS_DECLARATION_INVALID');       // implied by an app of its kind
  refusal(() => resolveRepoDeclaration(manifest, { ...BE, optionalSlots: ['fe.package.ui'] }), 'HFS_DECLARATION_INVALID');       // another profile
  refusal(() => resolveRepoDeclaration(manifest, { ...BE, optionalSlots: ['be.made.up'] }), 'HFS_DECLARATION_INVALID');
  refusal(() => resolveRepoDeclaration(manifest, { ...BE, apps: [{ name: 'core', kind: 'worker' }, { name: 'migrate', kind: 'migrate' }] }), 'HFS_DECLARATION_INVALID');   // no api app
  refusal(() => resolveRepoDeclaration(manifest, { ...BE, apps: [{ name: 'core', kind: 'api' }] }), 'HFS_DECLARATION_INVALID');   // connections declared, no migrate app
  assert.doesNotThrow(() => resolveRepoDeclaration(manifest, { ...BE, apps: [{ name: 'core', kind: 'api' }], connections: [] }));
  refusal(() => resolveRepoDeclaration(manifest, { ...FE, apps: [] }), 'HFS_DECLARATION_INVALID');
});

test('readRepoDeclaration reads hfs.json and refuses a missing one (never "unavailable")', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-hfs-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const manifest = loadSlotManifest();
  refusal(() => readRepoDeclaration(manifest, dir), 'HFS_DECLARATION_INVALID');
  fs.writeFileSync(path.join(dir, 'hfs.json'), JSON.stringify(BE));
  assert.equal(readRepoDeclaration(manifest, dir).project, 'nivo');
  assert.equal(openHfs({ repoRoot: dir }).repo.profile, 'be');
  fs.writeFileSync(path.join(dir, 'hfs.json'), '{not json');
  refusal(() => readRepoDeclaration(manifest, dir), 'HFS_DECLARATION_INVALID');
});

test('a manifest major mismatch is refused, in either direction, with no compatibility window', () => {
  const manifest = loadSlotManifest();
  try {
    resolveRepoDeclaration(manifest, { ...BE, hfs: 3 });
    assert.fail('major 3 was accepted by a 2.x manifest');
  } catch (error) {
    assert.equal(error.code, 'HFS_MANIFEST_MAJOR_MISMATCH');
    assert.deepEqual([error.details.pinned, error.details.manifestMajor], [3, 2]);
  }
  const next = loadSlotManifest({ text: manifestText.replace('schema: starci/hfs-slots@2', 'schema: starci/hfs-slots@3').replace('version: 2.0.0', 'version: 3.0.0') });
  assert.equal(next.major, 3);
  refusal(() => resolveRepoDeclaration(next, BE), 'HFS_MANIFEST_MAJOR_MISMATCH');           // a repository pinned to the old major
  assert.equal(resolveRepoDeclaration(next, { ...BE, hfs: 3 }).hfs, 3);
});

test('BE fixture: which slot owns a path', () => {
  const be = openHfs({ declaration: BE });
  const owner = (p) => { const c = be.classifyPath(p); return `${c.status}:${c.slot ?? ''}`; };
  assert.equal(owner('README.md'), 'owned:repo.readme');
  assert.equal(owner('hfs.json'), 'owned:repo.declaration');
  assert.equal(owner('apps/core/src/main.ts'), 'owned:be.app.api');
  assert.equal(owner('apps/worker/src/app.module.ts'), 'owned:be.app.worker');
  assert.equal(owner('apps/migrate/src/main.ts'), 'owned:be.app.migrate');
  assert.equal(owner('src/features/orders/index.ts'), 'owned:be.feature');
  assert.equal(owner('src/features/orders/application/place.use-case.ts'), 'owned:be.feature.application');
  assert.equal(owner('src/features/orders/transport/http/place.controller.ts'), 'owned:be.transport.http');
  assert.equal(owner('src/features/orders/transport/schedule/sweep.job.ts'), 'owned:be.transport.schedule');
  assert.equal(owner('src/features/orders/transport/message/paid.consumer.ts'), 'not-enabled:be.transport.message');     // opt-in, not declared
  assert.equal(owner('src/modules/domain/orders/orders.service.ts'), 'owned:be.domain');
  assert.equal(owner('src/modules/domain/orders/errors/orders.error.ts'), 'owned:be.errors');
  assert.equal(owner('src/modules/integrations/stripe/errors/stripe.error.ts'), 'owned:be.errors');
  assert.equal(owner('src/modules/platform/database/persistence/migrations/20260101000000-init.ts'), 'owned:be.persistence');
  assert.equal(owner('src/modules/platform/config/index.ts'), 'owned:be.platform');
  assert.equal(owner('src/tests/e2e/orders/place.e2e-spec.ts'), 'owned:be.tests.e2e');
  assert.equal(owner('src/tests/e2e/setup/app.ts'), 'owned:be.tests.e2e-setup');
  assert.equal(owner('contracts/core/schema.graphql'), 'owned:be.contract.graphql');
  assert.equal(owner('contracts/core/openapi.json'), 'not-enabled:be.contract.openapi');
  assert.equal(owner('.starciwork/features/index.yaml'), 'owned:be.starciwork');
  assert.equal(owner('.starciwork/worktrees/x/README.md'), 'forbidden:repo.worktrees');
  assert.equal(owner('.starcistacks/prod/secrets/db.enc'), 'owned:be.starcistacks');
  assert.equal(owner('.github/workflows/ci.yml'), 'owned:repo.ci');
  assert.equal(owner('docs/adr/0001-use-nest.md'), 'owned:repo.docs');
  assert.equal(owner('e2e/probe.spec.ts'), 'forbidden:be.root-e2e');
  assert.equal(owner('.env.production'), 'forbidden:repo.plaintext-env');
  assert.equal(owner('node_modules/x/index.js'), 'owned:repo.build-output');
  assert.equal(owner('apps/core/src/.next/x'), 'owned:be.app.api');   // the deeper slot: app source owns its subtree
  // a Windows spelling and a directory spelling reach the same slot
  assert.equal(owner('src\\features\\orders\\index.ts'), 'owned:be.feature');
  assert.equal(owner('src/features/orders/'), 'owned:be.feature');
  assert.equal(be.ownerOf('src/features/orders/application/place.use-case.ts').root, 'src/features/orders');
  assert.equal(be.classifyPath('e2e/probe.spec.ts').goesTo.startsWith('src/tests/e2e/'), true);
});

test('BE fixture: tracked, tier, required files', () => {
  const be = openHfs({ declaration: BE });
  assert.equal(be.isTracked('src/features/orders/index.ts'), true);
  assert.equal(be.trackingOf('apps/core/dist/main.js'), 'ignored');
  assert.equal(be.isTracked('apps/core/dist/main.js'), false);
  assert.equal(be.trackingOf('.eslintcache'), 'external');
  assert.equal(be.trackingOf('nul'), 'external');
  assert.equal(be.trackingOf('nothing/here.txt'), null);
  assert.equal(be.isTracked('nothing/here.txt'), false);
  assert.equal(be.tierOf('apps/core/src/main.ts'), 'app');
  assert.equal(be.tierOf('src/modules/domain/orders/persistence/orders.repository.ts'), 'domain');       // inherits the owner's tier
  assert.equal(be.tierOf('src/modules/platform/database/persistence/x.ts'), 'platform');
  assert.equal(be.tierOf('README.md'), 'none');
  assert.deepEqual(be.requiredFiles('src/features/orders/index.ts'), ['src/features/orders/index.ts', 'src/features/orders/orders.module.ts', 'src/features/orders/application/']);
  assert.deepEqual(be.requiredFiles('src/features/orders/transport/http/a.controller.ts'), ['src/features/orders/transport/http/orders-http.module.ts']);
  assert.deepEqual(be.requiredFiles('apps/core/src/main.ts'), ['apps/core/src/main.ts', 'apps/core/src/app.module.ts', 'apps/core/src/core.composition.spec.ts']);
  assert.deepEqual(be.requiredFiles('src/modules/domain/orders/persistence/x.ts'), ['src/modules/domain/orders/persistence/connection.ts']);
  const { paths, minimums } = be.requiredPaths();
  const has = (p) => paths.some((e) => e.path === p);
  for (const p of ['README.md', 'hfs.json', 'package-lock.json', 'tsconfig.json', 'nest-cli.json', '.husky/pre-push', '.github/workflows/ci.yml', '.sops.yaml', '.starciwork/', '.starciwork/features/index.yaml', '.starcistacks/application-stacks.yaml',
    'apps/core/src/', 'apps/core/src/core.composition.spec.ts', 'apps/migrate/src/migrate.composition.spec.ts', 'src/modules/platform/config/', 'src/modules/platform/logging/', 'src/modules/platform/errors/', 'src/modules/platform/primitives/'])
    assert.equal(has(p), true, `required path missing: ${p}`);
  assert.equal(has('.github/workflows/e2e.yml'), false, 'an optional file is not required');
  assert.equal(has('apps/worker/src/'), false, 'an opt-in app is not required');
  assert.equal(has('jest.config.e2e.js'), false);
  assert.deepEqual(minimums.map((m) => m.slot).sort(), ['be.app.api', 'be.feature']);
  // no connection declared: no migrate app is required, and its paths are not
  const noDb = openHfs({ declaration: { ...BE, apps: [{ name: 'core', kind: 'api' }], connections: [] } });
  assert.equal(noDb.requiredPaths().paths.some((e) => e.slot === 'be.app.migrate'), false);
});

test('BE fixture: import direction', () => {
  const be = openHfs({ declaration: BE });
  const ok = (a, b) => be.importAllowed(a, b);
  assert.equal(ok('src/features/orders/application/place.use-case.ts', 'src/modules/domain/stock/index.ts').allowed, true);
  assert.equal(ok('src/features/orders/application/place.use-case.ts', 'src/features/orders/orders.module.ts').reason, 'sameOwner');
  assert.deepEqual([ok('src/features/orders/application/a.ts', 'src/features/billing/index.ts').allowed, ok('src/features/orders/application/a.ts', 'src/features/billing/index.ts').reason], [false, 'tierDirection']);   // feature never imports feature
  assert.equal(ok('src/features/orders/application/a.ts', 'src/modules/domain/stock/stock.service.ts').reason, 'notPublicEntry');          // cross-owner targets index.ts
  assert.equal(ok('src/modules/platform/config/index.ts', 'src/modules/domain/stock/index.ts').reason, 'tierDirection');                   // platform never imports domain
  assert.equal(ok('src/modules/domain/stock/index.ts', 'src/modules/domain/pricing/index.ts').allowed, true);                              // domain may (acyclic is a graph rule)
  assert.equal(ok('src/modules/integrations/stripe/index.ts', 'src/modules/domain/stock/index.ts').reason, 'tierDirection');
  assert.equal(ok('apps/core/src/app.module.ts', 'src/features/orders/index.ts').allowed, true);
  assert.equal(ok('apps/core/src/app.module.ts', 'apps/worker/src/app.module.ts').reason, 'crossApp');                                     // apps never import each other
  assert.equal(ok('src/tests/e2e/orders/place.e2e-spec.ts', 'src/tests/e2e/setup/app.ts').allowed, true);
  assert.equal(ok('src/tests/e2e/orders/place.e2e-spec.ts', 'apps/core/src/app.module.ts').allowed, true);                                  // an app's public entry is app.module.ts
  assert.equal(ok('src/tests/e2e/orders/place.e2e-spec.ts', 'apps/core/src/main.ts').reason, 'notPublicEntry');
  assert.equal(ok('src/tests/fixtures/orders.ts', 'src/features/orders/index.ts').reason, 'tierDirection');                                // fixtures never import a feature
  assert.equal(ok('src/features/orders/index.ts', 'README.md').reason, 'untiered');
  const unknown = ok('src/features/orders/index.ts', 'src/whatever/x.ts');
  assert.deepEqual([unknown.allowed, unknown.reason, unknown.code], [false, 'unowned', 'HFS_PATH_NO_SLOT']);
  assert.equal(ok('src/features/orders/transport/message/a.ts', 'src/features/orders/index.ts').reason, 'slotNotEnabled');
});

test('FE multi-app fixture', () => {
  const fe = openHfs({ declaration: FE });
  const owner = (p) => fe.classifyPath(p).slot;
  assert.equal(owner('apps/web/next.config.ts'), 'fe.app.next');
  assert.equal(owner('apps/admin/package.json'), 'fe.app.next');
  assert.equal(owner('apps/web/vitest.config.ts'), 'fe.app-optional');
  assert.equal(owner('apps/web/src/app/[locale]/page.tsx'), 'fe.route');
  assert.equal(owner('apps/web/src/features/pages/Home/index.tsx'), 'fe.feature');
  assert.equal(owner('apps/web/src/components/blocks/Header/component.tsx'), 'fe.components');
  assert.equal(owner('apps/web/src/hooks/orders/useOrders.ts'), 'fe.hooks');
  assert.equal(owner('apps/web/src/modules/api/client.ts'), 'fe.modules.api');
  assert.equal(owner('apps/web/src/modules/api/contract/core.graphql'), 'fe.contract.copy');   // the contract copy is a slot of its own
  assert.equal(owner('apps/web/src/modules/api/read/orders.ts'), 'fe.modules.api');            // anything else below the module stays the module's
  assert.equal(owner('apps/web/src/modules/i18n/messages/en.json'), 'fe.modules.i18n');
  assert.equal(owner('apps/web/src/modules/brand/brand.css'), 'fe.modules.brand');
  assert.equal(owner('apps/web/src/modules/cart/index.ts'), 'fe.modules');
  assert.equal(owner('packages/nivo-ui/src/index.ts'), 'fe.package.ui');
  assert.equal(owner('e2e/checkout/pay.e2e-spec.ts'), 'fe.e2e');
  assert.equal(owner('apps/web/Dockerfile'), 'repo.app-image');
  assert.equal(fe.classifyPath('src/index.ts').status, 'no-slot');                              // FE has no root src/
  assert.equal(fe.classifyPath('.starciwork/x.yaml').status, 'no-slot');                        // and no .starciwork
  assert.equal(fe.ownerOf('apps/admin/src/modules/cart/index.ts').root, 'apps/admin/src/modules/cart');
  assert.equal(fe.classifyPath('apps/admin/src/modules/cart/index.ts').bindings.app, 'admin');
  // required paths are expanded per declared app
  const paths = fe.requiredPaths().paths.map((e) => e.path);
  for (const app of ['web', 'admin']) for (const p of [`apps/${app}/next.config.ts`, `apps/${app}/src/app/[locale]/layout.tsx`, `apps/${app}/src/modules/api/`, `apps/${app}/src/modules/i18n/`, `apps/${app}/src/modules/routes/`, `apps/${app}/src/modules/config/`])
    assert.equal(paths.includes(p), true, `missing ${p}`);
  assert.equal(paths.includes('apps/web/vitest.config.ts'), false);
  assert.deepEqual(fe.requiredFiles('e2e/checkout/pay.e2e-spec.ts'), ['playwright.config.ts', 'tsconfig.e2e.json']);
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
  assert.equal(ok('apps/web/src/features/pages/Home/index.tsx', 'packages/nivo-ui/src/index.ts').allowed, true);
  assert.equal(ok('packages/nivo-ui/src/button.ts', 'apps/web/src/modules/api/index.ts').reason, 'tierDirection');
  assert.equal(ok('e2e/checkout/pay.e2e-spec.ts', 'apps/web/src/modules/api/index.ts').reason, 'tierDirection');                            // black box: no app source
  assert.equal(fe.slotEnabled(fe.slot('fe.package.ui')), true);
  assert.equal(openHfs({ declaration: { ...FE, optionalSlots: [] } }).classifyPath('packages/nivo-ui/src/index.ts').status, 'not-enabled');
});

test('an unknown path is reported with its nearest slot and HFS_PATH_NO_SLOT', () => {
  const be = openHfs({ declaration: BE });
  const stray = be.classifyPath('src/tests/e2e/orders/place.ts');
  assert.deepEqual([stray.status, stray.code], ['no-slot', 'HFS_PATH_NO_SLOT']);
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
});

test('growth is a minor: adding a slot changes no existing answer; every slot pattern owns its own sample', () => {
  const grown = loadSlotManifest({ text: manifestText.replace('version: 2.0.0', 'version: 2.1.0').replace('\n# Checks that read this manifest', `
  - id: be.transport.grpc
    profiles: [be]
    path: "src/features/<feature>/transport/grpc/"
    presence: opt-in
    tracked: tracked
    tier: feature
    tests: unit-beside
    since: 2.1.0

# Checks that read this manifest`) });
  assert.equal(grown.minor, 1);
  const before = openHfs({ declaration: BE });
  const after = openHfs({ manifest: grown, declaration: { ...BE, optionalSlots: [...BE.optionalSlots, 'be.transport.grpc'] } });
  for (const p of ['src/features/orders/index.ts', 'apps/core/src/main.ts', 'src/modules/domain/a/errors/x.error.ts', 'README.md', '.env'])
    assert.equal(after.classifyPath(p).slot, before.classifyPath(p).slot);
  assert.equal(after.classifyPath('src/features/orders/transport/grpc/a.ts').status, 'owned');
  assert.equal(before.classifyPath('src/features/orders/transport/grpc/a.ts').status, 'owned', 'the feature slot owns the subtree until the new slot is declared');
  assert.equal(after.classifyPath('src/features/orders/transport/grpc/a.ts').slot, 'be.transport.grpc');

  // every variant of every slot, filled with sample names, is owned by that slot and never ambiguous
  const manifest = loadSlotManifest();
  for (const [profile, declaration] of [['be', BE], ['fe', FE]]) {
    const repo = openHfs({ declaration: { ...declaration, optionalSlots: [] } });
    const kindOf = (slot) => declaration.apps.find((a) => a.kind === slot.appKind)?.name;
    for (const slot of manifest.slots.filter((s) => s.profiles.includes(profile))) {
      for (const variant of braceVariants(slot.path)) {
        const sample = variant.replace(/<app>/g, kindOf(slot) ?? 'core').replace(/<[^>]+>/g, 'sample').replace(/\*\*\//g, '').replace(/\*\*/g, 'a/b').replace(/\*/g, 'x') + (variant.endsWith('/') ? 'file.ts' : '');
        const c = repo.classifyPath(sample);
        assert.notEqual(c.status, 'ambiguous', `${profile}: ${sample} (${slot.id}) is ambiguous between ${c.candidates}`);
        assert.notEqual(c.status, 'no-slot', `${profile}: ${sample} (${slot.id}) matches no slot`);
        if (slot.appKind === undefined) assert.equal(c.slot, slot.id, `${profile}: ${sample} owned by ${c.slot}, expected ${slot.id}`);
      }
    }
  }
});

test('the failure catalog explains the new codes in Vietnamese', () => {
  const catalog = parseYaml(fs.readFileSync(path.join(root, 'modules/kernel/failure-codes.yaml'), 'utf8'));
  for (const code of ['HFS_PATH_NO_SLOT', 'HFS_MANIFEST_MAJOR_MISMATCH', 'HFS_MANIFEST_INVALID', 'HFS_DECLARATION_INVALID']) {
    assert.ok(catalog[code], `${code} has no catalog entry`);
    for (const field of ['title_vi', 'meaning_vi', 'nextStep_vi']) assert.match(catalog[code][field], /[À-ỹ]/, `${code}.${field} is not Vietnamese`);
  }
});
