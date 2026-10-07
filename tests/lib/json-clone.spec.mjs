import test from 'node:test';
import assert from 'node:assert/strict';
import { jsonClone } from '../../scripts/lib/json-clone.mjs';

// The reference is the JSON text round trip jsonClone stands for, written in two steps.
const roundTrip = (value) => {
  const text = JSON.stringify(value);
  return JSON.parse(text);
};
const outcome = (run) => {
  try { return { value: run() }; } catch (error) { return { error: error.name }; }
};

class Tagged { constructor() { this.kept = 1; this.dropped = undefined; } get computed() { return 2; } }
const toJsonOf = (result) => ({ secret: 'x', toJSON: (key) => ({ result, key }) });
const holes = [1, , 3];
holes.length = 5;
const shared = { n: 1 };
const frozen = Object.freeze({ list: Object.freeze([1, { a: Object.freeze({ b: 2 }) }]) });
const proto = JSON.parse('{"__proto__":{"polluted":true},"ok":1}');
const cyclic = { name: 'loop' };
cyclic.self = cyclic;

const SHAPES = {
  null: null, string: 'text', empty: '', zero: 0, negativeZero: -0, float: 1.5, big: 1e21, true: true, false: false,
  nan: Number.NaN, infinity: Number.POSITIVE_INFINITY, negativeInfinity: Number.NEGATIVE_INFINITY,
  emptyObject: {}, emptyArray: [], nested: { a: [1, { b: [2, [3, null]] }], c: { d: { e: 'f' } } },
  undefinedMember: { a: undefined, b: 1 }, functionMember: { f() { return 1; }, g: () => 2, h: 3 }, symbolMember: { s: Symbol('s'), [Symbol('k')]: 1, ok: 1 },
  undefinedItems: [undefined, () => 1, Symbol('x'), 1], holes, nonFinite: { a: Number.NaN, b: [Number.POSITIVE_INFINITY, -Infinity] },
  date: new Date(Date.UTC(2026, 9, 7, 12, 30, 15, 123)), invalidDate: new Date(Number.NaN), dateMember: { when: new Date(0), list: [new Date(1)] },
  toJson: toJsonOf(1), toJsonNested: { a: toJsonOf(2), list: [toJsonOf(3)] }, toJsonUndefined: { toJSON: () => undefined }, toJsonUndefinedMember: { a: { toJSON: () => undefined }, b: 1 },
  toJsonNull: { a: { toJSON: () => null } }, toJsonPrimitive: [{ toJSON: () => 7 }, { toJSON: () => 'seven' }],
  boxed: { n: Object(3), s: Object('s'), b: Object(false), t: Object(true) }, boxedItems: [Object(1), Object('x')],
  map: { m: new Map([[1, 2]]), s: new Set([1]) }, instance: new Tagged(), sharedTwice: { a: shared, b: shared, c: [shared, shared] },
  integerKeys: { b: 1, 2: 'two', a: 2, 1: 'one', 10: 'ten' }, frozen, proto, array: [[], [[]], [{}]], long: Array.from({ length: 200 }, (_, i) => ({ i, even: i % 2 === 0 })),
  typed: { u8: new Uint8Array([1, 2]) }, regexp: { r: /x/g }, error: { e: new Error('boom') }, string3: ['a\u2028b', '"quoted"', '\ud800'],
};

test('jsonClone equals the JSON text round trip on every shape the callers pass', () => {
  for (const [name, value] of Object.entries(SHAPES)) {
    assert.deepEqual(outcome(() => jsonClone(value)), outcome(() => roundTrip(value)), name);
    const mine = outcome(() => jsonClone(value)).value, theirs = outcome(() => roundTrip(value)).value;
    assert.equal(JSON.stringify(mine), JSON.stringify(theirs), `${name}: same text`);
    assert.deepEqual(Object.keys(mine ?? {}), Object.keys(theirs ?? {}), `${name}: same key order`);
  }
});

