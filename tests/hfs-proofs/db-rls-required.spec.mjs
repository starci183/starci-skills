// proves: DB_RLS_REQUIRED@lite
// proves: DB_RLS_REQUIRED@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkDatabase } from '../../scripts/hfs/rules/database.mjs';
import { loadSlotManifest, readRepoDeclaration } from '../../scripts/hfs/slots.mjs';

const FILE = 'supabase/migrations/20260101120000_items.sql';
const TABLE = 'create table public.items (id uuid primary key, owner_id uuid not null);\n';

async function judge(t, edition, sql, forceRls = []) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-proof-rls-'));
  t.after(() => fs.rmSync(repoRoot, { recursive: true, force: true }));
  fs.writeFileSync(path.join(repoRoot, 'hfs.json'), JSON.stringify({
    hfs: 3, kind: 'app', project: 'proof', edition, supabase: { forceRls },
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
  test(`DB_RLS_REQUIRED@${edition} rejects an exposed table without RLS`, async (t) => {
    const findings = await judge(t, edition, TABLE);
    assert.deepEqual(findings.map(({ code }) => code), ['DB_RLS_REQUIRED']);
    assert.equal(findings[0].path, FILE);
    assert.equal(findings[0].table, 'public.items');
    assert.match(findings[0].message, /without a later.*enable row level security/);
  });

  test(`DB_RLS_REQUIRED@${edition} accepts RLS enabled after the table declaration`, async (t) => {
    assert.deepEqual(await judge(t, edition, `${TABLE}alter table public.items enable row level security;`), []);
  });

  test(`DB_RLS_REQUIRED@${edition} requires and accepts FORCE for a declared owner table`, async (t) => {
    const enabled = `${TABLE}alter table public.items enable row level security;\n`;
    const findings = await judge(t, edition, enabled, ['public.items']);
    assert.deepEqual(findings.map(({ code }) => code), ['DB_RLS_REQUIRED']);
    assert.match(findings[0].message, /force row level security/);
    assert.deepEqual(await judge(t, edition, `${enabled}alter table public.items force row level security;`, ['public.items']), []);
  });
}
