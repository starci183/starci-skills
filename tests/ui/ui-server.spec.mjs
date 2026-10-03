import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { startHarnessServer } from '../../ui/server.mjs';

test('ui/server.mjs serves through scripts/api/http/serve.mjs on 127.0.0.1 with its security headers', async (t) => {
  const running = startHarnessServer({ port: 0, env: process.env });
  t.after(() => running.close());
  if (!running.server.listening) await once(running.server, 'listening');
  const { port } = running.server.address();
  const r = await fetch(`http://127.0.0.1:${port}/no-such-asset.js`);
  await r.arrayBuffer();
  assert.equal(r.status, 404, 'a file outside ui/dist is not served');
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(r.headers.get('referrer-policy'), 'no-referrer');
});
