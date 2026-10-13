import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { parseYaml } from '../../engine/yaml.mjs';
import { checkRepo } from '../../scripts/hfs/check.mjs';
import { managedScriptNames } from '../../scripts/hfs/architecture/managed-scripts.mjs';
import { managedGroupOf } from '../../scripts/hfs/edition-slots.mjs';
import { HfsSlotsError, loadRuleCatalog, loadSlotManifest, openHfs, resolveRepoDeclaration } from '../../scripts/hfs/slots.mjs';

// The edition mechanism (L01, manifest 2.1.0, re-ruled in 2.3.0): hfs.json names `edition: full|lite` (absent means full), and lite is
// the same manifest filtered (a slot's `editions`, `litePresence` and `lite` overlay), never a second engine. Owner ruling 2026-10-12:
// lite is the full architecture deployed without self-hosted infrastructure - it keeps every pattern, the worker app and the back-end
// unit specs, and drops only the e2e and contract world, the browser journey, UAT records and the self-hosted stack; a `supabase`
// connection provider enables the Supabase slots (app.supabase*, be.integrations.supabase, fe.modules.db, fe.package.db).

const root = path.resolve(import.meta.dirname, '..', '..');
const Ajv2020 = (() => { const loaded = createRequire(import.meta.url)('ajv/dist/2020.js'); return loaded.default ?? loaded; })();
const validateRepoSchema = new Ajv2020({ strict: false, allErrors: true, logger: false }).compile(parseYaml(fs.readFileSync(path.join(root, 'modules/schemas/hfs-repo.schema.yaml'), 'utf8')));

const CONNECTION = { name: 'primary', envPrefix: 'PRIMARY_DB', owner: 'core', isolation: 'database' };
const BE = { apps: [{ name: 'core', kind: 'api' }, { name: 'cli', kind: 'cli' }], connections: [CONNECTION] };
const FE = { apps: [{ name: 'web', kind: 'next' }] };
const app = ({ edition, be = BE, fe = FE } = {}) => ({ hfs: 2, kind: 'app', project: 'demo', ...(edition === undefined ? {} : { edition }), sides: { be, fe } });

const refusal = (fn, code) => assert.throws(fn, (error) => error instanceof HfsSlotsError && error.code === code, `expected ${code}`);
const tree = (t, files) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-edition-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  for (const [file, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), typeof content === 'string' ? content : JSON.stringify(content));
  }
  return dir;
};

test('edition: absent means full, full and lite resolve, every view carries it', () => {
  const manifest = loadSlotManifest();
  assert.equal(resolveRepoDeclaration(manifest, app()).edition, 'full');
  assert.equal(resolveRepoDeclaration(manifest, app({ edition: 'full' })).edition, 'full');
  const lite = resolveRepoDeclaration(manifest, app({ edition: 'lite' }));
  assert.equal(lite.edition, 'lite');
  for (const side of ['be', 'fe']) assert.equal(lite.sides[side].edition, 'lite', `${side} inherits the edition`);
  assert.equal(openHfs({ declaration: app({ edition: 'lite' }), side: 'fe' }).repo.edition, 'lite');
  // the hfs.json schema agrees: full and lite are legal, anything else is not
  for (const edition of [undefined, 'full', 'lite']) assert.equal(validateRepoSchema(JSON.parse(JSON.stringify(app({ edition })))), true, `schema refused edition ${edition}`);
  for (const edition of ['basic', 'light', 2]) {
    assert.equal(validateRepoSchema(JSON.parse(JSON.stringify(app({ edition })))), false, `schema accepted edition ${edition}`);
    refusal(() => resolveRepoDeclaration(manifest, app({ edition })), 'HFS_EDITION_INVALID');
  }
  // starci app check reports an invalid edition as one hfs.json finding, never an exception
  const bad = checkRepo({ repoRoot: root, declaration: app({ edition: 'basic' }), files: ['hfs.json'], tree: false });
  assert.deepEqual(bad.findings.map((f) => [f.code, f.path]), [['HFS_EDITION_INVALID', 'hfs.json']]);
});

