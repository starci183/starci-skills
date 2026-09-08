import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { summarizeBenchmark } from './benchmark-profiles.mjs';
const fixture = () => JSON.parse(readFileSync(new URL('../tests/benchmarks/fixtures/observations.json', import.meta.url), 'utf8'));
test('matched fixture observations preserve unknowns and separate refusal from delivery', () => {
  const report = summarizeBenchmark(fixture());
  assert.equal(report.performanceEvidence, false);
  assert.equal(report.pairs.length, 1);
  assert.equal(report.unmatchedRuns, 1);
  assert.equal(report.pairs[0].liteMinusFull.inputTokens, -20);
  assert.equal(report.pairs[0].liteMinusFull.cachedInputTokens, null);
  assert.equal(report.profiles.lite.outcomes.delivered, 1);
  assert.equal(report.profiles.lite.outcomes['correct-refusal'], 1);
  assert.deepEqual(report.profiles.lite.metrics.inputTokens, { known: 1, unknown: 1, mean: 100 });
});
test('different model, prompt, revision or baseline cannot produce matched comparisons', () => {
  for (const key of ['model', 'promptSha256', 'baselineSha256', 'skillRevision', 'reasoning', 'environment']) {
    const data = fixture(); data.runs[1][key] += '-different';
    assert.equal(summarizeBenchmark(data).pairs.length, 0);
  }
});
test('refusal is never credited as an efficient delivery', () => {
  const data = fixture(); data.runs[1].outcome = 'correct-refusal';
  const pair = summarizeBenchmark(data).pairs[0];
  assert.equal(pair.deliveryComparable, false);
  assert.ok(Object.values(pair.liteMinusFull).every(value => value === null));
});
test('missing data, duplicate trials and unverified delivery fail validation', () => {
  for (const mutate of [d => delete d.runs[0].inputTokens, d => d.runs[0].inputTokens = -1, d => d.runs[0].regressions = null, d => d.runs[0].evidence = [], d => d.runs.push({ ...d.runs[0], id: 'duplicate-pair' })]) {
    const data = fixture(); mutate(data); assert.throws(() => summarizeBenchmark(data));
  }
});
test('CLI reproduces fixture summary and empty real observations make no performance claim', () => {
  const result = spawnSync(process.execPath, ['scripts/benchmark-profiles.mjs', 'tests/benchmarks/fixtures/observations.json'], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), summarizeBenchmark(fixture()));
  const empty = summarizeBenchmark({ version: 1, kind: 'agent-trials', runs: [] });
  assert.equal(empty.performanceEvidence, false);
  assert.equal(empty.profiles.full.metrics.elapsedMs.mean, null);
});
