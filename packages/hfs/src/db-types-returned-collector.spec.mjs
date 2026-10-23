// proves: DB_TYPES_DRIFT@lite
// proves: DB_TYPES_DRIFT@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { checkDatabase } from '../runtime/scripts/hfs/rules/database.mjs';
import { mkdtemp } from './helpers/tmpdir.mjs';

const FILE = 'supabase/types/database.types.ts';
const FRESH = 'export type Database = { public: { Tables: Record<string, never> } };\n';
const STALE = 'export type Database = { public: { Tables: { removed: unknown } } };\n';

for (const edition of ['lite', 'full']) {
  test(`${edition} rejects stale types in the returned database collector and accepts regenerated text`, async t => {
    const repoRoot = mkdtemp(t, `db-types-collector-${edition}-`);
    fs.mkdirSync(path.join(repoRoot, 'supabase/types'), { recursive: true });
    const target = path.join(repoRoot, FILE);
    fs.writeFileSync(target, STALE);
    const options = { repoRoot, files: [FILE], edition, supabase: {},
      git: () => ({ ok: false, stdout: '' }), emitTypes: async () => FRESH };
    const stale = await checkDatabase(options);
    assert.deepEqual(stale.filter(finding => finding.code === 'DB_TYPES_DRIFT').map(({ code, drift }) => ({ code, drift })),
      [{ code: 'DB_TYPES_DRIFT', drift: 'stale' }]);
    assert.equal(fs.readFileSync(target, 'utf8'), STALE);
    fs.writeFileSync(target, FRESH);
    const fresh = await checkDatabase(options);
    assert.deepEqual(fresh.filter(finding => finding.code === 'DB_TYPES_DRIFT'), []);
  });
}