test('lite removes the slots its editions exclude, keeps the rest, and adds its own', () => {
  const manifest = loadSlotManifest();
  for (const slot of manifest.slots) assert.ok(slot.editions === undefined || slot.editions.every((e) => ['full', 'lite'].includes(e)), `${slot.id}: unknown edition`);
  const liteOnly = manifest.slots.filter((s) => s.editions?.includes('lite') && !s.editions.includes('full')).map((s) => s.id);
  assert.deepEqual(liteOnly.sort(), ['app.starciwork.uat', 'be.feature.realtime.supabase', 'fe.modules.db.outcome'], 'the lite-only slots');
  const liteBe = openHfs({ declaration: app({ edition: 'lite' }), side: 'be' });
  const fullBe = openHfs({ declaration: app(), side: 'be' });
  assert.equal(liteBe.slot('be.feature.realtime.supabase').presence, 'opt-in', 'the lite-only realtime door exists under lite');
  assert.equal(fullBe.slot('be.feature.realtime.supabase'), null, 'under full it does not exist');
  // owner ruling 2026-10-12: the test world of the optional integration specs and the unit fixtures stay; e2e and contract go
  assert.equal(liteBe.slot('be.tests.world').presence, 'optional');
  assert.equal(liteBe.slot('be.tests.fixtures.builders').presence, 'optional');
  assert.equal(liteBe.slot('be.tests.integration').presence, 'optional');
  for (const id of ['be.tests.e2e', 'be.tests.contract']) {
    assert.equal(liteBe.slot(id).presence, 'forbidden', `${id}: litePresence replaces presence under lite`);
    assert.equal(liteBe.slot(id).tracked, 'external', `${id}: a forbidden slot holds no tracked path: it points out (goesTo)`);
    assert.equal(typeof liteBe.slot(id).goesTo, 'string', `${id}: every lite-forbidden slot says where the content goes`);
  }
  // a lite slot owes exactly the unit specs its full slot owes
  for (const slot of liteBe.slots()) assert.equal(slot.tests, fullBe.slot(slot.id)?.tests ?? slot.tests, `${slot.id}.tests`);
  assert.equal(liteBe.slot('be.domain').tests, 'unit-beside');
  // the lite overlay replaces the fields it names; the trigger kinds keep their application/ roots
  assert.equal(liteBe.slot('be.feature.application').path, fullBe.slot('be.feature.application').path);
  assert.deepEqual(liteBe.slot('be.projections').requires, ['index.ts', '<name>.module.ts', '<name>.projection.ts'], 'a lite read model has no TypeORM projection entity');
  assert.match(liteBe.slot('be.platform.queue').why, /pgmq/, 'the lite why names the Supabase adapter');
  // ruleParams merge their lite overrides over the base: the schema authority and the self-hosted libraries change, the unit roles do not
  assert.equal(fullBe.ruleParams().schemaAuthority, undefined);
  assert.equal(liteBe.ruleParams().schemaAuthority, 'supabase');
  assert.deepEqual(liteBe.ruleParams().unitRoles, fullBe.ruleParams().unitRoles);
  assert.ok(liteBe.ruleParams().unitRoles.length > 0);
  assert.deepEqual(liteBe.ruleParams().infraOwners.bullmq, []);
  assert.deepEqual(fullBe.ruleParams().infraOwners.bullmq, ['platform/queue']);
  assert.deepEqual(liteBe.ruleParams().infraOwners.fetch, fullBe.ruleParams().infraOwners.fetch, 'a specifier lite does not restate keeps its owner');
});

