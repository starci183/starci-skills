import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseYaml } from '../engine/yaml.mjs';
import { CHECK_CODES, checkRepo, explainPath, initRepo, readWhy } from '../scripts/lib/hfs-check.mjs';
import { HfsSlotsError } from '../scripts/lib/hfs-slots.mjs';
import { main } from '../packages/hfs/bin/hfs.mjs';
import { driftOfRuntime } from '../packages/hfs/scripts/sync-runtime.mjs';
import { BE, FE, cleanup, gitAdd, writeCleanRepo } from './_hfs-cli-fixture.mjs';

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
const codesOf = (result) => result.findings.map((f) => f.code);
const only = (result, code) => result.findings.filter((f) => f.code === code);
const cli = async (argv) => {
  let out = '';
  let err = '';
  const code = await main(argv, { stdout: (s) => { out += s; }, stderr: (s) => { err += s; } });
  return { code, out, err };
};
const HAS_VIETNAMESE = /[À-ỹ]/;

test('a clean back-end repository passes with no findings', () => {
  const result = checkRepo({ repoRoot: repoOf(BE) });
  assert.equal(result.ok, true);
  assert.deepEqual(result.findings, []);
  assert.equal(result.profile, 'be');
  assert.equal(result.counts.error, 0);
});

test('a clean multi-app front-end repository passes and expands the required files per app', () => {
  const result = checkRepo({ repoRoot: repoOf(FE) });
  assert.equal(result.ok, true, JSON.stringify(result.findings.slice(0, 3)));
  assert.deepEqual(result.apps.map((a) => a.name), ['web', 'admin']);
});

test('HFS_PATH_NO_SLOT names the path and the nearest slot', () => {
  const result = checkRepo({ repoRoot: repoOf(BE, (dir) => put(dir, 'src/stray/thing.ts')) });
  const [finding] = only(result, 'HFS_PATH_NO_SLOT');
  assert.equal(result.ok, false);
  assert.equal(finding.path, 'src/stray/thing.ts');
  assert.equal(finding.level, 'error');
  assert.ok(finding.nearest.slot, 'the nearest slot is reported');
});

test('HFS_REQUIRED_MISSING is reported per slot, and per app in a multi-app repository', () => {
  const be = checkRepo({ repoRoot: repoOf(BE, (dir) => drop(dir, '.nvmrc')) });
  const [rootFile] = only(be, 'HFS_REQUIRED_MISSING');
  assert.equal(rootFile.path, '.nvmrc');
  assert.equal(rootFile.slot, 'repo.tool-config');

  const fe = checkRepo({ repoRoot: repoOf(FE, (dir) => drop(dir, 'apps/admin/src/app/global-error.tsx')) });
  const [perApp] = only(fe, 'HFS_REQUIRED_MISSING');
  assert.equal(fe.findings.length, 1);
  assert.equal(perApp.app, 'admin');
  assert.equal(perApp.slot, 'fe.app.next');

  const feature = checkRepo({ repoRoot: repoOf(BE, (dir) => drop(dir, 'src/features/orders/index.ts')) });
  assert.deepEqual(only(feature, 'HFS_REQUIRED_MISSING').map((f) => f.path), ['src/features/orders/index.ts']);
});

test('HFS_MIN_INSTANCES fires when the repository has no feature', () => {
  const result = checkRepo({ repoRoot: repoOf(BE, (dir) => drop(dir, 'src/features')) });
  const [finding] = only(result, 'HFS_MIN_INSTANCES');
  assert.equal(finding.slot, 'be.feature');
  assert.equal(finding.min, 1);
  assert.equal(finding.count, 0);
});

test('a tracked path in an ignored slot is HFS_TRACKED_MUST_BE_IGNORED', () => {
  const result = checkRepo({ repoRoot: repoOf(BE, (dir) => put(dir, 'dist/main.js')) });
  assert.deepEqual(only(result, 'HFS_TRACKED_MUST_BE_IGNORED').map((f) => f.path), ['dist/main.js']);
  assert.equal(result.ok, false);
});

test('a tracked path in a forbidden (external) slot is HFS_FORBIDDEN_PRESENT and names where it belongs', () => {
  const result = checkRepo({ repoRoot: repoOf(BE, (dir) => { put(dir, '.env', 'A=1\n'); put(dir, 'report-1.json', '{}'); }) });
  const found = only(result, 'HFS_FORBIDDEN_PRESENT');
  assert.deepEqual(found.map((f) => f.path).sort(), ['.env', 'report-1.json']);
  assert.match(found.find((f) => f.path === '.env').goesTo, /\.starcistacks/);
});

