// W01: public app verbs reach their real implementations in both editions.
// proves: ENV_VALUE_SHAPE@lite ENV_VALUE_SHAPE@full HFS_COVERAGE_BELOW@lite HFS_COVERAGE_BELOW@full
// proves: BE_APP_BOOT_PROOF_MISSING@lite BE_APP_BOOT_PROOF_MISSING@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { main, VERBS } from '../../packages/hfs/src/main.mjs';
import { withCheckProofs } from '../../scripts/hfs/check.mjs';
import { BUNDLES, importClosure } from '../../scripts/hfs/sync-runtime.mjs';
import { loadSlotManifest } from '../../scripts/hfs/slots.mjs';
import { FORMATTED, PRESETS } from '../helpers/hfs-cli-fixture.mjs';
import { privateAbsent } from '../helpers/hfs-secret-fixture.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';

const workspace = path.resolve(import.meta.dirname, '../..');
const manifest = loadSlotManifest();
const FIRST = '20260101000000';
const NEXT = '20260102000000';
const MIGRATION = `supabase/migrations/${FIRST}_start.sql`;
const BASELINE = `supabase/migrations/${NEXT}_baseline.sql`;
const LOGIC = 'be/src/modules/domain/orders/orders.service.ts';
const MODULE = 'be/apps/api/src/app.module.ts';
const BOOT_CODE = 'BE_APP_BOOT_PROOF_MISSING';
const ENC = 'ENC[AES256_GCM,data:AA==,iv:AA==,tag:AA==,type:str]';
const SEALED = `FEATURE_ENABLED=${ENC}\nsops_mac=${ENC}\n`;
const APP_MODULE = "import { Module } from '@nestjs/common';\n@Module({}) export class AppModule {}\n";
const declaration = edition => ({ hfs: 3, kind: 'app', edition, project: 'verbs-fixture',
  sides: { be: { apps: [{ name: 'api', kind: 'api' }] }, fe: { apps: [{ name: 'web', kind: 'next' }] } } });

function put(root, entries) {
  for (const [file, value] of Object.entries(entries)) {
    const target = path.join(root, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, value);
  }
}

function git(root, args) {
  return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: 'pipe' });
}

function fixture(t, edition, entries = {}, committed = false) {
  const root = mkdtemp(t, 'hfs-main-verbs-');
  put(root, { 'hfs.json': JSON.stringify(declaration(edition)), '.gitignore': 'node_modules/\ncoverage/\n',
    'package.json': JSON.stringify({ name: 'verbs-fixture', private: true }), ...entries });
  git(root, ['init', '-q']);
  git(root, ['add', '.']);
  if (committed) git(root, ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'fixture']);
  return root;
}

async function cli(argv, seams = {}) {
  let out = '';
  let err = '';
  const code = await main(argv, { stdout: text => { out += text; }, stderr: text => { err += text; }, ...seams });
  return { code, out, err };
}

function databaseRunner(root, { drift = false, failed = false } = {}) {
  const calls = [];
  const run = (_command, args, options) => {
    assert.equal(options.cwd, root);
    assert.equal(options.encoding, 'utf8');
    assert.equal(options.windowsHide, true);
    assert.equal(options.env.FIXTURE_RUNNER, 'forwarded');
    calls.push(args);
    if (failed) return { status: 1, stdout: 'fixture-private-tool-output', stderr: 'fixture-private-tool-error' };
    if (args[1] !== 'query') return { status: 0, stdout: 'create table public.demo(id integer);\n' };
    let rows = [];
    if (args[2].includes('to_regclass')) rows = [{ migrations: true, cron: false, queues: false, vault: false }];
    else if (!drift) rows = [{ version: FIRST }];
    return { status: 0, stdout: JSON.stringify(rows) };
  };
  return { calls, run, env: { FIXTURE_RUNNER: 'forwarded' } };
}

const record = (hit = 1) => [`SF:${LOGIC}`, 'LF:1', `LH:${hit}`, 'FNF:1', 'FNH:1', 'BRF:1', 'BRH:1', 'end_of_record', ''].join('\n');
const cleanResult = () => ({ ok: true, profile: 'app', findings: [], counts: { error: 0, warning: 0, info: 0, byCode: {} } });