test('lite classification: e2e, contract, the socket realtime doors and the browser journey are forbidden paths with a goesTo; the patterns and the worker are not', () => {
  const be = openHfs({ declaration: app({ edition: 'lite' }), side: 'be' });
  const fe = openHfs({ declaration: app({ edition: 'lite' }), side: 'fe' });
  const whole = openHfs({ declaration: app({ edition: 'lite' }) });
  const forbidden = (resolver, p, slot) => {
    const c = resolver.classifyPath(p);
    assert.deepEqual([c.status, c.slot], ['forbidden', slot], p);
    assert.equal(typeof c.goesTo, 'string', `${p}: a forbidden path says where it goes`);
  };
  forbidden(be, 'src/tests/e2e/orders/place.e2e-spec.ts', 'be.tests.e2e');
  forbidden(be, 'src/tests/contract/stripe/charge.contract-spec.ts', 'be.tests.contract');
  forbidden(be, 'src/features/realtime/chat/transport/websocket/chat.gateway.ts', 'be.feature.realtime.websocket');
  forbidden(be, 'src/features/realtime/chat/transport/graphql/chat.subscription.ts', 'be.feature.realtime.graphql');
  assert.equal(be.classifyPath('jest.config.e2e.js').slot, 'be.tool-config-local');
  assert.equal(be.classifyPath('e2e/probe.ts').slot, 'be.root-e2e');
  // what lite keeps: the unit world, the integration world, the patterns and their kinds (opt-in, enabled by a declaration)
  assert.equal(be.classifyPath('jest.config.js').slot, 'be.tool-config', 'lite renders the jest unit config');
  assert.equal(be.classifyPath('src/tests/tsconfig.json').slot, 'be.tool-config');
  assert.equal(be.classifyPath('src/tests/world/use-test-world.ts').slot, 'be.tests.world');
  assert.equal(be.classifyPath('src/tests/fixtures/builders/order.builder.ts').slot, 'be.tests.fixtures.builders');
  for (const [p, slot] of [
    ['src/features/saga/checkout/index.ts', 'be.feature.saga'], ['src/features/realtime/chat/index.ts', 'be.feature.realtime'],
    ['src/features/realtime/chat/transport/supabase/chat.subscription.ts', 'be.feature.realtime.supabase'],
    ['src/features/jobs/send/index.ts', 'be.feature.jobs'], ['src/modules/events/orders/order-paid.event.ts', 'be.events'],
    ['src/modules/platform/event-bus/index.ts', 'be.platform.event-bus'], ['src/modules/platform/queue/index.ts', 'be.platform.queue'],
    ['contracts/core/events.json', 'be.contract.events'],
  ]) {
    const c = be.classifyPath(p);
    assert.equal(c.slot, slot, p);
    assert.notEqual(c.status, 'forbidden', `${p} is not forbidden under lite`);
  }
  const withWorker = openHfs({ declaration: app({ edition: 'lite', be: { ...BE, apps: [...BE.apps, { name: 'jobs', kind: 'worker' }] } }), side: 'be' });
  assert.equal(withWorker.classifyPath('apps/jobs/src/main.ts').slot, 'be.app.worker');
  assert.notEqual(withWorker.classifyPath('apps/jobs/src/main.ts').status, 'forbidden', 'the optional worker app is legal under lite');
  // at the app root: the e2e workflow and the browser journey are forbidden, the UAT records of .starciwork are the lite-only slot's
  assert.deepEqual([whole.classifyPath('.github/workflows/e2e.yml').status, whole.classifyPath('.github/workflows/e2e.yml').slot], ['forbidden', 'app.ci-e2e']);
  assert.deepEqual([whole.classifyPath('browser/playwright.config.ts').status, whole.classifyPath('browser/playwright.config.ts').slot], ['forbidden', 'app.browser']);
  assert.equal(whole.classifyPath('codecov.yml').slot, 'app.quality-config', 'lite keeps codecov.yml');
  assert.equal(whole.classifyPath('.starciwork/_resources/identities/users.yaml').slot, 'app.starciwork.uat');
  assert.equal(whole.classifyPath('.starciwork/_resources/identities/users.yaml').status, 'forbidden');
  assert.equal(be.classifyPath('src/features/api/orders/index.ts').slot, 'be.feature');
  assert.equal(be.classifyPath('apps/cli/src/main.ts').slot, 'be.app.cli', 'a cli app is optional under lite, not forbidden');
  assert.equal(fe.classifyPath('apps/web/src/app/auth/callback/route.ts').slot, 'fe.route.callback', 'the OAuth callback route exists under lite');
  assert.equal(fe.classifyPath('apps/web/src/components/leaves/Text/index.spec.tsx').slot, 'fe.components', 'the front end is full\'s: a spec there is FE_NO_TESTS, as in full');
});

