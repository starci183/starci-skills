import test from 'node:test';
import assert from 'node:assert/strict';
import { replaceOverdueWorker } from '../../scripts/reconciler/turn-replace.mjs';

const terminal = 'term-owned-incarnation', dispatch = 'dispatch-owned';
const verified = { dispatch, ok: true, handle: terminal, closed: { ok: true, proof: 'gone' }, processes: { verdict: 'none' } };
const shown = { ok: true, dispatch: { assigneeHandle: terminal } };

test('the recorded Dispatch is freshly attested and closed only through the existing exact worker owner', () => {
  const calls = [];
  const result = replaceOverdueWorker({ terminal, agent: 'codex' }, {
    dispatchOf: handle => { calls.push(['locate', handle]); return dispatch; },
    show: input => { calls.push(['show', input]); return shown; },
    close: (id, handle) => { calls.push(['close', id, handle]); return verified; }
  });
  assert.deepEqual(calls, [['locate', terminal], ['show', { dispatch }], ['close', dispatch, terminal]]);
  assert.equal(result.ok, true);
  assert.equal(result.schema, 'starci/turn-replace@1');
  assert.equal(result.effectState, 'closed');
  assert.deepEqual(result.closure, verified);
});

test('missing locator, unavailable read and a recycled terminal never request a stop', () => {
  for (const deps of [
    { dispatchOf: () => null },
    { dispatchOf: () => { throw Error('registry unavailable'); } },
    { dispatchOf: () => dispatch, show: () => ({ ok: false, hostUnavailable: true }) },
    { dispatchOf: () => dispatch, show: () => ({ ok: true, dispatch: { assigneeHandle: 'term-new-incarnation' } }) },
    { dispatchOf: () => dispatch, show: () => ({ ok: true, result: { worker: {} } }) }
  ]) {
    const result = replaceOverdueWorker({ terminal, agent: 'codex' }, {
      ...deps, close: () => { throw Error('unattested worker must not be stopped'); }
    });
    assert.equal(result.ok, false);
    assert.equal(result.effectState, 'none');
    assert.equal(result.closure, undefined);
  }
});

test('accepted release, terminal-only closure, wrong identity and incomplete process proof retain custody', () => {
  for (const closure of [
    null, { dispatch, ok: true },
    { ...verified, dispatch: 'dispatch-new-owner' },
    { ...verified, handle: 'term-new-incarnation' },
    { ...verified, closed: { ok: true, proof: 'accepted' } },
    { ...verified, processes: { verdict: 'unverifiable' } },
    { ...verified, processes: { verdict: 'survived' } },
    { ...verified, ok: false }
  ]) {
    let closed = 0;
    const result = replaceOverdueWorker({ terminal, agent: 'claude' }, {
      dispatchOf: () => dispatch, show: () => shown, close: () => { closed += 1; return closure; }
    });
    assert.equal(closed, 1);
    assert.equal(result.ok, false);
    assert.equal(result.effectState, 'unknown');
    assert.equal(result.recoveryRequired, true);
    assert.deepEqual(result.closure, closure);
  }
});

test('a throwing close retains unknown custody rather than reporting a replacement', () => {
  const result = replaceOverdueWorker({ terminal, agent: 'devin' }, {
    dispatchOf: () => dispatch, show: () => shown, close: () => { throw Error('host response lost'); }
  });
  assert.equal(result.ok, false);
  assert.equal(result.effectState, 'unknown');
  assert.equal(result.recoveryRequired, true);
  assert.match(result.closure.error, /response lost/);
});
