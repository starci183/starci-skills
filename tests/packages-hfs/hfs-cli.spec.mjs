import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseYaml } from '../../engine/yaml.mjs';
import { ALL_CHECK_CODES, CHECK_CODES, checkRepo, checkRepository, explainPath, readWhy } from '../../scripts/hfs/check.mjs';
import { ARCHITECTURE_RULE_IDS } from '../../scripts/hfs/architecture/index.mjs';
import { HfsSlotsError } from '../../scripts/hfs/slots.mjs';
import { main } from '../../packages/hfs/bin/hfs.mjs';
import { BUNDLES, driftOfRuntime, importClosure } from '../../scripts/hfs/sync-runtime.mjs';
import { APP, TWO_FE_APPS, FORMATTED, PRESETS, appOf, cleanup, gitAdd, installPresets, installTypeScript, writeCleanRepo } from '../helpers/hfs-cli-fixture.mjs';

const root = path.resolve(import.meta.dirname, '..', '..');
const pins = parseYaml(fs.readFileSync(path.join(root, 'knowledge/hfs/canon-pins.yaml'), 'utf8')).pins;
const made = [];
const repoOf = (declaration = APP, mutate, options) => {
  const dir = writeCleanRepo(declaration, options);
  made.push(dir);
  if (mutate) mutate(dir);
  return installTypeScript(gitAdd(dir));
};
test.after(() => cleanup(made));

const put = (dir, relative, text = 'export {};\n') => {
  const target = path.join(dir, ...relative.split('/'));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, text);
};
const drop = (dir, relative) => fs.rmSync(path.join(dir, ...relative.split('/')), { recursive: true, force: true });
const codesOf = (result) => result.findings.map((f) => f.code);
const only = (result, code) => result.findings.filter((f) => f.code === code);
const presetsOf = (argv) => {
  const at = argv.indexOf('--repo');
  return at >= 0 && fs.existsSync(path.join(argv[at + 1], 'hfs.json')) ? PRESETS : undefined;
};
const cli = async (argv, seams = {}) => {
  let out = '';
  let err = '';
  const code = await main(argv, { stdout: (s) => { out += s; }, stderr: (s) => { err += s; }, presets: presetsOf(argv), prettier: FORMATTED, ...seams });
  return { code, out, err };
};
const HAS_VIETNAMESE = /[À-ỹ]/;

test('a clean app passes with no findings', () => {
  const result = checkRepo({ repoRoot: repoOf(APP) });
  assert.equal(result.ok, true);
  assert.deepEqual(result.findings, []);
  assert.equal(result.profile, 'app');
  assert.equal(result.counts.error, 0);
});

test('a clean app with two fe apps passes and expands the required files per app', () => {
  const result = checkRepo({ repoRoot: repoOf(TWO_FE_APPS) });
  assert.equal(result.ok, true, JSON.stringify(result.findings.slice(0, 3)));
  assert.deepEqual(result.apps.map((a) => `${a.side}/${a.name}`), ['be/core', 'fe/web', 'fe/admin']);
});

test('HFS_SLOT_UNDECLARED names the path and the nearest slot', () => {
  const result = checkRepo({ repoRoot: repoOf(APP, (dir) => put(dir, 'be/src/stray/thing.ts')) });
  const [finding] = only(result, 'HFS_SLOT_UNDECLARED');
  assert.equal(result.ok, false);
  assert.equal(finding.path, 'be/src/stray/thing.ts');
  assert.equal(finding.level, 'error');
  assert.ok(finding.nearest.slot, 'the nearest slot is reported');
});

test('HFS_SLOT_REQUIRED_MISSING is reported per slot, and per app of a side with several apps', () => {
  const be = checkRepo({ repoRoot: repoOf(APP, (dir) => drop(dir, '.nvmrc')) });
  const [rootFile] = only(be, 'HFS_SLOT_REQUIRED_MISSING');
  assert.equal(rootFile.path, '.nvmrc');
  assert.equal(rootFile.slot, 'app.tool-config');

  const fe = checkRepo({ repoRoot: repoOf(TWO_FE_APPS, (dir) => drop(dir, 'fe/apps/admin/src/app/global-error.tsx')) });
  const [perApp] = only(fe, 'HFS_SLOT_REQUIRED_MISSING');
  assert.equal(fe.findings.length, 1);
  assert.equal(perApp.app, 'admin');
  assert.equal(perApp.slot, 'fe.app.next');

  const feature = checkRepo({ repoRoot: repoOf(APP, (dir) => drop(dir, 'be/src/features/api/orders/index.ts')) });
  assert.deepEqual(only(feature, 'HFS_SLOT_REQUIRED_MISSING').map((f) => f.path), ['be/src/features/api/orders/index.ts']);
});

test('HFS_SLOT_REQUIRED_MISSING and HFS_MIN_INSTANCES are silent when every required file and instance is tracked', () => {
  for (const declaration of [APP, TWO_FE_APPS]) {
    const result = checkRepo({ repoRoot: repoOf(declaration) });
    assert.deepEqual(only(result, 'HFS_SLOT_REQUIRED_MISSING'), []);
    assert.deepEqual(only(result, 'HFS_MIN_INSTANCES'), []);
  }
});

test('HFS_SLOT_UNDECLARED is silent when every tracked path has an owner', () => {
  assert.deepEqual(only(checkRepo({ repoRoot: repoOf(APP) }), 'HFS_SLOT_UNDECLARED'), []);
  assert.deepEqual(only(checkRepo({ repoRoot: repoOf(TWO_FE_APPS) }), 'HFS_SLOT_UNDECLARED'), []);
});

