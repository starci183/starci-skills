// worker-verbs.spec.mjs - read/show/stop/release wrappers use only their injectable Orca call files.
import test from 'node:test';
import assert from 'node:assert/strict';
import { workerReadVerb, workerReleaseVerb, workerShowVerb, workerStopVerb } from '../../scripts/supervisor/worker-verbs.mjs';

test('worker show maps Orca state and observation', async () => {
  const result = await workerShowVerb({ args: { dispatch: 'ctx_1' } }, { workerShow: () => ({ ok: true, state: 'ready',
    result: { observation: { status: 'live' } } }) });
  assert.equal(result.code, 0);
  assert.deepEqual([result.data.state, result.data.liveness], ['ready', 'live']);
});

test('worker read defaults to 80 lines and returns the bounded rows', async () => {
  let call;
  const result = await workerReadVerb({ args: { dispatch: 'ctx_1' } }, { workerRead: (input) => {
    call = input;
    return { ok: true, source: 'terminal', rows: ['one', 'two'], contentComplete: false, clipping: ['tail'] };
  } });
  assert.deepEqual(call, { dispatch: 'ctx_1', source: 'auto', limit: 80 });
  assert.equal(result.text, 'one\ntwo');
});

test('worker stop refuses a settled worker and stops a working one', async () => {
  let stopped = false;
  const settled = await workerStopVerb({ args: { dispatch: 'ctx_done' } }, { workerShow: () => ({ ok: true, state: 'succeeded' }),
    workerStop: () => { stopped = true; } });
  assert.equal(settled.code, 2);
  assert.equal(stopped, false);
  const active = await workerStopVerb({ args: { dispatch: 'ctx_live' } }, { workerShow: () => ({ ok: true, state: 'working' }),
    workerStop: () => ({ ok: true, state: 'stopped', result: {} }) });
  assert.equal(active.code, 0);
});

test('worker release retains the normal-close warning', async () => {
  const result = await workerReleaseVerb({ args: { dispatch: 'ctx_1' } }, { workerRelease: () => ({ ok: true, state: 'released' }) });
  assert.equal(result.code, 0);
  assert.match(result.text, /worker close/);
});
