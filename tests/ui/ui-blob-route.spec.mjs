import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Writable } from 'node:stream';
import { DatabaseSync } from 'node:sqlite';
import { putBlob, ARTIFACT_ROOT_ENV } from '../../engine/db/blob.mjs';
import { blob } from '../../ui/api/routes/blob.mjs';

function sink() {
  const chunks = [];
  const response = new Writable({ write(chunk, _encoding, callback) { chunks.push(Buffer.from(chunk)); callback(); } });
  const finished = new Promise(resolve => response.on('finish', resolve));
  response.writeHead = (status, headers) => { response.status = status; response.headers = headers; };
  const end = response.end.bind(response);
  response.end = body => { if (body) chunks.push(Buffer.from(body)); end(); };
  return { response, chunks, finished };
}
async function fetchBlob(store, sha, { method = 'GET', headers = {}, query = '' } = {}) {
  const { response, chunks, finished } = sink();
  await blob({ method, headers }, response, store, new URL(`http://fixture/api/blob/${sha}${query}`), sha);
  await Promise.race([finished, new Promise(resolve => setTimeout(resolve, 300))]);
  return { status: response.status, headers: response.headers, body: Buffer.concat(chunks).toString('utf8') };
}

function world(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-blob-route-'));
  process.env[ARTIFACT_ROOT_ENV] = root;
  t.after(() => { delete process.env[ARTIFACT_ROOT_ENV]; fs.rmSync(root, { recursive: true, force: true }); });
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  db.exec('CREATE TABLE blobs(sha256 TEXT,media_type TEXT,redaction TEXT,archived_at INTEGER,archive_ref TEXT)');
  const insert = db.prepare('INSERT INTO blobs VALUES(?,?,?,?,?)');
  const add = (bytes, mediaType, redaction) => {
    const { sha } = putBlob(Buffer.from(bytes), { mediaType });
    insert.run(sha, mediaType, redaction, null, null);
    return sha;
  };
  return { store: { machine: { db }, forEachLedger: () => [{ result: null }] }, add, insert };
}

test('blob route refuses malformed, unknown, archived and byte-less identifiers', async t => {
  const { store, insert } = world(t);
  assert.equal((await fetchBlob(store, 'xyz')).status, 400);
  assert.equal((await fetchBlob(store, 'a'.repeat(64))).status, 404);
  insert.run('b'.repeat(64), 'text/plain', 'v1', 5, JSON.stringify({ at: 'cold' }));
  const archived = await fetchBlob(store, 'b'.repeat(64));
  assert.equal(archived.status, 410);
  assert.equal(JSON.parse(archived.body).error.code, 'ARCHIVED');
  assert.equal((await fetchBlob(store, 'b'.repeat(64), { method: 'HEAD' })).body, '');
  insert.run('c'.repeat(64), 'text/plain', 'v1', null, null);
  const unavailable = await fetchBlob(store, 'c'.repeat(64));
  assert.equal(unavailable.status, 404);
  assert.equal(JSON.parse(unavailable.body).error.message, 'Blob bytes unavailable');
});

