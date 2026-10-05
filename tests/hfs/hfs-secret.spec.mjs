// hfs-secret.spec.mjs - `starci app secret list|show|set|gen` (scripts/hfs/secret.mjs) over a fake sops seam: what is read, what is
// sealed, with which recipients and format, and that a value never reaches a message or an argument list.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import * as secrets from '../../scripts/hfs/secret.mjs';
const { envelopeOf, formatOf, plaintextOf, secretMain, setSecretValues } = secrets;

const RECIPIENT = 'age1fixturerecipientaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

/** A sealed json envelope the way sops writes it: encrypted members, then a `sops` block naming the recipients. */
const ENC = 'ENC[AES256_GCM,data:AA==,iv:AA==,tag:AA==,type:str]';
const sealedJson = (keys, recipients = [RECIPIENT]) => `${JSON.stringify({ ...Object.fromEntries(keys.map((key) => [key, ENC])), sops: { mac: ENC, age: recipients.map((recipient) => ({ recipient, enc: 'x' })) } }, null, 1)}\n`;
const sealedDotenv = (keys) => `${keys.map((key) => `${key}=${ENC}`).join('\n')}\nsops_age__list_0__map_recipient=${RECIPIENT}\nsops_mac=${ENC}\n`;

/** An app with .starcistacks/<env>/secrets holding the given files. */
function app(t, files, env = 'dev') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-secret-'));
  const prior = process.env.STARCI_LOCAL_ROOT;
  process.env.STARCI_LOCAL_ROOT = path.join(root, 'private-machine');
  t.after(() => {
    if (prior === undefined) delete process.env.STARCI_LOCAL_ROOT; else process.env.STARCI_LOCAL_ROOT = prior;
    fs.rmSync(root, { recursive: true, force: true });
  });
  const dir = path.join(root, '.starcistacks', env, 'secrets');
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), text);
  return { root, dir };
}

/** A sops seam keeping what each file decrypts to, and recording every seal request. */
function fakeSops(plain = {}) {
  const sealed = [];
  return {
    sealed,
    decrypt: (file) => ({ ...plain[path.basename(file)] }),
    seal: (request) => { sealed.push(request); return request.inputType === 'dotenv' ? sealedDotenv(request.plaintext.split(String.fromCharCode(10)).filter(Boolean).map((line) => line.split('=')[0])) : sealedJson(Object.keys(JSON.parse(request.plaintext)), request.recipients.length ? request.recipients : [RECIPIENT]); },
  };
}

function run(argv, options) {
  const out = []; const err = [];
  const code = secretMain(argv, { stdout: (s) => out.push(s), stderr: (s) => err.push(s), ...options });
  return { code, out: out.join(''), err: err.join('') };
}

test('an existing live resource manager refuses a sealed write before decrypt or seal', async t => {
  const { root, dir } = app(t, { 'token.enc': sealedJson(['data']) });
  const absolute = path.resolve(dir, 'token.enc'), target = process.platform === 'win32' ? absolute.toLowerCase() : absolute;
  const name = `sealed-secret-${createHash('sha256').update(target).digest('hex')}`;
  const owner = pathToFileURL(path.resolve(import.meta.dirname, '../../scripts/connectors/lib.mjs')).href;
  const source = `import {claimManager} from ${JSON.stringify(owner)};const held=claimManager(${JSON.stringify(name)});`+
    `if(!held.ok)process.exit(2);console.log('held');setInterval(()=>{},1000);`;
  const child = spawn(process.execPath, ['--input-type=module', '-e', source], {
    env: { ...process.env }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  const exit = new Promise(resolve => child.once('close', resolve));
  t.after(async () => { if (child.exitCode === null) child.kill('SIGTERM'); await exit; });
  try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('private resource manager did not become ready')), 10_000);
    let text = '', errors = '';
    child.stderr.on('data', chunk => { errors += chunk; });
    child.stdout.on('data', chunk => { text += chunk; if (text.includes('held')) { clearTimeout(timer); resolve(); } });
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('close', code => { clearTimeout(timer); reject(new Error(`private manager exited ${code}: ${errors}`)); });
  });
  assert.throws(() => setSecretValues(root, { slug: 'token', values: { data: 'refused-private-value' } }, {
    sops: { decrypt: () => assert.fail('a held manager must refuse before decrypt'), seal: () => assert.fail('a held manager must refuse before seal') },
  }), /being updated/);
  assert.equal(fs.readFileSync(path.join(dir, 'token.enc'), 'utf8'), sealedJson(['data']));
  } finally { if (child.exitCode === null) child.kill('SIGTERM'); await exit; }
});

