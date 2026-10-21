// DB_MIGRATION_DESTRUCTIVE: a contract migration that drops a column is blocked only by a be/src source that still names that
// column together with its own table; a same-named column of another table is not a reference. Table drops keep the leaf match.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { destructiveMigrationFindings } from '../runtime/scripts/hfs/rules/database-migrations.mjs';

const MIGRATION = 'supabase/migrations/20261101000906_origin-columns_contract_drop.sql';

/** The findings of `migration` (SQL text) against be/src sources `{ path: text }` in a fresh app root. */
function judge(t, migration, sources) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-destructive-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const files = { [MIGRATION]: migration, ...sources };
  for (const [file, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  }
  return destructiveMigrationFindings({ repoRoot: root, migrations: [MIGRATION], files: Object.keys(files) });
}

const sql = (text) => `export const QUERY = ${JSON.stringify(text)};\n`;
const dropOrigin = 'alter table public.transactions drop column origin;\n';

test('a same-named column of another table is not a reference of the dropped column', (t) => {
  const findings = judge(t, dropOrigin, { 'be/src/modules/domain/brain-lessons/persistence/brain-lessons.sql.ts': sql('select public.brain_lessons.origin from public.brain_lessons') });
  assert.deepEqual(findings, []);
});

test('the same table and the same column is a reference', (t) => {
  const findings = judge(t, dropOrigin, { 'be/src/modules/domain/ledger/persistence/transactions.sql.ts': sql('select public.transactions.origin from public.transactions') });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].code, 'DB_MIGRATION_DESTRUCTIVE');
  assert.equal(findings[0].reference, 'be/src/modules/domain/ledger/persistence/transactions.sql.ts');
});

test('an unqualified column beside a mention of its table is a reference', (t) => {
  const findings = judge(t, dropOrigin, { 'be/src/modules/domain/ledger/persistence/transactions.sql.ts': sql('select origin, amount from transactions where id = $1') });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].object, 'public.transactions.origin');
});

test('a table drop still matches any source naming the table', (t) => {
  const findings = judge(t, 'drop table public.brain_lessons;\n', { 'be/src/modules/domain/brain-lessons/persistence/brain-lessons.sql.ts': sql('select id from brain_lessons') });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].object, 'public.brain_lessons');
});
