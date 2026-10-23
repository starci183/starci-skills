// HFS_EMIT_DB_TYPES_STALE (R216): before generating types the emit proves that the versions the local database applied equal the
// migration filename stamps; a gap or an extra version refuses with the stale code, an equal history generates.
// The command runner is injected (a fake of the spawnSync result), so no Supabase stack or Docker is reached.
// proves: HFS_EMIT_DB_TYPES_STALE@lite
// proves: HFS_EMIT_DB_TYPES_STALE@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { emitDbTypes } from '../emit/db-types.mjs';
import { mkdtemp } from './helpers/tmpdir.mjs';

const CODE = 'HFS_EMIT_DB_TYPES_STALE';
const BODY = 'export type Database = { public: { Tables: Record<string, never> } };\n';

/** An app root of `edition` holding the migrations stamped `versions`. */
function app(t, edition, versions) {
  const root = mkdtemp(t, `db-types-stale-${edition}-`);
  fs.mkdirSync(path.join(root, 'supabase', 'migrations'), { recursive: true });
  for (const version of versions) fs.writeFileSync(path.join(root, 'supabase', 'migrations', `${version}_change.sql`), 'select 1;');
  return root;
}

/** A runner answering the migration history as JSON rows `applied` and the generated types body. */
const runner = (applied) => (file, args) => (args[0] === 'migration'
  ? { status: 0, stdout: JSON.stringify({ migrations: applied.map((version) => ({ local: version, remote: version })) }), stderr: '' }
  : { status: 0, stdout: BODY, stderr: '' });

/** The error the emit raises for a database whose applied versions are `applied` (the emit's answer when it does not raise). */
function refusal(root, applied) {
  try {
    return emitDbTypes({ root, run: runner(applied) });
  } catch (error) {
    return error;
  }
}

for (const edition of ['lite', 'full']) {
  test(`${CODE} ${edition}: a database behind or ahead of the migrations folder is refused with the stale code`, (t) => {
    const root = app(t, edition, ['20261014120000', '20261015120000']);
    const behind = refusal(root, ['20261014120000']);
    assert.equal(behind.code, CODE);
    assert.match(behind.message, /the local database is at 20261014120000, the migrations folder at 20261015120000/);
    assert.equal(refusal(root, ['20261014120000', '20261015120000', '20261016120000']).code, CODE);
  });

  test(`${CODE} ${edition}: a database whose applied versions equal the migration stamps passes and generates the types`, (t) => {
    const root = app(t, edition, ['20261014120000', '20261015120000']);
    const text = emitDbTypes({ root, run: runner(['20261014120000', '20261015120000']) });
    assert.ok(text.endsWith(BODY));
    assert.match(text, /^\/\/ migrations-sha256: [0-9a-f]{64}\n/);
  });
}
