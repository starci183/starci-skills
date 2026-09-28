#!/usr/bin/env node
// test-secrets.mjs — the encrypted test-secret store (owner ruling push-scan-test-secrets-encrypted, 2026-09-28).
// A test credential a script needs STABLE across runs (a seeded account's password, a test client secret) is
// committed only as `<repo>/.starciwork/secrets/<name>.enc`: an AES-256-GCM envelope {v, iv, tag, ct}, no
// plaintext. The key lives OUTSIDE every repository at ~/.starci/secrets/test-secrets.key (STARCI_TEST_SECRETS_KEY
// names another file), generated once, readable by the owner only, never committed and never printed. A credential
// that need not be stable (a disposable account registered per run) is generated per run and never stored.
// The push secret scan (scripts/supervisor/push-mains.mjs) stays strict on plaintext; it passes a `.enc` file only
// when it parses as this envelope (isTestSecretEnvelope).
//
//   node scripts/lib/test-secrets.mjs set <name> --repo <path> [--generate]   value from stdin unless --generate
//   node scripts/lib/test-secrets.mjs get <name> --repo <path> [--reveal]     prints nothing unless --reveal
//
// In a script:  import { testSecret } from '<runtime>/scripts/lib/test-secrets.mjs';
//               const password = testSecret('login-capture-password', { repo });
// A secret value is never logged: every message names the secret and its file, never the value.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ENVELOPE_VERSION = 1;
const ENVELOPE_KEYS = ['ct', 'iv', 'tag', 'v'];
const NAME = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const B64 = /^[A-Za-z0-9+/]+={0,2}$/;

/** The key file: STARCI_TEST_SECRETS_KEY, else ~/.starci/secrets/test-secrets.key. */
export const testSecretsKeyFile = (env = process.env) => path.resolve(env.STARCI_TEST_SECRETS_KEY || path.join(os.homedir(), '.starci', 'secrets', 'test-secrets.key'));

/** Where `name`'s envelope lives in `repo`. */
export function testSecretFile(name, { repo } = {}) {
  if (!NAME.test(String(name ?? ''))) throw new Error(`test secret name must match ${NAME} (got ${JSON.stringify(name)})`);
  if (!repo) throw new Error('test secret needs {repo}: the repository root that commits its .enc file');
  return path.join(path.resolve(String(repo)), '.starciwork', 'secrets', `${name}.enc`);
}

/** Restrict a file to its owner: mode 0600, and on Windows an ACL of the current user alone. Best effort. */
function ownerOnly(file) {
  try { fs.chmodSync(file, 0o600); } catch { /* ignored where modes do not apply */ }
  if (process.platform !== 'win32') return;
  const user = process.env.USERNAME ? `${process.env.USERDOMAIN ? `${process.env.USERDOMAIN}\\` : ''}${process.env.USERNAME}` : null;
  if (!user) return;
  try { execFileSync('icacls', [file, '/inheritance:r', '/grant:r', `${user}:F`], { stdio: 'ignore', windowsHide: true }); } catch { /* best effort */ }
}