function proofFixture(t, edition, { module = APP_MODULE, hit = 1 } = {}) {
  const entries = { 'be/tsconfig.json': JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'CommonJS',
    experimentalDecorators: true, emitDecoratorMetadata: true, skipLibCheck: true } }),
  [LOGIC]: 'export class OrdersService { run() { return 1; } }\n',
  'coverage/lcov.info': record(hit) };
  if (module !== null) entries[MODULE] = module;
  const root = fixture(t, edition, entries);
  fs.symlinkSync(fs.realpathSync(path.join(workspace, 'node_modules')), path.join(root, 'node_modules'), 'junction');
  return root;
}

for (const edition of ['lite', 'full']) {
  test(`app db plan dispatches JSON/local options and returns clean, drift and refused statuses (${edition})`, async t => {
    const root = fixture(t, edition, { [MIGRATION]: 'create table public.demo(id integer);\n' });
    const ports = databaseRunner(root);
    const passed = await cli(['db', 'plan', '--cwd', root, '--json', '--local'], ports);
    assert.equal(passed.code, 0, passed.err);
    assert.deepEqual(JSON.parse(passed.out).migrations, { expected: 1, remote: 1, missing: 0, unexpected: 0, changed: 0 });
    assert.equal(JSON.parse(passed.out).readOnly, true);
    assert.ok(ports.calls.every(args => args[0] === 'db' && args[1] === 'query' && args.includes('--local')));
    const drift = await cli(['db', 'plan', '--json'], { ...databaseRunner(root, { drift: true }), cwd: root });
    assert.equal(drift.code, 1);
    assert.equal(JSON.parse(drift.out).drift, true);
    const failed = await cli(['db', 'plan'], { ...databaseRunner(root, { failed: true }), cwd: root });
    assert.equal(failed.code, 2);
    assert.match(failed.err, /Supabase command failed/);
    privateAbsent(failed, ['fixture-private-tool-output', 'fixture-private-tool-error']);
    assert.equal(fs.readFileSync(path.join(root, MIGRATION), 'utf8'), 'create table public.demo(id integer);\n');
  });

  test(`app db baseline forwards stamp/apply and leaves previews untouched (${edition})`, async t => {
    const sql = 'create table public.demo(id integer);\n';
    const root = fixture(t, edition, { [MIGRATION]: sql }, true);
    const ports = databaseRunner(root);
    const preview = await cli(['db', 'baseline', '--stamp', NEXT, '--local', '--cwd', root], ports);
    assert.equal(preview.code, 0, preview.err);
    assert.match(preview.out, /preview baseline/);
    assert.ok(!ports.calls.some(args => args[0] === 'migration'));
    assert.equal(fs.existsSync(path.join(root, BASELINE)), false);
    assert.equal(fs.readFileSync(path.join(root, MIGRATION), 'utf8'), sql);
    const applied = await cli(['db', 'baseline', `--stamp=${NEXT}`, '--apply', '--local'], { ...ports, cwd: root });
    assert.equal(applied.code, 0, applied.err);
    assert.ok(fs.readFileSync(path.join(root, BASELINE), 'utf8').startsWith(`-- starci:baseline ${FIRST}\n`));
    assert.equal(fs.readFileSync(path.join(root, `supabase/migrations/_archive/${FIRST}_start.sql`), 'utf8'), sql);
    assert.equal(fs.existsSync(path.join(root, MIGRATION)), false);
    assert.deepEqual(ports.calls.filter(args => args[0] === 'migration'), [
      ['migration', 'repair', FIRST, '--status', 'reverted', '--local'],
      ['migration', 'repair', NEXT, '--status', 'applied', '--local'],
    ]);
  });

  test(`app db restamp forwards map/apply and refuses invalid database arguments (${edition})`, async t => {
    const root = fixture(t, edition, { [MIGRATION]: 'select 1;\n', 'restamp.yaml': `versions:\n  '${FIRST}': '${NEXT}'\n` });
    const ports = databaseRunner(root);
    const preview = await cli(['db', 'restamp', '--map', 'restamp.yaml', '--cwd', root], ports);
    assert.equal(preview.code, 0, preview.err);
    assert.match(preview.out, /preview restamp 1 migrations/);
    assert.equal(ports.calls.length, 0);
    assert.equal(fs.existsSync(path.join(root, MIGRATION)), true);
    const applied = await cli(['db', 'restamp', '--map=restamp.yaml', '--apply', '--local'], { ...ports, cwd: root });
    assert.equal(applied.code, 0, applied.err);
    assert.equal(fs.existsSync(path.join(root, MIGRATION)), false);
    assert.equal(fs.readFileSync(path.join(root, `supabase/migrations/${NEXT}_start.sql`), 'utf8'), `-- starci:restamp ${FIRST} ${NEXT}\nselect 1;\n`);
    const never = { cwd: root, run: () => assert.fail('invalid arguments must not reach Supabase') };
    const invalid = [['baseline', '--stamp'], ['baseline', '--stamp', FIRST], ['restamp'], ['restamp', '--map'], ['plan', '--unknown'], ['plan', '--json', '--json']];
    const refusedResults = await Promise.all(invalid.map(args => cli(['db', ...args], never)));
    for (const refused of refusedResults) {
      assert.equal(refused.code, 2);
      assert.match(refused.err, /starci app db/);
    }
  });

  test(`app secret verify reaches the real shape checker with fixture-only SOPS (${edition})`, async t => {
    const root = fixture(t, edition, {
      '.starcistacks/dev/secrets/app.enc': SEALED,
      'be/apps/api/src/api.env.ts': 'import type { EnvSource } from "@modules/platform/config";\nexport const readApiEnv = (env: EnvSource) => ({ enabled: env.bool("FEATURE_ENABLED") });\n',
    });
    let decrypted = 0;
    const sops = { decrypt: () => { decrypted += 1; return { FEATURE_ENABLED: 'true' }; }, seal: () => assert.fail('verify is read-only') };
    const valid = await cli(['secret', 'verify', 'dev', '--cwd', root], { sops });
    assert.equal(valid.code, 0, valid.err);
    assert.match(valid.out, /verified dev: 1 key sealed/);
    assert.equal(decrypted, 1);
    const bad = 'fixture-invalid-bool-value';
    const invalid = await cli(['secret', 'verify', 'dev'], { cwd: root, sops: { ...sops, decrypt: () => ({ FEATURE_ENABLED: bad }) } });
    assert.equal(invalid.code, 2);
    assert.match(invalid.out, /ENV_VALUE_SHAPE dev\/app\.enc: FEATURE_ENABLED is not true or false/);
    privateAbsent(invalid, [bad]);
    assert.equal(fs.readFileSync(path.join(root, '.starcistacks/dev/secrets/app.enc'), 'utf8'), SEALED);
    assert.equal((await cli(['secret', 'verify'], { cwd: root, sops })).code, 2);
  });

  test(`app check adds explicit wiring and coverage reports, recomputes totals and explains failures (${edition})`, t => {
    const root = proofFixture(t, edition);
    const options = { repoRoot: root, manifest, wiring: true, coverageFrom: 'coverage/lcov.info' };
    const regular = [
      { code: 'HFS_SIZE_SOFT_BACKLOG', path: LOGIC, level: 'info', message: 'ordinary report' },
      { code: 'HFS_SLOT_UNDECLARED', path: 'fixture.json', level: 'warning', message: 'ordinary warning' },
    ];
    const passing = withCheckProofs({ ...cleanResult(), findings: regular }, options);
    assert.equal(passing.ok, true, JSON.stringify(passing.findings));
    assert.deepEqual(passing.findings, regular);
    assert.equal(passing.wiring.status, edition === 'lite' ? 'checked' : 'skipped');
    assert.equal(passing.coverage.ok, true);
    assert.deepEqual(passing.coverage.measured, [LOGIC]);
    assert.equal(passing.counts.error, 0);
    assert.equal(passing.counts.warning, 1);
    assert.equal(passing.counts.info, 1);
    assert.equal(passing.counts.byCode.HFS_SIZE_SOFT_BACKLOG.count, 1);
    put(root, { 'coverage/lcov.info': record(0) });
    fs.unlinkSync(path.join(root, MODULE));
    const failing = withCheckProofs(cleanResult(), options);
    assert.equal(failing.ok, false);
    const codes = new Set(failing.findings.map(finding => finding.code));
    assert.ok(codes.has('HFS_COVERAGE_BELOW'));
    assert.equal(codes.has(BOOT_CODE), edition === 'lite');
    assert.equal(failing.counts.error, failing.findings.length);
    assert.equal(failing.counts.byCode.HFS_COVERAGE_BELOW.count, 1);
    for (const finding of failing.findings) {
      assert.ok(finding.titleVi && finding.whyVi && finding.nextStepVi, finding.code);
    }
  });
}