test('HFS_MIN_INSTANCES fires when the be side has no feature', () => {
  const result = checkRepo({ repoRoot: repoOf(APP, (dir) => drop(dir, 'be/src/features')) });
  const [finding] = only(result, 'HFS_MIN_INSTANCES');
  assert.equal(finding.slot, 'be.feature');
  assert.equal(finding.min, 1);
  assert.equal(finding.count, 0);
});

test('a tracked path in an ignored slot is HFS_TRACKED_MUST_BE_IGNORED', () => {
  const result = checkRepo({ repoRoot: repoOf(APP, (dir) => put(dir, 'be/dist/main.js')) });
  assert.deepEqual(only(result, 'HFS_TRACKED_MUST_BE_IGNORED').map((f) => f.path), ['be/dist/main.js']);
  assert.equal(result.ok, false);
});

test('a tracked path in a forbidden (external) slot is HFS_FORBIDDEN_PRESENT and names where it belongs; a plaintext secret file is the secret rule\'s, once', () => {
  const result = checkRepo({ repoRoot: repoOf(APP, (dir) => { put(dir, '.env', 'A=1\n'); put(dir, 'report-1.json', '{}'); }) });
  const found = only(result, 'HFS_FORBIDDEN_PRESENT');
  assert.deepEqual(found.map((f) => f.path), ['report-1.json']);
  assert.match(found[0].goesTo, /agent scratchpad/);
  const [secret] = only(result, 'HFS_PLAINTEXT_SECRET');
  assert.equal(secret.path, '.env');
  assert.match(secret.goesTo, /\.starcistacks/);
});

test('BE_SOURCE_FORM: a back-end source name outside the closed suffix vocabulary is refused; a role name, index, main and a migration are not', () => {
  const dir = repoOf(APP, (repo) => {
    for (const ok of ['cancel-order.command.ts', 'cancel-order.query.ts', 'cancel-order.handler.spec.ts']) put(repo, `be/src/features/api/orders/application/${ok}`);
    put(repo, 'be/src/modules/domain/stock/index.ts');
    put(repo, 'be/src/modules/domain/stock/persistence/migrations/20260101000000-create-stock.ts');
    for (const bad of ['cancel-order.use-case.ts', 'order.types.ts', 'CancelOrder.handler.ts', 'helpers.ts', 'order.repository.ts']) put(repo, `be/src/features/api/orders/application/${bad}`);
    put(repo, 'be/apps/core/src/core.options.ts');
    // kit/ is a slot whose allows names plain <name>.ts files: kebab plain names pass there (not at the world root, not unless kebab).
    for (const ok of ['poll.ts', 'free-ports.ts']) put(repo, `be/src/tests/world/kit/${ok}`);
    for (const bad of ['Bad_Name.ts']) put(repo, `be/src/tests/world/kit/${bad}`);
    put(repo, 'be/src/tests/world/poll.ts');
  });
  const result = checkRepo({ repoRoot: dir });
  const refused = only(result, 'BE_SOURCE_FORM');
  assert.deepEqual(refused.map((f) => path.posix.basename(f.path)).sort(), ['Bad_Name.ts', 'CancelOrder.handler.ts', 'cancel-order.use-case.ts', 'helpers.ts', 'order.repository.ts', 'order.types.ts', 'poll.ts']);
  assert.ok(refused.every((f) => f.level === 'error'));
  assert.equal(refused.find((f) => f.path.endsWith('order.types.ts')).suffix, 'types');
  assert.match(refused.find((f) => f.path.endsWith('order.repository.ts')).message, /\.sql\.ts.*\*\.service\.ts/, 'a repository file is told its home: <name>.sql.ts for text, the capability service for access');
  assert.doesNotMatch(refused.find((f) => f.path.endsWith('order.types.ts')).message, /\.sql\.ts/, 'only the data-access suffixes carry the home hint');
  assert.equal(result.ok, false);
  assert.deepEqual(only(checkRepo({ repoRoot: repoOf(APP) }), 'BE_SOURCE_FORM'), []);
  assert.deepEqual(only(checkRepo({ repoRoot: repoOf(TWO_FE_APPS, (repo) => put(repo, 'fe/apps/web/src/modules/api/helpers.ts')) }), 'BE_SOURCE_FORM'), [], 'the fe side is not judged by the back-end suffix list');
});

test('BE_SOURCE_FORM: a test data builder is <area>.builder.ts under src/tests/fixtures/builders/ only; .fixture, .factory and .repository are banned', () => {
  const dir = repoOf(APP, (repo) => {
    put(repo, 'be/src/tests/fixtures/builders/order.builder.ts');
    for (const bad of ['order.builder.ts', 'order.fixture.ts', 'order.factory.ts', 'order.repository.ts']) put(repo, `be/src/tests/fixtures/${bad}`);
    put(repo, 'be/src/tests/fixtures/builders/order.fixture.ts');
    put(repo, 'be/src/features/api/orders/application/order.builder.ts');
  });
  const refused = only(checkRepo({ repoRoot: dir }), 'BE_SOURCE_FORM').map((f) => f.path).sort();
  assert.ok(!refused.includes('be/src/tests/fixtures/builders/order.builder.ts'));
  for (const bad of ['be/src/tests/fixtures/order.builder.ts', 'be/src/tests/fixtures/order.fixture.ts', 'be/src/tests/fixtures/order.factory.ts', 'be/src/tests/fixtures/order.repository.ts', 'be/src/features/api/orders/application/order.builder.ts']) assert.ok(refused.includes(bad), bad);
  assert.deepEqual(only(checkRepo({ repoRoot: repoOf(APP, (repo) => put(repo, 'be/src/tests/fixtures/builders/order.builder.ts')) }), 'BE_SOURCE_FORM'), []);
});

