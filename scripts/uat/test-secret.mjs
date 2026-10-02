#!/usr/bin/env node
// test-secret.mjs — test credentials follow the product repository's own `.starcistacks` convention (owner ruling
// push-scan-test-secrets-encrypted, 2026-09-28: they work exactly like the stack custody and a plaintext password is never pushed).
// There is no store of the runtime's own: a test credential lives at `<repo>/.starcistacks/<stack>/secrets/test/<name>`,
// its plaintext git-ignored by the repo's `.starcistacks/**` rules and only the sops-encrypted twin `<name>.enc`
// committed. It is written with the repository's existing command (`node scripts/stack-secret.mjs set
// <stack>/secrets/test/<name>`, npm run secret:set), which encrypts against the recipients `.sops.yaml` names and
// removes the plaintext; this module only READS: the local plaintext when present, else the `.enc` decrypted by sops
// with the shared age identity (SOPS_AGE_KEY_FILE, default ~/.starci/master.identity) into memory.
// A credential that need not be stable across runs (a disposable account registered per run) is generated per run
// and stored nowhere. A value is never logged.
//
// Internal entry: spawned by scripts/supervisor/push-mains.mjs; not invoked directly.
// Args: get <name> --repo <path> [--stack dev] [--reveal]   prints nothing unless --reveal
//
// In a script:  import { testSecret } from '<runtime>/scripts/uat/test-secret.mjs';
//               const password = testSecret('login-capture-password', { repo });
// The push secret scan (scripts/supervisor/push-mains.mjs) passes a `.enc` only when isSopsEnvelope holds (scripts/lib/sops-envelope.mjs).
import fs from 'node:fs';
import path from 'node:path';
import { decrypt } from '../api/sops/decrypt.mjs';
import { isMain } from '../lib/is-main.mjs';
import { setCommand, sopsFormatFor, testSecretPaths } from '../lib/sops-envelope.mjs';

/** Read test credential `name`: the local plaintext when present, else its committed `.enc` through sops. */
export function testSecret(name, { repo, stack = 'dev', env = process.env, sops = null } = {}) {
  const { plain, enc, rel } = testSecretPaths(name, { repo, stack });
  if (fs.existsSync(plain)) return fs.readFileSync(plain, 'utf8').replace(/\r?\n$/, '');
  if (!fs.existsSync(enc)) throw new Error(`test secret ${name} is not in .starcistacks/${rel}.enc; store it with \`${setCommand(name, stack)}\` in ${repo}`);
  const format = sopsFormatFor(plain);
  const r = decrypt(sops, ['--decrypt', '--input-type', format, '--output-type', format, enc], { cwd: path.resolve(String(repo)), env, maxBuffer: 1024 * 1024 });
  if (r.error?.code === 'SOPS_MISSING') throw r.error;
  if (r.status !== 0) throw new Error(`test secret ${name}: sops could not decrypt .starcistacks/${rel}.enc (${String(r.stderr ?? r.error?.message ?? '').trim().split(/\r?\n/).pop()})`);
  return String(r.stdout).replace(/\r?\n$/, '');
}

if (isMain(import.meta.url)) {
  const [cmd, name, ...rest] = process.argv.slice(2);
  const opt = (f) => { const i = rest.indexOf(f); return i >= 0 ? rest[i + 1] : undefined; };
  try {
    if (cmd === 'get') {
      const value = testSecret(name, { repo: opt('--repo'), stack: opt('--stack') ?? 'dev' });
      if (rest.includes('--reveal')) process.stdout.write(`${value}\n`);
    } else {
      console.error(`usage: test-secret.mjs get <name> --repo <path> [--stack dev] [--reveal]\nstore one with the product repo's own command: ${setCommand()}`);
      process.exitCode = 2;
    }
  } catch (error) { console.error(String(error?.message ?? error)); process.exitCode = 1; }
}
