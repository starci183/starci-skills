import test from 'node:test';
import assert from 'node:assert/strict';
import { eachInOrder, mapInOrder, findInOrder, repeatInOrder } from '../../scripts/lib/in-order.mjs';

const tick = () => new Promise((resolve) => setImmediate(resolve));

/** A deferred promise per call, so a spec decides when each item settles and sees which have STARTED. */
const gate = () => {
  const started = [];
  const settle = [];
  const run = (label) => (item, index) => new Promise((resolve, reject) => {
    started.push(label ? `${label}${item}` : item);
    settle[index] = { resolve, reject };
  });
  return { started, settle, run };
};

test('eachInOrder starts item n+1 only after item n settled', async () => {
  const g = gate();
  const done = eachInOrder([10, 20, 30], g.run());
  await tick();
  assert.deepEqual(g.started, [10], 'only the first item has started');
  g.settle[0].resolve();
  await tick();
  assert.deepEqual(g.started, [10, 20]);
  await tick();
  assert.deepEqual(g.started, [10, 20], 'the second is still pending, the third has not started');
  g.settle[1].resolve();
  await tick();
  assert.deepEqual(g.started, [10, 20, 30]);
  let finished = false;
  done.then(() => { finished = true; });
  await tick();
  assert.equal(finished, false, 'not done while the last item is pending');
  g.settle[2].resolve();
  assert.equal(await done, undefined);
});

test('eachInOrder passes the index and runs a plain (non-promise) fn', async () => {
  const seen = [];
  await eachInOrder(['a', 'b', 'c'], (item, index) => { seen.push([item, index]); });
  assert.deepEqual(seen, [['a', 0], ['b', 1], ['c', 2]]);
});

test('the first rejection stops the run: later items never start', async () => {
  const g = gate();
  const caught = eachInOrder([1, 2, 3], g.run()).catch((error) => error);
  await tick();
  g.settle[0].resolve();
  await tick();
  const boom = new Error('boom');
  g.settle[1].reject(boom);
  assert.equal(await caught, boom);
  await tick();
  assert.deepEqual(g.started, [1, 2], 'item 3 never started');
});

test('a synchronous throw of fn is a rejection, like a throw inside an async for...of', async () => {
  const seen = [];
  const boom = new Error('sync');
  const run = eachInOrder([1, 2, 3], (item) => { seen.push(item); if (item === 2) throw boom; });
  assert.ok(run instanceof Promise, 'never throws synchronously');
  await assert.rejects(run, (error) => error === boom);
  assert.deepEqual(seen, [1, 2]);
  await assert.rejects(mapInOrder([1], () => { throw boom; }), (error) => error === boom);
  await assert.rejects(findInOrder([1], () => { throw boom; }), (error) => error === boom);
  await assert.rejects(repeatInOrder(() => { throw boom; }), (error) => error === boom);
});

test('a non-iterable and a non-function reject instead of throwing synchronously', async () => {
  let promise;
  assert.doesNotThrow(() => { promise = eachInOrder(42, () => {}); });
  await assert.rejects(promise, TypeError);
  await assert.rejects(eachInOrder([1], null), TypeError);
});

test('empty input resolves at once and never calls fn', async () => {
  let calls = 0;
  const fn = () => { calls++; };
  assert.equal(await eachInOrder([], fn), undefined);
  assert.deepEqual(await mapInOrder([], fn), []);
  assert.equal(await findInOrder([], fn), undefined);
  assert.equal(calls, 0);
});

test('it reads generators, Sets, Maps and strings lazily, one item at a time', async () => {
  const log = [];
  function* lazy() { for (const n of [1, 2, 3]) { log.push(`pull${n}`); yield n; } }
  await eachInOrder(lazy(), (n) => { log.push(`ran${n}`); });
  assert.deepEqual(log, ['pull1', 'ran1', 'pull2', 'ran2', 'pull3', 'ran3'], 'the iterator is pulled between items, never ahead');
  assert.deepEqual(await mapInOrder(new Set(['x', 'y']), (v) => v.toUpperCase()), ['X', 'Y']);
  assert.deepEqual(await mapInOrder(new Map([['k', 1], ['j', 2]]), ([key, value]) => `${key}${value}`), ['k1', 'j2']);
  assert.deepEqual(await mapInOrder('abc', (c) => c), ['a', 'b', 'c']);
});

test('items added to an array while it runs are visited, as for...of does', async () => {
  const items = [1];
  const seen = [];
  await eachInOrder(items, (n) => { seen.push(n); if (n < 4) items.push(n + 1); });
  assert.deepEqual(seen, [1, 2, 3, 4]);
});

test('mapInOrder returns results in item order and runs one at a time', async () => {
  const g = gate();
  const done = mapInOrder(['a', 'b'], g.run('r'));
  await tick();
  assert.deepEqual(g.started, ['ra']);
  g.settle[0].resolve(1);
  await tick();
  assert.deepEqual(g.started, ['ra', 'rb']);
  g.settle[1].resolve(2);
  assert.deepEqual(await done, [1, 2]);
});

test('mapInOrder stops at the first rejection', async () => {
  const seen = [];
  await assert.rejects(mapInOrder([1, 2, 3], async (n) => { seen.push(n); if (n === 2) throw new Error('two'); return n; }), /two/);
  assert.deepEqual(seen, [1, 2]);
});

test('findInOrder returns the first match and never runs later predicates', async () => {
  const g = gate();
  const done = findInOrder(['a', 'b', 'c'], g.run());
  await tick();
  g.settle[0].resolve(false);
  await tick();
  g.settle[1].resolve('yes');
  assert.equal(await done, 'b');
  await tick();
  assert.deepEqual(g.started, ['a', 'b'], 'c never ran');
  assert.equal(await findInOrder([1, 2], async () => 0), undefined, 'no match is undefined');
  assert.equal(await findInOrder(['', 5], (n) => n === ''), '', 'the item is returned even when it is falsy');
});