test('an opt-in slot the repository did not declare is HFS_SLOT_NOT_ENABLED, and declaring it clears the finding', () => {
  const mutate = (dir) => put(dir, 'be/docs/adr/0001-record.md', '# ADR\n');
  assert.deepEqual(only(checkRepo({ repoRoot: repoOf(APP, mutate) }), 'HFS_SLOT_NOT_ENABLED').map((f) => f.slot), ['repo.docs']);
  const declared = appOf({ be: { apps: [{ name: 'core', kind: 'api' }], optionalSlots: ['repo.docs'] } });
  assert.equal(checkRepo({ repoRoot: repoOf(declared, mutate) }).ok, true);
});

test('pin drift: a range, an old version and a file: link are drift; the exact registry pin is not, for @starci packages too', () => {
  const ts = pins.typescript.version;
  const tsconfig = pins['@starci/tsconfig'].version;
  const withPackage = (pkg) => repoOf(APP, (dir) => put(dir, 'package.json', `${JSON.stringify({ name: 'demo', ...pkg })}\n`));
  const drift = (dir) => only(checkRepo({ repoRoot: dir }), 'HFS_CANON_PIN_DRIFT');
  const linked = { devDependencies: { '@starci/tsconfig': 'file:.starci/packages/tsconfig' } };

  assert.deepEqual(drift(withPackage({ devDependencies: { typescript: ts } })), []);
  const range = drift(withPackage({ devDependencies: { typescript: `^${ts}` } }));
  assert.equal(range.length, 1);
  assert.deepEqual([range[0].dependency, range[0].pinned, range[0].declared, range[0].path], ['typescript', ts, `^${ts}`, 'package.json']);
  assert.equal(drift(withPackage({ devDependencies: { typescript: '4.9.5' } })).length, 1);
  assert.deepEqual(drift(withPackage({ devDependencies: { '@starci/tsconfig': tsconfig } })), [], 'a @starci package installs from the registry at the pinned version');
  assert.equal(drift(withPackage({ devDependencies: { '@starci/tsconfig': `^${tsconfig}` } })).length, 1, 'a range is drift');
  assert.equal(drift(withPackage(linked)).length, 1, 'a file: link is drift');
  const grammar = pins['@starci/grammar'].version;
  assert.equal(pins['@starci/grammar'].side, 'fe', '@starci/grammar is used by the fe side; the app package.json carries it and is judged on it');
  const withFePackage = (pkg) => repoOf(APP, (dir) => put(dir, 'package.json', `${JSON.stringify({ name: 'demo', ...pkg })}\n`));
  assert.equal(pins['@starci/grammar'].install, 'registry', '@starci/grammar is a published package');
  assert.deepEqual(drift(withFePackage({ dependencies: { '@starci/grammar': grammar } })), [], 'grammar installs from the registry at the pinned version');
  assert.equal(drift(withFePackage({ dependencies: { '@starci/grammar': `^${grammar}` } })).length, 1, 'a range is drift');
  assert.equal(drift(withFePackage({ dependencies: { '@starci/grammar': 'file:.starci/packages/grammar' } })).length, 1, 'grammar is not a file: link');
});

test('package.json ownership: an app-specific devDependency is neither drift nor a pin finding; a wrong @starci pin still is', () => {
  const ts = pins.typescript.version;
  const extra = repoOf(APP, (dir) => put(dir, 'package.json', `${JSON.stringify({ name: 'demo', devDependencies: { ajv: '^8.17.1', typescript: ts } })}\n`));
  assert.deepEqual(only(checkRepo({ repoRoot: extra }), 'HFS_CANON_PIN_DRIFT'), [], 'ajv is not a pinned name');
  const wrong = repoOf(APP, (dir) => put(dir, 'package.json', `${JSON.stringify({ name: 'demo', devDependencies: { ajv: '^8.17.1', '@starci/tsconfig': '0.0.1' } })}\n`));
  assert.deepEqual(only(checkRepo({ repoRoot: wrong }), 'HFS_CANON_PIN_DRIFT').map((f) => f.dependency), ['@starci/tsconfig']);
});

test('the app package.json carries the pins of both sides, and a workspace package of the fe side is judged too', () => {
  const root = repoOf(APP, (dir) => put(dir, 'package.json', `${JSON.stringify({ name: 'demo', dependencies: { next: '1.0.0', '@nestjs/core': pins['@nestjs/core'].version } })}\n`));
  const [next] = only(checkRepo({ repoRoot: root }), 'HFS_CANON_PIN_DRIFT');
  assert.deepEqual([next.path, next.dependency, next.pinned], ['package.json', 'next', pins.next.version], 'a front-end pin is judged on the one package.json');
  const declaration = appOf({ fe: { apps: [{ name: 'web', kind: 'next' }], optionalSlots: ['fe.package.ui'] } });
  const workspace = repoOf(declaration, (dir) => put(dir, 'fe/packages/demo-ui/package.json', `${JSON.stringify({ name: '@demo/ui', dependencies: { next: '1.0.0' } })}\n`));
  assert.deepEqual(only(checkRepo({ repoRoot: workspace }), 'HFS_CANON_PIN_DRIFT').map((f) => f.path), ['fe/packages/demo-ui/package.json']);
});

