import assert from 'node:assert/strict';
import test from 'node:test';
import {
  harnessOpenVerb,
  harnessStartVerb,
  harnessStatusVerb,
  harnessStopVerb,
} from '../../ui/harness-verbs.mjs';

const ctx = (args = {}) => ({ args, env: {}, now: 123, io: { stdout: () => {}, stderr: () => {} } });

test('start maps child failure to code one and streams the selected URL once', async () => {
  let output = '';
  const result = await harnessStartVerb({ ...ctx({ tunnel: true }), io: { stdout: (text) => { output += text; }, stderr: () => {} } }, {
    harnessUrl: async ({ tunnel }) => tunnel ? 'https://harness.example' : 'http://127.0.0.1:4547',
    startHarness: ({ tunnel, env, now }) => {
      assert.equal(tunnel, true);
      assert.deepEqual(env, {});
      assert.equal(now, 123);
      return { done: Promise.resolve({ code: 7 }) };
    },
  });
  assert.deepEqual(result, { code: 1 });
  assert.equal(output, 'StarCi harness: https://harness.example\n');
});

test('stop, status and open preserve their human and machine result shapes', async () => {
  const stop = await harnessStopVerb(ctx(), {
    stopHarness: () => ({ ok: true, action: 'stopped', stopped: [{ mode: 'app', pid: 42 }], stale: [], refused: [] }),
  });
  assert.equal(stop.code, 0);
  assert.equal(stop.text, 'harness stopped: app pid 42');
  assert.equal(stop.data.action, 'stopped');

  const status = await harnessStatusVerb(ctx(), {
    harnessStatus: async () => ({ ok: true, running: true, url: 'http://127.0.0.1:4547', status: 200 }),
  });
  assert.equal(status.text, 'harness UP: http://127.0.0.1:4547');
  assert.equal(status.data.status, 200);

  const open = await harnessOpenVerb(ctx(), {
    openHarness: async () => ({ ok: false, url: 'http://127.0.0.1:4547', error: 'blocked' }),
  });
  assert.equal(open.code, 1);
  assert.match(open.stderr, /could not open .*blocked/);
});
