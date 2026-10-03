import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { supabaseSecretFindings } from '../../scripts/hfs/rules/supabase-secrets.mjs';

const tree = (t, files) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-supabase-secrets-adversarial-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const [file, text] of Object.entries(files)) {
    const target = path.join(root, ...file.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, text);
  }
  return root;
};

const resolver = {
  classifyPath: () => ({ status: 'owned' }),
  slot: () => null,
};
const app = edition => ({ profile: 'app', edition });
const fe = edition => ({ profile: 'fe', edition });
const b64url = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const validJwt = `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ iss: 'supabase', role: 'service_role', exp: 4102444800 })}.${'s'.repeat(43)}`;
const invalidJwt = `eyJ${'a'.repeat(20)}.eyJ${'b'.repeat(20)}.${'c'.repeat(30)}`;

const exactCodes = findings => findings.filter(item => item.code === 'HFS_LITE_SECRET_CUSTODY').map(item => item.code).sort();

test('L17 adversarial custody and provider-secret matrix has exact findings for 25 paths and literal shapes', async t => {
  const cases = [
    { name: 'root .env is forbidden', file: '.env', text: 'PUBLIC=value', repo: app('lite'), expected: ['HFS_LITE_SECRET_CUSTODY'] },
    { name: 'root .env.local is forbidden', file: '.env.local', text: 'PUBLIC=value', repo: app('lite'), expected: ['HFS_LITE_SECRET_CUSTODY'] },
    { name: 'root .env.example is forbidden', file: '.env.example', text: 'PUBLIC=example', repo: app('lite'), expected: ['HFS_LITE_SECRET_CUSTODY'] },
    { name: 'root secrets.env is forbidden', file: 'secrets.env', text: 'PUBLIC=value', repo: app('lite'), expected: ['HFS_LITE_SECRET_CUSTODY'] },
    { name: 'root .secrets directory is forbidden', file: '.secrets/key.txt', text: 'fixture', repo: app('lite'), expected: ['HFS_LITE_SECRET_CUSTODY'] },
    { name: 'sealed secret home is accepted', file: '.starcistacks/dev/secrets/app.enc', text: 'fixture', repo: app('lite'), expected: [] },
    { name: 'sealed root file is refused', file: 'backup.enc', text: 'fixture', repo: app('lite'), expected: ['HFS_LITE_SECRET_CUSTODY'] },
    { name: 'sealed side file is refused', file: 'modules/config/app.enc', text: 'fixture', repo: fe('lite'), expected: ['HFS_LITE_SECRET_CUSTODY'] },
    { name: 'long sbp personal access token is refused', file: 'fe/config.ts', text: `export const key='sbp_${'A'.repeat(24)}'`, repo: app('lite'), expected: ['HFS_LITE_SECRET_CUSTODY'] },
    { name: 'short sbp example is ignored', file: 'fe/config.ts', text: `export const key='sbp_example'`, repo: app('lite'), expected: [] },
    { name: 'long publishable key is refused', file: 'fe/config.ts', text: `export const key='sb_publishable_${'P'.repeat(24)}'`, repo: app('lite'), expected: ['HFS_LITE_SECRET_CUSTODY'] },
    { name: 'long sb_secret token is refused', file: 'supabase/config.ts', text: `export const key='sb_secret_${'B'.repeat(24)}'`, repo: app('lite'), expected: ['HFS_LITE_SECRET_CUSTODY'] },
    { name: 'valid JWT is refused', file: 'fe/config.ts', text: `export const token='${validJwt}'`, repo: app('lite'), expected: ['HFS_LITE_SECRET_CUSTODY'] },
    { name: 'long eyJ prose is ignored', file: 'fe/README.md', text: `The prefix eyJ${'C'.repeat(80)} is a documentation placeholder.`, repo: app('lite'), expected: [] },
    { name: 'invalid three-segment docs JWT is ignored', file: 'supabase/README.md', text: `Example: ${invalidJwt}`, repo: app('lite'), expected: [] },
    { name: 'invalid three-segment test JWT is ignored', file: 'fe/auth.test.ts', text: `export const fixture='${invalidJwt}'`, repo: app('lite'), expected: [] },
    { name: 'real JWT in docs remains refused', file: 'supabase/README.md', text: `Accidentally copied: ${validJwt}`, repo: app('lite'), expected: ['HFS_LITE_SECRET_CUSTODY'] },
    { name: 'postgres password connection is refused', file: 'fe/config.ts', text: `export const url='postgres://app:s3cret-value@db.invalid/product'`, repo: app('lite'), expected: ['HFS_LITE_SECRET_CUSTODY'] },
    { name: 'postgresql password connection is refused', file: 'supabase/config.ts', text: `export const url='postgresql://app:s3cret-value@db.invalid/product'`, repo: app('lite'), expected: ['HFS_LITE_SECRET_CUSTODY'] },
    { name: 'redis password connection is refused', file: 'fe/config.ts', text: `export const url='redis://app:s3cret-value@cache.invalid/0'`, repo: app('lite'), expected: ['HFS_LITE_SECRET_CUSTODY'] },
    { name: 'passwordless connection is accepted', file: 'fe/config.ts', text: `export const url='postgresql://db.invalid/product'`, repo: app('lite'), expected: [] },
    { name: 'environment-interpolated password is accepted', file: 'supabase/config.toml', text: `database_url = 'postgresql://app:\${DATABASE_PASSWORD}@db.invalid/product'`, repo: app('lite'), expected: [] },
    { name: 'app file outside fe and supabase is not in provider scan', file: 'docs/example.md', text: validJwt, repo: app('lite'), expected: [] },
    { name: 'package lock token text is ignored', file: 'fe/package-lock.json', text: JSON.stringify({ note: `sbp_${'Z'.repeat(30)}` }), repo: app('lite'), expected: [] },
    { name: 'side-root valid JWT is refused', file: 'modules/config/token.ts', text: `export const token='${validJwt}'`, repo: fe('lite'), expected: ['HFS_LITE_SECRET_CUSTODY'] },
  ];
  assert.equal(cases.length, 25);
  for (const item of cases) {
    await t.test(item.name, child => {
      const root = tree(child, { [item.file]: item.text });
      const input = { repoRoot: root, files: [item.file], repo: item.repo, resolver };
      const findings = supabaseSecretFindings(input);
      assert.deepEqual(exactCodes(findings), [...item.expected].sort(), JSON.stringify(findings, null, 2));
    });
  }
});
