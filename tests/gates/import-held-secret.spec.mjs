// import-held-secret.spec.mjs - `starci runtime import-held-secret` (scripts/gates/import-held-secret.mjs): the owner's one-time move of a held member's value
// from git history into the untracked secret.env. Every port is a fake: a history reader returning a fixed ciphertext, a decryptor returning a fixed value, a fake
// sops program for the one decrypt-through-the-call-owner case, and a throwaway git repository for the default revision. Nothing here touches a real secret or a real secret.env.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { decryptCiphertext, importHeldSecret, readMemberFromHistory } from '../../scripts/gates/import-held-secret.mjs';
import { HELD_MEMBERS } from '../../scripts/gates/sonar-host-secrets.mjs';

const DB_MEMBER = 'ext/sonar/secrets/sonarqube-db-password.txt.enc'; // [removed-list]
const VALUE = 'decrypted-value-0011';

function temporary(t, label) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `starci-held-${label}-`));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

const fakes = (decrypted = { value: VALUE }, history = { ciphertext: 'CIPHERTEXT-FIXTURE', rev: 'rev-fixture' }) => {
  const calls = { read: [], decrypt: [] };
  return {
    calls,
    readMember: (member) => { calls.read.push(member); return history; },
    decryptCipher: (ciphertext) => { calls.decrypt.push(ciphertext); return decrypted; },
  };
};

test('a held member is decrypted and appended as NAME=value after the existing lines, and the report carries no value', (t) => {
  const file = path.join(temporary(t, 'append'), 'secret.env');
  fs.writeFileSync(file, 'SONAR_TOKEN=existing-token-0012');
  const ports = fakes();
  const report = importHeldSecret({ member: DB_MEMBER, secretFile: file, ...ports });
  assert.deepEqual([report.outcome, report.variable, report.member, report.rev], ['imported', 'SONARQUBE_DB_PASSWORD', DB_MEMBER, 'rev-fixture']);
  assert.match(report.reader, /starci gate sonar up/);
  assert.equal(fs.readFileSync(file, 'utf8'), `SONAR_TOKEN=existing-token-0012\nSONARQUBE_DB_PASSWORD=${VALUE}\n`);
  assert.ok(!JSON.stringify(report).includes(VALUE), 'the report never carries the value');
  assert.deepEqual(ports.calls.read, [DB_MEMBER]);
  assert.deepEqual(ports.calls.decrypt, ['CIPHERTEXT-FIXTURE']);
});

test('an absent secret.env is created owner-only and a trailing newline is not doubled', (t) => {
  const root = temporary(t, 'create');
  const file = path.join(root, 'secret.env');
  importHeldSecret({ member: DB_MEMBER, secretFile: file, ...fakes() });
  assert.equal(fs.readFileSync(file, 'utf8'), `SONARQUBE_DB_PASSWORD=${VALUE}\n`);
  if (process.platform !== 'win32') assert.equal(fs.statSync(file).mode & 0o077, 0, 'no group or other permission bits');
  const second = path.join(root, 'second.env');
  fs.writeFileSync(second, 'A=1\n');
  importHeldSecret({ member: 'ext/sonar/secrets/sonarqube-admin-password.txt.enc', secretFile: second, ...fakes() }); // [removed-list]
  assert.equal(fs.readFileSync(second, 'utf8'), `A=1\nSONARQUBE_ADMIN_PASSWORD=${VALUE}\n`);
});

test('an existing name is never overwritten, even a blank one, and nothing is read or decrypted', (t) => {
  const file = path.join(temporary(t, 'exists'), 'secret.env');
  for (const existing of ['SONARQUBE_DB_PASSWORD=owner-value-0013\n', 'SONARQUBE_DB_PASSWORD=\n', '# note\nexport SONARQUBE_DB_PASSWORD=owner-value-0013\n']) {
    fs.writeFileSync(file, existing);
    const ports = fakes();
    const report = importHeldSecret({ member: DB_MEMBER, secretFile: file, ...ports });
    assert.deepEqual([report.outcome, report.code, report.cause], ['refused', 'held-secret-import-refused', 'variable-exists']);
    assert.match(report.message, /SONARQUBE_DB_PASSWORD is already in secret\.env: it is not overwritten/);
    assert.equal(fs.readFileSync(file, 'utf8'), existing, 'the file is untouched');
    assert.deepEqual([ports.calls.read, ports.calls.decrypt], [[], []]);
  }
});

test('a retired or unknown member writes nothing and says why', (t) => {
  const file = path.join(temporary(t, 'retired'), 'secret.env');
  const retired = HELD_MEMBERS.filter((entry) => entry.variable === null);
  assert.equal(retired.length, 1, 'the server-wide analysis token is retired');
  for (const entry of retired) {
    const ports = fakes();
    const report = importHeldSecret({ member: entry.path, secretFile: file, ...ports });
    assert.deepEqual([report.outcome, report.cause], ['refused', 'retired-member']);
    assert.match(report.message, /retired/);
    assert.deepEqual([ports.calls.read, ports.calls.decrypt], [[], []]);
  }
  const unknown = importHeldSecret({ member: 'ext/sonar/secrets/other.enc', secretFile: file, ...fakes() });
  assert.deepEqual([unknown.outcome, unknown.cause], ['refused', 'unknown-member']);
  assert.equal(fs.existsSync(file), false, 'no secret.env was created');
});

