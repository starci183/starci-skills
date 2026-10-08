// in-order.mjs — asynchronous work done strictly one after another, named by what it does. A sequential `await` in a
// loop is often the point (ordered ledger writes, one Orca or git call at a time, a rate limit, stop at the first
// failure or match); these helpers state that intent at the call site so no loop body carries an `await`. Each one
// starts item n+1 only after item n has settled, lets the first rejection (or a synchronous throw of `fn`) stop the run
// with later items never started, pulls a lazy iterable one item at a time, and closes it on an early stop, the way
// `for (const x of xs) await fn(x)` does. All of them run on the one `walk` below: promise callbacks, not an async
// recursion, so the stack and the memory stay flat however long the input is.
// Provably independent work that needs no order, short-circuit or error contract may use `Promise.all` instead.

/** Close `iterator` the way a `for...of` leaves it: `return()` when it has one. */
const close = (iterator) => iterator.return?.();

/**
 * Drive `visit(item, index)` over `items` one at a time. `decide(outcome, item)` runs after each settled visit: a
 * `{ value }` box ends the walk with that value, anything else goes on. Resolves with the box value, or `undefined` when
 * the items ran out; rejects with the first rejection or throw, after closing the iterator.
 */
const walk = (items, visit, decide) => new Promise((resolve, reject) => {
  const iterator = items[Symbol.iterator]();
  let index = 0;
  const fail = (error) => {
    try { close(iterator); } catch { /* the failure being reported wins, as it does in a for...of */ }
    reject(error);
  };
  const stop = (value) => {
    try { close(iterator); } catch (error) { reject(error); return; }
    resolve(value);
  };
  const advance = () => {
    let step, pending;
    try {
      step = iterator.next();
      if (step.done) { resolve(undefined); return; }
      pending = visit(step.value, index++);
    } catch (error) {
      if (step === undefined || step.done) reject(error); else fail(error);
      return;
    }
    Promise.resolve(pending).then((outcome) => {
      let box;
      try { box = decide(outcome, step.value); } catch (error) { fail(error); return; }
      if (box) stop(box.value); else advance();
    }, fail);
  };
  advance();
});

const never = () => undefined;

/** `for (const x of items) await fn(x, index)`: resolves undefined once every item has run, one at a time. */
export const eachInOrder = (items, fn) => walk(items, fn, never);

/** The sequential map: `fn(x, index)` for each item in turn, resolving the results in item order. */
export const mapInOrder = (items, fn) => {
  const results = [];
  return walk(items, fn, (outcome) => { results.push(outcome); }).then(() => results);
};

/** The first item whose `predicate(x, index)` resolves truthy (undefined when none); later items never run. */
export const findInOrder = (items, predicate) => walk(items, predicate, (outcome, item) => (outcome ? { value: item } : undefined));

/**
 * `for (;;) await step(attempt)`: `step(attempt)` runs again, after the previous run settled, until it resolves
 * something other than undefined; that value (null included) is the result. A poll or retry returns undefined to go
 * on and its answer to stop. `attempt` counts from 0.
 */
export const repeatInOrder = (step) => walk(forever(), step, (outcome) => (outcome === undefined ? undefined : { value: outcome }));

function* forever() {
  for (let attempt = 0; ; attempt++) yield attempt;
}
