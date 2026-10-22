// The emit graph reader decides a `==` between two literals without the `==` operator; its answer is the language's.
import test from 'node:test';
import assert from 'node:assert/strict';
import { looseLiteralEqual } from '../emit/static-graph.mjs';

const VALUES = ['', ' ', '0', '1', '12', ' 12 ', 'abc', 'NaN', 'true', 0, 1, 12, -0, Number.NaN, true, false];

test('looseLiteralEqual answers what JavaScript abstract equality answers for every string, number and boolean pair', () => {
  // The reference is the language itself, evaluated through Function so this spec carries no == operator of its own.
  const abstractEquals = new Function('a', 'b', 'return a == b');
  for (const a of VALUES) for (const b of VALUES) assert.equal(looseLiteralEqual(a, b), abstractEquals(a, b), `${JSON.stringify(a)} == ${JSON.stringify(b)}`);
});
