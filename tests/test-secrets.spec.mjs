// test-secrets.spec.mjs — the encrypted test-secret store and the push scan that stays strict on plaintext test
// credentials (owner ruling push-scan-test-secrets-encrypted, 2026-09-28).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { testSecret, setTestSecret, testSecretFile, isTestSecretEnvelope, encryptTestSecret, generateTestSecret } from '../scripts/lib/test-secrets.mjs';
import { scanDiff, scanHint, applyScanAllow, TEST_SECRET_HINT } from '../scripts/supervisor/push-mains.mjs';

const CLI = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'lib', 'test-secrets.mjs');
const sandbox = (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-test-secrets-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const env = { ...process.env, STARCI_TEST_SECRETS_KEY: path.join(dir, 'home', 'test-secrets.key') };
  const repo = path.join(dir, 'repo');
  fs.mkdirSync(repo, { recursive: true });
  return { dir, env, repo };
};
// Built at run time so this spec never carries a plaintext password shape itself.
const plain = () => ['Local', 'Capture', 'Passw0rd', '1'].join('-');

test('a test secret round-trips through a committed .enc envelope that holds no plaintext', (t) => {
  const { env, repo } = sandbox(t);
  const value = plain();
  const { file } = setTestSecret('login-capture-password', value, { repo, env });
  assert.equal(file, testSecretFile('login-capture-password', { repo }));
  assert.ok(file.endsWith(path.join('.starciwork', 'secrets', 'login-capture-password.enc')));
  const text = fs.readFileSync(file, 'utf8');
  assert.ok(!text.includes(value), 'the envelope never holds the value');
  assert.ok(isTestSecretEnvelope(text));
  assert.deepEqual(Object.keys(JSON.parse(text)).sort(), ['ct', 'iv', 'tag', 'v']);
  assert.equal(testSecret('login-capture-password', { repo, env }), value);
  assert.ok(fs.existsSync(env.STARCI_TEST_SECRETS_KEY), 'the key is created once, outside the repository');
  assert.ok(!fs.readdirSync(repo, { recursive: true }).some((f) => String(f).endsWith('.key')));
});

test('an envelope is bound to its name and its key', (t) => {
  const { env, repo } = sandbox(t);
  const { file } = setTestSecret('seed-admin-password', plain(), { repo, env });
  fs.copyFileSync(file, testSecretFile('other-password', { repo }));
  assert.throws(() => testSecret('other-password', { repo, env }), /cannot decrypt/);
  const otherKey = { ...env, STARCI_TEST_SECRETS_KEY: path.join(path.dirname(env.STARCI_TEST_SECRETS_KEY), 'other.key') };
  assert.throws(() => testSecret('seed-admin-password', { repo, env: otherKey }), /does not exist/);
  assert.throws(() => setTestSecret('../escape', plain(), { repo, env }), /name must match/);
});

test('the CLI stores a generated secret and prints a value only with get --reveal', (t) => {
  const { env, repo } = sandbox(t);
  const run = (...args) => spawnSync(process.execPath, [CLI, ...args], { env, encoding: 'utf8', input: '' });
  const set = run('set', 'uat-password', '--repo', repo, '--generate');
  assert.equal(set.status, 0, set.stderr);
  const value = testSecret('uat-password', { repo, env });
  assert.ok(!set.stdout.includes(value), 'set never prints the value');
  const quiet = run('get', 'uat-password', '--repo', repo);
  assert.equal(quiet.status, 0, quiet.stderr);
  assert.equal(quiet.stdout, '');
  assert.equal(run('get', 'uat-password', '--repo', repo, '--reveal').stdout.trim(), value);
  assert.match(generateTestSecret(), /^Ts-[A-Za-z0-9_-]{24}-9aZ$/);
});