test('an opt-in slot the repository did not declare is HFS_SLOT_NOT_ENABLED, and declaring it clears the finding', () => {
  const mutate = (dir) => put(dir, 'docs/adr/0001-record.md', '# ADR\n');
  assert.deepEqual(only(checkRepo({ repoRoot: repoOf(BE, mutate) }), 'HFS_SLOT_NOT_ENABLED').map((f) => f.slot), ['repo.docs']);
  const declared = { ...BE, optionalSlots: ['repo.docs'] };
  assert.equal(checkRepo({ repoRoot: repoOf(declared, mutate) }).ok, true);
});

test('pin drift: a range, an old version, a registry @starci spec and a missing link are drift; the exact pin and a good link are not', () => {
  const ts = pins.typescript.version;
  const tsconfig = pins['@starci/tsconfig'].version;
  const withPackage = (pkg, link) => repoOf(BE, (dir) => {
    put(dir, 'package.json', `${JSON.stringify({ name: 'demo', ...pkg })}\n`);
    if (link) put(dir, '.starci/packages/tsconfig/package.json', `${JSON.stringify({ name: '@starci/tsconfig', version: link })}\n`);
  });
  const drift = (dir) => only(checkRepo({ repoRoot: dir }), 'HFS_CANON_PIN_DRIFT');
  const linked = { devDependencies: { '@starci/tsconfig': 'file:.starci/packages/tsconfig' } };

  assert.deepEqual(drift(withPackage({ devDependencies: { typescript: ts } })), []);
  const range = drift(withPackage({ devDependencies: { typescript: `^${ts}` } }));
  assert.equal(range.length, 1);
  assert.deepEqual([range[0].dependency, range[0].pinned, range[0].declared, range[0].path], ['typescript', ts, `^${ts}`, 'package.json']);
  assert.equal(drift(withPackage({ devDependencies: { typescript: '4.9.5' } })).length, 1);
  assert.equal(drift(withPackage({ devDependencies: { '@starci/tsconfig': tsconfig } })).length, 1, 'a @starci package comes from starci link, not a registry version');
  assert.equal(drift(withPackage(linked)).length, 1, 'no linked copy');
  assert.equal(drift(withPackage(linked, '0.0.1')).length, 1, 'stale linked copy');
  assert.deepEqual(drift(withPackage(linked, tsconfig)), []);
  const grammar = pins['@starci/grammar'].version;
  assert.equal(pins['@starci/grammar'].install, 'registry', '@starci/grammar is a published package');
  assert.deepEqual(drift(withPackage({ dependencies: { '@starci/grammar': grammar } })), [], 'grammar installs from the registry at the pinned version');
  assert.equal(drift(withPackage({ dependencies: { '@starci/grammar': `^${grammar}` } })).length, 1, 'a range is drift');
  assert.equal(drift(withPackage({ dependencies: { '@starci/grammar': 'file:.starci/packages/grammar' } })).length, 1, 'grammar is not linked');
});

test('pins of the other side are not judged, and every package.json of a workspace repository is', () => {
  const be = repoOf(BE, (dir) => put(dir, 'package.json', `${JSON.stringify({ name: 'demo', dependencies: { next: '1.0.0' } })}\n`));
  assert.deepEqual(only(checkRepo({ repoRoot: be }), 'HFS_CANON_PIN_DRIFT'), [], 'next is a front-end pin');
  const fe = repoOf(FE, (dir) => put(dir, 'apps/admin/package.json', `${JSON.stringify({ name: 'admin', dependencies: { next: '1.0.0' } })}\n`));
  const [finding] = only(checkRepo({ repoRoot: fe }), 'HFS_CANON_PIN_DRIFT');
  assert.equal(finding.path, 'apps/admin/package.json');
  assert.equal(finding.pinned, pins.next.version);
});

test('the soft-size backlog is reported and never fails the check', () => {
  const result = checkRepo({ repoRoot: repoOf(BE, (dir) => put(dir, 'apps/core/src/big.ts', 'export {};\n'.repeat(650))) });
  const [finding] = only(result, 'HFS_SIZE_SOFT_BACKLOG');
  assert.equal(finding.level, 'info');
  assert.equal(finding.path, 'apps/core/src/big.ts');
  assert.equal(finding.soft, 500);
  assert.ok(finding.lines > 500);
  assert.equal(result.ok, true);
  assert.equal(result.counts.error, 0);
  assert.equal(result.counts.info, 1);
});

