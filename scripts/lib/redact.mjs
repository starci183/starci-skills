// redact.mjs — the ONE redaction module (docs/ledger-db.md). Every blob put of text bytes
// (report attachments, check stdout/stderr/output, terminal transcripts, CLI sessions) and every log write
// passes through here first; the harness UI server reuses it. A blob whose bytes went through redactText is
// stamped blobs.redaction = REDACTION_VERSION; bytes that cannot be filtered (images, video, archives) are
// stamped 'binary'.
//
// It blanks: provider tokens and JWTs (secret-patterns.mjs, the push scan's list), auth headers, URL query
// secrets, URL credentials (scheme://user:pass@host), PEM private-key blocks (the whole block), KEY=value /
// KEY: value pairs whose key names a secret (FOO_API_KEY=..., password: ...), and the declared secrets of a
// product repo's .starcistacks (their env-style names as keys, and their values wherever they appear).
// Keys and surrounding words stay, so a redacted transcript still reads.
import fs from 'node:fs';
import path from 'node:path';
import { FORBIDDEN_FILES, SECRET_PATTERNS } from './secret-patterns.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { altOf } from './source-phrases.mjs';
import { redactResolvedSecrets } from '../../engine/secrets.mjs';

const REDACTION_VERSION = 'v1';
export const MARK = '[redacted]';

