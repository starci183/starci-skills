import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jsonCopy } from '../../scripts/lib/json-copy.mjs';

const roundTrip = (value) => JSON.parse(JSON.stringify(value));
const outcome = (fn) => { try { return { value: fn() }; } catch (error) { return { error: error.constructor.name }; } };

const holey = [1, 2, 3];
delete holey[1];
class Point { constructor() { this.x = 1; this.fn = () => 1; } get y() { return 2; } }
const withToJson = { toJSON: (key) => ({ key, ok: true }) };
const withHidden = Object.defineProperty({ shown: 1 }, 'hidden', { value: 2, enumerable: false });
const symbolKeyed = { [Symbol('s')]: 1, a: 1 };
const protoKey = JSON.parse('{"__proto__":{"x":1},"a":2}');

const shapes = {
  scalars: [0, -0, 1.5, 'text', '', true, false, null],
  nonFinite: [NaN, Infinity, -Infinity],
  undefinedMembers: { a: undefined, b: 1, c: { d: undefined, e: [undefined, 2] } },
  functionsAndSymbols: { f() {}, s: Symbol('x'), g: [() => 1, Symbol('y')] },
  holes: holey,
  nested: { list: [[1, [2, [3]]], { a: [{ b: null }] }], empty: {}, none: [] },
  date: { at: new Date(Date.UTC(2026, 9, 7, 1, 2, 3)), list: [new Date(0)] },
  invalidDate: { at: new Date(Number.NaN) },
  toJson: { w: withToJson, list: [withToJson] },
  mapSet: { m: new Map([[1, 2]]), s: new Set([1]) },
  wrappers: { n: Object(3), s: Object('s'), b: Object(false) },
  instance: new Point(),
  hidden: withHidden,
  symbolKeyed,
  protoKey,
  nullProto: Object.assign(Object.create(null), { a: 1 }),
  unicode: { 'ключ': 'значение', 'a b': '\u2028' },
};

test('the copy equals the JSON round trip on every shape the callers pass', () => {
  for (const [name, value] of Object.entries(shapes)) assert.deepStrictEqual(jsonCopy(value), roundTrip(value), name);
});

test('the copy shares no reference with its source', () => {
  const source = { a: { b: [1, { c: 2 }] } };
  const copy = jsonCopy(source);
  assert.notEqual(copy.a, source.a);
  assert.notEqual(copy.a.b, source.a.b);
  assert.notEqual(copy.a.b[1], source.a.b[1]);
  copy.a.b[1].c = 9;
  assert.equal(source.a.b[1].c, 2);
});

test('toJSON receives the property name or index, and the top level gets an empty key', () => {
  const seen = [];
  const probe = { toJSON: (key) => { seen.push(key); return key; } };
  jsonCopy({ first: probe, list: [probe] });
  jsonCopy(probe);
  assert.deepEqual(seen, ['first', '0', '']);
  assert.deepEqual(seen, (() => { const log = []; const p = { toJSON: (k) => { log.push(k); return k; } }; JSON.stringify({ first: p, list: [p] }); JSON.stringify(p); return log; })());
});

test('the values JSON cannot carry fail the way a round trip fails', () => {
  const cycle = { a: 1 }; cycle.self = cycle;
  const cases = { cycle, bigint: { n: 1n }, undef: undefined, fn: () => 1, symbol: Symbol('s'), throwingToJson: { toJSON() { throw new RangeError('boom'); } } };
  for (const [name, value] of Object.entries(cases)) {
    const expected = outcome(() => roundTrip(value));
    assert.ok(expected.error, name);
    assert.deepEqual(outcome(() => jsonCopy(value)), expected, name);
  }
});

test('a value repeated without a cycle is copied each time', () => {
  const shared = { n: 1 };
  const copy = jsonCopy({ a: shared, b: shared, list: [shared, shared] });
  assert.deepStrictEqual(copy, { a: { n: 1 }, b: { n: 1 }, list: [{ n: 1 }, { n: 1 }] });
  assert.notEqual(copy.a, copy.b);
});
