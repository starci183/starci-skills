import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const freePort = async () => {
  const s = net.createServer();
  await new Promise((resolve) => s.listen(0, '127.0.0.1', resolve));
  const { port } = s.address();
  await new Promise((resolve) => s.close(resolve));
  return port;
};

test('ui/server.mjs serves through scripts/api/http/serve.mjs on 127.0.0.1 with its security headers', async (t) => {
  const port = await freePort();
  const child = spawn(process.execPath, [path.join(ROOT, 'ui', 'server.mjs')], { cwd: path.join(ROOT, 'ui'), env: { ...process.env, STARCI_STATUS_PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  t.after(() => { try { child.kill(); } catch { /* gone */ } });
  let out = '';
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`server did not start: ${out}`)), 30_000);
    child.stdout.on('data', (d) => { out += d; if (out.includes(`http://127.0.0.1:${port}`)) { clearTimeout(timer); resolve(); } });
    child.stderr.on('data', (d) => { out += d; });
    child.once('exit', (code) => { clearTimeout(timer); reject(new Error(`server exited ${code}: ${out}`)); });
  });
  const r = await fetch(`http://127.0.0.1:${port}/no-such-asset.js`);
  await r.arrayBuffer();
  assert.equal(r.status, 404, 'a file outside ui/dist is not served');
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(r.headers.get('referrer-policy'), 'no-referrer');
});
