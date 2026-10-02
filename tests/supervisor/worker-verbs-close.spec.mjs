// worker-verbs-close.spec.mjs - full-close proof mapping over the one closeWorker seam.
import test from 'node:test';
import assert from 'node:assert/strict';
import { workerCloseVerb } from '../../scripts/supervisor/worker-verbs-close.mjs';

test('worker close forwards recovery flags and succeeds only with every proof', async () => {
  let call;
  const result = await workerCloseVerb({ env: {}, args: { dispatch: 'ctx_1', 'stop-first': true, 'retry-release': true } }, {
    closeWorker: (input) => { call = input; return { ok: true, handle: 'term_1', closed: { ok: true }, processes: { verdict: 'none' } }; },
  });
  assert.deepEqual({ dispatch: call.dispatch, stopFirst: call.stopFirst, retryRelease: call.retryRelease },
    { dispatch: 'ctx_1', stopFirst: true, retryRelease: true });
  assert.equal(result.code, 0);
  assert.deepEqual([result.data.released, result.data.terminalClosed, result.data.processGone], [true, true, true]);
});

test('worker close exits one when a process remains alive', async () => {
  const result = await workerCloseVerb({ args: { dispatch: 'ctx_live' } }, {
    closeWorker: () => ({ ok: true, handle: 'term_live', closed: { ok: true }, processes: { verdict: 'survived', survivors: [{ pid: 42 }] } }),
  });
  assert.equal(result.code, 1);
  assert.equal(result.data.processGone, false);
  assert.match(result.text, /process exit/);
});

test('worker close exits one when terminal-close proof is missing despite release', async () => {
  const result = await workerCloseVerb({ args: { dispatch: 'ctx_open' } }, {
    closeWorker: () => ({ ok: true, handle: 'term_open', closed: { ok: false }, processes: { verdict: 'none' } }),
  });
  assert.equal(result.code, 1);
  assert.equal(result.data.released, true);
  assert.equal(result.data.terminalClosed, false);
});