test('full is untouched: no lite-only slot exists, every presence and path answers as before', () => {
  const be = openHfs({ declaration: app(), side: 'be' });
  assert.equal(be.slot('be.feature.realtime.supabase'), null);
  assert.equal(openHfs({ declaration: app() }).slot('app.starciwork.uat'), null);
  for (const [p, slot] of [
    ['src/tests/world/use-test-world.ts', 'be.tests.world'], ['src/features/realtime/chat/index.ts', 'be.feature.realtime'],
    ['src/features/jobs/send/send.processor.ts', 'be.feature.jobs'], ['contracts/core/events.json', 'be.contract.events'],
    ['src/features/api/orders/application/place.handler.ts', 'be.feature.application'],
  ]) {
    const c = be.classifyPath(p);
    assert.equal(c.slot, slot, `${p} under full`);
    assert.notEqual(c.status, 'forbidden', `${p} is not forbidden under full`);
  }
  const whole = openHfs({ declaration: app() });
  assert.equal(whole.classifyPath('.starciwork/_resources/identities/users.yaml').slot, 'app.starciwork', 'full: no uat slot, .starciwork answers');
  assert.equal(whole.classifyPath('fe/apps/web/src/app/auth/callback/route.ts').status, 'not-enabled', 'a full app without a Supabase connection holds no callback route (it is an opt-in slot of the supabase provider)');
});

test('a supabase connection provider enables the supabase slots of every profile; without it they stay opt-in', () => {
  const supabase = app({ edition: 'lite', be: { ...BE, connections: [{ ...CONNECTION, provider: 'supabase' }] } });
  const repo = resolveRepoDeclaration(loadSlotManifest(), supabase);
  assert.deepEqual(repo.providers, ['supabase']);
  assert.deepEqual(repo.sides.fe.providers, ['supabase'], 'the provider reaches the fe view: it declares no connections of its own');
  const whole = openHfs({ declaration: supabase });
  for (const [p, slot] of [
    ['supabase/config.toml', 'app.supabase.config'],
    ['supabase/migrations/20260101120000_init.sql', 'app.supabase.migrations'],
    ['supabase/seed.sql', 'app.supabase.seed'],
    ['supabase/types/database.types.ts', 'app.supabase.types'],
    ['be/src/modules/integrations/supabase/index.ts', 'be.integrations.supabase'],
    ['fe/apps/web/src/modules/db/index.ts', 'fe.modules.db'],
    ['fe/packages/app-db/src/index.ts', 'fe.package.db'],
  ]) assert.deepEqual([whole.classifyPath(p).status, whole.classifyPath(p).slot], ['owned', slot], p);
  // under lite the supabase tree is required: migrations is the schema authority of a lite app
  const paths = whole.requiredPaths().paths.map((e) => e.path);
  for (const p of ['supabase/', 'supabase/config.toml', 'supabase/types/database.types.ts']) assert.equal(paths.includes(p), true, `required under lite+supabase: ${p}`);
  // without the provider the same paths are opt-in slots the app did not enable
  const plain = openHfs({ declaration: app({ edition: 'lite' }) });
  for (const p of ['supabase/config.toml', 'be/src/modules/integrations/supabase/index.ts', 'fe/apps/web/src/modules/db/index.ts']) {
    assert.equal(plain.classifyPath(p).status, 'not-enabled', p);
  }
  // the provider also enables the slots under full (provider gating is not a lite thing)
  const fullWhole = openHfs({ declaration: app({ be: { ...BE, connections: [{ ...CONNECTION, provider: 'supabase' }] } }) });
  assert.equal(fullWhole.classifyPath('supabase/config.toml').status, 'owned');
  // and a bad provider is a declaration problem
  refusal(() => resolveRepoDeclaration(loadSlotManifest(), app({ be: { ...BE, connections: [{ ...CONNECTION, provider: 'turso' }] } })), 'HFS_DECLARATION_INVALID');
});

