// proves: HFS_COVERAGE_BELOW@lite
// proves: HFS_COVERAGE_BELOW@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { byCodeUnit } from '../../scripts/lib/list.mjs';
import { coverageFrom, coverageFromMain, formatCoverageReport } from '../../scripts/hfs/coverage-from.mjs';
import { HFS_COVERAGE_BELOW, coverageBelowFindings, coverageBelowReport } from '../../scripts/hfs/rules/coverage-below.mjs';
import { a15Findings } from '../../scripts/hfs/rules/a15-findings.mjs';
import { loadSlotManifest, resolveRepoDeclaration } from '../../scripts/hfs/slots.mjs';

const manifest = loadSlotManifest();
const LOGIC = 'be/src/modules/domain/orders/orders.service.ts';
const POLICY = 'be/src/modules/platform/access/access.policy.ts';
const OUTSIDE = [
  'be/src/features/api/orders/application/place-order.handler.ts',
  'be/src/features/cli/seed/seed.cli.ts',
  'be/src/features/webhooks/stripe/transport/http/stripe.webhook.ts',
  'be/src/modules/domain/orders/persistence/orders.mapper.ts',
  'be/src/modules/domain/orders/orders.module.ts',
];
const declaration = (edition) => ({
  hfs: 3, kind: 'app', project: 'coverage-demo', edition,
  sides: {
    be: { apps: [{ name: 'core', kind: 'api' }, { name: 'cli', kind: 'cli' }], connections: [{ name: 'primary', envPrefix: 'PRIMARY_DB', owner: 'core', isolation: 'database', provider: 'supabase' }] },
    fe: { apps: [{ name: 'web', kind: 'next' }] },
  },
});

const record = (file, { line = 1, fn = 1, branch = 1 } = {}) => [
  `SF:${file}`, 'FN:1,run', `FNDA:${fn},run`, 'FNF:1', `FNH:${fn > 0 ? 1 : 0}`,
  `DA:1,${line}`, 'LF:1', `LH:${line > 0 ? 1 : 0}`,
  `BRDA:1,0,0,${branch}`, 'BRF:1', `BRH:${branch !== '-' && branch > 0 ? 1 : 0}`, 'end_of_record', '',
].join('\n');

function fixture(t, edition, report, files = [LOGIC, ...OUTSIDE]) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-coverage-below-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, 'hfs.json'), JSON.stringify(declaration(edition)));
  fs.mkdirSync(path.join(dir, 'coverage'));
  if (report !== undefined) fs.writeFileSync(path.join(dir, 'coverage/lcov.info'), report);
  for (const file of files) {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), 'export class Subject { run() { return 1; } }\n');
  }
  const repo = resolveRepoDeclaration(manifest, declaration(edition));
  return { repoRoot: dir, repo, manifest, files, coverageFrom: 'coverage/lcov.info' };
}

for (const edition of ['lite', 'full']) {
  test(`HFS_COVERAGE_BELOW ${edition}: refuses each metric below 100% per measured file`, (t) => {
    for (const partial of [{ line: 0 }, { fn: 0 }, { branch: '-' }]) {
      const report = coverageBelowReport(fixture(t, edition, record(LOGIC, partial)));
      assert.equal(report.ok, false);
      assert.deepEqual(report.findings.map((finding) => [finding.code, finding.level, finding.path]), [[HFS_COVERAGE_BELOW, 'error', LOGIC]]);
      assert.match(report.findings[0].message, /0\/1 \(0\.00%\) is below 100%/);
    }
  });

  test(`HFS_COVERAGE_BELOW ${edition}: accepts 100% and lists features, cli and webhooks outside measured scope`, (t) => {
    const report = coverageFrom(fixture(t, edition, record(LOGIC) + OUTSIDE.map((file) => record(file, { line: 0, fn: 0, branch: 0 })).join('')));
    assert.equal(report.ok, true);
    assert.deepEqual(report.findings, []);
    assert.deepEqual(report.measured, [LOGIC]);
    assert.deepEqual(report.unmeasured, [...OUTSIDE].sort(byCodeUnit));
    assert.ok(report.unmeasuredScopes.includes('be/src/features/api/*/'));
    assert.ok(report.unmeasuredScopes.includes('be/src/features/cli/'));
    assert.ok(report.unmeasuredScopes.includes('be/src/features/webhooks/*/'));
    const output = formatCoverageReport(report);
    for (const file of OUTSIDE) assert.ok(output.includes(file), file);
    assert.match(output, /unmeasured scope:/);
    assert.match(output, /statement coverage is enforced by the unit runner/);
  });

  test(`HFS_COVERAGE_BELOW ${edition}: missing measured SF records cannot shrink the denominator`, (t) => {
    const context = fixture(t, edition, record(LOGIC), [LOGIC, POLICY]);
    const report = coverageBelowReport(context);
    assert.equal(report.ok, false);
    assert.deepEqual(report.measured, [LOGIC, POLICY]);
    assert.deepEqual(report.findings.map((finding) => finding.path), [POLICY]);
    assert.match(report.findings[0].message, /no lcov source record/);
  });

  test(`HFS_COVERAGE_BELOW ${edition}: unreadable and empty reports refuse rather than skip`, (t) => {
    const absent = coverageBelowReport(fixture(t, edition, undefined));
    assert.equal(absent.ok, false);
    assert.equal(absent.findings[0].code, HFS_COVERAGE_BELOW);
    assert.match(absent.findings[0].message, /cannot be read/);
    const empty = coverageBelowReport(fixture(t, edition, ''));
    assert.equal(empty.ok, false);
    assert.match(empty.findings[0].message, /no source records/);
    assert.ok(empty.findings.some((finding) => finding.path === LOGIC));
  });

  test(`HFS_COVERAGE_BELOW ${edition}: ordinary app check has no coverage opt-in and no changed behavior`, (t) => {
    const context = fixture(t, edition, record(LOGIC, { line: 0 }));
    delete context.coverageFrom;
    assert.deepEqual(coverageBelowFindings(context), []);
    assert.equal(coverageBelowReport(context).enabled, false);
    assert.deepEqual(coverageBelowFindings({ ...context, repo: context.repo.sides.fe, coverageFrom: 'coverage/lcov.info' }), []);
  });
}