test('the soft-size backlog is reported and never fails the check', () => {
  const result = checkRepo({ repoRoot: repoOf(APP, (dir) => put(dir, 'be/apps/core/src/big.options.ts', 'export {};\n'.repeat(650))) });
  const [finding] = only(result, 'HFS_SIZE_SOFT_BACKLOG');
  assert.equal(finding.level, 'info');
  assert.equal(finding.path, 'be/apps/core/src/big.options.ts');
  assert.equal(finding.soft, 500);
  assert.ok(finding.lines > 500);
  assert.equal(result.ok, true);
  assert.equal(result.counts.error, 0);
  assert.equal(result.counts.info, 1);
});

test('a missing hfs.json is one HFS_DECLARATION_INVALID finding, not an exception', () => {
  const result = checkRepo({ repoRoot: repoOf(APP, null, { declare: false }) });
  assert.equal(result.ok, false);
  assert.deepEqual(codesOf(result), ['HFS_DECLARATION_INVALID']);
  assert.equal(result.profile, null);
});

test('a directory that is not a Git work tree is refused with HFS_REPO_UNREADABLE', () => {
  const dir = writeCleanRepo(APP);
  made.push(dir);
  assert.throws(() => checkRepo({ repoRoot: dir }), (error) => error instanceof HfsSlotsError && error.code === 'HFS_REPO_UNREADABLE');
});

test('every finding carries its code and the Vietnamese why text from the catalog', () => {
  const result = checkRepo({ repoRoot: repoOf(APP, (dir) => { put(dir, 'be/src/stray/a.ts'); put(dir, '.env', 'A=1\n'); put(dir, 'be/dist/a.js'); drop(dir, '.nvmrc'); }) });
  assert.ok(result.findings.length >= 4);
  const catalog = parseYaml(fs.readFileSync(path.join(root, 'modules/kernel/failure-codes.yaml'), 'utf8'));
  for (const finding of result.findings) {
    assert.ok(catalog[finding.code], `${finding.code} is in the catalog`);
    assert.equal(finding.titleVi, catalog[finding.code].title_vi);
    assert.equal(finding.whyVi, catalog[finding.code].meaning_vi);
    assert.match(finding.whyVi, HAS_VIETNAMESE);
  }
  assert.equal(result.counts.byCode.HFS_SLOT_UNDECLARED.count, 1);
});

test('every code the check can emit has a Vietnamese catalog entry, and the package bundle carries it', () => {
  const why = readWhy(root);
  assert.deepEqual(Object.keys(why).sort(), [...CHECK_CODES].sort());
  for (const code of CHECK_CODES) {
    assert.match(why[code].titleVi, HAS_VIETNAMESE, code);
    assert.ok(why[code].whyVi.length > 20 && why[code].nextStepVi.length > 20, code);
  }
  assert.deepEqual(driftOfRuntime(), [], 'run `node scripts/hfs/sync-runtime.mjs` after changing a copied runtime file');
});

test('explain names the slot, tier, allowed imports and required tests of a path', () => {
  const dir = repoOf(APP);
  const owned = explainPath({ repoRoot: dir, input: 'be/src/features/api/orders/application/place-order.handler.ts' });
  assert.equal(owned.slot, 'be.feature.application');
  assert.equal(owned.tier, 'feature');
  assert.deepEqual(owned.owner, { slot: 'be.feature', root: 'be/src/features/api/orders' });
  assert.deepEqual(owned.allowedImports, ['domain', 'platform', 'integrations', 'package']);
  assert.equal(owned.tests, 'none');

  const app = explainPath({ repoRoot: dir, input: 'be/apps/core/src/main.ts' });
  assert.equal(app.slot, 'be.app.api');
  assert.deepEqual(app.requiredFiles, ['be/apps/core/src/main.ts', 'be/apps/core/src/app.module.ts']);

  const lost = explainPath({ repoRoot: dir, input: 'be/src/stray/x.ts' });
  assert.equal(lost.status, 'no-slot');
  assert.equal(lost.code, 'HFS_SLOT_UNDECLARED');
  assert.match(lost.whyVi, HAS_VIETNAMESE);

  const secret = explainPath({ repoRoot: dir, input: '.env' });
  assert.equal(secret.status, 'forbidden');
  assert.match(secret.goesTo, /\.enc/);
});

test('the CLI: check exits 0 clean, 1 on an error finding, 2 on refusal; --json is machine readable', async () => {
  const clean = await cli(['check', '--repo', repoOf(APP)]);
  assert.equal(clean.code, 0);
  assert.match(clean.out, /0 error findings/);

  // a stray TypeScript file is an ESLint report of the project graph (slot-undeclared); `hfs check` judges the paths no editor shows
  const stray = repoOf(APP, (dir) => put(dir, 'be/src/stray/thing.json'));
  const bad = await cli(['check', '--repo', stray, '--json']);
  assert.equal(bad.code, 1);
  const parsed = JSON.parse(bad.out);
  assert.equal(parsed.ok, false);
  assert.equal(parsed.findings[0].code, 'HFS_SLOT_UNDECLARED');

  const text = await cli(['check', '--repo', stray]);
  assert.match(text.out, /HFS_SLOT_UNDECLARED x1/);
  assert.match(text.out, HAS_VIETNAMESE);

  const notGit = writeCleanRepo(APP);
  made.push(notGit);
  const refused = await cli(['check', '--repo', notGit]);
  assert.equal(refused.code, 2);
  assert.match(refused.err, /HFS_REPO_UNREADABLE/);
  assert.equal((await cli(['check', '--nope'])).code, 2);
  assert.equal((await cli([])).code, 2);
});