test('what JSON drops is dropped: undefined, functions and symbols leave objects and null out array items', () => {
  assert.deepEqual(jsonClone({ a: undefined, b: () => 1, c: Symbol('c'), d: 1 }), { d: 1 });
  assert.deepEqual(jsonClone([undefined, () => 1, Symbol('c'), 1]), [null, null, null, 1]);
  assert.equal('a' in jsonClone({ a: undefined }), false);
});

test('holes in an array are written as null, as in a JSON text', () => {
  assert.deepEqual(jsonClone(holes), [1, null, 3, null, null]);
  assert.equal(1 in jsonClone(holes), true, 'a copy has no hole');
});

test('toJSON replaces its object, is called once with the key, and Dates become their ISO text', () => {
  const calls = [];
  const spy = { toJSON(key) { calls.push(key); return { seen: key }; } };
  assert.deepEqual(jsonClone({ first: spy, list: [spy] }), { first: { seen: 'first' }, list: [{ seen: '0' }] });
  assert.deepEqual(calls, ['first', '0']);
  assert.deepEqual(jsonClone({ at: new Date(Date.UTC(2026, 0, 2)) }), { at: '2026-01-02T00:00:00.000Z' });
  assert.equal(jsonClone(new Date(Number.NaN)), null);
  assert.deepEqual(jsonClone(new Map([[1, 2]])), {});
});

test('the copy is plain data: nothing is shared with the original, nothing stays frozen, shared references split', () => {
  const copy = jsonClone(frozen);
  assert.deepEqual(copy, frozen);
  assert.equal(Object.isFrozen(copy) || Object.isFrozen(copy.list) || Object.isFrozen(copy.list[1]), false);
  copy.list[1].a.b = 3;
  assert.equal(frozen.list[1].a.b, 2);
  const twice = jsonClone({ a: shared, b: shared });
  assert.notEqual(twice.a, twice.b);
  assert.notEqual(twice.a, shared);
  assert.equal(Object.getPrototypeOf(jsonClone(new Tagged())), Object.prototype);
});

test('a __proto__ key stays an own property and does not reach the prototype', () => {
  const copy = jsonClone(proto);
  assert.equal(Object.hasOwn(copy, '__proto__'), true);
  assert.equal(copy.polluted, undefined);
  assert.equal(Object.getPrototypeOf(copy), Object.prototype);
});

test('what JSON cannot write throws the error the round trip throws', () => {
  assert.throws(() => jsonClone(cyclic), TypeError);
  assert.throws(() => jsonClone({ n: 1n }), TypeError);
  assert.throws(() => jsonClone(Object(1n)), TypeError);
  for (const value of [undefined, () => 1, Symbol('s')]) {
    assert.throws(() => jsonClone(value), SyntaxError);
    assert.throws(() => roundTrip(value), SyntaxError);
  }
  assert.deepEqual(jsonClone({ a: [1, { b: 2 }], c: { a: [1, { b: 2 }] } }), { a: [1, { b: 2 }], c: { a: [1, { b: 2 }] } }, 'a repeated subtree is not a cycle');
});

test('a seeded random walk over JSON-like and JSON-unlike values agrees with the round trip', () => {
  let seed = 20261007;
  const next = (limit) => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % limit; };
  const leaves = [() => null, () => true, () => false, () => next(1000) / 8, () => `s${next(50)}`, () => undefined, () => () => 1, () => Number.NaN, () => -0, () => Symbol('r'), () => new Date(next(1e12)), () => Object(next(9)), () => { const fixed = next(5); return { toJSON: () => fixed }; }];
  const build = (depth) => {
    if (depth === 0 || next(4) === 0) return leaves[next(leaves.length)]();
    if (next(2) === 0) return Array.from({ length: next(5) }, () => build(depth - 1));
    return Object.fromEntries(Array.from({ length: next(5) }, () => [`k${next(8)}`, build(depth - 1)]));
  };
  for (let round = 0; round < 400; round += 1) {
    const value = build(5);
    assert.deepEqual(outcome(() => jsonClone(value)), outcome(() => roundTrip(value)), `round ${round}`);
  }
});