test('a missing hfs.json is one HFS_DECLARATION_INVALID finding, not an exception', () => {
  const result = checkRepo({ repoRoot: repoOf(BE, null, { declare: false }) });
  assert.equal(result.ok, false);
  assert.deepEqual(codesOf(result), ['HFS_DECLARATION_INVALID']);
  assert.equal(result.profile, null);
});

test('a directory that is not a Git work tree is refused with HFS_REPO_UNREADABLE', () => {
  const dir = writeCleanRepo(BE);
  made.push(dir);
  assert.throws(() => checkRepo({ repoRoot: dir }), (error) => error instanceof HfsSlotsError && error.code === 'HFS_REPO_UNREADABLE');
});

test('every finding carries its code and the Vietnamese why text from the catalog', () => {
  const result = checkRepo({ repoRoot: repoOf(BE, (dir) => { put(dir, 'src/stray/a.ts'); put(dir, '.env', 'A=1\n'); put(dir, 'dist/a.js'); drop(dir, '.nvmrc'); }) });
  assert.ok(result.findings.length >= 4);
  const catalog = parseYaml(fs.readFileSync(path.join(root, 'modules/kernel/failure-codes.yaml'), 'utf8'));
  for (const finding of result.findings) {
    assert.ok(catalog[finding.code], `${finding.code} is in the catalog`);
    assert.equal(finding.titleVi, catalog[finding.code].title_vi);
    assert.equal(finding.whyVi, catalog[finding.code].meaning_vi);
    assert.match(finding.whyVi, HAS_VIETNAMESE);
  }
  assert.equal(result.counts.byCode.HFS_PATH_NO_SLOT.count, 1);
});

test('every code the check can emit has a Vietnamese catalog entry, and the package bundle carries it', () => {
  const why = readWhy(root);
  assert.deepEqual(Object.keys(why).sort(), [...CHECK_CODES].sort());
  for (const code of CHECK_CODES) {
    assert.match(why[code].titleVi, HAS_VIETNAMESE, code);
    assert.ok(why[code].whyVi.length > 20 && why[code].nextStepVi.length > 20, code);
  }
  assert.deepEqual(driftOfRuntime(), [], 'run `node packages/hfs/scripts/sync-runtime.mjs` after changing a copied runtime file');
});

test('explain names the slot, tier, allowed imports and required tests of a path', () => {
  const dir = repoOf(BE);
  const owned = explainPath({ repoRoot: dir, input: 'src/features/orders/application/place-order.use-case.ts' });
  assert.equal(owned.slot, 'be.feature.application');
  assert.equal(owned.tier, 'feature');
  assert.deepEqual(owned.owner, { slot: 'be.feature', root: 'src/features/orders' });
  assert.deepEqual(owned.allowedImports, ['domain', 'platform', 'integrations', 'package']);
  assert.equal(owned.tests, 'unit-beside');

  const app = explainPath({ repoRoot: dir, input: 'apps/core/src/main.ts' });
  assert.equal(app.slot, 'be.app.api');
  assert.ok(app.requiredFiles.includes('apps/core/src/core.composition.spec.ts'));

  const lost = explainPath({ repoRoot: dir, input: 'src/stray/x.ts' });
  assert.equal(lost.status, 'no-slot');
  assert.equal(lost.code, 'HFS_PATH_NO_SLOT');
  assert.match(lost.whyVi, HAS_VIETNAMESE);

  const secret = explainPath({ repoRoot: dir, input: '.env' });
  assert.equal(secret.status, 'forbidden');
  assert.match(secret.goesTo, /\.enc/);
});

test('init detects a back-end repository, its apps and the opt-in slots its files already occupy', () => {
  const dir = repoOf(BE, (d) => {
    put(d, 'package.json', `${JSON.stringify({ name: 'demo-backend', dependencies: { '@nestjs/core': '11.2.5' } })}\n`);
    put(d, 'docs/adr/0001.md', '# ADR\n');
    put(d, 'apps/jobs-worker/src/main.ts');
  }, { declare: false });
  const preview = initRepo({ repoRoot: dir, write: false });
  assert.deepEqual(preview.declaration, {
    hfs: 1,
    profile: 'be',
    project: 'demo',
    apps: [{ name: 'core', kind: 'api' }, { name: 'jobs-worker', kind: 'worker' }],
    optionalSlots: ['repo.docs'],
  });
  assert.equal(fs.existsSync(path.join(dir, 'hfs.json')), false, 'a preview writes nothing');
  const written = initRepo({ repoRoot: dir });
  assert.equal(JSON.parse(fs.readFileSync(written.file, 'utf8')).profile, 'be');
  assert.throws(() => initRepo({ repoRoot: dir }), (error) => error instanceof HfsSlotsError && error.code === 'HFS_INIT_EXISTS');
});

