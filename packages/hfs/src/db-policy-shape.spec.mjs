// proves: DB_POLICY_SHAPE@lite
// proves: DB_POLICY_SHAPE@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkDatabase } from '../runtime/scripts/hfs/rules/database.mjs';
import { loadSlotManifest, readRepoDeclaration } from '../runtime/scripts/hfs/slots.mjs';

const FILE = 'supabase/migrations/20260101120000_items.sql';
const TABLE = 'create table public.items (id uuid primary key, owner_id uuid not null);\nalter table public.items enable row level security;\n';

async function judge(t, edition, policy) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-proof-policy-'));
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
  fs.writeFileSync(path.join(repoRoot, FILE), TABLE + policy);
  return checkDatabase({ repoRoot, files: [FILE], git: () => ({ ok: false, stdout: '' }) });
}

for (const edition of ['lite', 'full']) {
  test(`DB_POLICY_SHAPE@${edition} rejects a write policy with WITH CHECK true`, async (t) => {
    const findings = await judge(t, edition, 'create policy items_app_be_insert on public.items for insert to app_be with check (true);');
    assert.deepEqual(findings.map(({ code }) => code), ['DB_POLICY_SHAPE']);
    assert.equal(findings[0].path, FILE);
    assert.equal(findings[0].policy, 'items_app_be_insert');
    assert.match(findings[0].message, /WITH CHECK \(true\)/);
  });

  test(`DB_POLICY_SHAPE@${edition} accepts a named write policy with an ownership predicate`, async (t) => {
    const policy = 'create policy items_app_be_insert on public.items for insert to app_be with check (owner_id = auth.uid());';
    assert.deepEqual(await judge(t, edition, policy), []);
  });
}
