// The shipped @tools/host: loopback only, first free port from 60000, a receipt with every page.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { start, HOST, PORT_RANGE } from './host-artifacts.mjs';

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
