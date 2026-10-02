import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { liteSecretCustodyFindings, supabaseSecretFindings } from '../../scripts/hfs/rules/supabase-secrets.mjs';

const tree = (t, files) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-supabase-secrets-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const [file, text] of Object.entries(files)) {
    const target = path.join(root, ...file.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, text);
  }
  return root;
};

const app = edition => ({ profile: 'app', edition });
const fe = edition => ({ profile: 'fe', edition });

test('L17 is lite-only and forbids root env/custody entries plus sealed files outside the one starcistacks secret home', t => {
  const files = ['.env.example', 'secrets.env', '.secrets/ci.key', 'backup.enc', '.starcistacks/dev/secrets/app.enc'];
  const root = tree(t, Object.fromEntries(files.map(file => [file, 'fixture'])));
  assert.deepEqual(liteSecretCustodyFindings({ repoRoot: root, files, repo: app('full') }), []);
  const findings = liteSecretCustodyFindings({ repoRoot: root, files, repo: app('lite') });
  assert.deepEqual(findings.map(item => item.path).sort(), ['.env.example', '.secrets/ci.key', 'backup.enc', 'secrets.env']);
  assert.ok(findings.every(item => item.code === 'HFS_LITE_SECRET_CUSTODY' && item.level === 'error'));
});

test('L17 recognises Supabase tokens, long eyJ service material and password-bearing connection strings under fe/', t => {
  const source = [
    `export const publishable = 'sbp_${'A'.repeat(24)}'`,
    `export const secret = 'sb_secret_${'B'.repeat(24)}'`,
    `export const service = 'eyJ${'C'.repeat(70)}'`,
    `export const database = 'postgresql://app:${'p'.repeat(12)}@db.invalid/product'`,
  ].join('\n');
  const root = tree(t, { 'apps/web/src/modules/config/generated.ts': source });
  const findings = liteSecretCustodyFindings({ repoRoot: root, files: ['apps/web/src/modules/config/generated.ts'], repo: fe('lite') });
  assert.deepEqual(findings.map(item => item.pattern).sort(), [
    'password-connection-string', 'supabase-eyj-service-token', 'supabase-publishable-token', 'supabase-secret-token',
  ]);
  assert.ok(findings.every(item => !item.message.includes('postgresql://') && !item.message.includes('sb_secret_')), 'a finding never prints the captured value');
});

test('L17 non-matches include comments and strings that merely name token families, passwordless/env-derived URLs, lockfiles and full edition', t => {
  const harmless = `
// sbp_ and sb_secret_ are provider prefixes; eyJ is a header prefix.
export const names=['sbp_example','sb_secret_example','eyJshort'];
export const passwordless='postgresql://db.invalid/product';
export const injected='postgresql://app:\${DATABASE_PASSWORD}@db.invalid/product';
`;
  const files = ['apps/web/src/modules/config/index.ts', 'package-lock.json'];
  const root = tree(t, { [files[0]]: harmless, [files[1]]: `{"note":"sbp_${'Z'.repeat(30)}"}` });
  assert.deepEqual(liteSecretCustodyFindings({ repoRoot: root, files, repo: fe('lite') }), []);
  assert.deepEqual(liteSecretCustodyFindings({ repoRoot: root, files: [files[0]], repo: fe('full') }), []);
});

test('the extended scanner emits one specific L17 finding instead of duplicate R06/L17 findings for a complete JWT in lite', t => {
  const jwt = `eyJ${'a'.repeat(30)}.eyJ${'b'.repeat(30)}.${'c'.repeat(30)}`;
  const file = 'supabase/config.ts';
  const root = tree(t, { [file]: `export const copied = '${jwt}'\n` });
  const lite = supabaseSecretFindings({ repoRoot: root, files: [file], repo: app('lite'), resolver: { classifyPath: () => ({ status: 'owned' }) } });
  assert.equal(lite.length, 1, JSON.stringify(lite, null, 2));
  assert.equal(lite[0].code, 'HFS_LITE_SECRET_CUSTODY');
  const full = supabaseSecretFindings({ repoRoot: root, files: [file], repo: app('full'), resolver: { classifyPath: () => ({ status: 'owned' }) } });
  assert.equal(full.length, 1, JSON.stringify(full, null, 2));
  assert.equal(full[0].code, 'HFS_PLAINTEXT_SECRET', 'full edition keeps the unchanged R06 judgement');
});
