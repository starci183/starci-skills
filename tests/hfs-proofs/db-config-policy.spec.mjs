// proves: DB_CONFIG_POLICY@lite
// proves: DB_CONFIG_POLICY@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkDatabase } from '../../scripts/hfs/rules/database.mjs';
import { loadSlotManifest, readRepoDeclaration } from '../../scripts/hfs/slots.mjs';

const FILE = 'supabase/config.toml';

async function judge(t, edition, enableSignup) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-proof-db-config-'));
  t.after(() => fs.rmSync(repoRoot, { recursive: true, force: true }));
  fs.writeFileSync(path.join(repoRoot, 'hfs.json'), JSON.stringify({
    hfs: 3, kind: 'app', project: 'proof', edition,
    supabase: { enableSignup: false, jwtExpiry: 3600, siteUrl: 'http://localhost:3000', redirectUrls: [] },
    sides: {
      be: {
        apps: [{ name: 'api', kind: 'api' }],
        connections: [{ name: 'primary', envPrefix: 'PRIMARY_DB', owner: 'api', isolation: 'schema', provider: 'supabase' }],
      },
      fe: { apps: [{ name: 'web', kind: 'next' }] },
    },
  }));
  assert.equal(readRepoDeclaration(loadSlotManifest(), repoRoot).edition, edition);
  fs.mkdirSync(path.join(repoRoot, 'supabase'), { recursive: true });
  fs.writeFileSync(path.join(repoRoot, FILE), `[api]
enabled = false
schemas = []
[auth]
enable_signup = ${enableSignup}
jwt_expiry = 3600
site_url = "http://localhost:3000"
additional_redirect_urls = []
`);
  return checkDatabase({ repoRoot, files: [FILE], git: () => ({ ok: false, stdout: '' }) });
}

for (const edition of ['lite', 'full']) {
  test(`DB_CONFIG_POLICY@${edition} rejects auth signup that contradicts the app declaration`, async (t) => {
    const findings = await judge(t, edition, true);
    assert.deepEqual(findings.map(({ code }) => code), ['DB_CONFIG_POLICY']);
    assert.equal(findings[0].path, FILE);
    assert.equal(findings[0].key, 'auth.enable_signup');
    assert.equal(findings[0].declared, false);
  });

  test(`DB_CONFIG_POLICY@${edition} accepts auth settings matching the app declaration`, async (t) => {
    assert.deepEqual(await judge(t, edition, false), []);
  });
}