const withGlobal = (re) => new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
const PATTERNS = SECRET_PATTERNS.filter((rule) => rule.name !== 'private-key-block').map((rule) => ({ ...rule, g: withGlobal(rule.re) }));
// Words that make an env-style key a secret, matched per `_`-separated segment of the name (FOO_API_KEY,
// KEYCLOAK_ADMIN_PASSWORD, GH_TOKEN, MINIO_SECRET_KEY, DATABASE_URL is not; TESTS_PASSED is not).
const SECRET_SEGMENTS = new Set(['PASSWORD', 'PASSWD', 'PWD', 'PASS', 'SECRET', 'SECRETS', 'TOKEN', 'APIKEY', 'KEY', 'CREDENTIAL', 'CREDENTIALS', 'COOKIE', 'OTP', 'DSN', 'PAT']);
const isSecretEnvName = (name) => String(name).replace(/^export\s+/, '').replace(/_FILE$/, '').split('_').some((seg) => SECRET_SEGMENTS.has(seg));
const PEM_BLOCK = /-----BEGIN ((?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY(?: BLOCK)?)-----[\s\S]*?(?:-----END \1-----|$)/g;
const RULES = [
  { name: 'url-credentials', re: /\b([a-z][a-z0-9+.-]*:\/\/)([^\s:@/"'<>]+):([^\s@/"'<>]+)@/gi, to: (m, scheme, user) => `${scheme}${user}:${MARK}@` },
  { name: 'auth-header', re: /\b(Bearer|Basic|Token)(\s+)[A-Za-z0-9._~+/=-]{8,}/gi, to: (m, a, b) => `${a}${b}${MARK}` },
  { name: 'url-secret', re: /([?&#](?:access_token|refresh_token|id_token|token|key|api_key|apikey|secret|code|password|otp|sig|signature)=)([^&#\s"']+)/gi, to: (m, a) => `${a}${MARK}` },
  { name: 'otp', re: new RegExp(`\\b(otp|one[-_ ]?time[-_ ]?(?:code|password|pin)|verification[-_ ]?code|2fa[-_ ]?code|${altOf('redact.otpLabel')})(\\s*[:=]?\\s*["']?)(\\d{4,8})\\b`, 'giu'), to: (m, a, b) => `${a}${b}${MARK}` },
  // ENV_STYLE_KEY=value / ENV_STYLE_KEY: value (shell exports, dotenv, compose, CLI echo).
  { name: 'env-secret', re: /\b((?:export\s+)?[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*)(\s*[:=]\s*["']?)((?!\[redacted)[^\s"'`]{3,})/g,
    to: (m, a, b, c) => (isSecretEnvName(a) && !c.startsWith('/run/secrets/') && !c.startsWith('$') ? `${a}${b}${MARK}` : m) },
  { name: 'keyed-secret', re: /\b(password|passwd|pwd|secret|api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|auth[_-]?token|session[_-]?token|private[_-]?key|otp|pin[_-]?code|cookie|set-cookie)(["']?\s*[:=]\s*["']?)((?!\[redacted)[^\s"',;&}]{3,})/gi, to: (m, a, b) => `${a}${b}${MARK}` },
];

/** Keys whose value is a secret whatever it looks like; the key stays, the value goes. */
export const SECRET_KEY = /^(?:password|passwd|pwd|pass|secret|otp|pin|pincode|pin_code|credential|credentials|authorization|cookie|cookies|set-cookie|private[_-]?key|client[_-]?secret|api[_-]?key|apikey|[a-z_-]*token|[a-z_-]*secret)$/i;

// ------------------------------------------------------------------------------ declared stack secrets
// A product repo's .starcistacks/<stack>/stack.yaml `secrets:` block names each secret and the runtime file
// that holds its value. Values are refreshed from their declared inputs; values never leave the filter.
const STACK_DIRS = ['.starcistacks'];
const secretValues = new Set();
const secretNames = new Set();
const envName = (name) => String(name).replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').toUpperCase();
const readSafe = (file) => { try { return fs.readFileSync(file, 'utf8'); } catch { return null; } };
const listSafe = (dir) => { try { return fs.readdirSync(dir, { withFileTypes: true }); } catch { return []; } };

/** A value this process must never write out (a secret it resolved itself). Values under 6 chars are ignored. */
function addSecretValue(value) {
  const v = typeof value === 'string' ? value.trim() : '';
  if (v.length >= 6 && !/^\[redacted/.test(v)) secretValues.add(v);
}

/** Learn the declared secrets of every .starcistacks stack under `repoRoot` (idempotent). */
export function learnStackSecrets(repoRoot) {
  if (typeof repoRoot !== 'string' || !repoRoot) return;
  const root = path.resolve(repoRoot);
  for (const stackDir of STACK_DIRS) {
    for (const entry of listSafe(path.join(root, stackDir))) {
      if (!entry.isDirectory()) continue;
      const dir = path.join(root, stackDir, entry.name);
      const text = readSafe(path.join(dir, 'stack.yaml'));
      let doc = null;
      try { doc = text ? parseYaml(text) : null; } catch { doc = null; }
      const secrets = doc && typeof doc.secrets === 'object' && doc.secrets ? doc.secrets : {};
      for (const [name, spec] of Object.entries(secrets)) {
        secretNames.add(envName(name));
        if (spec && typeof spec.file === 'string') addSecretValue(readSafe(path.resolve(dir, spec.file)));
      }
      // Plaintext runtime copies of the secrets (git-ignored): their values are secrets too.
      for (const file of listSafe(path.join(dir, 'runtime', 'files'))) if (file.isFile()) addSecretValue(readSafe(path.join(dir, 'runtime', 'files', file.name)));
    }
  }
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
let namesRe = null, namesSize = -1;
const declaredNameRule = () => {
  if (namesSize !== secretNames.size) {
    namesSize = secretNames.size;
    namesRe = secretNames.size ? new RegExp(`\\b((?:${[...secretNames].map(escapeRe).join('|')})(?:_FILE)?)(\\s*[:=]\\s*["']?)((?!\\[redacted)[^\\s"'\`]{3,})`, 'g') : null;
  }
  return namesRe;
};

// --------------------------------------------------------------------------------------------- text
/**
 * `text` with every secret value blanked. `repoRoots` (optional) are product repos whose .starcistacks
 * declarations are learned first.
 */
export function redactText(text, { repoRoots = [] } = {}) {
  if (typeof text !== 'string' || !text) return text;
  for (const root of repoRoots) learnStackSecrets(root);
  let out = redactResolvedSecrets(text).replace(PEM_BLOCK, (m, kind) => `[redacted:pem ${kind}]`);
  for (const value of secretValues) if (out.includes(value)) out = out.split(value).join('[redacted:stack-secret]');
  for (const rule of PATTERNS) {
    rule.g.lastIndex = 0;
    out = out.replace(rule.g, (match, value) => {
      if (rule.name === 'assigned-secret') return rule.placeholder?.test(value ?? '') ? match : match.replace(value, MARK);
      return `[redacted:${rule.name}]`;
    });
  }
  const declared = declaredNameRule();
  if (declared) { declared.lastIndex = 0; out = out.replace(declared, (m, a, b) => `${a}${b}${MARK}`); }
  for (const rule of RULES) { rule.re.lastIndex = 0; out = out.replace(rule.re, rule.to); }
  return out;
}

/** A path that is a secret by being one (an env file, a key file, .secrets/): blanked, its rule named. */
export function redactPath(p) {
  if (typeof p !== 'string') return p;
  const slashed = p.replace(/\\/g, '/');
  const rule = FORBIDDEN_FILES.find((r) => r.test(slashed));
  return rule ? `[redacted:${rule.name}]` : redactText(p);
}

/** A deep copy of `value` with secret-named keys blanked and every string redacted. */
export function redactData(value, key = null, depth = 0) {
  if (depth > 8) return '[depth]';
  if (key && SECRET_KEY.test(key) && value != null && typeof value !== 'object' && typeof value !== 'boolean') return MARK;
  if (typeof value === 'string') return /(?:path|ref|file)$/i.test(key ?? '') ? redactPath(value) : redactText(value);
  if (Array.isArray(value)) return value.map((v) => redactData(v, null, depth + 1));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, redactData(v, k, depth + 1)]));
  return value;
}

// -------------------------------------------------------------------------------------------- bytes
/** True for media types whose bytes are text the filter can read. */
export const isTextMedia = (mediaType) => /^text\/|[/+](?:json|xml|yaml|x-yaml|javascript|x-ndjson|x-diff|x-patch|csv|sql|x-sh)\b|^application\/(?:json|xml|yaml|javascript|x-ndjson|x-diff|x-patch|sql)$/i
  .test(String(mediaType ?? ''));

/** The supported text encoding selected by a byte-order mark. */
export function textEncodingOf(bytes) {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) return 'utf-16le';
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) return 'utf-16be';
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return 'utf-8-bom';
  return 'utf-8';
}

/** Decode supported text without accepting malformed bytes as sanitized evidence. */
export function decodeText(bytes) {
  const encoding = textEncodingOf(bytes);
  return new TextDecoder(encoding === 'utf-8-bom' ? 'utf-8' : encoding, { fatal: true }).decode(bytes);
}

/**
 * Bytes ready for a blob put: text bytes redacted ({redaction:'v1'}), anything else untouched
 * ({redaction:'binary'}). The blob sha is then taken over the returned bytes.
 */
export function redactBytes(bytes, mediaType, { repoRoots = [] } = {}) {
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  if (!isTextMedia(mediaType)) return { bytes: buf, redaction: 'binary' };
  const text = decodeText(buf);
  const clean = redactText(text, { repoRoots });
  return { bytes: Buffer.from(clean, 'utf8'), redaction: REDACTION_VERSION };
}
