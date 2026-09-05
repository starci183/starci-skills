// The shipped @tools/host: loopback only, first free port from 60000, a receipt with every page, and a
// stop the receipt survives on every platform.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { EventEmitter } from 'node:events';
import { start, listen, requestStop, stopMarker, HOST, PORT_RANGE } from './host-artifacts.mjs';

test('unavailable ports keep the bounded host search alive without leaving event listeners', async () => {
  const server = new EventEmitter();
  const attempts = [];
  server.listen = ({ port, host, exclusive }) => {
    attempts.push(port);
    assert.equal(host, HOST);
    assert.equal(exclusive, true);
    queueMicrotask(() => {
      if (attempts.length === 1) server.emit('error', Object.assign(new Error('excluded'), { code: 'EACCES' }));
      else if (attempts.length === 2) server.emit('error', Object.assign(new Error('raced'), { code: 'EADDRINUSE' }));
      else server.emit('listening');
    });
    return server;
  };
  const port = await listen(server);
  assert.equal(attempts.length, 3);
  assert.ok(port > attempts[0] && port <= PORT_RANGE.last);
  assert.equal(server.listenerCount('error'), 0);
  assert.equal(server.listenerCount('listening'), 0);
});

test('serves a folder on 127.0.0.1 from the 60000 range, records host.json and stops cleanly', async () => {
  const folder = mkdtempSync(path.join(tmpdir(), 'host-'));
  writeFileSync(path.join(folder, 'candidate-a.html'), '<!doctype html><title>a</title>');
  writeFileSync(path.join(folder, 'candidate-b.html'), '<!doctype html><title>b</title>');
  const first = await start(folder);
  const second = await start(folder, path.join(folder, 'host-2.json'));
  try {
    assert.equal(first.receipt.interface, 'loopback');
    assert.ok(first.receipt.port >= PORT_RANGE.first && first.receipt.port <= PORT_RANGE.last);
    assert.ok(second.receipt.port > first.receipt.port && second.receipt.port <= PORT_RANGE.last, 'a taken port yields a later free one');
    assert.equal(first.receipt.url, `http://${HOST}:${first.receipt.port}/`);
    assert.deepEqual(first.receipt.pages.map((p) => p.file), ['candidate-a.html', 'candidate-b.html']);
    const body = await fetch(`${first.receipt.url}candidate-b.html`).then((r) => r.text());
    assert.match(body, /<title>b<\/title>/);
    const index = await fetch(first.receipt.url).then((r) => r.text());
    assert.match(index, /candidate-a\.html/);
    const escape = await fetch(`${first.receipt.url}../host-artifacts.mjs`);
    assert.equal(escape.status, 404, 'nothing outside the folder is served');
    assert.ok(existsSync(path.join(folder, 'host.json')));
  } finally {
    first.stop(); second.stop();
    const receipt = JSON.parse(readFileSync(path.join(folder, 'host.json'), 'utf8'));
    assert.ok(receipt.stoppedAt, 'the receipt records the stop');
    rmSync(folder, { recursive: true, force: true });
  }
});

// A stop asked for from outside is honoured by the server itself, so the receipt is complete wherever
// the tree runs: a signal is a hard terminate on some platforms and leaves a receipt that reads as a
// server still running. The marker is the address; the server polls it, completes its own receipt and
// closes the port, and a stale marker from an earlier server with the same pid stops nobody.
test('a stop asked for by marker completes the receipt and frees the port', async () => {
  const folder = mkdtempSync(path.join(tmpdir(), 'host-stop-'));
  const markerDir = mkdtempSync(path.join(tmpdir(), 'host-marker-'));
  writeFileSync(path.join(folder, 'sheet.html'), '<!doctype html><title>sheet</title>');
  const stale = stopMarker(process.pid, markerDir);
  writeFileSync(stale, 'left by an earlier run\n');
  const server = await start(folder, path.join(folder, 'host.json'), { markerDir, pollMs: 20 });
  try {
    assert.equal(server.marker, stale, 'the marker is named after the pid a stopper is given');
    assert.ok(!existsSync(stale), 'a marker older than this server is removed at start');
    assert.equal((await fetch(server.receipt.url + 'sheet.html')).status, 200);
    const before = JSON.parse(readFileSync(path.join(folder, 'host.json'), 'utf8'));
    assert.equal(before.stoppedAt, undefined, 'a running server has recorded no stop');
    writeFileSync(server.marker, 'stop\n');
    for (let waited = 0; waited < 3000 && existsSync(server.marker); waited += 20) await new Promise((r) => { setTimeout(r, 20); });
    const receipt = JSON.parse(readFileSync(path.join(folder, 'host.json'), 'utf8'));
    assert.ok(receipt.stoppedAt, 'the server that holds the receipt is the one that completes it');
    assert.equal(receipt.url, before.url, 'the stopped receipt is the same record, closed');
    assert.ok(!existsSync(server.marker), 'the marker is consumed');
    await assert.rejects(() => fetch(server.receipt.url + 'sheet.html'), 'the port is free');
  } finally {
    server.stop();
    rmSync(folder, { recursive: true, force: true });
    rmSync(markerDir, { recursive: true, force: true });
  }
});

test('a stop asked for at a pid nothing runs at is reported, not faked', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'host-gone-'));
  try {
    // A pid outside the range any live process holds: the stopper reports it and writes no marker.
    assert.equal(await requestStop(0x7ffffffe, { dir, graceMs: 100, pollMs: 20 }), 'gone');
    assert.ok(!existsSync(stopMarker(0x7ffffffe, dir)));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
