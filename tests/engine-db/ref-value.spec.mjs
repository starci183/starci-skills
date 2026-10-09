// The reader half of the storage convention (modules/schemas/storage-convention.yaml): a column holds the content inline (every row written before the convention) or a reference to
// it in the blob store, and every handle either store opens returns the content whichever shape the row has, byte for byte. Nothing writes a reference yet: the writers and the
// row migration come after the readers (the readers ship alone, so a store written by a later runtime is readable by this one).
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { isRef, refOf, parseRef, resolveValue, putContent, installRefResolver } from '../../engine/db/ref-value.mjs';
import { putBlob } from '../../engine/db/blob.mjs';
import { openLedger, openLedgerReader } from '../../engine/db/ledger.mjs';
import { openMachine, openMachineReader } from '../../engine/db/machine.mjs';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-ref-value-'));
after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
const big = 'é'.repeat(5000) + '\n{"x":1}';
const stored = (text) => refOf(putBlob(Buffer.from(text, 'utf8'), { mediaType: 'text/plain' }).sha, Buffer.byteLength(text, 'utf8'));

test('a reference names its blob and resolves to the exact content; a plain value, a lookalike and null pass through', () => {
  const ref = stored(big);
  assert.ok(isRef(ref));
  JSON.parse(ref); // a reference is valid JSON: it passes a column's json_valid check
  assert.equal(parseRef(ref).bytes, Buffer.byteLength(big, 'utf8'));
  assert.equal(resolveValue(ref), big, 'byte for byte, multi-byte characters included');
  for (const plain of ['{"a":1}', 'ref:abc', String.raw`"\u0001ref:abc"`, '"quoted"', '', null, 7]) assert.equal(resolveValue(plain), plain);
  assert.equal(parseRef(String.raw`"\u0001ref:not-a-sha:3"`), null);
});

test('putContent keeps a value that fits inline and puts a longer one in the blob store whole', () => {
  assert.equal(putContent('short', { bound: 1024 }), 'short');
  const ref = putContent(big, { bound: 1024 });
  assert.ok(isRef(ref));
  assert.equal(resolveValue(ref), big);
  assert.equal(putContent(null, { bound: 10 }), null);
});

test('a handle with the resolver returns the content for get, all and iterate, and leaves the other statement methods alone', () => {
  const db = installRefResolver(new DatabaseSync(path.join(dir, 'plain.sqlite')));
  db.exec('CREATE TABLE t (id INTEGER PRIMARY KEY, body TEXT, n INTEGER)');
  const insert = db.prepare('INSERT INTO t(body,n) VALUES(?,?)');
  insert.run(stored(big), 1);
  insert.run('inline', 2);
  assert.equal(db.prepare('SELECT body FROM t WHERE n=1').get().body, big);
  assert.deepEqual(db.prepare('SELECT body FROM t ORDER BY n').all().map((r) => r.body), [big, 'inline']);
  assert.deepEqual([...db.prepare('SELECT body FROM t ORDER BY n').iterate()].map((r) => r.body), [big, 'inline']);
  assert.equal(db.prepare('SELECT count(*) AS n FROM t').get().n, 2);
  assert.equal(installRefResolver(db), db, 'installing twice changes nothing');
  db.close();
});

test('the product ledger and machine.sqlite handles, writer and reader, resolve a reference in a column they hold', () => {
  const ledger = openLedger({ file: path.join(dir, 'runtime.sqlite') });
  const machine = openMachine({ file: path.join(dir, 'machine.sqlite') });
  machine.db.prepare('INSERT INTO machine_logs(at,actor,level,kind,msg,data_json) VALUES(?,?,?,?,?,?)').run(1, 'harness', 'info', 'spec.ref', 'm', stored(big));
  try {
    assert.equal(machine.db.prepare("SELECT data_json FROM machine_logs WHERE kind='spec.ref'").get().data_json, big);
  } finally { machine.close(); ledger.close(); }
  const reader = openMachineReader({ file: path.join(dir, 'machine.sqlite') });
  try { assert.equal((reader.db ?? reader).prepare("SELECT data_json FROM machine_logs WHERE kind='spec.ref'").get().data_json, big); } finally { reader.close(); }
  const ledgerReader = openLedgerReader(path.join(dir, 'runtime.sqlite'));
  try { assert.ok(ledgerReader.prepare('SELECT 1 AS one').get().one === 1); } finally { ledgerReader.close(); }
});