test('envelopeOf reads the format, the key names and the recipients of a sealed document without decrypting', () => {
  assert.equal(formatOf(sealedJson(['data'])), 'json');
  assert.equal(formatOf(sealedDotenv(['A'])), 'dotenv');
  assert.equal(formatOf('a: ENC[x]\nsops:\n  age: []\n'), 'yaml');
  assert.deepEqual(envelopeOf(sealedJson(['data'])), { format: 'json', keys: ['data'], recipients: [RECIPIENT] });
  assert.deepEqual(envelopeOf(sealedDotenv(['DATABASE_URL', 'REDIS_URL'])), { format: 'dotenv', keys: ['DATABASE_URL', 'REDIS_URL'], recipients: [RECIPIENT] });
  assert.equal(plaintextOf('dotenv', { A: '1', B: '2' }), 'A=1\nB=2\n');
  assert.throws(() => plaintextOf('dotenv', { A: 'one\ntwo' }), /line break/);
});

test('list names every secret of the only env with its keys, and decrypts nothing', (t) => {
  const { root } = app(t, { 'app-env.enc': sealedDotenv(['DATABASE_URL', 'REDIS_URL']), 'sepay-api-key-key.enc': sealedJson(['data']), 'notes.txt': 'not a secret' });
  const sops = { decrypt: () => assert.fail('list must not decrypt'), seal: () => assert.fail('list must not seal') };
  const result = run(['list', '--cwd', root], { sops });
  assert.equal(result.code, 0);
  assert.match(result.out, /^app-env {2}DATABASE_URL, REDIS_URL$/mu);
  assert.match(result.out, /^sepay-api-key-key {2}data$/mu);
  assert.match(result.out, /2 secrets in \.starcistacks\/dev\/secrets/);
  assert.doesNotMatch(result.out, /notes/);
});

test('show prints one value: data of a single-value secret, a named key of a document, and refuses an ambiguous or missing one', (t) => {
  const { root } = app(t, { 'one-key.enc': sealedJson(['data']), 'app-env.enc': sealedDotenv(['DATABASE_URL', 'REDIS_URL']) });
  const sops = fakeSops({ 'one-key.enc': { data: 'v1' }, 'app-env.enc': { DATABASE_URL: 'postgres://x', REDIS_URL: 'redis://y' } });
  assert.equal(run(['show', 'one-key', '--cwd', root], { sops }).out, 'v1\n');
  assert.equal(run(['show', 'app-env', '--key', 'REDIS_URL', '--cwd', root], { sops }).out, 'redis://y\n');
  const ambiguous = run(['show', 'app-env', '--cwd', root], { sops });
  assert.equal(ambiguous.code, 2);
  assert.match(ambiguous.err, /holds DATABASE_URL, REDIS_URL; name one with --key/);
  assert.equal(run(['show', 'app-env', '--key', 'NOPE', '--cwd', root], { sops }).code, 2);
  assert.equal(run(['show', 'absent', '--cwd', root], { sops }).code, 2);
});

test('set seals the value read from stdin: a new secret takes --age (json), an existing one keeps its keys, format and recipients', (t) => {
  const { root, dir } = app(t, { 'app-env.enc': sealedDotenv(['DATABASE_URL']) });
  const sops = fakeSops({ 'app-env.enc': { DATABASE_URL: 'postgres://x' } });
  const created = run(['set', 'sepay-webhook-secret-key', '--age', RECIPIENT, '--cwd', root], { sops, stdin: () => 'whsec_value\n' });
  assert.equal(created.code, 0, created.err);
  assert.deepEqual(sops.sealed[0], { inputType: 'json', plaintext: '{"data":"whsec_value"}\n', recipients: [RECIPIENT], filenameOverride: path.join(dir, 'sepay-webhook-secret-key.enc') });
  assert.ok(fs.existsSync(path.join(dir, 'sepay-webhook-secret-key.enc')));
  assert.doesNotMatch(created.out + created.err, /whsec_value/, 'a value is never echoed');
  const updated = run(['set', 'app-env', '--key', 'REDIS_URL', '--cwd', root], { sops, stdin: () => 'redis://z' });
  assert.equal(updated.code, 0, updated.err);
  assert.deepEqual(sops.sealed[1], { inputType: 'dotenv', plaintext: 'DATABASE_URL=postgres://x\nREDIS_URL=redis://z\n', recipients: [RECIPIENT], filenameOverride: path.join(dir, 'app-env.enc') });
});

test('set of a new secret with no --age leaves the recipients to .sops.yaml through the target file name (the override of every seal); an empty value is refused', (t) => {
  const { root, dir } = app(t, {});
  const sops = fakeSops();
  assert.equal(run(['set', 'upload-signing-secret-key', '--cwd', root], { sops, stdin: () => 'x' }).code, 0);
  assert.deepEqual(sops.sealed[0].recipients, []);
  assert.equal(sops.sealed[0].filenameOverride, path.join(dir, 'upload-signing-secret-key.enc'));
  const empty = run(['set', 'other', '--cwd', root], { sops, stdin: () => '\n' });
  assert.equal(empty.code, 2);
  assert.match(empty.err, /empty/);
});

