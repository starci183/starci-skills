import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { guardWrites } from '../../engine/db/authorizer.mjs';

test('guardWrites fences a connection to the named tables: no schema change, no foreign write, deletes only where admitted', (t) => {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  db.exec('CREATE TABLE logs (id INTEGER PRIMARY KEY, msg TEXT); CREATE TABLE jobs (id INTEGER PRIMARY KEY); CREATE TABLE logs_fts_data (id INTEGER PRIMARY KEY)');
  if (!guardWrites(db, { writable: ['logs', 'logs_fts_data'], deletable: (table) => table.startsWith('logs_fts') })) { t.skip('this node:sqlite has no setAuthorizer'); return; }
  db.prepare('INSERT INTO logs (msg) VALUES (?)').run('kept');
  db.prepare('UPDATE logs SET msg = ?').run('updated');
  db.prepare('INSERT INTO logs_fts_data (id) VALUES (1)').run();
  db.prepare('DELETE FROM logs_fts_data').run();
  assert.equal(db.prepare('SELECT msg FROM logs').get().msg, 'updated', 'reads and the writable tables pass');
  assert.throws(() => db.prepare('INSERT INTO jobs (id) VALUES (1)'), /not authorized/i);
  assert.throws(() => db.prepare('DELETE FROM logs'), /not authorized/i);
  assert.throws(() => db.prepare('CREATE TABLE x (id INTEGER)'), /not authorized/i);
});

test('guardWrites fences nothing on a connection without setAuthorizer', () => {
  assert.equal(guardWrites({}), false);
});
