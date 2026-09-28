#!/usr/bin/env node
// test-secrets.mjs — test credentials follow the product repository's own `.starcistacks` convention (owner ruling
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
//   node scripts/lib/test-secrets.mjs get <name> --repo <path> [--stack dev] [--reveal]   prints nothing unless --reveal
//
// In a script:  import { testSecret } from '<runtime>/scripts/lib/test-secrets.mjs';
//               const password = testSecret('login-capture-password', { repo });
// The push secret scan (scripts/supervisor/push-mains.mjs) passes a `.enc` only when isSopsEnvelope holds.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';

const NAME = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const STACK = /^[a-z0-9][a-z0-9-]{0,31}$/;
/** One sops-encrypted leaf: `ENC[AES256_GCM,data:...,iv:...,tag:...,type:...]` (data may be empty). */
const SOPS_VALUE = /^ENC\[AES256_GCM,data:[A-Za-z0-9+/=]*,iv:[A-Za-z0-9+/=]+,tag:[A-Za-z0-9+/=]+,type:[a-z]+\]$/;

/** Where test credential `name` of `stack` lives in `repo`: {plain, enc, rel}. `rel` is the path the repo's
 *  `stack-secret.mjs set` takes. */
export function testSecretPaths(name, { repo, stack = 'dev' } = {}) {
  if (!NAME.test(String(name ?? ''))) throw new Error(`test secret name must match ${NAME} (got ${JSON.stringify(name)})`);
  if (!STACK.test(String(stack ?? ''))) throw new Error(`stack must match ${STACK} (got ${JSON.stringify(stack)})`);
  if (!repo) throw new Error('test secret needs {repo}: the product repository whose .starcistacks holds it');
  const rel = `${stack}/secrets/test/${name}`;
  const plain = path.join(path.resolve(String(repo)), '.starcistacks', stack, 'secrets', 'test', name);
  return { plain, enc: `${plain}.enc`, rel };
}

/** The command that stores a test credential, in the product repository's own tooling. */
export const setCommand = (name = '<name>', stack = 'dev') => `node scripts/stack-secret.mjs set ${stack}/secrets/test/${name}`;

/** sops' format for a plaintext path, as the repository's stack-secret.mjs formatFor decides it. */
export const sopsFormatFor = (file) => (file.endsWith('.env') ? 'dotenv' : /\.json$/.test(file) ? 'json' : /\.(ya?ml|kubeconfig)$/.test(file) ? 'yaml' : 'binary');

/** The sops binary: PATH, then winget's Links and Packages (spawn without a shell ignores PATHEXT). */
export function resolveSops(env = process.env) {
  const win = process.platform === 'win32';
  const names = win ? ['sops.exe', 'sops'] : ['sops'];
  const dirs = String(env.PATH ?? '').split(win ? ';' : ':').filter(Boolean);
  if (win && env.LOCALAPPDATA) {
    const winget = path.join(env.LOCALAPPDATA, 'Microsoft', 'WinGet');
    dirs.push(path.join(winget, 'Links'));
    const packages = path.join(winget, 'Packages');
    try { for (const e of fs.readdirSync(packages)) if (/sops/i.test(e)) dirs.push(path.join(packages, e)); } catch { /* none */ }
  }
  for (const dir of dirs) for (const n of names) { const f = path.join(dir, n); try { if (fs.statSync(f).isFile()) return f; } catch { /* next */ } }
  return null;
}

/** Read test credential `name`: the local plaintext when present, else its committed `.enc` through sops. */
export function testSecret(name, { repo, stack = 'dev', env = process.env, sops = null } = {}) {
  const { plain, enc, rel } = testSecretPaths(name, { repo, stack });
  if (fs.existsSync(plain)) return fs.readFileSync(plain, 'utf8').replace(/\r?\n$/, '');
  if (!fs.existsSync(enc)) throw new Error(`test secret ${name} is not in .starcistacks/${rel}.enc; store it with \`${setCommand(name, stack)}\` in ${repo}`);
  const bin = sops ?? resolveSops(env);
  if (!bin) throw new Error('sops is not installed (Windows: winget install Mozilla.SOPS)');
  const format = sopsFormatFor(plain);
  const r = spawnSync(bin, ['--decrypt', '--input-type', format, '--output-type', format, enc], {
    cwd: path.resolve(String(repo)), encoding: 'utf8', windowsHide: true,
    env: { ...env, SOPS_AGE_KEY_FILE: env.SOPS_AGE_KEY_FILE || path.join(os.homedir(), '.starci', 'master.identity') },
  });
  if (r.status !== 0) throw new Error(`test secret ${name}: sops could not decrypt .starcistacks/${rel}.enc (${String(r.stderr ?? r.error?.message ?? '').trim().split(/\r?\n/).pop()})`);
  return String(r.stdout).replace(/\r?\n$/, '');
}

/** Every leaf outside the `sops` block is an ENC[...] value (or null); the block itself carries a mac. */
const allEncrypted = (node) => {
  if (node === null) return true;
  if (Array.isArray(node)) return node.every(allEncrypted);
  if (typeof node === 'object') return Object.values(node).every(allEncrypted);
  return typeof node === 'string' && SOPS_VALUE.test(node);
};
const sopsTree = (doc) => !!doc && typeof doc === 'object' && !Array.isArray(doc) && !!doc.sops && typeof doc.sops === 'object'
  && typeof doc.sops.mac === 'string' && SOPS_VALUE.test(doc.sops.mac)
  && Object.keys(doc).length > 1 && Object.entries(doc).every(([k, v]) => k === 'sops' || allEncrypted(v));

/**
 * True only for a sops-encrypted file with no plaintext value: binary/json form ({"data": ENC[...], "sops": {...}}),
 * yaml form (every value ENC[...] plus the sops block) or dotenv form (KEY=ENC[...] lines plus sops_* metadata).
 * The sops metadata must carry its mac. A key kept plaintext through `unencrypted_suffix` does not pass.
 */
export function isSopsEnvelope(text) {
  const src = String(text ?? '').replace(/^﻿/, '');
  if (!src.trim()) return false;
  try { return sopsTree(JSON.parse(src)); } catch { /* not JSON */ }
  const lines = src.split(/\r?\n/).filter((l) => l.trim() && !/^\s*#/.test(l));
  if (lines.length && lines.every((l) => /^[A-Za-z_][A-Za-z0-9_]*=/.test(l))) {
    const pairs = lines.map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]);
    const meta = pairs.filter(([k]) => k.startsWith('sops_'));
    const vals = pairs.filter(([k]) => !k.startsWith('sops_'));
    return vals.length > 0 && vals.every(([, v]) => SOPS_VALUE.test(v)) && meta.some(([k, v]) => k === 'sops_mac' && SOPS_VALUE.test(v));
  }
  try { return sopsTree(parseYaml(src)); } catch { return false; }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, name, ...rest] = process.argv.slice(2);
  const opt = (f) => { const i = rest.indexOf(f); return i >= 0 ? rest[i + 1] : undefined; };
  try {
    if (cmd === 'get') {
      const value = testSecret(name, { repo: opt('--repo'), stack: opt('--stack') ?? 'dev' });
      if (rest.includes('--reveal')) process.stdout.write(`${value}\n`);
    } else {
      console.error(`usage: test-secrets.mjs get <name> --repo <path> [--stack dev] [--reveal]\nstore one with the product repo's own command: ${setCommand()}`);
      process.exitCode = 2;
    }
  } catch (error) { console.error(String(error?.message ?? error)); process.exitCode = 1; }
}
