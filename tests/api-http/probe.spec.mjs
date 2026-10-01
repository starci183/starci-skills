import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import { probe } from '../../scripts/api/http/probe.mjs';

const listen = async (t, handler) => {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => { server.closeAllConnections?.(); server.close(resolve); }));
  return `http://127.0.0.1:${server.address().port}`;
};

test('probe follows redirects by default, as fetch did: a 302 chain answers with the final status and URL', async (t) => {
  const seen = [];
  const origin = await listen(t, (req, res) => {
    seen.push(`${req.method} ${req.url}`);
    if (req.url === '/healthz') { res.writeHead(302, { location: '/healthz/' }); res.end(); return; }
    if (req.url === '/healthz/') { res.writeHead(301, { location: '/ok' }); res.end(); return; }
    res.writeHead(200); res.end('ok');
  });
  const r = await probe(`${origin}/healthz`, { timeoutMs: 3000 });
  assert.equal(r.state, 'answered');
  assert.equal(r.status, 200);
  assert.equal(r.url, `${origin}/ok`);
  assert.deepEqual(seen, ['GET /healthz', 'GET /healthz/', 'GET /ok']);
});

test('follow: 0 answers the redirect itself; a 307 keeps the method and body; a 303 turns a POST into a GET', async (t) => {
  const seen = [];
  const origin = await listen(t, (req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; }).on('end', () => {
      seen.push(`${req.method} ${req.url} ${body}`);
      if (req.url === '/keep') { res.writeHead(307, { location: '/kept' }); res.end(); return; }
      if (req.url === '/see') { res.writeHead(303, { location: '/seen' }); res.end(); return; }
      res.writeHead(200); res.end();
    });
  });
  const manual = await probe(`${origin}/keep`, { timeoutMs: 3000, follow: 0 });
  assert.deepEqual([manual.state, manual.status, manual.headers.location], ['answered', 307, '/kept']);
  seen.length = 0;
  await probe(`${origin}/keep`, { method: 'POST', body: '{"a":1}', timeoutMs: 3000 });
  await probe(`${origin}/see`, { method: 'POST', body: '{"a":1}', timeoutMs: 3000 });
  assert.deepEqual(seen, ['POST /keep {"a":1}', 'POST /kept {"a":1}', 'POST /see {"a":1}', 'GET /seen ']);
});

test('a redirect loop stops at the follow limit and answers the last redirect', async (t) => {
  const origin = await listen(t, (req, res) => { res.writeHead(302, { location: req.url }); res.end(); });
  const r = await probe(`${origin}/loop`, { timeoutMs: 3000, follow: 3 });
  assert.deepEqual([r.state, r.status], ['answered', 302]);
});

test('refused is down, an accepted connection that never answers is hung, a bad URL is an error', async (t) => {
  const free = net.createServer();
  await new Promise((resolve) => free.listen(0, '127.0.0.1', resolve));
  const deadPort = free.address().port;
  await new Promise((resolve) => free.close(resolve));
  assert.equal((await probe(`http://127.0.0.1:${deadPort}/`, { timeoutMs: 2000 })).state, 'down');
  const sockets = [];
  const hung = net.createServer((s) => sockets.push(s));
  await new Promise((resolve) => hung.listen(0, '127.0.0.1', resolve));
  try {
    assert.equal((await probe(`http://127.0.0.1:${hung.address().port}/`, { timeoutMs: 500 })).state, 'hung');
  } finally {
    for (const s of sockets) s.destroy();
    await new Promise((resolve) => hung.close(resolve));
  }
  assert.deepEqual(await probe('not a url'), { state: 'error', code: 'URL_INVALID' });
});
