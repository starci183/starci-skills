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


test('schema-declared source text preserves traversal-looking bytes while references and universal caps remain guarded', () => {
  const content = { type: 'string', 'x-content': 'source-text' };
  const schema = { type: 'object', properties: { chunks: { type: 'array', items: { $ref: '#/$defs/content' } }, path: { type: 'string' } }, $defs: { content } };
  const chunks = ['COPY ../../package.json /app/', '# ../comment', 'volume: ../../data:/data'];
  assert.deepEqual(validateAgainst(schema, { chunks, path: 'Dockerfile' }), []);
  for (const path of ['../escape', 'root/../../escape', '..\\escape']) assert.ok(validateAgainst(schema, { chunks, path }).some(e => e.includes('traversal')));
  assert.ok(validateAgainst(schema, { chunks: ['x'.repeat(8193)] }).some(e => e.includes('contract limit')));
  assert.ok(validateAgainst(schema, { chunks: Array(513).fill('../literal') }).some(e => e.includes('contract limit')));
  assert.ok(validateAgainst({ type: 'object', properties: { value: { type: 'string' } } }, { value: '../escape', 'x-content': 'source-text' }).some(e => e.includes('traversal')));
  assert.ok(validateAgainst({ type: 'object', properties: { a: { type: 'object', properties: { b: content } }, 'a.b': { type: 'string' } } }, { a: { b: '../literal' }, 'a.b': '../escape' }).some(e => e.includes('traversal')));
});

test('opaque source annotations follow only matching schema branches and cannot widen ambiguous reference alternatives', () => {
  const content = { type: 'string', 'x-content': 'source-text' }, ref = { type: 'string' };
  assert.deepEqual(validateAgainst({ oneOf: [content, { type: 'number' }] }, '../literal'), []);
  assert.deepEqual(validateAgainst({ anyOf: [content, content] }, '../literal'), []);
  assert.ok(validateAgainst({ type: 'string', anyOf: [content] }, '../escape').some(e => e.includes('traversal')));
  assert.ok(validateAgainst({ anyOf: [content, ref] }, '../escape').some(e => e.includes('traversal')));
  assert.ok(validateAgainst({ anyOf: [content, {}] }, '../escape').some(e => e.includes('traversal')));
  assert.ok(validateAgainst({ allOf: [content, ref] }, '../escape').some(e => e.includes('traversal')));
  assert.deepEqual(validateAgainst({ allOf: [content] }, '../literal'), []);
  assert.ok(validateAgainst({ type: 'string', allOf: [content] }, '../escape').some(e => e.includes('traversal')));
  assert.ok(validateAgainst({ oneOf: [{ ...content, pattern: '^safe' }, ref] }, '../escape').some(e => e.includes('traversal')));
  const branch = { type: 'object', properties: { kind: { const: 'content' } }, required: ['kind'] };
  const schema = { if: branch, then: { properties: { value: content } }, else: { properties: { value: ref } } };
  assert.deepEqual(validateAgainst(schema, { kind: 'content', value: '../literal' }), []);
  assert.ok(validateAgainst(schema, { kind: 'reference', value: '../escape' }).some(e => e.includes('traversal')));
});
import { readFileSync } from 'node:fs';

const readSchema = path => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
test('actual request goal enforces sibling shape alongside oneOf', () => {
  const rule = readSchema('templates/step/request.schema.json').properties.goal;
  for (const good of [{ doneWhen: 0 }, { prerequisite: '1/2' }]) assert.deepEqual(validateAgainst(rule, good), []);
  for (const bad of [{ doneWhen: '0' }, { doneWhen: -1, extra: true }, { prerequisite: 123 }, {}, [], { doneWhen: 0, prerequisite: '1/2' }]) assert.ok(validateAgainst(rule, bad).length, JSON.stringify(bad));
});
test('actual runtime identity enforces required and property constraints alongside anyOf', () => {
  const schema = readSchema('readiness/initialization/runtime/owner.schema.json');
  const rule = { ...schema.$defs.identity, $defs: schema.$defs };
  assert.ok(validateAgainst(rule, { realm: 'x' }).length);
});
test('all combinators and local ref siblings are conjunctive', () => {
  assert.ok(validateAgainst({ oneOf: [{ type: 'integer' }], anyOf: [{ const: 2 }] }, 1).length);
  assert.ok(validateAgainst({ $defs: { n: { type: 'integer' } }, $ref: '#/$defs/n', minimum: 2 }, 1).length);
  assert.ok(validateAgainst({ type: 'array', maxItems: 512, anyOf: [{ maxItems: 1024 }] }, Array(600).fill(1)).length);
});
test('unsupported assertions fail closed even in inactive branches and definitions', () => {
  for (const schema of [{ not: { const: 1 } }, { anyOf: [{ type: 'integer' }, { contains: {} }] }, { $defs: { unused: { patternProperties: {} } } }, { format: 'email' }, { items: [] }, { $ref: '#/$defs/missing' }]) assert.ok(validateAgainst(schema, 1).some(e => /schema|unsupported/.test(e)));
});
test('boolean schemas and JSON structural equality follow schema semantics', () => {
  assert.deepEqual(validateAgainst(true, 1), []);
  assert.ok(validateAgainst(false, 1).length);
  assert.ok(validateAgainst({ items: false }, [1]).length);
  assert.ok(validateAgainst({ if: true, then: false }, 1).length);
  assert.deepEqual(validateAgainst({ const: { a: 1, b: 2 } }, { b: 2, a: 1 }), []);
  assert.deepEqual(validateAgainst({ enum: [{ a: 1 }] }, { a: 1 }), []);
  assert.ok(validateAgainst({ uniqueItems: true }, [{ a: 1, b: 2 }, { b: 2, a: 1 }]).length);
});