test('gen seals a random value of the asked size without printing it', (t) => {
  const { root } = app(t, {});
  const sops = fakeSops();
  const result = run(['gen', 'todo-session-secret-key', '--bytes', '24', '--age', RECIPIENT, '--cwd', root], { sops, random: (n) => Buffer.alloc(n, 0xfb) });
  assert.equal(result.code, 0, result.err);
  const sealedValue = JSON.parse(sops.sealed[0].plaintext).data;
  assert.equal(sealedValue, Buffer.alloc(24, 0xfb).toString('base64url'));
  assert.doesNotMatch(result.out, new RegExp(sealedValue.replace(/[-_]/gu, '.')), 'the generated value is not printed');
  assert.equal(run(['gen', 'x', '--bytes', '4', '--cwd', root], { sops }).code, 2);
});

test('refusals: an unknown verb or flag, a bad slug, no .starcistacks, several envs without --env', (t) => {
  const { root } = app(t, { 'a-key.enc': sealedJson(['data']) });
  const sops = fakeSops();
  assert.equal(run(['frobnicate'], {}).code, 2);
  assert.equal(run(['list', '--bogus', '--cwd', root], { sops }).code, 2);
  assert.match(run(['show', 'Bad_Slug', '--cwd', root], { sops }).err, /not a secret slug/);
  const bare = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-secret-bare-'));
  t.after(() => fs.rmSync(bare, { recursive: true, force: true }));
  assert.match(run(['list', '--cwd', bare], { sops }).err, /no \.starcistacks/);
  fs.mkdirSync(path.join(root, '.starcistacks', 'vps', 'secrets'), { recursive: true });
  assert.match(run(['list', '--cwd', root], { sops }).err, /more than one environment/);
  assert.equal(run(['list', '--env', 'vps', '--cwd', root], { sops }).code, 0);
});

test('a failed seal or invalid encryption result preserves the previous envelope and publishes no plaintext', t => {
  const prior = sealedJson(['data']);
  const { root, dir } = app(t, { 'token.enc': prior });
  assert.throws(() => run(['set', 'token', '--cwd', root], { stdin: () => 'replacement-negative-fixture',
    sops: { decrypt: () => ({ data: 'old-negative-fixture' }), seal: () => { throw new Error('fixture SOPS failure'); } } }));
  assert.equal(fs.readFileSync(path.join(dir, 'token.enc'), 'utf8'), prior);
  const invalid = run(['set', 'token', '--cwd', root], { stdin: () => 'replacement-negative-fixture',
    sops: { decrypt: () => ({ data: 'old-negative-fixture' }), seal: () => '{"data":"opaque-negative-fixture"}' } });
  assert.equal(invalid.code, 2);
  assert.doesNotMatch(invalid.out + invalid.err, /opaque-negative-fixture/);
  assert.equal(fs.readFileSync(path.join(dir, 'token.enc'), 'utf8'), prior);
  assert.deepEqual(fs.readdirSync(dir), ['token.enc']);
});

test('an in-progress update refuses a second writer before decryption, and preserves related keys in one envelope', t => {
  const { root, dir } = app(t, { 'app-env.enc': sealedJson(['OTHER']) });
  const sops = fakeSops({ 'app-env.enc': { OTHER: 'old-negative-fixture' } });
  const seal = sops.seal;
  sops.seal = request => {
    assert.throws(() => setSecretValues(root, { slug: 'app-env', values: { SECOND: 'conflict-negative-fixture' } },
      { sops: { decrypt: () => assert.fail('held update must refuse before decrypt'), seal } }), /being updated/);
    return seal(request);
  };
  setSecretValues(root, { slug: 'app-env', values: { FIRST: 'new-negative-fixture' } }, { sops });
  assert.deepEqual(JSON.parse(sops.sealed[0].plaintext), { OTHER: 'old-negative-fixture', FIRST: 'new-negative-fixture' });
  assert.deepEqual(envelopeOf(fs.readFileSync(path.join(dir, 'app-env.enc'), 'utf8')).keys, ['OTHER', 'FIRST']);
});

test('a dotenv newline cannot inject another key or overwrite the existing envelope', t => {
  const prior = sealedDotenv(['OTHER']);
  const { root, dir } = app(t, { 'app-env.enc': prior });
  const sops = fakeSops({ 'app-env.enc': { OTHER: 'old-negative-fixture' } });
  assert.throws(() => setSecretValues(root, { slug: 'app-env', values: { FIRST: 'one\nINJECTED=two' } }, { sops }), /line break/);
  assert.equal(sops.sealed.length, 0);
  assert.equal(fs.readFileSync(path.join(dir, 'app-env.enc'), 'utf8'), prior);
});