test('the CLI: report-only backlog leaves the exit code 0; explain prints what it found', async () => {
  const dir = repoOf(APP, (d) => put(d, 'be/src/features/api/orders/application/place-order.handler.ts', 'export {};\n'.repeat(600)));
  assert.equal((await cli(['check', '--repo', dir])).code, 0);

  const explained = await cli(['explain', 'be/src/features/api/orders/index.ts', '--repo', dir]);
  assert.equal(explained.code, 0);
  assert.match(explained.out, /be\.feature/);
  assert.match(explained.out, /may import domain, platform, integrations, package/);
  assert.equal((await cli(['explain', 'be/src/stray/x.ts', '--repo', dir])).code, 1);
  assert.equal((await cli(['explain', '--repo', dir])).code, 2);

  assert.equal((await cli(['init', '--repo', dir])).code, 2, 'hfs init is gone: hfs scaffold app makes a new app');
});

test('sync is delegated to the packaged sync command: an app without the generated files fails its --check', async () => {
  const dir = repoOf(APP);
  assert.notEqual((await cli(['sync', '--check', '--root', dir])).code, 0);
  assert.equal((await cli(['sync'])).code === 0, false);
});

/** A package the repository "installed": its node_modules entry, the way `npm ci` leaves it. */
const install = (dir, name, body) => {
  const target = path.join(dir, 'node_modules', ...name.split('/'));
  fs.mkdirSync(target, { recursive: true });
  fs.writeFileSync(path.join(target, 'package.json'), JSON.stringify({ name, main: 'index.js' }));
  fs.writeFileSync(path.join(target, 'index.js'), body);
};