test('L01: under lite an e2e, contract, stack or browser script and a test-infrastructure or self-hosted library dependency are findings; the unit run is not', (t) => {
  const repoRoot = tree(t, {
    'package.json': {
      name: 'demo',
      scripts: { build: 'tsc -b', test: 'cd be && jest --selectProjects unit --coverage', 'typecheck:tests': 'tsc -p be/src/tests/tsconfig.json', 'test:integration': 'cd be && jest --selectProjects integration', 'test:e2e': 'cd be && jest --selectProjects e2e', 'test:contract': 'x', 'test:stack': 'starci app stack' },
      devDependencies: { jest: '30.0.0', '@starci/jest-preset': '1.0.0', testcontainers: '10.0.0', typescript: '6.0.0' },
      dependencies: { bullmq: '5.0.0', kafkajs: '2.0.0', ioredis: '5.0.0', pg: '8.0.0', next: '16.0.0' },
    },
  });
  const liteDecl = { ...app({ edition: 'lite' }), sides: { be: { ...BE, apps: [...BE.apps, { name: 'jobs', kind: 'worker' }], patterns: ['event-bus', 'queue'], kinds: ['api', 'cli', 'reactors'] }, fe: FE } };
  const files = ['package.json', 'be/jest.config.js', 'be/src/tests/e2e/orders/x.e2e-spec.ts', 'be/src/features/api/orders/index.ts'];
  const findings = checkRepo({ repoRoot, declaration: liteDecl, files, tree: false }).findings;
  const editionFindings = findings.filter((f) => f.code === 'HFS_EDITION_FORBIDDEN_PRESENT');
  const on = (p) => editionFindings.filter((f) => f.path === p);
  const named = on('package.json').map((f) => f.name).sort();
  assert.deepEqual(named, ['bullmq', 'ioredis', 'kafkajs', 'test:contract', 'test:e2e', 'test:stack', 'testcontainers'], JSON.stringify(on('package.json').map((f) => f.message)));
  // the declaration: the worker app, the event patterns and the reactors kind are full architecture, legal under lite
  assert.deepEqual(on('hfs.json'), []);
  // the forbidden e2e path comes from the slot machinery, as HFS_FORBIDDEN_PRESENT, not L01
  assert.equal(findings.some((f) => f.path === 'be/src/tests/e2e/orders/x.e2e-spec.ts' && f.code === 'HFS_FORBIDDEN_PRESENT'), true);
  assert.equal(on('be/src/tests/e2e/orders/x.e2e-spec.ts').length, 0, 'the slot layer owns the path finding');
  // the full view answers [] for the same tree and declaration (the rule tests the edition once)
  const fullDecl = { ...app(), sides: { be: liteDecl.sides.be, fe: FE } };
  const full = checkRepo({ repoRoot, declaration: fullDecl, files, tree: false }).findings;
  assert.equal(full.some((f) => f.code === 'HFS_EDITION_FORBIDDEN_PRESENT'), false);
  assert.equal(full.some((f) => f.code === 'HFS_EDITION_INVALID'), false);
});

test('L01: a clean lite app produces no edition finding', (t) => {
  const repoRoot = tree(t, {
    'package.json': { name: 'demo', scripts: { build: 'tsc -b', lint: 'eslint . --max-warnings=0', typecheck: 'tsc --noEmit' }, devDependencies: { typescript: '6.0.0' }, dependencies: { next: '16.0.0' } },
  });
  const files = ['package.json', 'be/src/features/api/orders/index.ts', 'fe/apps/web/src/app/[locale]/page.tsx'];
  const findings = checkRepo({ repoRoot, declaration: app({ edition: 'lite', be: { ...BE, kinds: ['api', 'cli'] } }), files, tree: false }).findings;
  assert.equal(findings.some((f) => f.code.startsWith('HFS_EDITION')), false, JSON.stringify(findings.filter((f) => f.code.startsWith('HFS_EDITION'))));
});

test('managedGroupOf: the one template-group answer of sync and the README check - liteManagedBy in lite, managedBy otherwise', () => {
  assert.equal(managedGroupOf({ managedBy: 'a', liteManagedBy: 'b' }, 'lite'), 'b');
  assert.equal(managedGroupOf({ managedBy: 'a', liteManagedBy: 'b' }, 'full'), 'a');
  assert.equal(managedGroupOf({ managedBy: 'a' }, 'lite'), 'a');
  assert.equal(managedGroupOf({ liteManagedBy: 'b' }, 'full'), undefined);
  assert.equal(managedGroupOf({ path: 'x' }, 'lite'), undefined);
  const slot = loadSlotManifest().slots.find((entry) => entry.id === 'app.package-manifest');
  for (const edition of ['full', 'lite']) {
    const names = [...managedScriptNames('app', edition)];
    assert.ok(names.length > 0, `${edition}: the group ${managedGroupOf(slot, edition)} names scripts`);
  }
});