test('explicit wiring replaces the ordinary boot finding once and respects the full edition override', t => {
  const root = proofFixture(t, 'lite', { module: null });
  const stale = { code: BOOT_CODE, path: MODULE, level: 'error', message: 'ordinary proof failed' };
  const result = { ...cleanResult(), ok: false, findings: [stale] };
  const checked = withCheckProofs(result, { repoRoot: root, manifest, wiring: true });
  assert.equal(checked.findings.filter(finding => finding.code === BOOT_CODE).length, 1);
  const full = withCheckProofs({ ...result, editionOverride: { declared: 'lite', judged: 'full' } }, { repoRoot: root, manifest, wiring: true });
  assert.equal(full.wiring.status, 'skipped');
  assert.equal(full.ok, true);
  assert.equal(full.counts.error, 0);
});

test('ordinary check proof plumbing is an identity operation without either option', () => {
  const result = cleanResult();
  assert.equal(withCheckProofs(result), result);
});

test('main check accepts both proof options and produces their JSON reports', async t => {
  const root = proofFixture(t, 'full');
  const result = await cli(['check', '--cwd', root, '--wiring', '--coverage-from=coverage/lcov.info', '--json'], { presets: PRESETS, prettier: FORMATTED });
  assert.equal(result.code, 1, result.err);
  const parsed = JSON.parse(result.out);
  assert.equal(parsed.wiring.status, 'skipped');
  assert.equal(parsed.coverage.ok, true);
  assert.deepEqual(parsed.coverage.measured, [LOGIC]);
});