test('the packaged entry point runs from a fresh process with no runtime checkout around it', () => {
  const dir = installPresets(installTypeScript(repoOf(APP)));
  // A fresh process has no seams: the coverage exclusions come from the installed preset and the format check from the repository's own prettier.
  install(dir, 'prettier', 'module.exports = { getFileInfo: async () => ({ ignored: true }), resolveConfig: async () => null, check: async () => true };');
  const run = spawnSync(process.execPath, [path.join(root, 'packages/hfs/bin/hfs.mjs'), 'check', '--repo', dir, '--json'], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(JSON.parse(run.stdout).ok, true);
});

// ------------------------------------------------------------------------------------------------ the tree (R03)

const git = (dir, ...args) => spawnSync('git', ['-C', dir, '-c', 'user.name=spec', '-c', 'user.email=spec@example.test', ...args], { encoding: 'utf8' });
const mkdir = (dir, relative) => fs.mkdirSync(path.join(dir, ...relative.split('/')), { recursive: true });
const NO_FINDINGS_MACHINE = () => ({ ok: true, files: 0, kinds: [], violations: [], errors: [] });
/** A committed repository on `main` with a `topic` branch checked out: what a lane looks like before its first change. */
const branched = (mutate) => {
  const dir = repoOf(APP, mutate);
  git(dir, 'commit', '-qm', 'base');
  git(dir, 'branch', '-M', 'main');
  git(dir, 'checkout', '-qb', 'topic');
  return dir;
};

test('an empty directory is HFS_EMPTY_DIR: the topmost one, however many empty directories sit below it', () => {
  const dir = repoOf(APP, (d) => { mkdir(d, 'be/src/modules/business/a/b'); mkdir(d, 'be/src/modules/business/c'); });
  const found = only(checkRepo({ repoRoot: dir }), 'HFS_EMPTY_DIR');
  assert.deepEqual(found.map((f) => [f.path, f.below]), [['be/src/modules/business', 3]]);
  assert.equal(found[0].level, 'error');
});

test('a directory holding only empty directories is empty; one file anywhere below makes the whole chain not empty', () => {
  const dir = repoOf(APP, (d) => { mkdir(d, 'be/src/modules/x/y/z'); put(d, 'be/src/modules/kept/deep/er/file.ts'); });
  assert.deepEqual(only(checkRepo({ repoRoot: dir }), 'HFS_EMPTY_DIR').map((f) => f.path), ['be/src/modules/x']);
});

test('empty directories inside .git, node_modules and an ignored slot are not reported', () => {
  const dir = repoOf(APP, (d) => { mkdir(d, 'be/dist/empty'); mkdir(d, 'node_modules/pkg/empty'); mkdir(d, 'coverage/lcov'); });
  const result = checkRepo({ repoRoot: dir });
  assert.deepEqual(only(result, 'HFS_EMPTY_DIR'), []);
  assert.deepEqual(only(result, 'HFS_GHOST_TREE'), []);
});

test('HFS_GHOST_TREE: an empty directory beside a sibling within two edits of its name (business / bussiness)', () => {
  const dir = repoOf(APP, (d) => { put(d, 'be/src/modules/business/a.ts'); mkdir(d, 'be/src/modules/bussiness'); mkdir(d, 'be/src/modules/platform-extras'); });
  const result = checkRepo({ repoRoot: dir });
  const ghosts = only(result, 'HFS_GHOST_TREE');
  assert.equal(ghosts.length, 1, 'platform-extras is far from every sibling');
  assert.deepEqual([ghosts[0].path, ghosts[0].of, ghosts[0].distance], ['be/src/modules/bussiness', 'be/src/modules/business', 1]);
  assert.ok(only(result, 'HFS_EMPTY_DIR').some((f) => f.path === 'be/src/modules/bussiness'), 'the ghost is also an empty directory');
});

test('two lookalike siblings that both hold files are not a ghost tree; three edits apart are not lookalikes', () => {
  const dir = repoOf(APP, (d) => { put(d, 'be/src/modules/order/a.ts'); put(d, 'be/src/modules/ordr/a.ts'); mkdir(d, 'be/src/modules/orderXYZ'); });
  assert.deepEqual(only(checkRepo({ repoRoot: dir }), 'HFS_GHOST_TREE'), []);
});

test('HFS_UNTRACKED_ROOT_ENTRY: an entry git neither tracks nor ignores; one in an ignored slot or ignored by git is not reported', () => {
  const dir = repoOf(APP);
  put(dir, 'nul');
  put(dir, 'scratch/notes.txt');
  put(dir, 'be/dist/main.js');
  put(dir, '.gitignore', 'ignored-by-git.txt\n');
  put(dir, 'ignored-by-git.txt');
  const result = checkRepo({ repoRoot: dir });
  assert.deepEqual(only(result, 'HFS_UNTRACKED_ROOT_ENTRY').map((f) => f.path).sort(), ['nul', 'scratch']);
  assert.equal(result.ok, false);
});

test('the tree checks do not run over an explicit file list (a dry run of specs and previews)', () => {
  const dir = repoOf(APP, (d) => mkdir(d, 'be/src/modules/business'));
  const result = checkRepo({ repoRoot: dir, files: ['hfs.json'], declaration: APP });
  assert.deepEqual(only(result, 'HFS_EMPTY_DIR'), []);
});

// ------------------------------------------------------------------------------------- the machine inside hfs check

test('hfs check runs the architecture machine: its violation is a finding under its own code with the Vietnamese why', () => {
  const dir = repoOf(APP, (d) => put(d, 'be/src/modules/domain/order/a.ts'));
  const result = checkRepository({ repoRoot: dir });
  const [finding] = only(result, 'BE_REQUIRED_MODULE_MISSING');
  assert.equal(result.ok, false);
  assert.equal(finding.level, 'error');
  assert.equal(finding.source, 'machine');
  assert.equal(finding.path, 'be/src/modules/domain/order/index.ts');
  assert.match(finding.whyVi, HAS_VIETNAMESE);
  assert.equal(result.machine.status, 'ran');
  assert.ok(result.machine.files > 0);
  assert.equal(result.counts.byCode.BE_REQUIRED_MODULE_MISSING.count, 1);
  assert.deepEqual(only(result, 'BE_FEATURE_NOT_COMPOSED'), [], 'a finding on a TypeScript file is an ESLint report, not a hfs check finding');
});

test('a clean back end and a clean front end are clean to the machine too', () => {
  for (const declaration of [APP, TWO_FE_APPS]) {
    const result = checkRepository({ repoRoot: repoOf(declaration) });
    assert.deepEqual(result.findings, [], JSON.stringify(declaration.sides.fe.apps));
    assert.equal(result.machine.status, 'ran');
  }
});

test('machine errors and violations merge as findings with path, line and message; a code without a catalog entry is a refusal', () => {
  const dir = repoOf(APP);
  // The machine runs once per side folder; this one reports on the be side and finds nothing on the fe side.
  const machine = (input) => (path.basename(input.repositoryRoot) !== 'be' ? { ok: true, files: 1, kinds: ['frontend'], violations: [], errors: [] } : {
    ok: false, files: 4, kinds: ['backend'],
    violations: [{ ruleId: 'BE_TIER_DIRECTION', path: 'be/src/features/api/orders/index.ts', line: 3, column: 1, message: 'goes the wrong way' }],
    errors: [{ ruleId: 'ARCH_TYPESCRIPT_MISSING', message: 'install TypeScript' }],
  });
  const result = checkRepository({ repoRoot: dir, machine });
  assert.deepEqual(codesOf(result).sort(), ['ARCH_TYPESCRIPT_MISSING', 'BE_TIER_DIRECTION']);
  assert.equal(only(result, 'BE_TIER_DIRECTION')[0].message, 'be/src/features/api/orders/index.ts:3: goes the wrong way');
  assert.equal(only(result, 'BE_TIER_DIRECTION')[0].line, 3);
  assert.match(only(result, 'ARCH_TYPESCRIPT_MISSING')[0].whyVi, HAS_VIETNAMESE);
  const unknown = () => ({ ok: false, files: 0, kinds: [], violations: [{ ruleId: 'BE_NOT_IN_ANY_CATALOG', message: 'x' }], errors: [] });
  assert.throws(() => checkRepository({ repoRoot: dir, machine: unknown }), (error) => error instanceof HfsSlotsError && /BE_NOT_IN_ANY_CATALOG/.test(error.message));
});

test('a machine that throws is one ARCH_EXECUTION_UNAVAILABLE finding, never a pass; an invalid hfs.json skips the machine', () => {
  const dir = repoOf(APP);
  const result = checkRepository({ repoRoot: dir, machine: (input) => { if (path.basename(input.repositoryRoot) === 'be') throw new Error('boom'); return { ok: true, files: 1, kinds: ['frontend'], violations: [], errors: [] }; } });
  assert.deepEqual(codesOf(result), ['ARCH_EXECUTION_UNAVAILABLE']);
  assert.equal(result.ok, false);
  const undeclared = checkRepository({ repoRoot: repoOf(APP, null, { declare: false }), machine: () => { throw new Error('must not run'); } });
  assert.deepEqual(codesOf(undeclared), ['HFS_DECLARATION_INVALID']);
  assert.equal(undeclared.machine.status, 'skipped');
});

test('an app without TypeScript installed fails the check with ARCH_TYPESCRIPT_MISSING, never passes', () => {
  const dir = gitAdd(writeCleanRepo(APP));
  made.push(dir);
  const result = checkRepository({ repoRoot: dir });
  assert.equal(result.ok, false);
  assert.ok(codesOf(result).includes('ARCH_TYPESCRIPT_MISSING'));
});

// --------------------------------------------------------------------------------------------------- --fast

test('--fast without a merge-base is a refusal that names the fix, never a silent full pass', async () => {
  const dir = repoOf(APP);
  const refused = await cli(['check', '--repo', dir, '--fast']);
  assert.equal(refused.code, 2);
  assert.match(refused.err, /merge-base/);
  assert.match(refused.err, /git fetch origin main|--base/);
  assert.equal(refused.out, '');
  const unknownBase = await cli(['check', '--repo', branched(), '--fast', '--base', 'no-such-ref']);
  assert.equal(unknownBase.code, 2);
  assert.match(unknownBase.err, /--base no-such-ref/);
});

test('--fast judges the changed owners only: the machine gets their paths and skips clones and dead exports; nothing changed skips the machine', () => {
  const dir = branched();
  const calls = [];
  const machine = (input) => { calls.push(input); return { ok: true, files: 3, kinds: ['backend'], violations: [], errors: [] }; };
  const none = checkRepository({ repoRoot: dir, fast: true, machine });
  assert.equal(calls.length, 0);
  assert.equal(none.machine.status, 'skipped');
  assert.equal(none.fast.changed, 0);

  put(dir, 'be/src/features/api/orders/application/place-order.query.ts', 'export const placed = 1;\n');
  git(dir, 'add', '-A', '--', '.', ':!node_modules'); // --fast judges tracked paths: the change is staged
  const changed = checkRepository({ repoRoot: dir, fast: true, machine });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].paths, ['src/features/api/orders'], 'the machine of the be side gets side-relative owner paths');
  assert.equal(calls[0].fast, true);
  assert.match(calls[0].base, /^[0-9a-f]{40}$/);
  assert.equal(changed.fast.changed, 1);
  assert.deepEqual(changed.machine.paths, ['be/src/features/api/orders']);
});

