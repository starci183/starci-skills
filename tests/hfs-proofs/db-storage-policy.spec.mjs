// proves: DB_STORAGE_POLICY@lite
// proves: DB_STORAGE_POLICY@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkDatabase } from '../../scripts/hfs/rules/database.mjs';
import { loadSlotManifest, readRepoDeclaration } from '../../scripts/hfs/slots.mjs';

const FILE = 'supabase/migrations/20260101120000_avatars.sql';
const BUCKET = "insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('avatars', 'avatars', false, 1048576, '{image/png}');\n";

async function judge(t, edition, sql) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-proof-storage-'));
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
  test(`DB_STORAGE_POLICY@${edition} rejects a bucket without an objects policy`, async (t) => {
    const findings = await judge(t, edition, BUCKET);
    assert.deepEqual(findings.map(({ code }) => code), ['DB_STORAGE_POLICY']);
    assert.equal(findings[0].path, FILE);
    assert.equal(findings[0].bucket, 'avatars');
    assert.match(findings[0].message, /no storage.objects policy/);
  });

  test(`DB_STORAGE_POLICY@${edition} accepts a private bounded bucket with a matching owner policy`, async (t) => {
    const policy = `create policy objects_app_be_select on storage.objects for select to app_be
      using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);`;
    assert.deepEqual(await judge(t, edition, BUCKET + policy), []);
  });
}