test('history that lacks the member, a decryptor that refuses, and a multi-line or empty value each write nothing', (t) => {
  const file = path.join(temporary(t, 'refusals'), 'secret.env');
  const cases = [
    [fakes(undefined, { error: 'ext/sonar/x is not in rev' }), 'history-unreadable'],
    [fakes({ error: 'sops could not decrypt the member (exit 128)' }), 'undecryptable'],
    [fakes({ value: 'line one\nline two' }), 'value-unusable'],
    [fakes({ value: '   ' }), 'value-unusable'],
    [fakes({ value: 'REPLACE_ME' }), 'value-unusable'],
  ];
  for (const [ports, cause] of cases) {
    const report = importHeldSecret({ member: DB_MEMBER, secretFile: file, ...ports });
    assert.deepEqual([report.outcome, report.cause], ['refused', cause]);
    assert.ok(!JSON.stringify(report).includes('line one'), 'a refused value is not echoed');
  }
  assert.equal(fs.existsSync(file), false);
});

test('every held member is either mapped to one distinct secret.env variable or retired (the demo secrets of an example have no entry)', () => {
  const variables = HELD_MEMBERS.map((entry) => entry.variable).filter(Boolean);
  assert.deepEqual(variables, ['SONARQUBE_DB_PASSWORD', 'SONARQUBE_ADMIN_PASSWORD', 'SONARQUBE_ADMIN_TOKEN', 'CLOUDFLARE_TUNNEL_TOKEN']);
  assert.equal(new Set(variables).size, variables.length);
  assert.equal(HELD_MEMBERS.length, 5);
  assert.ok(HELD_MEMBERS.every((entry) => entry.reader.length > 0));
});

function git(cwd, ...args) {
  const result = spawnSync('git', ['-c', 'user.name=fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', ...args], { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

test('without --rev the ciphertext is read from the parent of the commit that deleted the member; --rev names it explicitly', (t) => {
  const repo = temporary(t, 'history');
  git(repo, 'init', '-q');
  const file = path.join(repo, DB_MEMBER);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, 'ENC:first-ciphertext');
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', 'seal');
  const sealed = git(repo, 'rev-parse', 'HEAD');
  git(repo, 'rm', '-q', DB_MEMBER);
  git(repo, 'commit', '-q', '-m', 'delete the member');
  const byDefault = readMemberFromHistory({ cwd: repo, member: DB_MEMBER });
  assert.equal(byDefault.ciphertext, 'ENC:first-ciphertext');
  assert.equal(byDefault.rev, `${git(repo, 'rev-parse', 'HEAD')}^`);
  const named = readMemberFromHistory({ cwd: repo, member: DB_MEMBER, rev: sealed });
  assert.deepEqual([named.ciphertext, named.rev], ['ENC:first-ciphertext', sealed]);
  assert.match(readMemberFromHistory({ cwd: repo, member: DB_MEMBER, rev: 'HEAD' }).error, /is not in HEAD/, 'the tree after the deletion no longer has it');
  assert.match(readMemberFromHistory({ cwd: repo, member: 'ext/sonar/secrets/never.enc' }).error, /no commit that deleted .* is in this history/);
});

test('decryption goes through the sops call owner with the owner\'s identity from the environment, from a temp file that is removed', (t) => {
  const root = temporary(t, 'sops');
  const identity = path.join(root, 'identity.txt');
  fs.writeFileSync(identity, 'AGE-SECRET-KEY-FAKE');
  const seen = path.join(root, 'seen.json');
  const sops = path.join(root, 'fake-sops.mjs');
  fs.writeFileSync(sops, `import fs from 'node:fs';
if (process.env.SOPS_AGE_KEY_FILE !== ${JSON.stringify(identity)}) { process.stderr.write('wrong identity'); process.exit(3); }
const file = process.argv.at(-1);
fs.writeFileSync(${JSON.stringify(seen)}, JSON.stringify({ argv: process.argv.slice(2, -1), file }));
process.stdout.write(fs.readFileSync(file, 'utf8').replace(/^ENC:/, '') + '\\n');
`);
  const opened = decryptCiphertext(`ENC:${VALUE}`, { env: { SOPS_AGE_KEY_FILE: identity }, sops });
  assert.deepEqual(opened, { value: VALUE });
  const call = JSON.parse(fs.readFileSync(seen, 'utf8'));
  assert.deepEqual(call.argv, ['--decrypt', '--input-type', 'binary', '--output-type', 'binary']);
  assert.equal(fs.existsSync(call.file), false, 'the temp ciphertext file is removed');
  const noIdentity = decryptCiphertext(`ENC:${VALUE}`, { env: {}, sops });
  assert.ok(noIdentity.error && !noIdentity.value, 'without the owner\'s identity there is no decryption');
  assert.ok(!JSON.stringify(noIdentity).includes(VALUE));
  const wrong = decryptCiphertext(`ENC:${VALUE}`, { env: { SOPS_AGE_KEY_FILE: path.join(root, 'other-identity.txt') }, sops });
  assert.ok(wrong.error && !wrong.value);
});