test('--fast: slot checks run on the changed paths only, and the tree checks do not run', async () => {
  const dir = branched((d) => put(d, 'be/src/stray/old.json'));
  put(dir, 'be/src/stray/new.json');
  mkdir(dir, 'be/src/modules/business');
  git(dir, 'add', '-A', '--', '.', ':!node_modules');
  const fast = checkRepository({ repoRoot: dir, fast: true, machine: NO_FINDINGS_MACHINE });
  assert.deepEqual(only(fast, 'HFS_SLOT_UNDECLARED').map((f) => f.path), ['be/src/stray/new.json'], 'the stray file already on main is not this change');
  assert.deepEqual(only(fast, 'HFS_EMPTY_DIR'), []);
  const full = checkRepository({ repoRoot: dir, machine: NO_FINDINGS_MACHINE });
  assert.deepEqual(only(full, 'HFS_SLOT_UNDECLARED').map((f) => f.path).sort(), ['be/src/stray/new.json', 'be/src/stray/old.json']);
  assert.deepEqual(only(full, 'HFS_EMPTY_DIR').map((f) => f.path), ['be/src/modules/business']);

  const cliFast = await cli(['check', '--repo', dir, '--fast', '--json']);
  assert.equal(cliFast.code, 1);
  assert.equal(JSON.parse(cliFast.out).fast.changed, 1);
});

test('--fast with the real machine: a Vietnamese document already on main is not judged, a full check reports it', async () => {
  const dir = branched((d) => { put(d, 'be/docs/adr/0001-old.md', 'Đây là một tài liệu viết bằng tiếng Việt, không phải tiếng Anh.\n'); });
  put(dir, 'be/src/features/api/orders/application/place-order.query.ts', 'export const placed = 1;\n');
  git(dir, 'add', '-A', '--', '.', ':!node_modules'); // --fast judges tracked paths: the change is staged
  const fast = await cli(['check', '--repo', dir, '--fast']);
  assert.equal(fast.code, 0, fast.out);
  assert.match(fast.out, /--fast/);
  assert.match(fast.out, /owners be\/src\/features\/api\/orders/);
  const full = await cli(['check', '--repo', dir]);
  assert.equal(full.code, 1);
  assert.match(full.out, /HFS_DOC_NOT_ENGLISH x1/);
});

test('HFS_CONTRACT_SNAPSHOT_DRIFT against the app: the full check emits every api app and says so, --fast skips it and says so, an emit that cannot run is a finding', async () => {
  const dir = branched();
  const full = await cli(['check', '--repo', dir, '--json']);
  assert.deepEqual(JSON.parse(full.out).contracts, { status: 'checked', apps: [{ app: 'core', artifact: 'schema.graphql', status: 'none' }] });
  assert.deepEqual(only(JSON.parse(full.out), 'HFS_CONTRACT_SNAPSHOT_DRIFT'), []);
  assert.match((await cli(['check', '--repo', dir])).out, /contract snapshots: emitted and compared, core\/schema\.graphql none/);
  assert.match((await cli(['check', '--repo', dir, '--fast'])).out, /contract snapshots: skipped, --fast does not emit the apps/);
  assert.equal(JSON.parse((await cli(['check', '--repo', dir, '--fast', '--json'])).out).contracts.status, 'skipped');
  put(dir, 'be/apps/core/src/app.module.ts', "import { Missing } from './missing';\nexport class AppModule {\n  static register() {\n    return { module: AppModule, imports: [Missing] };\n  }\n}\n");
  const broken = JSON.parse((await cli(['check', '--repo', dir, '--json'])).out);
  const [finding] = only(broken, 'HFS_CONTRACT_SNAPSHOT_DRIFT');
  assert.match(finding.message, /cannot be verified.*cannot resolve \.\/missing/);
  assert.match(finding.whyVi, HAS_VIETNAMESE);
  assert.deepEqual(broken.contracts.apps.map((a) => a.status), ['emit-failed', 'emit-failed']);
});