// ------------------------------------------------------------------------------- the rule catalog and the one findings filter

test('rule catalog: `editions` names the rules lite does not judge; a rule without it is judged by both', () => {
  const catalog = loadRuleCatalog();
  const fullOnly = catalog.rules.filter((r) => r.editions && !r.editions.includes('lite')).map((r) => r.id);
  // owner ruling 2026-10-12: only the proofs that need the e2e or integration world stay full only
  assert.deepEqual(fullOnly.sort(), ['R112', 'R155', 'R167', 'R173', 'R184'].sort());
  for (const id of ['R46', 'R47', 'R48', 'R98', 'R102', 'R151', 'R160', 'R169', 'R177', 'R10', 'R34', 'R97']) assert.ok(!fullOnly.includes(id), `${id} is judged in lite`);
  assert.equal(catalog.judgedIn('BE_TEST_TOPOLOGY', 'lite'), true);
  assert.equal(catalog.judgedIn('BE_PATTERN_SPEC_MISSING', 'lite'), false);
  assert.equal(catalog.judgedIn('BE_PATTERN_SPEC_MISSING', 'full'), true);
  assert.equal(catalog.judgedIn('FE_NO_TESTS', 'lite'), true);
  assert.equal(catalog.judgedIn('HFS_REPO_UNREADABLE', 'lite'), true, 'a code outside the catalog is always judged');
  assert.equal(catalog.rule('R212').cases[0].date, '2026-10-12', 'the edition ruling is recorded as a dated owner case on R212');
  assert.throws(() => loadRuleCatalog({ text: fs.readFileSync(path.join(root, 'knowledge/hfs/rules.yaml'), 'utf8').replace('editions: [full]', 'editions: [basic]') }), (e) => e.code === 'HFS_RULES_INVALID');
  assert.throws(() => loadRuleCatalog({ text: fs.readFileSync(path.join(root, 'knowledge/hfs/rules.yaml'), 'utf8').replace('        source: owner', '        source: agent') }), (e) => e.code === 'HFS_RULES_INVALID', 'a case is an owner ruling');
});

test('checkRepo: the one findings filter drops the codes of rules the edition does not judge, and only for that edition', () => {
  const files = ['hfs.json', 'be/src/tests/e2e/orders/place.e2e-spec.ts'];
  const lite = checkRepo({ repoRoot: root, declaration: app({ edition: 'lite' }), files, tree: false });
  assert.ok(lite.findings.some((f) => f.code === 'HFS_FORBIDDEN_PRESENT'), 'the forbidden e2e tree is a finding of lite');
  assert.ok(!lite.findings.some((f) => f.code === 'BE_PATTERN_SPEC_MISSING' || f.code === 'BE_INTEGRATION_SPEC_MISSING'), 'a code of a full-only rule is not reported under lite');
});

test('hfs.json supabase block: the auth posture is declared data (jwtExpiry 3600 at most), unknown keys refused', () => {
  const manifest = loadSlotManifest();
  const withBlock = (supabase) => ({ ...app({ edition: 'lite' }), supabase });
  const good = { enableSignup: false, jwtExpiry: 3600, siteUrl: 'http://localhost:3000', redirectUrls: ['http://localhost:3000/auth/callback'], forceRls: ['public.audit'] };
  assert.equal(resolveRepoDeclaration(manifest, withBlock(good)).edition, 'lite');
  assert.equal(validateRepoSchema(JSON.parse(JSON.stringify(withBlock(good)))), true);
  for (const bad of [{ jwtExpiry: 7200 }, { enableSignup: 'no' }, { redirectUrls: 'x' }, { surprise: true }, 'x']) {
    assert.equal(validateRepoSchema(JSON.parse(JSON.stringify(withBlock(bad)))), false, `schema accepted ${JSON.stringify(bad)}`);
    refusal(() => resolveRepoDeclaration(manifest, withBlock(bad)), 'HFS_DECLARATION_INVALID');
  }
});
