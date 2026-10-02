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

// The edition mechanism (L01, manifest 2.1.0): hfs.json names `edition: full|lite` (absent means full), and lite is the same
// manifest filtered (a slot's `editions`, `litePresence` and `lite` overlay), never a second engine. Full is the byte-for-byte
// behavior of before; lite drops the test world, the event patterns and the app kinds the filter forbids, and a `supabase`
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
  // hfs check reports an invalid edition as one hfs.json finding, never an exception
  const bad = checkRepo({ repoRoot: root, declaration: app({ edition: 'basic' }), files: ['hfs.json'], tree: false });
  assert.deepEqual(bad.findings.map((f) => [f.code, f.path]), [['HFS_EDITION_INVALID', 'hfs.json']]);
});

test('lite removes the slots its editions exclude, keeps the rest, and adds its own', () => {
  const manifest = loadSlotManifest();
  for (const slot of manifest.slots) assert.ok(slot.editions === undefined || slot.editions.every((e) => ['full', 'lite'].includes(e)), `${slot.id}: unknown edition`);
  const liteOnly = manifest.slots.filter((s) => s.editions?.includes('lite') && !s.editions.includes('full')).map((s) => s.id);
  assert.deepEqual(liteOnly.sort(), ['app.starciwork.uat', 'fe.db.outcome', 'repo.tests-forbidden'], 'the lite-only slots');
  const liteBe = openHfs({ declaration: app({ edition: 'lite' }), side: 'be' });
  const fullBe = openHfs({ declaration: app(), side: 'be' });
  assert.equal(liteBe.slot('repo.tests-forbidden').presence, 'forbidden', 'the lite-only forbidden slot exists under lite');
  assert.equal(fullBe.slot('repo.tests-forbidden'), null, 'under full it does not exist: the forbidden answers of full stay full\'s');
  assert.equal(fullBe.slot('be.tests.world').presence, 'optional');
  assert.equal(liteBe.slot('be.tests.world').presence, 'forbidden', 'litePresence replaces presence under lite');
  assert.equal(liteBe.slot('be.tests.world').tracked, 'external', 'a forbidden slot holds no tracked path: it points out (goesTo)');
  assert.equal(typeof liteBe.slot('be.tests.world').goesTo, 'string', 'every lite-forbidden slot says where the content goes');
  // tests is none on every slot lite sees: the lite edition has no test world
  for (const slot of liteBe.slots()) assert.equal(slot.tests, 'none', `${slot.id}.tests`);
  for (const slot of openHfs({ declaration: app({ edition: 'lite' }), side: 'fe' }).slots()) assert.equal(slot.tests, 'none', `${slot.id}.tests`);
  // the lite overlay replaces the fields it names: application/ exists only under features/api/ (the other kind roots are forbidden slots)
  assert.equal(fullBe.slot('be.feature.application').path, 'src/features/{api/,jobs/,reactors/,saga/}<feature>/application/');
  assert.equal(liteBe.slot('be.feature.application').path, 'src/features/api/<feature>/application/');
  // ruleParams merge their lite overrides over the base
  assert.equal(fullBe.ruleParams().schemaAuthority, undefined);
  assert.equal(liteBe.ruleParams().schemaAuthority, 'supabase');
  // no test world: no unit role owes a spec under lite (the unit-spec lint reads ruleParams.unitRoles through the same view)
  assert.deepEqual(liteBe.ruleParams().unitRoles, []);
  assert.ok(fullBe.ruleParams().unitRoles.length > 0);
});