test('emit-contracts writes contracts/<app>/openapi.json from the typed operation table, and the full check judges it', async () => {
  const dir = branched();
  const canon = fs.readFileSync(path.join(root, 'packages', 'eslint', 'be', 'fixtures', 'typed', 'src', 'modules', 'platform', 'operations', 'operation-contract.ts'), 'utf8');
  put(dir, 'be/apps/core/src/contract.ts', canon);
  put(dir, 'be/apps/core/src/operations.ts', `import { defineOperations, query } from './contract';
export interface Ask { readonly id: string }
export interface Answer { readonly total: number }
export const OPERATIONS = defineOperations({ 'shop.total@1': query<Ask, Answer, 'DENIED'>() });
`);
  const emitted = await cli(['emit-contracts', '--repo', dir]);
  assert.equal(emitted.code, 0, emitted.err + emitted.out);
  assert.match(emitted.out, /wrote be\/contracts\/core\/openapi\.json/);
  const document = JSON.parse(fs.readFileSync(path.join(dir, 'be', 'contracts', 'core', 'openapi.json'), 'utf8'));
  assert.deepEqual(document['x-operations'], [{ id: 'shop.total@1', kind: 'query' }]);
  git(dir, 'add', '-A', '--', '.', ':!node_modules');
  const fresh = JSON.parse((await cli(['check', '--repo', dir, '--json'])).out);
  assert.deepEqual(fresh.contracts.apps.filter((a) => a.artifact === 'openapi.json'), [{ app: 'core', artifact: 'openapi.json', status: 'fresh' }]);
  put(dir, 'be/apps/core/src/operations.ts', fs.readFileSync(path.join(dir, 'be/apps/core/src/operations.ts'), 'utf8').replace("'DENIED'", "'DENIED' | 'GONE'"));
  const stale = JSON.parse((await cli(['check', '--repo', dir, '--json'])).out);
  assert.match(only(stale, 'HFS_CONTRACT_SNAPSHOT_DRIFT')[0].message, /contracts\/core\/openapi\.json \([0-9a-f]{12}\) differs from what core emits now/);
});

test('HFS_FORMAT: --fast never runs prettier, the full check runs the repository\'s own, and a repository with none is a refusal, never a pass', async () => {
  const dir = branched();
  put(dir, 'be/src/features/api/orders/application/place-order.query.ts', 'export const placed = 1;\n');
  git(dir, 'add', '-A', '--', '.', ':!node_modules'); // --fast judges tracked paths: the change is staged
  let calls = 0;
  const counting = { ...FORMATTED, check: async () => { calls += 1; return true; } };
  await cli(['check', '--repo', dir, '--fast'], { prettier: counting });
  assert.equal(calls, 0);
  await cli(['check', '--repo', dir, '--json'], { prettier: counting });
  assert.ok(calls > 0);
  const refused = await cli(['check', '--repo', dir], { prettier: undefined });
  assert.equal(refused.code, 2);
  assert.match(refused.err, /HFS_FORMAT_TOOL_MISSING/);
});

test('the CLI: machine findings fail the exit code and print with their Vietnamese why', async () => {
  const dir = repoOf(APP, (d) => put(d, 'be/src/modules/domain/order/a.ts'));
  const text = await cli(['check', '--repo', dir]);
  assert.equal(text.code, 1);
  assert.match(text.out, /architecture machine: ran over \d+ source files/);
  assert.match(text.out, /BE_REQUIRED_MODULE_MISSING x1/);
  assert.match(text.out, HAS_VIETNAMESE);
  const json = JSON.parse((await cli(['check', '--repo', dir, '--json'])).out);
  assert.equal(json.machine.status, 'ran');
});

// --------------------------------------------------------------------------------------------- the bundle

test('the package bundle carries the machine, the files it imports and a why for every code the machine can emit', () => {
  const files = BUNDLES['packages/hfs/runtime'].files;
  assert.ok(files.includes('scripts/hfs/architecture.mjs'));
  assert.ok(files.includes('scripts/hfs/architecture/index.mjs'));
  assert.ok(files.includes('scripts/hfs/tree.mjs'));
  assert.ok(files.includes('knowledge/patterns/fe/folder.yaml'), 'the framework-pinned knowledge the front-end rules read');
  for (const file of importClosure(['scripts/hfs/architecture.mjs', 'scripts/hfs/check.mjs'])) assert.ok(files.includes(file), `${file} is imported by the check but not bundled`);
  const slice = parseYaml(fs.readFileSync(path.join(root, 'packages/hfs/runtime/modules/kernel/failure-codes.yaml'), 'utf8'));
  assert.deepEqual(Object.keys(slice).sort(), [...ALL_CHECK_CODES].sort());
  for (const code of ARCHITECTURE_RULE_IDS) assert.match(slice[code].title_vi, HAS_VIETNAMESE, code);
  assert.ok(CHECK_CODES.every((code) => ALL_CHECK_CODES.includes(code)));
});

test('the bundled machine is the runtime machine: the copies are byte-identical (no second implementation)', () => {
  const same = (text) => text.replace(/\r\n/g, '\n');
  for (const file of BUNDLES['packages/hfs/runtime'].files.filter((f) => f.startsWith('scripts/checks/'))) {
    assert.equal(same(fs.readFileSync(path.join(root, 'packages/hfs/runtime', file), 'utf8')), same(fs.readFileSync(path.join(root, file), 'utf8')), file);
  }
});