test('a marked binary blob serves whole, ranged, suffix-ranged, conditional and HEAD responses', async t => {
  const { store, add } = world(t);
  const sha = add('0123456789abcdefghij', 'application/octet-stream', 'v1');
  const whole = await fetchBlob(store, sha);
  assert.equal(whole.status, 200);
  assert.equal(whole.body, '0123456789abcdefghij');
  assert.equal(whole.headers['Content-Length'], 20);
  assert.equal(whole.headers.ETag, `"${sha}"`);
  assert.equal(whole.headers['Accept-Ranges'], 'bytes');
  assert.equal(whole.headers['Cache-Control'], 'public, max-age=31536000, immutable');
  assert.equal(whole.headers['Content-Range'], undefined);
  const part = await fetchBlob(store, sha, { headers: { range: 'bytes=2-5' } });
  assert.deepEqual([part.status, part.body, part.headers['Content-Range'], part.headers['Content-Length']], [206, '2345', 'bytes 2-5/20', 4]);
  const suffix = await fetchBlob(store, sha, { headers: { range: 'bytes=-4' } });
  assert.deepEqual([suffix.status, suffix.body, suffix.headers['Content-Range']], [206, 'ghij', 'bytes 16-19/20']);
  const open = await fetchBlob(store, sha, { headers: { range: 'bytes=15-' } });
  assert.deepEqual([open.status, open.body, open.headers['Content-Range']], [206, 'fghij', 'bytes 15-19/20']);
  const clamped = await fetchBlob(store, sha, { headers: { range: 'bytes=18-999' } });
  assert.deepEqual([clamped.status, clamped.body], [206, 'ij']);
  for (const range of ['bytes=5-2', 'bytes=20-', 'bytes=-0', 'bytes=-', 'junk']) {
    const refused = await fetchBlob(store, sha, { headers: { range } });
    assert.equal(refused.status, 416, range);
    assert.equal(refused.headers['Content-Range'], 'bytes */20', range);
    assert.equal(refused.body, '', range);
  }
  const conditional = await fetchBlob(store, sha, { headers: { 'if-none-match': `"${sha}"` } });
  assert.deepEqual([conditional.status, conditional.body], [304, '']);
  const head = await fetchBlob(store, sha, { method: 'HEAD', headers: { range: 'bytes=1-3' } });
  assert.deepEqual([head.status, head.body, head.headers['Content-Range']], [206, '', 'bytes 1-3/20']);
  assert.equal((await fetchBlob(store, sha, { query: '?download=1' })).headers['Content-Disposition'], `attachment; filename="${sha}.txt"`);
});

test('unmarked text is redacted on read and marked text keeps its bytes', async t => {
  const { store, add } = world(t);
  const unmarked = add('token password=hunter2hunter2 line1\nline2\n', 'text/plain', null);
  const streamed = await fetchBlob(store, unmarked);
  assert.equal(streamed.status, 200);
  assert.equal(streamed.body, 'token [redacted] line1\nline2\n');
  assert.equal(streamed.headers['X-StarCi-Redacted'], 'stream-v1');
  assert.equal(streamed.headers['Cache-Control'], 'no-store');
  assert.equal(streamed.headers['Content-Length'], undefined);
  assert.equal(streamed.headers.ETag, undefined);
  assert.equal(streamed.headers['Content-Type'], 'text/plain; charset=utf-8');
  const ranged = await fetchBlob(store, unmarked, { headers: { range: 'bytes=0-4' } });
  assert.deepEqual([ranged.status, ranged.body, ranged.headers['Content-Range']], [206, 'token', 'bytes 0-4/29']);
  const sized = await fetchBlob(store, unmarked, { method: 'HEAD' });
  assert.equal(sized.headers['Content-Length'], 29);
  const clean = add('hello\nworld\n', 'text/plain', 'v1');
  const marked = await fetchBlob(store, clean);
  assert.equal(marked.body, 'hello\nworld\n');
  assert.equal(marked.headers['X-StarCi-Redacted'], undefined);
  assert.equal(marked.headers.ETag, `"${clean}"`);
});

test('text previews return head or tail lines and refuse non-text and unknown modes', async t => {
  const { store, add } = world(t);
  const text = add('one\ntwo\nthree\nfour\nfive\n', 'text/plain', 'v1');
  const head = await fetchBlob(store, text, { query: '?text=head&lines=2' });
  assert.deepEqual([head.status, head.body, head.headers['Content-Type']], [200, 'one\ntwo', 'text/plain; charset=utf-8']);
  const tail = await fetchBlob(store, text, { query: '?text=tail&lines=2' });
  assert.equal(tail.body, 'five\n');
  const invalid = await fetchBlob(store, text, { query: '?text=middle' });
  assert.deepEqual([invalid.status, JSON.parse(invalid.body).error.code], [400, 'INVALID_PREVIEW']);
  const binary = add('binary', 'application/octet-stream', 'v1');
  const refused = await fetchBlob(store, binary, { query: '?text=head' });
  assert.deepEqual([refused.status, JSON.parse(refused.body).error.code], [400, 'NOT_TEXT']);
  const large = add('x'.repeat(1024 * 1024 + 10), 'text/plain', null);
  const tooLarge = await fetchBlob(store, large, { query: '?text=head' });
  assert.deepEqual([tooLarge.status, JSON.parse(tooLarge.body).error.code], [413, 'PREVIEW_TOO_LARGE']);
});
