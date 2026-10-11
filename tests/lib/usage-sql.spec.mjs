// usage-sql.mjs: the one spelling of "every token the models handled" over an llm_usage row.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { usageTokensSql } from '../../scripts/lib/usage-sql.mjs';

test('the sum covers input, output, cache read and cache write, a missing column counting as zero, with or without a table alias', () => {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE llm_usage (input_tokens INTEGER, output_tokens INTEGER, cache_read_tokens INTEGER, cache_write_tokens INTEGER)');
  db.exec('INSERT INTO llm_usage VALUES (1, 2, 4, 8), (16, NULL, NULL, NULL)');
  assert.deepEqual(db.prepare(`SELECT ${usageTokensSql()} AS tokens FROM llm_usage`).all().map((row) => row.tokens), [15, 16]);
  assert.equal(db.prepare(`SELECT sum(${usageTokensSql('u.')}) AS tokens FROM llm_usage u`).get().tokens, 31);
  db.close();
});
