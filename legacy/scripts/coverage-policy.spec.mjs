import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { configuredCoverageThresholds, requestedCoverageThresholds, coveragePolicyResult, validateCoveragePolicyRequest, coverageTableErrors } from './coverage-policy.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const METRICS = ['statements', 'lines', 'functions', 'branches'];
const bars = value => Object.fromEntries(METRICS.map(metric => [metric, value]));
const report = coverageThreshold => ({ version: '29.7.0', configs: [{ rootDir: '/synthetic/one' }, { rootDir: '/synthetic/two' }],
  globalConfig: coverageThreshold === undefined ? {} : { coverageThreshold } });
const coverage = thresholds => ({ ...bars(65), thresholds });
function fixture(raw = report(), thresholds = []) {
  const branch = mkdtempSync(path.join(tmpdir(), 'coverage-policy-'));
  const file = path.join(branch, 'request/artifacts/resolved.json');
  mkdirSync(path.dirname(file), { recursive: true });
  const bytes = JSON.stringify(raw);
  writeFileSync(file, bytes);
  const request = { contexts: [{ alias: '@workspaces/be', head: '1'.repeat(40) }], requirements: {
    gates: [{ gate: 'unit-coverage', commandRef: 'package.json#scripts.test', configRef: 'jest.config.js', required: true }], thresholds,
    coveragePolicy: { format: 'jest-show-config-29', sourceHead: '1'.repeat(40), commandRef: 'package.json#scripts.test', configRef: 'jest.config.js', evidenceRef: 'request/artifacts/resolved.json', evidenceSha256: createHash('sha256').update(bytes).digest('hex') }
  } };
  return { branch, file, request, dispose() {
    const relative = path.relative(path.resolve(tmpdir()), path.resolve(branch));
    if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw Error('Unsafe fixture cleanup');
    rmSync(branch, { recursive: true, force: true });
  } };
}

test('recognized effective report distinguishes absent, partial and explicit zero bars', () => {
  assert.deepEqual(configuredCoverageThresholds(report()), bars(null));
  assert.deepEqual(configuredCoverageThresholds(report({})), bars(null));
  assert.deepEqual(configuredCoverageThresholds(report({ global: { branches: 0, lines: 80 } })), { ...bars(null), branches: 0, lines: 80 });
});

test('request maps preserve every strongest bar and never coerce zero or bad values', () => {
  assert.deepEqual(requestedCoverageThresholds([{ branches: 0, lines: 70 }, { branches: 85, lines: 90 }]), { ...bars(null), branches: 85, lines: 90 });
  for (const invalid of [false, 80, '80', [80], { branches: '80' }, { branches: -1 }, { branches: Infinity }, { branch: 80 }]) assert.throws(() => requestedCoverageThresholds(invalid));
});

test('unsupported, incomplete, scoped and count reports cannot establish absence', () => {
  for (const invalid of [{}, { version: '29.7.0', configs: [] }, { ...report(), version: '30.0.0' }, report(null), report({ './src': { branches: 80 } }), report({ global: { statements: -10 } }), report({ global: { unexpected: 80 } }), { ...report(), configs: [{ coverageThreshold: {} }] }]) {
    assert.throws(() => configuredCoverageThresholds(invalid));
  }
});

test('frozen effective policy enforces exact max and refuses fabricated zero or null', () => {
  const f = fixture(report({ global: { branches: 80, lines: 0 } }), [{ branches: 60 }, { branches: 90 }]);
  try {
    assert.deepEqual(validateCoveragePolicyRequest(ROOT, f.branch, f.request), []);
    const expected = { ...bars(null), branches: 90, lines: 0 };
    assert.deepEqual(coveragePolicyResult(ROOT, f.branch, f.request, coverage(expected)).errors, []);
    for (const thresholds of [{ ...expected, branches: 80 }, { ...expected, lines: null }, { ...expected, functions: 0 }]) {
      assert.ok(coveragePolicyResult(ROOT, f.branch, f.request, coverage(thresholds)).errors.length);
    }
  } finally { f.dispose(); }
});

test('policy evidence is pinned to original bytes and declared gate/head/format', () => {
  const f = fixture();
  try {
    for (const patch of [{ sourceHead: '2'.repeat(40) }, { commandRef: 'different' }, { configRef: 'different' }, { evidenceRef: '../outside.json' }, { format: 'other' }, { arbitraryPointer: '/unused' }]) {
      const request = structuredClone(f.request); Object.assign(request.requirements.coveragePolicy, patch);
      assert.ok(validateCoveragePolicyRequest(ROOT, f.branch, request).length);
    }
    writeFileSync(f.file, JSON.stringify(report({ global: bars(80) })));
    assert.match(validateCoveragePolicyRequest(ROOT, f.branch, f.request).join('\n'), /hash differs/);
  } finally { f.dispose(); }
});

test('derived or null thresholds require evidence while explicit numeric legacy bars remain intact', () => {
  const request = { requirements: { thresholds: [] } };
  assert.match(coveragePolicyResult(ROOT, '/not-read', request, coverage(bars(null))).errors.join('\n'), /coveragePolicy/);
  assert.match(coveragePolicyResult(ROOT, '/not-read', request, coverage(bars(0))).errors.join('\n'), /coveragePolicy/);
  request.requirements.thresholds = bars(80);
  assert.deepEqual(coveragePolicyResult(ROOT, '/not-read', request, coverage(bars(80))).errors, []);
  assert.ok(coveragePolicyResult(ROOT, '/not-read', request, coverage(bars(0))).errors.length);
});

test('printed coverage preserves unconfigured status and all measured metric values', () => {
  const measured = coverage(bars(null));
  const rows = METRICS.map(metric => [metric, '65', '—', 'unconfigured']);
  assert.deepEqual(coverageTableErrors(rows, measured, true), []);
  assert.ok(coverageTableErrors(rows.slice(1), measured, true).length);
  const wrong = structuredClone(rows); wrong[0][3] = 'at-or-above';
  assert.ok(coverageTableErrors(wrong, measured, true).length);
  wrong[0] = ['statements', '65', '0', 'at-or-above'];
  assert.ok(coverageTableErrors(wrong, measured, true).length);
});