test('HFS_COVERAGE_BELOW: the alpha.15 registry judges an explicit report and accepts its 100% replacement', (t) => {
  const context = fixture(t, 'full', record(LOGIC, { line: 0 }));
  const own = (list) => list.filter((finding) => finding.code === HFS_COVERAGE_BELOW);
  const findings = own(a15Findings(context));
  assert.deepEqual(findings.map((finding) => [finding.code, finding.level, finding.path]), [[HFS_COVERAGE_BELOW, 'error', LOGIC]]);
  fs.writeFileSync(path.join(context.repoRoot, context.coverageFrom), record(LOGIC));
  assert.deepEqual(own(a15Findings(context)), []);
});

test('HFS_COVERAGE_BELOW: app and be-relative SF paths, absolute POSIX/Windows paths, file URIs and CRLF resolve the same measured file', (t) => {
  const context = fixture(t, 'lite', record(LOGIC));
  const sources = [
    LOGIC, LOGIC.slice(3), `./${LOGIC}`, path.join(context.repoRoot, LOGIC),
    `/home/runner/project/${LOGIC}`, `C:\\ci\\project\\${LOGIC.replaceAll('/', '\\')}`,
    `C:\\CI\\PROJECT\\${LOGIC.toUpperCase().replaceAll('/', '\\')}`,
    pathToFileURL(path.join(context.repoRoot, LOGIC)).href,
  ];
  for (const source of sources) {
    const report = coverageBelowReport({ ...context, lcov: `\uFEFF${record(source).replaceAll('\n', '\r\n')}` });
    assert.equal(report.ok, true, `${source}: ${JSON.stringify(report.findings)}`);
  }
});

test('HFS_COVERAGE_BELOW: checking the be side reports side-relative paths and shares the app boundary', (t) => {
  const app = fixture(t, 'full', record(LOGIC));
  const context = { ...app, repoRoot: path.join(app.repoRoot, 'be'), repo: app.repo.sides.be, files: app.files.map((file) => file.slice(3)), coverageFrom: '../coverage/lcov.info' };
  const report = coverageFrom(context);
  assert.equal(report.ok, true);
  assert.deepEqual(report.measured, [LOGIC.slice(3)]);
  assert.deepEqual(report.unmeasured, OUTSIDE.map((file) => file.slice(3)).sort(byCodeUnit));
});

test('HFS_COVERAGE_BELOW: duplicate test-name records merge covered identities, not totals or percentages', (t) => {
  const base = fixture(t, 'lite', record(LOGIC));
  const part = (name, first, second) => [
    `TN:${name}`, `SF:${LOGIC}`, 'FN:1,run', 'FNDA:1,run', 'FNF:1', 'FNH:1',
    `DA:1,${first}`, `DA:2,${second}`, 'LF:2', 'LH:1',
    `BRDA:1,0,0,${first}`, `BRDA:1,0,1,${second}`, 'BRF:2', 'BRH:1', 'end_of_record', '',
  ].join('\n');
  const good = coverageBelowReport({ ...base, lcov: part('first', 1, 0) + part('second', 0, 1) });
  assert.equal(good.ok, true);
  assert.deepEqual(good.results[0].metrics.lines, { found: 2, hit: 2, percent: 100 });
  const bad = coverageBelowReport({ ...base, lcov: part('first', 1, 0) + part('second', 1, 0) });
  assert.equal(bad.ok, false);
  assert.deepEqual(bad.results[0].metrics.branches, { found: 2, hit: 1, percent: 50 });
});

test('HFS_COVERAGE_BELOW: invalid counts and contradictory summary metadata refuse a nominally 100% report', (t) => {
  const context = fixture(t, 'full', record(LOGIC));
  for (const lcov of [record(LOGIC).replace('DA:1,1', 'DA:1,-1'), record(LOGIC).replace('LF:1', 'LF:2'), record(LOGIC).replace('LH:1', 'LH:2')]) {
    const report = coverageBelowReport({ ...context, lcov });
    assert.equal(report.ok, false);
    assert.ok(report.findings.some((finding) => finding.path === LOGIC));
    assert.match(report.findings.at(-1).message, /invalid DA|disagrees/);
  }
});