test('lite classification: the test tree, the worker app and the event patterns are forbidden paths with a goesTo', () => {
  const be = openHfs({ declaration: app({ edition: 'lite' }), side: 'be' });
  const fe = openHfs({ declaration: app({ edition: 'lite' }), side: 'fe' });
  const whole = openHfs({ declaration: app({ edition: 'lite' }) });
  const forbidden = (resolver, p, slot) => {
    const c = resolver.classifyPath(p);
    assert.deepEqual([c.status, c.slot], ['forbidden', slot], p);
    assert.equal(typeof c.goesTo, 'string', `${p}: a forbidden path says where it goes`);
  };
  // the test world under lite: the old test slots themselves are forbidden (the deeper match wins), a test-tool file a slot
  // does not already forbid is the lite-only repo.tests-forbidden's, and a spec inside an owned tree stays owned - with
  // tests forced to none, BE_SPEC_PLACEMENT (be) and FE_NO_TESTS (fe) report it
  for (const p of ['src/tests/world/use-test-world.ts']) forbidden(be, p, 'be.tests.world');
  forbidden(be, 'src/tests/e2e/orders/place.e2e-spec.ts', 'be.tests.e2e');
  for (const p of ['vitest.config.ts', 'src/__tests__/x.ts']) forbidden(be, p, 'repo.tests-forbidden');
  assert.equal(be.classifyPath('apps/cli/src/run.cli.spec.ts').slot, 'be.app.cli', 'a spec beside its command is the slot\'s, and the slot has no tests under lite');
  assert.equal(be.classifyPath('jest.config.e2e.js').slot, 'be.tool-config-local', 'a test configuration the lite tool-config no longer lists is the forbidden local config\'s');
  assert.equal(be.classifyPath('e2e/probe.ts').slot, 'be.root-e2e');
  forbidden(fe, 'apps/web/vitest.setup.ts', 'repo.tests-forbidden');
  assert.equal(fe.classifyPath('apps/web/src/components/leaves/Text/index.spec.tsx').slot, 'fe.components');
  // the event patterns and their kinds are forbidden slots, each naming where the content goes
  forbidden(be, 'src/features/saga/checkout/index.ts', 'be.feature.saga');
  forbidden(be, 'src/features/realtime/chat/index.ts', 'be.feature.realtime');
  forbidden(be, 'src/features/jobs/send/send.processor.ts', 'be.feature.jobs');
  forbidden(be, 'src/modules/events/orders/order-paid.event.ts', 'be.events');
  forbidden(be, 'src/modules/platform/event-bus/index.ts', 'be.platform.event-bus');
  forbidden(be, 'contracts/core/events.json', 'be.contract.events');
  forbidden(be, 'e2e/probe.spec.ts', 'be.root-e2e');
  // a worker app no declaration names is an unknown path (the slot binds <app> to a declared worker); a declared one is forbidden
  assert.equal(be.classifyPath('apps/worker/src/main.ts').status, 'no-slot');
  const withWorker = openHfs({ declaration: app({ edition: 'lite', be: { ...BE, apps: [...BE.apps, { name: 'jobs', kind: 'worker' }] } }), side: 'be' });
  forbidden(withWorker, 'apps/jobs/src/main.ts', 'be.app.worker');
  // at the app root: the e2e workflow is forbidden, the UAT records of .starciwork are the lite-only slot's
  assert.deepEqual([whole.classifyPath('.github/workflows/e2e.yml').status, whole.classifyPath('.github/workflows/e2e.yml').slot], ['forbidden', 'app.ci-e2e']);
  assert.equal(whole.classifyPath('.starciwork/_resources/identities/users.yaml').slot, 'app.starciwork.uat');
  assert.equal(whole.classifyPath('.starciwork/_resources/identities/users.yaml').status, 'forbidden');
  // what lite keeps answers as before
  assert.equal(be.classifyPath('src/features/api/orders/index.ts').slot, 'be.feature');
  assert.equal(be.classifyPath('apps/cli/src/main.ts').slot, 'be.app.cli', 'a cli app is optional under lite, not forbidden');
  assert.equal(fe.classifyPath('apps/web/src/app/auth/callback/route.ts').slot, 'fe.route.callback', 'the OAuth callback route exists under lite');
});

