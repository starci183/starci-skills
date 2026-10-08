import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { BASELINE_FILE, compareToBaseline, fingerprintOf, numbered, pruneBaseline, readBaseline, writeBaseline } from '../../scripts/gates/sonar-rules-baseline.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';

const finding = (over = {}) => ({ rule: 'S2871', file: 'src/a.mjs', line: 3, column: 1, message: 'm', text: 'list.sort()', ...over });
const all = () => true;

test('a fingerprint ignores the line: moving the code does not make it new', () => {
  assert.equal(fingerprintOf(finding({ line: 3 })), fingerprintOf(finding({ line: 40 })));
  assert.notEqual(fingerprintOf(finding()), fingerprintOf(finding({ text: 'other.sort()' })));
  assert.notEqual(fingerprintOf(finding()), fingerprintOf(finding({ rule: 'S7727' })));
});

test('equal findings of one file are numbered in source order', () => {
  const [first, second] = numbered([finding({ line: 9 }), finding({ line: 2 })]);
  assert.deepEqual([first.line, first.n, second.line, second.n], [2, 1, 9, 2]);
});

test('a finding that is not listed is NEW', (t) => {
  const root = mkdtemp(t, 'starci-sonar-baseline-');
  writeBaseline(root, [finding({ text: 'old.sort()' })]);
  const { entries } = readBaseline(root);
  const { fresh, stale, listed } = compareToBaseline([finding({ text: 'old.sort()' }), finding({ text: 'brand.new()' })], entries, all);
  assert.deepEqual(fresh.map((f) => f.text), ['brand.new()']);
  assert.deepEqual([stale.length, listed.length], [0, 1]);
});

test('an entry whose finding is gone is STALE: the baseline can only shrink', (t) => {
  const root = mkdtemp(t, 'starci-sonar-baseline-');
  writeBaseline(root, [finding({ text: 'a.sort()' }), finding({ text: 'b.sort()' })]);
  const { entries } = readBaseline(root);
  const { fresh, stale } = compareToBaseline([finding({ text: 'a.sort()' })], entries, all);
  assert.equal(fresh.length, 0);
  assert.deepEqual(stale.map((e) => e.excerpt), ['b.sort()']);
});

test('a listed finding is green, and a duplicate beyond the listed count is NEW', (t) => {
  const root = mkdtemp(t, 'starci-sonar-baseline-');
  writeBaseline(root, [finding()]);
  const { entries } = readBaseline(root);
  const same = compareToBaseline([finding()], entries, all);
  assert.deepEqual([same.fresh.length, same.stale.length, same.listed.length], [0, 0, 1]);
  assert.equal(compareToBaseline([finding(), finding({ line: 8 })], entries, all).fresh.length, 1);
});

test('a staged run judges only the files it covers', (t) => {
  const root = mkdtemp(t, 'starci-sonar-baseline-');
  writeBaseline(root, [finding({ file: 'src/a.mjs' }), finding({ file: 'src/b.mjs' })]);
  const { entries } = readBaseline(root);
  const { stale } = compareToBaseline([], entries, (file) => file === 'src/a.mjs');
  assert.deepEqual(stale.map((e) => e.file), ['src/a.mjs']);
});

test('a listed cognitive-complexity function may not get worse', (t) => {
  const root = mkdtemp(t, 'starci-sonar-baseline-');
  const scored = (weight) => finding({ rule: 'S3776', text: 'function f()', weight });
  writeBaseline(root, [scored(20)]);
  const { entries } = readBaseline(root);
  assert.equal(compareToBaseline([scored(20)], entries, all).fresh.length, 0);
  assert.equal(compareToBaseline([scored(17)], entries, all).fresh.length, 0);
  assert.equal(compareToBaseline([scored(21)], entries, all).fresh.length, 1);
});

test('prune removes stale entries and deletes the file when the last one goes; an empty write deletes it too', (t) => {
  const root = mkdtemp(t, 'starci-sonar-baseline-');
  const file = path.join(root, BASELINE_FILE);
  writeBaseline(root, [finding({ text: 'a.sort()' }), finding({ text: 'b.sort()' })]);
  const { entries } = readBaseline(root);
  assert.equal(pruneBaseline(root, [entries[0]]).length, 1);
  assert.ok(fs.existsSync(file));
  assert.equal(pruneBaseline(root, readBaseline(root).entries).length, 0);
  assert.ok(!fs.existsSync(file), 'the baseline is deleted when empty');
  writeBaseline(root, [finding()]);
  writeBaseline(root, []);
  assert.ok(!fs.existsSync(file));
});