test('an early stop or a throw closes a generator, as for...of does', async () => {
  const closed = [];
  function* source(tag) { try { yield 1; yield 2; yield 3; } finally { closed.push(tag); } }
  assert.equal(await findInOrder(source('found'), (n) => n === 2), 2);
  assert.deepEqual(closed, ['found']);
  await assert.rejects(eachInOrder(source('threw'), () => { throw new Error('x'); }), /x/);
  assert.deepEqual(closed, ['found', 'threw']);
  await eachInOrder(source('done'), () => {});
  assert.deepEqual(closed, ['found', 'threw', 'done'], 'a generator that ran out finished by itself');
});

test('an iterator whose next() throws rejects without being closed', async () => {
  const boom = new Error('next');
  let returned = 0;
  const iterable = { [Symbol.iterator]: () => ({ next() { throw boom; }, return() { returned++; return {}; } }) };
  await assert.rejects(eachInOrder(iterable, () => {}), (error) => error === boom);
  assert.equal(returned, 0, 'for...of does not call return() when next() itself throws');
});

test('repeatInOrder repeats until a step resolves a value; null and 0 count as values', async () => {
  const attempts = [];
  const result = await repeatInOrder(async (attempt) => { attempts.push(attempt); if (attempt === 3) return 'done'; });
  assert.equal(result, 'done');
  assert.deepEqual(attempts, [0, 1, 2, 3]);
  assert.equal(await repeatInOrder((attempt) => (attempt === 1 ? null : undefined)), null);
  assert.equal(await repeatInOrder(() => 0), 0);
});

test('repeatInOrder starts a step only after the previous one settled and stops on a rejection', async () => {
  const g = gate();
  const caught = repeatInOrder((attempt) => g.run('s')(attempt, attempt)).catch((error) => error);
  await tick();
  g.settle[0].resolve();
  await tick();
  assert.deepEqual(g.started, ['s0', 's1']);
  const boom = new Error('step');
  g.settle[1].reject(boom);
  assert.equal(await caught, boom);
  await tick();
  assert.deepEqual(g.started, ['s0', 's1'], 'no third step');
});

test('100k items run without growing the stack', async () => {
  let sum = 0;
  const lazy = { *[Symbol.iterator]() { for (let n = 0; n < 100_000; n++) yield n; } };
  await eachInOrder(lazy, async (n) => { sum += n; });
  assert.equal(sum, 99_999 * 100_000 / 2);
  const items = Array.from({ length: 100_000 }, (_, n) => n);
  const mapped = await mapInOrder(items, (n) => n + 1);
  assert.equal(mapped.length, 100_000);
  assert.equal(mapped[99_999], 100_000);
  assert.equal(await repeatInOrder((attempt) => (attempt === 100_000 ? attempt : undefined)), 100_000);
  assert.equal(await findInOrder(items, async (n) => n === 99_999), 99_999);
});

/** A small deterministic generator, so the randomized schedule repeats. */
const lcg = (seed) => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;

test('trace, results and failure equal the plain for...of await loop for a randomized schedule', async () => {
  const random = lcg(20240607);
  for (let round = 0; round < 40; round++) {
    const items = Array.from({ length: Math.floor(random() * 12) }, () => Math.floor(random() * 6));
    const waits = items.map(() => Math.floor(random() * 3));
    const failAt = random() < 0.3 ? Math.floor(random() * 6) : -1;
    const sync = random() < 0.3;
    const makeFn = (trace) => (item, index) => {
      trace.push(`start${index}:${item}`);
      if (sync) { trace.push(`end${index}`); return item === failAt ? Promise.reject(new Error(`fail${item}`)) : item * 2 + index; }
      return (async () => {
        for (let k = 0; k < waits[index]; k++) await tick();
        if (item === failAt) throw new Error(`fail${item}`);
        trace.push(`end${index}`);
        return item * 2 + index;
      })();
    };
    const outcome = async (run) => { try { return { ok: await run() }; } catch (error) { return { error: error.message }; } };

    const plainTrace = [];
    const plainFn = makeFn(plainTrace);
    const plain = await outcome(async () => {
      const out = [];
      let index = 0;
      for (const item of items) out.push(await plainFn(item, index++));
      return out;
    });
    const mapTrace = [];
    const mapped = await outcome(() => mapInOrder(items, makeFn(mapTrace)));
    assert.deepEqual(mapped, plain, `round ${round}: same results or failure`);
    assert.deepEqual(mapTrace, plainTrace, `round ${round}: same start/end order`);

    const eachTrace = [];
    const each = await outcome(() => eachInOrder(items, makeFn(eachTrace)));
    assert.deepEqual(eachTrace, plainTrace, `round ${round}: same trace for eachInOrder`);
    assert.equal(each.error, plain.error);

    const wanted = (item) => (item * 2) % 3 === 1;
    const foundTrace = [];
    const found = await findInOrder(items, async (item, index) => { foundTrace.push(index); return wanted(item); });
    const plainFoundTrace = [];
    let plainFound;
    let index = 0;
    for (const item of items) {
      plainFoundTrace.push(index++);
      if (await Promise.resolve(wanted(item))) { plainFound = item; break; }
    }
    assert.equal(found, plainFound, `round ${round}: same first match`);
    assert.deepEqual(foundTrace, plainFoundTrace, `round ${round}: same predicates ran`);
  }
});
