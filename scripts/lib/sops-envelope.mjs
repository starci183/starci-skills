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
export const sopsFormatFor = (file) => {
  if (file.endsWith('.env')) return 'dotenv';
  if (file.endsWith('.json')) return 'json';
  if (/\.(ya?ml|kubeconfig)$/.test(file)) return 'yaml';
  return 'binary';
};

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
  if (lines.length && lines.every((l) => /^[A-Za-z_]\w*=/.test(l))) {
    const pairs = lines.map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]);
    const meta = pairs.filter(([k]) => k.startsWith('sops_'));
    const vals = pairs.filter(([k]) => !k.startsWith('sops_'));
    return vals.length > 0 && vals.every(([, v]) => SOPS_VALUE.test(v)) && meta.some(([k, v]) => k === 'sops_mac' && SOPS_VALUE.test(v));
  }
  try { return sopsTree(parseYaml(src)); } catch { return false; }
}

/** Admit one flat age envelope for the native selected-identity invocation; this is shape admission, never cryptographic proof. */
const refusal = (reason) => ({ ok: false, reason });

function dotenvMetadataValue(meta, age, key, value) {
  if (key === 'age__list_0__map_recipient') age.recipient = value;
  else if (key === 'age__list_0__map_enc') age.enc = value;
  else if (key === 'mac_only_encrypted') {
    if (value !== 'false') return 'partial-mac';
    meta[key] = false;
  } else if (key.includes('__')) return 'unsupported-key-group';
  else meta[key] = value;
  return null;
}

function readDotenvMetadata(text) {
  const pairs = new Map();
  for (const line of String(text).split('\n')) {
    if (!line || line.startsWith('#')) continue;
    if (line.includes('\r')) return { refusal: 'unsupported-dotenv' };
    const at = line.indexOf('=');
    if (at < 1) return { refusal: 'unsupported-dotenv' };
    const name = line.slice(0, at);
    if (pairs.has(name)) return { refusal: 'duplicate-key' };
    pairs.set(name, line.slice(at + 1).replaceAll(String.raw`\n`, '\n'));
  }
  const meta = {};
  const age = {};
  for (const [name, value] of pairs) {
    if (!name.startsWith('sops_')) continue;
    const reason = dotenvMetadataValue(meta, age, name.slice('sops_'.length), value);
    if (reason) return { refusal: reason };
  }
  meta.age = [age];
  return { meta };
}

function readStructuredMetadata(text, format) {
  const doc = parseYaml(String(text));
  if (format !== 'yaml') JSON.parse(String(text));
  if (format === 'binary' && (!doc || Object.keys(doc).length !== 2 || !Object.hasOwn(doc, 'data') || !Object.hasOwn(doc, 'sops') || typeof doc.data !== 'string'))
    return { refusal: 'unsupported-binary-shape' };
  return { meta: doc?.sops };
}

function readAgeMetadata(text, format) {
  try {
    return format === 'dotenv' ? readDotenvMetadata(text) : readStructuredMetadata(text, format);
  } catch { return { refusal: 'invalid-envelope' }; }
}

function hasNonAgeProvider(meta, providers) {
  for (const name of providers) {
    if (Object.hasOwn(meta, name) && (!Array.isArray(meta[name]) || meta[name].length)) return true;
  }
  return false;
}

function isAgeEntry(entry) {
  return !!entry && typeof entry === 'object' && !Array.isArray(entry)
    && !Object.keys(entry).some(name => !['recipient', 'enc'].includes(name));
}

function hasValidAgePayload(entry) {
  return typeof entry.enc === 'string' && entry.enc.startsWith('-----BEGIN AGE ENCRYPTED FILE-----\n')
    && entry.enc.includes('\n-----END AGE ENCRYPTED FILE-----');
}

function hasValidEnvelopeVersion(meta) {
  return typeof meta.version === 'string' && /^\d+\.\d+\.\d+$/.test(meta.version)
    && typeof meta.lastmodified === 'string' && Number.isFinite(Date.parse(meta.lastmodified));
}

function validateAgeMetadata(meta, text, recipient) {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta) || !isSopsEnvelope(text)) return refusal('invalid-envelope');
  if (Object.hasOwn(meta, 'key_groups') || Object.hasOwn(meta, 'shamir_threshold')) return refusal('unsupported-key-group');
  const providers = ['kms', 'gcp_kms', 'hckms', 'azure_kv', 'hc_vault', 'pgp'];
  if (hasNonAgeProvider(meta, providers)) return refusal('non-age-provider');
  const fields = new Set([...providers, 'age', 'lastmodified', 'mac', 'version', 'unencrypted_suffix', 'encrypted_suffix', 'unencrypted_regex', 'encrypted_regex', 'unencrypted_comment_regex', 'encrypted_comment_regex', 'mac_only_encrypted']);
  if (Object.keys(meta).some(name => !fields.has(name))) return refusal('unknown-metadata');
  if (Object.hasOwn(meta, 'mac_only_encrypted') && meta.mac_only_encrypted !== false) return refusal('partial-mac');
  if (!Array.isArray(meta.age) || meta.age.length !== 1) return refusal('unsupported-age-set');
  const entry = meta.age[0];
  if (!isAgeEntry(entry)) return refusal('invalid-age-entry');
  if (typeof entry.recipient !== 'string' || entry.recipient !== recipient) return refusal('recipient-mismatch');
  if (!hasValidAgePayload(entry)) return refusal('invalid-age-entry');
  if (!hasValidEnvelopeVersion(meta)) return refusal('invalid-envelope');
  return { ok: true };
}

export function selectedAgeEnvelope(text, format, recipient) {
  if (!['binary', 'json', 'yaml', 'dotenv'].includes(format)) return refusal('unsupported-format');
  const parsed = readAgeMetadata(text, format);
  if (parsed.refusal) return refusal(parsed.refusal);
  return validateAgeMetadata(parsed.meta, text, recipient);
}
