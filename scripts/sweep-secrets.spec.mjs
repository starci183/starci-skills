import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { sweepSecrets, secretErrors, SECRET_PATTERNS } from './sweep-secrets.mjs';

function fixture(files) {
  const dir = mkdtempSync(path.join(tmpdir(), 'sweep-'));
  for (const [rel, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    writeFileSync(path.join(dir, rel), content);
  }
  return dir;
}

test('prose about a credential resolved by name is not a finding', () => {
  const dir = fixture({ 'response/response.md': 'The admin password was resolved by name; length 24; digest sha256:abc.\nAuthorization used the sealed roster reference.\n' });
  try { assert.deepEqual(sweepSecrets(dir), []); } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('value shapes are findings that name the file, the line and the pattern, never the value', () => {
  const jwt = `eyJ${'a'.repeat(12)}.eyJ${'b'.repeat(12)}.${'c'.repeat(12)}`;
  const dir = fixture({
    'response/data/probe.json': `{ "token": "${jwt}" }`,
    'response/artifacts/log.txt': '-----BEGIN RSA PRIVATE KEY-----\nxxx\n',
    'response/notes.md': 'password: "hunter2hunter2"\n',
    'response/shot.png': 'eyJ binary is skipped by extension',
  });
  try {
    const found = sweepSecrets(dir);
    assert.deepEqual(found.map((f) => [f.file, f.line, f.pattern]).sort(), [
      ['response/artifacts/log.txt', 1, 'private-key'],
      ['response/data/probe.json', 1, 'jwt'],
      ['response/notes.md', 1, 'password-literal'],
    ]);
    for (const e of secretErrors(dir)) { assert.ok(!e.includes(jwt)); assert.ok(!e.includes('hunter2')); }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('a missing folder sweeps clean and every pattern has an id', () => {
  assert.deepEqual(sweepSecrets(path.join(tmpdir(), 'sweep-does-not-exist')), []);
  for (const p of SECRET_PATTERNS) assert.ok(p.id && p.re instanceof RegExp);
});
