import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { request } from '../../scripts/api/http/request.mjs';
import { connectPost } from '../../scripts/api/windsurf/lib.mjs';

const get = (options, allow) => new Promise((resolve, reject) => {
  const req = request({ method: 'GET', path: '/', ...options }, (res) => { res.resume(); res.on('end', () => resolve(res.statusCode)); }, allow);
  req.on('error', reject);
  req.end();
});

test('request sends to loopback and to a declared host', async (t) => {
  const server = http.createServer((req, res) => res.end('ok'));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const { port } = server.address();
  assert.equal(await get({ host: '127.0.0.1', port }, 'loopback'), 200);
  assert.equal(await get({ host: '127.0.0.1', port }, { hosts: ['127.0.0.1'] }), 200);
});

test('request refuses a target outside its declared policy before anything is sent', () => {
  const sink = () => {};
  const refused = (options, allow) => assert.throws(() => request(options, sink, allow), { code: 'URL_TARGET_REFUSED' }, JSON.stringify([options, allow]));
  refused({ host: '127.0.0.1', port: 80 }, undefined);
  refused({ host: '127.0.0.1', port: 80 }, 'anywhere');
  refused({ host: '127.0.0.1', port: 80 }, { hosts: [] });
  refused({ host: 'evil.example', port: 80 }, 'loopback');
  refused({ host: '127.0.0.1.evil.example', port: 80 }, 'loopback');
  refused({ host: 'localhost@evil.example', port: 80 }, 'loopback');
  refused({ host: '10.0.0.5', port: 80 }, 'loopback');
  refused({ host: '127.0.0.1', port: 80, auth: 'user:pass' }, 'loopback');
  refused({ host: '127.0.0.1', port: 99999 }, 'loopback');
  refused({ host: '127.0.0.1', port: 'x' }, 'loopback');
  refused({ host: '127.0.0.1', port: 80, protocol: 'file:' }, 'loopback');
  refused({ host: 'other.example', port: 80 }, { hosts: ['api.example'] });
  refused({ host: undefined, port: 80 }, 'loopback');
});

test('the seat API runner sends only to a seat host over https or to a loopback server, and follows no redirect', async (t) => {
  for (const endpoint of ['https://evil.example/x', 'http://server.codeium.com/x', 'https://server.codeium.com.evil.example/x', 'https://user:pw@server.codeium.com/x', 'http://10.0.0.5/x', 'file:///etc/passwd', 'not a url', undefined]) {
    const r = await connectPost(endpoint, {}, 1000);
    assert.equal(r.status, 0, String(endpoint));
    assert.match(r.error, /URL_TARGET_REFUSED/, String(endpoint));
  }
  let hits = 0;
  const target = http.createServer((req, res) => { hits += 1; res.end('{}'); });
  const hop = http.createServer((req, res) => { res.writeHead(302, { location: `http://127.0.0.1:${target.address().port}/` }); res.end(); });
  for (const s of [target, hop]) await new Promise((resolve) => s.listen(0, '127.0.0.1', resolve));
  t.after(() => { target.close(); hop.close(); });
  const redirected = await connectPost(`http://127.0.0.1:${hop.address().port}/x`, {}, 3000);
  assert.equal(redirected.status, 0, 'a redirect is an error, not followed');
  assert.equal(hits, 0);
  const direct = await connectPost(`http://127.0.0.1:${target.address().port}/x`, {}, 3000);
  assert.equal(direct.status, 200);
  assert.equal(hits, 1);
});
