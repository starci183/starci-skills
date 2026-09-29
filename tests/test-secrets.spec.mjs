// test-secrets.spec.mjs — test credentials follow the product repo's .starcistacks + sops convention, and the push
// scan stays strict on plaintext (owner ruling push-scan-test-secrets-encrypted, 2026-09-28).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { testSecret, testSecretPaths, isSopsEnvelope, setCommand, sopsFormatFor } from '../scripts/lib/test-secrets.mjs';
import { scanDiff, diffScanner, scanHint, applyScanAllow, TEST_SECRET_HINT } from '../scripts/supervisor/push-mains.mjs';

const sandbox = (t) => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-test-secrets-'));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }));
  return repo;
};
// Built at run time so this spec never carries a plaintext password shape itself.
const plain = () => ['Local', 'Capture', 'Passw0rd', '1'].join('-');
const enc = (data = 'QUJD', type = 'str') => `ENC[AES256_GCM,data:${data},iv:${'A'.repeat(43)}=,tag:${'B'.repeat(22)}==,type:${type}]`;
const sopsMeta = { age: [{ recipient: 'age1example', enc: '-----BEGIN AGE ENCRYPTED FILE-----\nabc\n-----END AGE ENCRYPTED FILE-----\n' }], lastmodified: '2026-09-28T00:00:00Z', mac: enc('TUFD'), unencrypted_suffix: '_unencrypted', version: '3.13.2' };
const binaryEnc = () => JSON.stringify({ data: enc(), sops: sopsMeta }, null, '\t');
const yamlEnc = () => [`password: ${enc()}`, 'accounts:', `    - email: ${enc()}`, 'sops:', `    mac: ${enc('TUFD')}`, '    version: 3.13.2'].join('\n');
const dotenvEnc = () => [`UAT_PASSWORD=${enc()}`, `sops_mac=${enc('TUFD')}`, 'sops_version=3.13.2'].join('\n');

test('a test credential lives at .starcistacks/<stack>/secrets/test/<name> and is stored with the repo\'s own command', (t) => {
  const repo = sandbox(t);
  const p = testSecretPaths('login-capture-password', { repo });
  assert.equal(p.plain, path.join(repo, '.starcistacks', 'dev', 'secrets', 'test', 'login-capture-password'));
  assert.equal(p.enc, `${p.plain}.enc`);
  assert.equal(setCommand('login-capture-password', 'dev'), 'node scripts/stack-secret.mjs set dev/secrets/test/login-capture-password');
  assert.equal(sopsFormatFor(p.plain), 'binary');
  assert.throws(() => testSecretPaths('../escape', { repo }), /name must match/);
  assert.throws(() => testSecretPaths('x', { repo, stack: '../vps' }), /stack must match/);
});