test('full is untouched: no lite-only slot exists, every presence and path answers as before', () => {
  const be = openHfs({ declaration: app(), side: 'be' });
  assert.equal(be.slot('repo.tests-forbidden'), null);
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

test('L01: under lite a test script, a test dependency, a test-tool file, a worker app and a gone pattern or kind are findings', (t) => {
  const repoRoot = tree(t, {
    'package.json': { name: 'demo', scripts: { build: 'tsc -b', test: 'vitest run', 'typecheck:tests': 'tsc -p tsconfig.tests.json', 'check:quality': 'node --test scripts/' }, devDependencies: { vitest: '3.0.0', typescript: '6.0.0' }, dependencies: { '@playwright/test': '1.0.0', next: '16.0.0' } },
    'fe/apps/web/package.json': { name: 'web', scripts: { 'test:e2e': 'playwright test' } },
  });
  const liteDecl = { ...app({ edition: 'lite' }), sides: { be: { ...BE, apps: [...BE.apps, { name: 'jobs', kind: 'worker' }], patterns: ['event-bus'], kinds: ['api', 'cli', 'realtime'] }, fe: FE } };
  const files = ['package.json', 'fe/apps/web/package.json', 'vitest.config.ts', 'be/apps/jobs/src/main.ts', 'be/src/tests/e2e/x.e2e-spec.ts', 'be/src/features/api/orders/index.ts'];
  const findings = checkRepo({ repoRoot, declaration: liteDecl, files, tree: false }).findings;
  const editionFindings = findings.filter((f) => f.code === 'HFS_EDITION_FORBIDDEN_PRESENT');
  const on = (p) => editionFindings.filter((f) => f.path === p);
  // package.json: one finding per test script and per test dependency
  assert.equal(on('package.json').length, 5, JSON.stringify(on('package.json').map((f) => f.message)));
  assert.equal(on('fe/apps/web/package.json').length, 1);
  // a root-level test-tool file no slot already forbids
  assert.equal(on('vitest.config.ts').length, 1);
  // the declaration: one hfs.json finding at the root for the worker app, the pattern and the kind - never doubled under be/
  const declared = on('hfs.json');
  assert.equal(declared.length, 3, JSON.stringify(declared.map((f) => f.message)));
  assert.ok(declared.some((f) => /worker app jobs/.test(f.message)));
  assert.ok(declared.some((f) => /event-bus pattern/.test(f.message)));
  assert.ok(declared.some((f) => /realtime trigger/.test(f.message)));
  assert.equal(findings.some((f) => f.path === 'be/hfs.json'), false, 'the side scope does not repeat the declaration findings');
  // the forbidden paths come from the slot machinery, as HFS_FORBIDDEN_PRESENT, not L01
  assert.equal(findings.some((f) => f.path === 'be/apps/jobs/src/main.ts' && f.code === 'HFS_FORBIDDEN_PRESENT'), true);
  assert.equal(findings.some((f) => f.path === 'be/src/tests/e2e/x.e2e-spec.ts' && f.code === 'HFS_FORBIDDEN_PRESENT'), true);
  assert.equal(on('be/src/tests/e2e/x.e2e-spec.ts').length, 0, 'the slot layer owns the path finding');
  // the full view forbids none of it, so the same tree and the same declaration produce no edition finding (the rule tests no edition)
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
  for (const id of ['R47', 'R48', 'R98', 'R102', 'R155', 'R167', 'R173', 'R151', 'R160', 'R169', 'R177']) assert.ok(fullOnly.includes(id), `${id} is full only`);
  for (const id of ['R10', 'R11', 'R34', 'R35', 'R74', 'R97', 'R147', 'R156', 'R174', 'R180']) assert.ok(!fullOnly.includes(id), `${id} stays in lite (relaxed by slot data, not dropped)`);
  assert.equal(catalog.judgedIn('BE_TEST_TOPOLOGY', 'lite'), false);
  assert.equal(catalog.judgedIn('BE_TEST_TOPOLOGY', 'full'), true);
  assert.equal(catalog.judgedIn('FE_NO_TESTS', 'lite'), true);
  assert.equal(catalog.judgedIn('HFS_REPO_UNREADABLE', 'lite'), true, 'a code outside the catalog is always judged');
  assert.throws(() => loadRuleCatalog({ text: fs.readFileSync(path.join(root, 'knowledge/hfs/rules.yaml'), 'utf8').replace('editions: [full]', 'editions: [basic]') }), (e) => e.code === 'HFS_RULES_INVALID');
});

test('checkRepo: the one findings filter drops the codes of rules the edition does not judge, and only for that edition', () => {
  const files = ['hfs.json', 'be/src/tests/world/test-world.config.ts', 'be/jest.config.js'];
  const lite = checkRepo({ repoRoot: root, declaration: app({ edition: 'lite' }), files, tree: false });
  assert.ok(lite.findings.some((f) => f.code === 'HFS_FORBIDDEN_PRESENT'), 'the forbidden test tree is a finding of lite');
  assert.ok(!lite.findings.some((f) => f.code === 'BE_TEST_TOPOLOGY'), 'a code of a full-only rule is not reported under lite');
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
