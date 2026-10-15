import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { generateAppIdentity, sealBootstrapValues } from '../../scripts/hfs/secret-bootstrap-crypto.mjs';
import { isSopsEnvelope, selectedAgeEnvelope } from '../../scripts/lib/sops-envelope.mjs';

const sops = process.env.STARCI_TEST_SOPS_BIN || 'sops';
const ageKeygen = process.env.STARCI_TEST_AGE_KEYGEN_BIN || 'age-keygen';
const hasSops = spawnSync(sops, ['--version'], { windowsHide: true }).status === 0;
const hasAgeKeygen = spawnSync(ageKeygen, ['--version'], { windowsHide: true }).status === 0;
const fixtureValues = () => ({ BOOTSTRAP_TOKEN: 'test-scaffold-placeholder', BOOTSTRAP_NOTES: 'bootstrap\nsecond line=not-real' });

test('bootstrap identities are fresh native X25519 age key pairs', () => {
  const first = generateAppIdentity();
  const second = generateAppIdentity();
  try {
    assert.ok(/^AGE-SECRET-KEY-1[0-9A-Z]{58}$/.test(first.identity.toString()), 'private identity has age encoding');
    assert.ok(/^age1[0-9a-z]{58}$/.test(first.recipient), 'recipient has age encoding');
    assert.ok(!first.identity.equals(second.identity), 'each app gets a fresh identity');
    assert.ok(first.recipient !== second.recipient, 'each app gets a fresh recipient');
    assert.ok(!first.identity.includes(10), 'identity has no trailing newline');
  } finally {
    first.identity.fill(0);
    second.identity.fill(0);
  }
});

test('bootstrap emits randomized SOPS dotenv envelopes for the selected app', () => {
  const app = generateAppIdentity();
  try {
    const first = sealBootstrapValues({ values: fixtureValues(), recipient: app.recipient });
    const second = sealBootstrapValues({ values: fixtureValues(), recipient: app.recipient });
    assert.ok(isSopsEnvelope(first));
    assert.deepEqual(selectedAgeEnvelope(first, 'dotenv', app.recipient), { ok: true });
    assert.ok(first !== second, 'fresh file keys, ephemeral keys and nonces randomize each seal');
    assert.ok(!Object.values(fixtureValues()).some((value) => first.includes(value)), 'no plaintext value is emitted');
    assert.ok(!first.includes(app.identity.toString()), 'no private identity is emitted');
  } finally {
    app.identity.fill(0);
  }
});

test('bootstrap refuses invalid recipients and unsafe dotenv input', () => {
  const app = generateAppIdentity();
  try {
    assert.throws(() => sealBootstrapValues({ values: fixtureValues(), recipient: 'age1invalid' }), /recipient/);
    const changed = app.recipient.slice(0, -1) + (app.recipient.endsWith('q') ? 'p' : 'q');
    assert.throws(() => sealBootstrapValues({ values: fixtureValues(), recipient: changed }), /checksum/);
    for (const values of [{}, { TOKEN: '' }, { TOKEN: 1 }, { sops_mac: 'reserved' }, { TOKEN_unencrypted: 'reserved' }]) {
      assert.throws(() => sealBootstrapValues({ values, recipient: app.recipient }), /Bootstrap/);
    }
  } finally {
    app.identity.fill(0);
  }
});

test('native age-keygen derives the generated app recipient', { skip: !hasAgeKeygen }, () => {
  const app = generateAppIdentity();
  try {
    const result = spawnSync(ageKeygen, ['-y'], { input: app.identity, windowsHide: true });
    assert.ok(result.status === 0, 'native age-keygen accepts the app identity');
    assert.ok(result.stdout.toString().trim() === app.recipient, 'native age derives the matching recipient');
  } finally {
    app.identity.fill(0);
  }
});

function nativeDecrypt(file, identity, directory) {
  return spawnSync(sops, ['--decrypt', '--input-type', 'dotenv', '--output-type', 'dotenv', file], {
    cwd: directory,
    env: {
      ...process.env,
      SOPS_AGE_KEY: identity.toString(),
      SOPS_AGE_KEY_FILE: path.join(directory, 'no-other-identity'),
      SOPS_AGE_KEY_CMD: '',
      XDG_CONFIG_HOME: directory,
    },
    windowsHide: true,
  });
}

function expectedDotenv(values) {
  return Buffer.from(Object.entries(values).map(([key, value]) => key + '=' + value.replaceAll('\n', String.raw`\n`)).join('\n') + '\n');
}

test('native SOPS verifies bootstrap encryption, app ownership and authenticated paths', { skip: !hasSops }, () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-bootstrap-crypto-'));
  const app = generateAppIdentity();
  const other = generateAppIdentity();
  try {
    const file = path.join(directory, 'bootstrap.env.enc');
    const values = fixtureValues();
    const envelope = sealBootstrapValues({ values, recipient: app.recipient });
    fs.writeFileSync(file, envelope);
    const decrypted = nativeDecrypt(file, app.identity, directory);
    assert.ok(decrypted.status === 0, 'native SOPS accepts the age wrapping and validates the SOPS MAC');
    assert.ok(decrypted.stdout.equals(expectedDotenv(values)), 'native SOPS returns the original bootstrap values');
    assert.ok(nativeDecrypt(file, other.identity, directory).status !== 0, 'another app cannot decrypt the envelope');
    fs.writeFileSync(file, envelope.replace('BOOTSTRAP_TOKEN=', 'RENAMED_TOKEN='));
    assert.ok(nativeDecrypt(file, app.identity, directory).status !== 0, 'renaming a key invalidates authenticated data');
    fs.writeFileSync(file, envelope.replace(/sops_lastmodified=[^\n]+/, 'sops_lastmodified=2000-01-01T00:00:00Z'));
    assert.ok(nativeDecrypt(file, app.identity, directory).status !== 0, 'changing the timestamp invalidates the MAC');
  } finally {
    app.identity.fill(0);
    other.identity.fill(0);
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
