import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { handleHost } from '../../ui/api/routes/host.mjs';

const serveHost = async (t) => {
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    if (!(await handleHost(request, response, {}, url))) { response.writeHead(404); response.end(); }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => { server.closeAllConnections?.(); server.close(resolve); }));
  return `http://127.0.0.1:${server.address().port}`;
};
const read = async (url) => { const r = await fetch(url); return { status: r.status, body: r.status === 200 ? await r.json() : null }; };

test('GET /api/host answers the host view; the PowerShell and nvidia-smi reads fill it in the background', async (t) => {
  const origin = await serveHost(t);
  assert.equal((await read(`${origin}/api/other`)).status, 404, 'another path is not the host route');
  let view = (await read(`${origin}/api/host`)).body.data;
  assert.equal(typeof view.cpu.cores, 'number');
  assert.ok(Array.isArray(view.gpus) && Array.isArray(view.disks));
  if (process.platform !== 'win32') return;
  // The disk read goes through scripts/api/process/run-powershell-async.mjs; every fixed disk shows up once it lands.
  const until = Date.now() + 30_000;
  while (!view.disks.length && Date.now() < until) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    view = (await read(`${origin}/api/host`)).body.data;
  }
  assert.ok(view.disks.length > 0, 'the PowerShell disk read answered');
  for (const disk of view.disks) assert.ok(disk.mount && disk.totalGb > 0);
});
