import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { startHarnessServer } from '../../ui/server.mjs';
import { tempState } from '../../scripts/reconciler/testing.mjs';

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

test('server health refuses missing delivery and becomes healthy only with the actual served entry assets', async (t) => {
  const state = tempState(), distDir = path.join(state.dir, 'dist');
  fs.mkdirSync(distDir);
  const running = startHarnessServer({ port: 0, env: { ...process.env, ...state.env }, distDir });
  t.after(async () => { await running.close(); state.close(); });
  if (!running.server.listening) await once(running.server, 'listening');
  const origin = `http://127.0.0.1:${running.server.address().port}`;
  const health = async () => { const response = await fetch(`${origin}/healthz`); return { status: response.status, body: await response.json() }; };
  assert.equal((await health()).status, 503, 'a live API is not a delivered UI');
  fs.writeFileSync(path.join(distDir, 'index.html'), '<script type="module" src="/assets/main.js"></script><link rel="stylesheet" href="/assets/main.css">');
  fs.mkdirSync(path.join(distDir, 'assets'));
  fs.writeFileSync(path.join(distDir, 'assets', 'main.js'), 'export const ready = true;');
  assert.equal((await health()).status, 503, 'the declared stylesheet must be served too');
  fs.writeFileSync(path.join(distDir, 'assets', 'main.css'), 'body {}');
  const ready = await health();
  assert.equal(ready.status, 200);
  assert.equal(ready.body.data.ok, true);
  for (const asset of ['/assets/main.js', '/assets/main.css']) {
    const response = await fetch(`${origin}${asset}`);
    await response.arrayBuffer();
    assert.equal(response.status, 200);
  }
  fs.writeFileSync(path.join(distDir, 'index.html'), '<script type="module" src="https://unowned.example.org/app.js"></script>');
  assert.equal((await health()).status, 503, 'an external module is not this server\'s entry');
});