test('HFS_COVERAGE_BELOW: metrics missing from lcov are unavailable while explicit zero denominators pass', (t) => {
  const context = fixture(t, 'full', record(LOGIC));
  const missing = coverageBelowReport({ ...context, lcov: `SF:${LOGIC}\nDA:1,1\nLF:1\nLH:1\nend_of_record\n` });
  assert.equal(missing.ok, false);
  assert.match(missing.findings[0].message, /functions coverage is unavailable/);
  const zero = coverageBelowReport({ ...context, lcov: `SF:${LOGIC}\nDA:1,1\nLF:1\nLH:1\nFNF:0\nFNH:0\nBRF:0\nBRH:0\nend_of_record\n` });
  assert.equal(zero.ok, true);
  assert.deepEqual(zero.results[0].metrics.functions, { found: 0, hit: 0, percent: 100 });
});

test('HFS_COVERAGE_BELOW: summary-only reports require each record to prove 100%, with no percentage rounding escape', (t) => {
  const context = fixture(t, 'lite', record(LOGIC));
  const summary = (found, hit) => `SF:${LOGIC}\nLF:${found}\nLH:${hit}\nFNF:0\nFNH:0\nBRF:0\nBRH:0\nend_of_record\n`;
  assert.equal(coverageBelowReport({ ...context, lcov: summary(2, 2) + summary(1, 1) }).ok, true);
  const below = coverageBelowReport({ ...context, lcov: summary(100000, 99999) });
  assert.equal(below.ok, false);
  assert.equal(below.results[0].metrics.lines.hit, 99999);
});

test('HFS_COVERAGE_BELOW: edition and manifest coverage changes alter the denominator', (t) => {
  const context = fixture(t, 'full', record(LOGIC), [LOGIC, POLICY]);
  const changed = { ...manifest, slots: manifest.slots.map((slot) => slot.id === 'be.domain' ? { ...slot, editions: ['full'] } : slot) };
  const lite = coverageBelowReport({ ...context, manifest: changed, repo: { ...context.repo, edition: 'lite' }, lcov: record(POLICY) });
  assert.equal(lite.ok, true);
  assert.deepEqual(lite.measured, [POLICY]);
  assert.ok(lite.unmeasured.includes(LOGIC));
  const full = coverageBelowReport({ ...context, manifest: changed, lcov: record(POLICY) });
  assert.equal(full.ok, false);
  assert.ok(full.findings.some((finding) => finding.path === LOGIC));
});

test('HFS_COVERAGE_BELOW: CLI accepts cwd, inline report and JSON and returns refusal status for an uncovered file', (t) => {
  const context = fixture(t, 'lite', record(LOGIC));
  let output = '';
  let errors = '';
  const run = (opts) => coverageFrom({ ...context, ...opts });
  const io = { cwd: context.repoRoot, stdout: (text) => { output += text; }, stderr: (text) => { errors += text; }, run };
  assert.equal(coverageFromMain(['--cwd', '.', '--coverage-from=coverage/lcov.info', '--json'], io), 0);
  assert.equal(errors, '');
  assert.deepEqual(JSON.parse(output).measured, [LOGIC]);
  fs.writeFileSync(path.join(context.repoRoot, 'coverage/lcov.info'), record(LOGIC, { fn: 0 }));
  output = '';
  assert.equal(coverageFromMain(['--coverage-from', 'coverage/lcov.info'], io), 2);
  assert.match(output, /HFS_COVERAGE_BELOW/);
  assert.match(output, /unmeasured source files:/);
});

test('HFS_COVERAGE_BELOW: CLI refuses missing and duplicate flags without running the proof', () => {
  let errors = '';
  const io = { stderr: (text) => { errors += text; }, run: () => assert.fail('invalid CLI must not run') };
  for (const argv of [[], ['--coverage-from'], ['--coverage-from=x', '--coverage-from=y'], ['--coverage-from=x', '--unknown']]) {
    assert.equal(coverageFromMain(argv, io), 2);
  }
  assert.match(errors, /needs a value/);
  assert.match(errors, /may be given only once/);
  assert.match(errors, /unknown argument/);
});

test('HFS_COVERAGE_BELOW: an explicit coverage proof refuses an fe side instead of reporting an empty pass', (t) => {
  const app = fixture(t, 'lite', record(LOGIC));
  const context = { ...app, repo: app.repo.sides.fe, files: [] };
  assert.throws(() => coverageFrom(context), /requires an app root or its be side/);
  let output = '';
  let errors = '';
  const io = {
    stdout: (text) => { output += text; }, stderr: (text) => { errors += text; },
    run: (options) => coverageFrom({ ...context, ...options }),
  };
  assert.equal(coverageFromMain(['--coverage-from', 'missing-lcov.info'], io), 2);
  assert.equal(output, '');
  assert.match(errors, /requires an app root or its be side/);
});