test('the push scan stays strict: a plaintext test password refuses the push with the store as the fix', () => {
  const pw = plain();
  const diff = [
    '+++ b/.starciwork/features/login/impl/nivo-fe/session-controls/E/capture.mjs', '@@ -66,0 +67,1 @@', `+const PASSWORD = "${pw}";`,
    '+++ b/tests/seed/accounts.mjs', '@@ -1,0 +1,1 @@', `+export const password = "${pw}";`,
    '+++ b/src/auth/config.ts', '@@ -1,0 +1,1 @@', `+const password = "${pw}";`,
  ].join('\n');
  const found = scanDiff({ diff, files: [] });
  assert.deepEqual(found.map((f) => `${f.file}:${f.line}:${f.pattern}`), [
    '.starciwork/features/login/impl/nivo-fe/session-controls/E/capture.mjs:67:assigned-secret',
    'tests/seed/accounts.mjs:1:assigned-secret',
    'src/auth/config.ts:1:assigned-secret',
  ]);
  assert.equal(scanHint(found), TEST_SECRET_HINT);
  assert.match(TEST_SECRET_HINT, /node scripts\/lib\/test-secrets\.mjs set <name> --generate/);
  assert.ok(!JSON.stringify(found).includes(pw));
});

test('a provider key in a test file still refuses the push', () => {
  const aws = ['AKIA', 'Q7RZ4M2K9XBW3N5T'].join('');
  const diff = ['+++ b/tests/e2e/fixtures/aws.mjs', '@@ -1,0 +1,1 @@', `+const key = '${aws}';`].join('\n');
  assert.deepEqual(scanDiff({ diff, files: [] }).map((f) => f.pattern), ['aws-access-key']);
});

test('a .enc file passes only as the bare envelope; anything else in it is scanned', () => {
  const key = Buffer.alloc(32, 7);
  const envelope = JSON.stringify(encryptTestSecret('login-capture-password', plain(), key));
  const ok = scanDiff({ diff: ['+++ b/.starciwork/secrets/login-capture-password.enc', '@@ -0,0 +1 @@', `+${envelope}`].join('\n'), files: [] });
  assert.deepEqual(ok, []);
  const leaky = JSON.stringify({ ...JSON.parse(envelope), password: plain() });
  assert.ok(!isTestSecretEnvelope(leaky));
  const bad = scanDiff({ diff: ['+++ b/.starciwork/secrets/login-capture-password.enc', '@@ -0,0 +1 @@', `+${leaky}`].join('\n'), files: [] });
  assert.deepEqual(bad.map((f) => `${f.line}:${f.pattern}`), ['1:test-secret-not-envelope']);
  const text = scanDiff({ diff: ['+++ b/.starciwork/secrets/seed.enc', '@@ -0,0 +1 @@', `+password = "${plain()}"`].join('\n'), files: [] });
  assert.deepEqual(text.map((f) => f.pattern), ['assigned-secret', 'test-secret-not-envelope']);
  const elsewhere = scanDiff({ diff: ['+++ b/vendor/blob.enc', '@@ -0,0 +1 @@', '+opaque-binary-ish'].join('\n'), files: [] });
  assert.deepEqual(elsewhere, [], 'a .enc outside the store is scanned like any file');
});

test('an allow entry pinned to a committed range is spent once origin/main holds it', () => {
  const entries = [{ repo: 'nivo-backend', file: 'E/capture.mjs', pattern: 'assigned-secret', approvedBy: 'owner', until: 'abc123' }];
  const findings = [{ file: 'E/capture.mjs', line: 67, pattern: 'assigned-secret' }];
  const ancestor = (status) => (args) => ({ ok: status === 0, status, stdout: '', stderr: '', args });
  assert.equal(applyScanAllow('D:/Repositories/nivo-backend', findings, entries, { run: ancestor(1) }).exempted.length, 1, 'not pushed yet: exempt');
  assert.equal(applyScanAllow('D:/Repositories/nivo-backend', findings, entries, { run: ancestor(0) }).findings.length, 1, 'range pushed: spent');
  assert.equal(applyScanAllow('D:/Repositories/nivo-backend', findings, entries, { run: ancestor(128) }).findings.length, 1, 'unknown commit: not exempt');
});
