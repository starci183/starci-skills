// The closed rule set a merge conflict is resolved under: one module, read by the runtime owner that
// merges a session branch into the integration branch and by the publish that merges it into the
// target branch. What this proves is that the rule names have one home — the resolution shape of the
// delta kind — and that the one rule which takes a side may only take it where the session owns the
// file.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { mergeRules, resolutionErrors, SESSION_OWNED_RULE, DELTA_SCHEMA, HUNK_RANGE } from './merge-resolution.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('the rule names are parsed out of the kind that publishes them, never copied', () => {
  const rules = mergeRules(root);
  assert.equal(rules.length, 4, 'the set is closed at four');
  assert.ok(rules.includes(SESSION_OWNED_RULE));
  // The same names, found by reading the schema text: a copy in this module would survive a schema
  // edit, and that is exactly the drift a shared rule set cannot afford.
  const text = readFileSync(path.join(root, DELTA_SCHEMA), 'utf8');
  for (const rule of rules) assert.ok(text.includes(`"${rule}"`), `${rule} is published by ${DELTA_SCHEMA}`);
  assert.throws(() => Object.assign(mergeRules(root), { 0: 'invented' }), 'the set a caller reads cannot be widened in place');
});

test('a recorded resolution names its file, its range and one of the rules, once', () => {
  const owned = ['src/session.ts'];
  const lawful = [{ file: 'src/session.ts', hunkRange: '12-18', rule: SESSION_OWNED_RULE }, { file: 'package-lock.json', hunkRange: '4-9', rule: 'one-side-touched' }];
  assert.deepEqual(resolutionErrors(lawful, { owned, root }), []);
  assert.deepEqual(resolutionErrors([], { owned, root }), [], 'a merge with no conflict records nothing');
  assert.deepEqual(resolutionErrors(undefined, { root }), []);

  const errorOf = (resolutions, opts = {}) => resolutionErrors(resolutions, { owned, root, ...opts });
  assert.ok(errorOf([{ file: 'src/session.ts', hunkRange: '12-18', rule: 'ours' }]).some((e) => e.includes('not one of the closed rule set')));
  assert.ok(errorOf([{ file: 'src/session.ts', hunkRange: 'around line twelve', rule: 'one-side-touched' }]).some((e) => e.includes('records the hunk range as')));
  assert.ok(errorOf([{ hunkRange: '12-18', rule: 'one-side-touched' }]).some((e) => e.includes('records no file')));
  assert.ok(errorOf([lawful[0], { ...lawful[0], rule: 'branch-elsewhere' }]).some((e) => e.includes('is recorded twice')));
  // The side-taking rule, and the only thing about it that is not local to the hunk.
  assert.ok(errorOf([{ file: 'src/elsewhere.ts', hunkRange: '1-3', rule: SESSION_OWNED_RULE }]).some((e) => e.includes('does not own')));
  assert.deepEqual(errorOf([{ file: 'src/elsewhere.ts', hunkRange: '1-3', rule: 'branch-elsewhere' }]), [], 'outside its own files the branch wins, and that is lawful');
  assert.deepEqual(resolutionErrors([{ file: 'src/elsewhere.ts', hunkRange: '1-3', rule: SESSION_OWNED_RULE }], { root }), [], 'a caller that cannot read the write set checks everything else and says nothing about ownership');
  assert.equal(HUNK_RANGE.test('12-18'), true);
});
