// proves: DB_DYNAMIC_DDL@lite
// proves: DB_DYNAMIC_DDL@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkDatabase } from '../../scripts/hfs/rules/database.mjs';
import { loadSlotManifest, readRepoDeclaration } from '../../scripts/hfs/slots.mjs';

const FILE = 'supabase/migrations/20260101120000_items.sql';

async function judge(t, edition, sql) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-proof-dynamic-ddl-'));
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
  fs.mkdirSync(path.join(repoRoot, 'supabase/migrations'), { recursive: true });
  fs.writeFileSync(path.join(repoRoot, FILE), sql);
  return checkDatabase({ repoRoot, files: [FILE], git: () => ({ ok: false, stdout: '' }) });
}

for (const edition of ['lite', 'full']) {
  test(`DB_DYNAMIC_DDL@${edition} rejects CREATE TABLE hidden behind EXECUTE`, async (t) => {
    const findings = await judge(t, edition, "do $$ begin execute 'create table public.items (id uuid)'; end $$;");
    assert.deepEqual(findings.map(({ code }) => code), ['DB_DYNAMIC_DDL']);
    assert.equal(findings[0].path, FILE);
    assert.match(findings[0].query, /create table public.items/);
    assert.match(findings[0].message, /builds DDL dynamically/);
  });

  test(`DB_DYNAMIC_DDL@${edition} accepts the same table as inspectable static DDL`, async (t) => {
    const sql = 'create table public.items (id uuid);\nalter table public.items enable row level security;';
    assert.deepEqual(await judge(t, edition, sql), []);
  });
}
