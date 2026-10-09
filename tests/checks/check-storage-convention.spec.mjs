// RT_STORAGE_UNDECLARED: every text column of both stores has a class (the storage convention: content is a blob under the runtime state dir, a row holds the reference).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { storageFindings, checkStorageConvention, textColumnsOf, REGISTRY_FILE } from '../../scripts/checks/check-storage-convention.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { withLedger } from '../helpers/ledger-fixture.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const registry = () => parseYaml(fs.readFileSync(path.join(ROOT, REGISTRY_FILE), 'utf8'));
const classes = { scalar: 'x', bounded: 'x', reference: 'x', spill: 'x', migrate: 'x' };

test('RT_STORAGE_UNDECLARED: a new column, a stale declaration, an unknown class and a migrate mismatch are each a finding (violating)', () => {
  const actual = { ledger: { jobs: ['job_id', 'payload_json', 'brand_new'] } };
  const declared = { ledger: { jobs: { job_id: 'scalar', payload_json: 'weird', gone: 'scalar' } } };
  const messages = storageFindings({ declared, classes, migrations: [] }, actual).map((f) => f.message).join('\n');
  assert.match(messages, /ledger\.jobs\.brand_new is a text column with no class/);
  assert.match(messages, /ledger\.jobs\.payload_json has the unknown class weird/);
  assert.match(messages, /ledger\.jobs\.gone is declared but is no text column/);
  const mismatch = storageFindings({ declared: { ledger: { t: { a: 'migrate', b: 'scalar' } } }, classes, migrations: [{ column: 'ledger.t.b' }] }, { ledger: { t: ['a', 'b'] } });
  assert.equal(mismatch.length, 2, 'migrate without a migrations entry, and a migrations entry without class migrate');
});

test('RT_STORAGE_UNDECLARED: the stores of this runtime declare every text column (passing), and the class of each family of tables is the convention\'s', () => {
  assert.deepEqual(checkStorageConvention(), []);
  const { columns } = registry();
  assert.equal(columns.ledger.events.payload_json, 'spill', 'event payloads go through the one spill path');
  assert.equal(columns.machine.sup_events.payload_json, 'spill');
  for (const [table, column] of [['blobs', 'file_uri'], ['events', 'payload_sha']]) assert.equal(columns.ledger[table][column], 'reference', `${table}.${column} holds the reference`);
});

test('a ledger opened from the code has the text columns the introspection reads', (t) => withLedger(t, ({ ledger }) => {
  const columns = textColumnsOf(ledger.db);
  assert.ok(columns.events.includes('payload_json') && columns.contracts.includes('markdown'));
  assert.ok(!Object.keys(columns).some((table) => table.includes('fts')));
}));