test('the reader prefers the local git-ignored plaintext and names the store command when nothing is there', (t) => {
  const repo = sandbox(t);
  assert.throws(() => testSecret('uat-password', { repo }), /stack-secret\.mjs set dev\/secrets\/test\/uat-password/);
  const { plain: file } = testSecretPaths('uat-password', { repo });
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${plain()}\n`);
  assert.equal(testSecret('uat-password', { repo }), plain());
  fs.rmSync(file);
  fs.writeFileSync(`${file}.enc`, binaryEnc());
  assert.throws(() => testSecret('uat-password', { repo, sops: path.join(repo, 'no-such-sops') }), /sops could not decrypt/);
});

test('isSopsEnvelope accepts sops binary, yaml and dotenv files and nothing with a plaintext value', () => {
  assert.ok(isSopsEnvelope(binaryEnc()));
  assert.ok(isSopsEnvelope(yamlEnc()));
  assert.ok(isSopsEnvelope(dotenvEnc()));
  assert.ok(!isSopsEnvelope(JSON.stringify({ data: enc(), sops: { ...sopsMeta, mac: undefined } })), 'no mac');
  assert.ok(!isSopsEnvelope(JSON.stringify({ data: enc(), password: plain(), sops: sopsMeta })), 'plaintext field');
  assert.ok(!isSopsEnvelope(JSON.stringify({ data: enc(), password_unencrypted: plain(), sops: sopsMeta })), 'unencrypted_suffix field');
  assert.ok(!isSopsEnvelope(`${yamlEnc()}\nnote: ${plain()}`));
  assert.ok(!isSopsEnvelope(`UAT_PASSWORD=${plain()}\nsops_mac=${enc('TUFD')}`));
  assert.ok(!isSopsEnvelope(JSON.stringify({ v: 1, iv: 'AAAA', tag: 'BBBB', ct: 'CCCC' })), 'a home-made envelope is not sops');
  assert.ok(!isSopsEnvelope(''));
});

test('the push scan stays strict: a plaintext test password refuses the push with .starcistacks + sops as the fix', () => {
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
  assert.match(TEST_SECRET_HINT, /\.starcistacks\/<stack>\/secrets\/test\/<name>/);
  assert.match(TEST_SECRET_HINT, /node scripts\/stack-secret\.mjs set <stack>\/secrets\/test\/<name>/);
  assert.ok(!JSON.stringify(found).includes(pw));
});

test('a provider key in a test file still refuses the push', () => {
  const aws = ['AKIA', 'Q7RZ4M2K9XBW3N5T'].join('');
  const diff = ['+++ b/tests/e2e/fixtures/aws.mjs', '@@ -1,0 +1,1 @@', `+const key = '${aws}';`].join('\n');
  assert.deepEqual(scanDiff({ diff, files: [] }).map((f) => f.pattern), ['aws-access-key']);
});

test('the plaintext twin under .starcistacks/<stack>/secrets is a forbidden file; only the .enc is pushed', () => {
  const files = ['.starcistacks/dev/secrets/test/uat-password', '.starcistacks/dev/secrets/test/uat-password.enc', '.starcistacks/dev/secrets/.gitkeep'];
  assert.deepEqual(scanDiff({ diff: '', files }).map((f) => `${f.file}:${f.pattern}`), ['.starcistacks/dev/secrets/test/uat-password:starcistacks-secret-plaintext']);
});

test('a .enc passes only as a sops envelope, judged on the whole file when the scan can read it', () => {
  const file = '.starcistacks/dev/secrets/test/uat-password.enc';
  const lines = (text) => ['+++ b/' + file, '@@ -0,0 +1 @@', ...text.split('\n').map((l) => `+${l}`)].join('\n');
  assert.deepEqual(scanDiff({ diff: lines(binaryEnc()), files: [] }), []);
  const leaky = JSON.stringify({ data: enc(), password: plain(), sops: sopsMeta });
  assert.deepEqual(scanDiff({ diff: lines(leaky), files: [] }).map((f) => f.pattern), ['sops-not-envelope']);
  const text = scanDiff({ diff: lines(`password = "${plain()}"`), files: [] });
  assert.deepEqual(text.map((f) => f.pattern), ['assigned-secret', 'sops-not-envelope']);
  // An edited sops YAML: a --unified=0 diff holds only the changed line; the whole file at the pushed commit decides.
  const edited = ['+++ b/.starcistacks/dev/stack.yaml.enc', '@@ -3,1 +3,1 @@', `+    - email: ${enc('WFla')}`].join('\n');
  assert.deepEqual(scanDiffWith(edited, () => yamlEnc()), []);
  assert.deepEqual(scanDiffWith(edited, () => `${yamlEnc()}\nnote: ${plain()}`).map((f) => f.pattern), ['sops-not-envelope']);
  const elsewhere = scanDiff({ diff: ['+++ b/vendor/blob.enc', '@@ -0,0 +1 @@', '+opaque-binary-ish'].join('\n'), files: [] });
  assert.deepEqual(elsewhere, [], 'a .enc outside .starcistacks is scanned like any file');
});

const scanDiffWith = (diff, encText) => { const s = diffScanner([], { encText }); for (const l of diff.split('\n')) s.line(l); return s.findings; };

test('an allow entry pinned to a committed range is spent once origin/main holds it', () => {
  const entries = [{ repo: 'nivo-backend', file: 'evidence/capture.mjs', pattern: 'assigned-secret', approvedBy: 'owner', until: 'abc123' }];
  const findings = [{ file: 'evidence/capture.mjs', line: 67, pattern: 'assigned-secret' }];
  const ancestor = (status) => () => ({ ok: status === 0, status, stdout: '', stderr: '' });
  assert.equal(applyScanAllow('D:/Repositories/nivo-backend', findings, entries, { run: ancestor(1) }).exempted.length, 1, 'not pushed yet: exempt');
  assert.equal(applyScanAllow('D:/Repositories/nivo-backend', findings, entries, { run: ancestor(0) }).findings.length, 1, 'range pushed: spent');
  assert.equal(applyScanAllow('D:/Repositories/nivo-backend', findings, entries, { run: ancestor(128) }).findings.length, 1, 'unknown commit: not exempt');
});
