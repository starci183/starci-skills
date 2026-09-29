import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalJSON} from '../engine/canonical-json.mjs';
import {sha256} from '../engine/digest.mjs';
import {isPlainObject} from '../engine/plain-object.mjs';

test('canonicalJSON sorts object keys at every depth and keeps array order', () => {
  assert.equal(canonicalJSON({z: 2, a: {b: 1, a: [3, {y: 1, x: 2}]}}), '{"a":{"a":[3,{"x":2,"y":1}],"b":1},"z":2}');
  assert.equal(canonicalJSON({z: 2, a: {b: 1}}), canonicalJSON({a: {b: 1}, z: 2}));
  assert.notEqual(sha256(canonicalJSON([1, 2])), sha256(canonicalJSON([2, 1])), 'array order is part of the value');
});

test('canonicalJSON serializes scalars like JSON and treats null and arrays as non-mappings', () => {
  assert.equal(canonicalJSON(null), 'null');
  assert.equal(canonicalJSON('a"b'), '"a\\"b"');
  assert.equal(canonicalJSON(7), '7');
  assert.equal(isPlainObject(null), false);
  assert.equal(isPlainObject([]), false);
  assert.equal(isPlainObject({}), true);
});

test('sha256 is the lowercase hex digest', () => {
  assert.equal(sha256('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});
