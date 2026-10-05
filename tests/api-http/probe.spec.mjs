import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import { EventEmitter } from 'node:events';
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

test('an incomplete header trickle cannot renew the wall-clock deadline', async t => {
  const sockets = new Set(), timers = new Set();
  const server = net.createServer(socket => {
    sockets.add(socket); socket.write('HTTP/1.1 200 OK\r\nX-Trickle: ');
    const trickle = setInterval(() => socket.write('x'), 20);
    const stop = setTimeout(() => socket.destroy(), 900);
    timers.add(trickle); timers.add(stop);
    socket.on('close', () => { clearInterval(trickle); clearTimeout(stop); sockets.delete(socket); });
    socket.on('error', () => {});
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { for (const timer of timers) clearTimeout(timer); for (const socket of sockets) socket.destroy(); await new Promise(resolve => server.close(resolve)); });
  const result = await probe(`http://127.0.0.1:${server.address().port}/`, { timeoutMs: 150 });
  assert.equal(result.state, 'hung');
  assert.ok(result.ms < 700, `trickle exceeded the finite budget: ${result.ms}`);
});

const slowLookup = (t, delay) => {
  const realRequest = http.request, timers = new Set();
  t.mock.method(http, 'request', function(url, options) {
    return realRequest.call(this, url, { ...options, lookup(_name, opts, callback) {
      const timer = setTimeout(() => callback(null, ...(opts.all ? [[{ address: '127.0.0.1', family: 4 }]] : ['127.0.0.1', 4])), delay);
      timers.add(timer);
    } });
  });
  t.after(() => { for (const timer of timers) clearTimeout(timer); });
};

test('the deadline includes DNS lookup before a socket connects', async t => {
  let received = 0;
  const origin = await listen(t, (_req, res) => { received += 1; res.end('ok'); });
  slowLookup(t, 500);
  const target = origin.replace('127.0.0.1', 'private-probe.test');
  assert.equal((await probe(target, { timeoutMs: 100 })).code, 'CONNECT_TIMEOUT');
  assert.equal(received, 0, 'a timed-out lookup must not issue a later HTTP request');
});

test('redirect lookup delays share one deadline rather than starting new clocks', async t => {
  const origin = await listen(t, (req, res) => {
    const hop = Number(req.url.slice(1));
    if (hop < 3) { res.writeHead(302, { location: `/${hop + 1}` }); res.end(); }
    else res.end('ok');
  });
  slowLookup(t, 90);
  const result = await probe(`${origin.replace('127.0.0.1', 'private-chain.test')}/0`, { timeoutMs: 250 });
  assert.equal(result.state, 'down'); assert.equal(result.code, 'CONNECT_TIMEOUT');
});

test('an answered header probe destroys an endless unused response body', async t => {
  let closed;
  const close = new Promise(resolve => { closed = resolve; });
  const origin = await listen(t, (_req, res) => {
    res.writeHead(200); res.flushHeaders();
    const timer = setInterval(() => res.write('unused body'), 20);
    res.once('close', () => { clearInterval(timer); closed(true); });
  });
  assert.equal((await probe(origin, { timeoutMs: 500 })).state, 'answered');
  const safety = setTimeout(() => closed(false), 700);
  try { assert.equal(await close, true, 'the unused response body and socket must close after headers'); }
  finally { clearTimeout(safety); }
});

test('unsupported protocols and invalid bounds refuse without issuing a request', async t => {
  let calls = 0; t.mock.method(http, 'request', () => { calls += 1; throw new Error('must not issue'); });
  assert.deepEqual(await probe('file:///private'), { state: 'error', code: 'URL_PROTOCOL' });
  assert.deepEqual(await probe('http://private.test', { timeoutMs: Infinity }), { state: 'error', code: 'TIMEOUT_INVALID' });
  assert.deepEqual(await probe('http://private.test', { follow: -1 }), { state: 'error', code: 'FOLLOW_INVALID' });
  assert.equal(calls, 0);
});

test('a redirect to a non-HTTP protocol refuses before issuing that target', async t => {
  const origin = await listen(t, (_req, res) => { res.writeHead(302, { location: 'file:///private' }); res.end(); });
  assert.deepEqual(await probe(origin), { state: 'error', code: 'REDIRECT_PROTOCOL' });
});

test('an upgraded header probe owns late stream and raw-socket errors after teardown', async t => {
  const req = new EventEmitter(), res = new EventEmitter(), socket = new EventEmitter();
  socket.connecting = false; socket.pending = false; socket.destroyed = false;
  socket.destroy = () => { socket.destroyed = true; };
  res.statusCode = 101; res.headers = { upgrade: 'private-fixture' }; res.destroyed = false;
  res.destroy = () => { res.destroyed = true; };
  req.destroy = () => {}; req.write = () => {};
  req.end = () => queueMicrotask(() => { req.emit('socket', socket); req.emit('upgrade', res, socket, Buffer.alloc(0)); });
  t.mock.method(http, 'request', () => req);
  const result = await probe('http://private-upgrade.test/', { timeoutMs: 500 });
  assert.deepEqual([result.state, result.status, res.destroyed, socket.destroyed], ['answered', 101, true, true]);
  const escaped = [];
  for (const surface of [res, socket]) {
    try { surface.emit('error', new Error('private late upgrade failure')); } catch (error) { escaped.push(error.message); }
  }
  assert.deepEqual(escaped, [], 'late errors on detached upgraded transports must not escape their owner');
});
