import assert from 'node:assert/strict';
import test from 'node:test';
import { validateAgainst } from './json-schema.mjs';

test('literal punctuation in property names cannot borrow another instance array bound', () => {
  const rows = Array.from({ length: 795 }, () => 'entry');
  const schema = { type: 'object', properties: { a: { type: 'object', properties: { b: { type: 'array', maxItems: 1024 } } }, 'a.b': { type: 'array' }, 'a[0]': { type: 'array' } } };
  assert.deepEqual(validateAgainst(schema, { a: { b: rows } }), []);
  assert.ok(validateAgainst(schema, { a: { b: rows }, 'a.b': rows }).some(error => error.includes('contract limit')));
  assert.ok(validateAgainst({ properties: { a: { type: 'array', items: { type: 'array', maxItems: 1024 } }, 'a[0]': { type: 'array' } } }, { a: [rows], 'a[0]': rows }).some(error => error.includes('contract limit')));
});

test('explicit array bounds cover large manifests without widening unrelated hygiene', () => {
  const rows = Array.from({ length: 795 }, () => 'entry');
  const schema = { type: 'object', properties: { items: { $ref: '#/$defs/rows' }, other: { type: 'array' } }, $defs: { rows: { type: 'array', maxItems: 1024, items: { type: 'string' } } } };
  assert.deepEqual(validateAgainst(schema, { items: rows }), []);
  assert.ok(validateAgainst(schema, { items: [...rows, ...rows] }).some(error => error.includes('too long')));
  assert.ok(validateAgainst(schema, { items: rows, other: rows }).some(error => error.includes('contract limit')));
  assert.ok(validateAgainst(schema, { items: ['../escape'] }).some(error => error.includes('traversal')));
  assert.ok(validateAgainst(schema, { items: ['x'.repeat(8193)] }).some(error => error.includes('string exceeds')));
  assert.deepEqual(validateAgainst({ $defs: schema.$defs, oneOf: [schema, { type: 'string' }] }, { items: rows }), []);
  assert.deepEqual(validateAgainst({ $defs: schema.$defs, allOf: [schema] }, { items: rows }), []);
  assert.ok(validateAgainst({ anyOf: [{ type: 'string', maxItems: 1024 }, { type: 'array' }] }, rows).some(error => error.includes('contract limit')));
});

test('additionalProperties schema validates only properties outside the declared set', () => {
  const schema = {
    type: 'object',
    properties: { fixed: { type: 'string' } },
    additionalProperties: {
      type: 'object',
      additionalProperties: false,
      required: ['value'],
      properties: { value: { type: 'integer' } }
    }
  };

  assert.deepEqual(validateAgainst(schema, { fixed: 'declared', extra: { value: 1 } }), []);
  assert.ok(validateAgainst(schema, { fixed: 'declared', extra: { value: 'wrong' } }).some((error) => error.includes('$.extra.value: expected integer')));
  assert.ok(validateAgainst(schema, { fixed: 'declared', extra: { value: 1, stray: true } }).some((error) => error.includes('$.extra.stray: unexpected property')));
});

test('additionalProperties false still permits declared properties and rejects unknown ones', () => {
  const schema = {
    type: 'object',
    additionalProperties: false,
    properties: { fixed: { type: 'string' } }
  };

  assert.deepEqual(validateAgainst(schema, { fixed: 'declared' }), []);
  assert.ok(validateAgainst(schema, { fixed: 'declared', extra: true }).some((error) => error.includes('$.extra: unexpected property')));
});
