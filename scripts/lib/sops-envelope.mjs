// sops-envelope.mjs — the pure rules of a test credential (owner ruling push-scan-test-secrets-encrypted, 2026-09-28):
// where it lives in a product repository's `.starcistacks`, the command that stores it, the sops format of its path, and
// whether a committed file is a sops envelope with no plaintext value (the push secret scan's test). Reading one is
// scripts/uat/test-secret.mjs; the sops binary is found by scripts/api/sops/lib.mjs.
import path from 'node:path';
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