test('init detects a multi-app front-end repository and refuses what it cannot classify', () => {
  const fe = repoOf(FE, (d) => {
    put(d, 'package.json', `${JSON.stringify({ name: '@demo/site', devDependencies: { typescript: '5.9.3' } })}\n`);
    put(d, 'apps/web/package.json', `${JSON.stringify({ name: 'web', dependencies: { next: pins.next.version } })}\n`);
  }, { declare: false });
  const { declaration } = initRepo({ repoRoot: fe, write: false });
  assert.deepEqual([declaration.profile, declaration.project, declaration.apps.map((a) => `${a.name}:${a.kind}`)], ['fe', 'site', ['admin:next', 'web:next']]);

  const neither = repoOf(BE, (d) => { put(d, 'package.json', '{"name":"x"}\n'); drop(d, 'nest-cli.json'); }, { declare: false });
  assert.throws(() => initRepo({ repoRoot: neither, write: false }), (error) => error instanceof HfsSlotsError && error.code === 'HFS_INIT_UNDETECTED');
});

test('the CLI: check exits 0 clean, 1 on an error finding, 2 on refusal; --json is machine readable', async () => {
  const clean = await cli(['check', '--repo', repoOf(BE)]);
  assert.equal(clean.code, 0);
  assert.match(clean.out, /0 error findings/);

  const stray = repoOf(BE, (dir) => put(dir, 'src/stray/thing.ts'));
  const bad = await cli(['check', '--repo', stray, '--json']);
  assert.equal(bad.code, 1);
  const parsed = JSON.parse(bad.out);
  assert.equal(parsed.ok, false);
  assert.equal(parsed.findings[0].code, 'HFS_PATH_NO_SLOT');

  const text = await cli(['check', '--repo', stray]);
  assert.match(text.out, /HFS_PATH_NO_SLOT x1/);
  assert.match(text.out, HAS_VIETNAMESE);

  const notGit = writeCleanRepo(BE);
  made.push(notGit);
  const refused = await cli(['check', '--repo', notGit]);
  assert.equal(refused.code, 2);
  assert.match(refused.err, /HFS_REPO_UNREADABLE/);
  assert.equal((await cli(['check', '--nope'])).code, 2);
  assert.equal((await cli([])).code, 2);
});

test('the CLI: report-only backlog leaves the exit code 0; explain and init print what they found', async () => {
  const dir = repoOf(BE, (d) => put(d, 'apps/core/src/big.ts', 'export {};\n'.repeat(600)));
  assert.equal((await cli(['check', '--repo', dir])).code, 0);

  const explained = await cli(['explain', 'src/features/orders/index.ts', '--repo', dir]);
  assert.equal(explained.code, 0);
  assert.match(explained.out, /be\.feature/);
  assert.match(explained.out, /may import domain, platform, integrations, package/);
  assert.equal((await cli(['explain', 'src/stray/x.ts', '--repo', dir])).code, 1);
  assert.equal((await cli(['explain', '--repo', dir])).code, 2);

  const preview = repoOf(BE, null, { declare: false });
  const init = await cli(['init', '--repo', preview, '--stdout']);
  assert.equal(init.code, 0);
  assert.equal(JSON.parse(init.out).apps[0].kind, 'api');
});

test('sync is delegated to the packaged sync command: a repository without the generated files fails its --check', async () => {
  const dir = repoOf(BE);
  assert.notEqual((await cli(['sync', '--check', '--root', dir])).code, 0);
  assert.equal((await cli(['sync'])).code === 0, false);
});

test('the packaged entry point runs from a fresh process with no runtime checkout around it', () => {
  const dir = repoOf(BE);
  const run = spawnSync(process.execPath, [path.join(root, 'packages/hfs/bin/hfs.mjs'), 'check', '--repo', dir, '--json'], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(JSON.parse(run.stdout).ok, true);
});
