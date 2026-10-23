// proves: DB_DEFINER_SAFE@lite
// proves: DB_DEFINER_SAFE@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkDatabase } from '../runtime/scripts/hfs/rules/database.mjs';
import { loadSlotManifest, readRepoDeclaration } from '../runtime/scripts/hfs/slots.mjs';

const FILE = 'supabase/migrations/20260101120000_lookup.sql';

async function judge(t, edition, sql) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-proof-definer-'));
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
  test(`DB_DEFINER_SAFE@${edition} rejects a definer with an unpinned search path`, async (t) => {
    const sql = 'create function private.lookup(subject uuid) returns boolean language sql security definer as $$ select subject is not null $$;';
    const findings = await judge(t, edition, sql);
    assert.deepEqual(findings.map(({ code }) => code), ['DB_DEFINER_SAFE']);
    assert.equal(findings[0].path, FILE);
    assert.equal(findings[0].function, 'private.lookup');
    assert.match(findings[0].message, /sets no search_path/);
  });

  test(`DB_DEFINER_SAFE@${edition} accepts an exposed definer with a pinned path and explicit revokes`, async (t) => {
    const sql = `create function public.lookup(subject uuid) returns boolean language sql security definer
      set search_path = '' as $$ select subject is not null $$;
      revoke execute on function public.lookup(uuid) from public, anon, authenticated;`;
    assert.deepEqual(await judge(t, edition, sql), []);
  });
}