test('main rejects missing/duplicate coverage paths and unknown database verbs and advertises the public surface', async () => {
  const help = await cli(['--help']);
  assert.equal(help.code, 0);
  for (const text of ['--wiring', '--coverage-from <lcov>', 'db baseline', 'db restamp', 'db plan', 'secret verify <env>']) assert.ok(help.out.includes(text), text);
  assert.ok(VERBS.includes('db'));
  const invalidDatabase = [[], ['unknown'], ['plan', '--map', 'restamp.yaml']];
  const databaseResults = await Promise.all(invalidDatabase.map(args => cli(['db', ...args])));
  for (const result of databaseResults) assert.equal(result.code, 2);
  const invalidCoverage = [['--coverage-from'], ['--coverage-from', '--json'], ['--coverage-from='], ['--coverage-from=a', '--coverage-from=b']];
  const coverageResults = await Promise.all(invalidCoverage.map(args => cli(['check', ...args])));
  for (const result of coverageResults) {
    assert.equal(result.code, 2);
    assert.match(result.err, /--coverage-from/);
  }
});

test('the published HFS bundle carries all new verb/proof entries and their relative import closures', () => {
  const entries = ['scripts/hfs/db-baseline-verb.mjs', 'scripts/hfs/db-restamp-verb.mjs', 'scripts/hfs/db-plan-verb.mjs',
    'scripts/hfs/app-wiring.mjs', 'scripts/hfs/coverage-from.mjs', 'scripts/hfs/rules/env-value-shape.mjs'];
  const bundled = new Set(BUNDLES['packages/hfs/runtime'].files);
  for (const file of [...entries, ...importClosure(entries)]) assert.ok(bundled.has(file), file);
});
