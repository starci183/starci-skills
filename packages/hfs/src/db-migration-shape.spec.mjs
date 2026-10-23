// proves: DB_MIGRATION_SHAPE@lite
// proves: DB_MIGRATION_SHAPE@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkDatabase } from '../runtime/scripts/hfs/rules/database.mjs';
import { loadSlotManifest, readRepoDeclaration } from '../runtime/scripts/hfs/slots.mjs';

async function judge(t, edition, name) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-proof-migration-'));
  t.after(() => fs.rmSync(repoRoot, { recursive: true, force: true }));
  fs.writeFileSync(path.join(repoRoot, 'hfs.json'), JSON.stringify({
    hfs: 3, kind: 'app', project: 'proof', edition,
    sides: {
      be: {
        apps: [{ name: 'api', kind: 'api' }],
        connections: [{ name: 'primary', envPrefix: 'PRIMARY_DB', owner: 'api', isolation: 'schema', provider: 'supabase' }],
      },
      fe: { apps: [{ name: 'web', kind: 'next' }] },
    },
  }));
  assert.equal(readRepoDeclaration(loadSlotManifest(), repoRoot).edition, edition);
  const file = `supabase/migrations/${name}`;
  fs.mkdirSync(path.join(repoRoot, 'supabase/migrations'), { recursive: true });
  fs.writeFileSync(path.join(repoRoot, file), 'select 1;\n');
  return checkDatabase({ repoRoot, files: [file], git: () => ({ ok: false, stdout: '' }) });
}

for (const edition of ['lite', 'full']) {
  test(`DB_MIGRATION_SHAPE@${edition} rejects a migration with an impossible UTC stamp`, async (t) => {
    const findings = await judge(t, edition, '20260230000000_baseline.sql');
    assert.deepEqual(findings.map(({ code }) => code), ['DB_MIGRATION_SHAPE']);
    assert.equal(findings[0].path, 'supabase/migrations/20260230000000_baseline.sql');
    assert.match(findings[0].message, /no valid UTC time/);
  });

  test(`DB_MIGRATION_SHAPE@${edition} accepts a real UTC stamp and kebab migration name`, async (t) => {
    assert.deepEqual(await judge(t, edition, '20260228235959_create-items.sql'), []);
  });
}
