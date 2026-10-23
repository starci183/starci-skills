// An UPPER_SNAKE literal that a script only READS (compares, queries, tests for membership), mentions in a comment or declares as an enum
// member is not an emitted failure code (scripts/lib/failure-code-reads.mjs, read by the runtime's failure-codes check). Emission sites
// (code:, reason:, thrown messages) are never excluded.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { nonEmittingOffsets } from '../runtime/scripts/lib/failure-code-reads.mjs';

const t = createRequire(import.meta.url)('typescript');
const UPPER = /(['"`])([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)\1/g;
const BRACKET = /\[([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)\]/g;

/** The UPPER names of `code` that the read rules leave out, and those that stay emitted. */
function split(code) {
  const source = t.createSourceFile('probe.mjs', code, t.ScriptTarget.Latest, true, t.ScriptKind.JS);
  const skipped = nonEmittingOffsets(t, source, [UPPER, BRACKET]);
  const left = [], kept = [];
  for (const match of code.matchAll(UPPER)) (skipped.has(match.index) ? left : kept).push(match[2]);
  for (const match of code.matchAll(BRACKET)) (skipped.has(match.index) ? left : kept).push(match[1]);
  return { left, kept };
}

test('a literal compared with a value is read, not emitted', () => {
  assert.deepEqual(split("if (grant.targtype === 'ACL_TARGET_OBJECT') {}").left, ['ACL_TARGET_OBJECT']);
  assert.deepEqual(split("if ('OBJECT_TABLE' !== grant.objtype) {}").left, ['OBJECT_TABLE']);
  assert.deepEqual(split("switch (k) { case 'VAR_RESET': break; }").left, ['VAR_RESET']);
});

test('two literals compared with each other, an assignment and a code property stay emitted', () => {
  assert.deepEqual(split("const same = 'A_B' === 'C_D';").kept, ['A_B', 'C_D']);
  assert.deepEqual(split("return { code: 'TARGET_MISSING' };").kept, ['TARGET_MISSING']);
  assert.deepEqual(split("const reason = 'NO_SUCH_THING';").kept, ['NO_SUCH_THING']);
  assert.deepEqual(split("throw new Error('[BAD_INPUT] nope');").kept, ['BAD_INPUT']);
});

test('a string or collection query argument is read', () => {
  assert.deepEqual(split("keys.find((key) => key.endsWith('BAND_TOKEN_NAMES'))").left, ['BAND_TOKEN_NAMES']);
  assert.deepEqual(split("names.has('APP_GUARD')").left, ['APP_GUARD']);
});

test('an array literal only tested with includes(value) is a membership test; a list that is stored is not', () => {
  assert.deepEqual(split("['OBJECT_TABLE', SEQUENCE].includes(grant.objtype)").left, ['OBJECT_TABLE']);
  assert.deepEqual(split("const CODES = ['FIRST_CODE', 'SECOND_CODE'];").kept, ['FIRST_CODE', 'SECOND_CODE']);
});

test('the symbol of a (symbol, package) argument pair and a type discriminator are names of someone else', () => {
  assert.deepEqual(split("kit.providersOf(root, 'APP_FILTER', '@nestjs/core')").left, ['APP_FILTER']);
  assert.deepEqual(split("mint({ type: 'GLOBAL_ANALYSIS_TOKEN', label: 'x' })").left, ['GLOBAL_ANALYSIS_TOKEN']);
  assert.deepEqual(split("mint({ kind: 'GLOBAL_ANALYSIS_TOKEN' })").kept, ['GLOBAL_ANALYSIS_TOKEN']);
});

test('a name in a comment is not emitted, the same name in code is', () => {
  const { left, kept } = split("/** The `ENGINE_SCHEMA` marker. */\n// see [TOKEN_TOLERANCE]\nconst x = { code: 'ENGINE_SCHEMA' };");
  assert.deepEqual(left, ['ENGINE_SCHEMA', 'TOKEN_TOLERANCE']);
  assert.deepEqual(kept, ['ENGINE_SCHEMA']);
});

test('an enum member declared by identity covers every occurrence of its name', () => {
  const { left, kept } = split("Scalar.QUOTE_DOUBLE = 'QUOTE_DOUBLE'; a = 'QUOTE_DOUBLE'; b = 'OTHER_CODE';");
  assert.deepEqual(left, ['QUOTE_DOUBLE', 'QUOTE_DOUBLE']);
  assert.deepEqual(kept, ['OTHER_CODE']);
});