/** The 32-byte key, generated once on first use (`create: false` refuses to make one). Never printed. */
export function loadTestSecretsKey({ env = process.env, create = true } = {}) {
  const file = testSecretsKeyFile(env);
  if (fs.existsSync(file)) {
    const key = Buffer.from(fs.readFileSync(file, 'utf8').trim(), 'base64');
    if (key.length !== 32) throw new Error(`test-secret key ${file} is not a 32-byte base64 key`);
    return key;
  }
  if (!create) throw new Error(`test-secret key ${file} does not exist; run \`node scripts/lib/test-secrets.mjs set <name> --repo <r> --generate\` once to create it`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const key = crypto.randomBytes(32);
  fs.writeFileSync(file, `${key.toString('base64')}\n`, { mode: 0o600, flag: 'wx' });
  ownerOnly(file);
  return key;
}

const aad = (name) => Buffer.from(`starci-test-secret:v${ENVELOPE_VERSION}:${name}`, 'utf8');

/** Encrypt `value` as `name`'s envelope. The name is bound as AAD, so an envelope cannot be renamed. */
export function encryptTestSecret(name, value, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(aad(name));
  const ct = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return { v: ENVELOPE_VERSION, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ct: ct.toString('base64') };
}

export function decryptTestSecret(name, envelope, key) {
  if (!isTestSecretEnvelope(envelope)) throw new Error(`test secret ${name}: not a v${ENVELOPE_VERSION} envelope {v, iv, tag, ct}`);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64'));
  decipher.setAAD(aad(name));
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
  try { return Buffer.concat([decipher.update(Buffer.from(envelope.ct, 'base64')), decipher.final()]).toString('utf8'); }
  catch { throw new Error(`test secret ${name}: cannot decrypt (wrong key or tampered envelope)`); }
}

/** True only for the envelope itself: an object (or its JSON text) with exactly v, iv, tag, ct, base64 values -
 *  no plaintext field. The push scan passes a `.enc` file only when this holds. */
export function isTestSecretEnvelope(input) {
  let doc = input;
  if (typeof input === 'string') { try { doc = JSON.parse(input); } catch { return false; } }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return false;
  const keys = Object.keys(doc).sort();
  if (keys.length !== ENVELOPE_KEYS.length || keys.some((k, i) => k !== ENVELOPE_KEYS[i])) return false;
  return doc.v === ENVELOPE_VERSION && ['iv', 'tag', 'ct'].every((k) => typeof doc[k] === 'string' && B64.test(doc[k]));
}

/** A random test credential that passes common password rules (upper, lower, digit, symbol). */
export const generateTestSecret = () => `Ts-${crypto.randomBytes(18).toString('base64url')}-9aZ`;

/** Read and decrypt `name` from `repo`. Throws naming the file, never a value. */
export function testSecret(name, { repo, env = process.env } = {}) {
  const file = testSecretFile(name, { repo });
  if (!fs.existsSync(file)) throw new Error(`test secret ${name} is not stored at ${file}; run \`node scripts/lib/test-secrets.mjs set ${name} --repo <r> --generate\``);
  return decryptTestSecret(name, JSON.parse(fs.readFileSync(file, 'utf8')), loadTestSecretsKey({ env, create: false }));
}

/** Encrypt `value` and write `name`'s envelope into `repo`. Returns the file, never the value. */
export function setTestSecret(name, value, { repo, env = process.env } = {}) {
  if (typeof value !== 'string' || !value) throw new Error(`test secret ${name}: the value must be a non-empty string`);
  const file = testSecretFile(name, { repo });
  const envelope = encryptTestSecret(name, value, loadTestSecretsKey({ env }));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(envelope)}\n`);
  return { name, file };
}

const readStdin = () => { try { return fs.readFileSync(0, 'utf8').replace(/\r?\n$/, ''); } catch { return ''; } };

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, name, ...rest] = process.argv.slice(2);
  const flag = (f) => rest.includes(f);
  const opt = (f) => { const i = rest.indexOf(f); return i >= 0 ? rest[i + 1] : undefined; };
  const repo = opt('--repo');
  try {
    if (cmd === 'set') {
      const value = flag('--generate') ? generateTestSecret() : readStdin();
      const { file } = setTestSecret(name, value, { repo });
      console.log(`stored test secret ${name} -> ${file} (encrypted; commit the .enc, never the value)`);
    } else if (cmd === 'get') {
      const value = testSecret(name, { repo });
      if (flag('--reveal')) process.stdout.write(`${value}\n`);
    } else {
      console.error('usage: test-secrets.mjs set <name> --repo <path> [--generate] | get <name> --repo <path> [--reveal]');
      process.exitCode = 2;
    }
  } catch (error) { console.error(String(error?.message ?? error)); process.exitCode = 1; }
}
