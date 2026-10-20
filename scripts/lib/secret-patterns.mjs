import { parseYaml } from '../../engine/yaml.mjs';

// secret-patterns.mjs — the one list of secret shapes the runtime refuses to carry: the push secret scan
// (scripts/supervisor/push-mains.mjs scanDiff) refuses an outgoing range that adds one, and the typed-log
// redaction (scripts/kernel/typed-logs.mjs redactText) blanks the value before a log row is stored.
// FORBIDDEN_FILES name paths that are secrets by being (an env file, a key file); SECRET_PATTERNS match values.

export const FORBIDDEN_FILES = [
  { name: 'env-file', test: (f) => /(^|\/)\.env(\.[^/]*)?$/i.test(f) && !/\.env\.(example|sample|template)$/i.test(f) },
  { name: 'secrets-dir', test: (f) => /(^|\/)\.secrets\//i.test(f) },
  { name: 'private-key-file', test: (f) => /\.(pem|key|p12|pfx)$/i.test(f) || /(^|\/)id_(rsa|ed25519|ecdsa)$/i.test(f) },
  // .starcistacks/<stack>/secrets/ commits sops twins only (owner ruling push-scan-test-secrets-encrypted): a plaintext
  // credential there - a test password included - is git-ignored by the product repo and never pushed.
  { name: 'starcistacks-secret-plaintext', test: (f) => /(^|\/)\.starcistacks\/[^/]+\/secrets\//i.test(f) && !/(\.enc|\/\.gitkeep|\/KEYS\.md)$/i.test(f) },
  { name: 'credentials-json', test: (f) => /(^|\/)(credentials|service-account|client_secret)[^/]*\.json$/i.test(f) },
];
// `word` in any case (name checks are case-aware by construction, not by flag).
const fold = (word) => word.replace(/[a-z]/gi, (c) => `[${c.toLowerCase()}${c.toUpperCase()}]`);

// A name that holds secret material: the keyword is an identifier segment, so DB_PASSWORD, dbPassword,
// OPENAI_API_KEY, api_secret and accessToken are candidates while `secondary`, `tokenize`, `monkey`, `secrets.x`
// and `$secret` are not. A segment starts at the name edge, after `_`/`-`/`.`, or at a camel hump.
const SECRET_WORD = [
  'password', 'passwd', 'passphrase', 'secret', 'credentials?', 'token',
  'api[_-]?key', 'access[_-]?token', 'auth[_-]?token', 'refresh[_-]?token', 'id[_-]?token', 'session[_-]?token',
  'client[_-]?secret', 'api[_-]?secret', 'session[_-]?secret', 'jwt[_-]?secret',
  'private[_-]?key', 'secret[_-]?key', 'signing[_-]?key', 'encryption[_-]?key', 'master[_-]?key',
  'service[_-]?role[_-]?key', 'service[_-]?key', 'session[_-]?key',
].map((word) => fold(word)).join('|');

// A name whose last segment is configuration, not material: SECRET_FILE and *_PATH point at the materialized
// secret file (the materializer's own form), PASSWORD_MIN_LENGTH is a number, *_REF/_ID a reference.
const BENIGN_WORD = [
  'file', 'path', 'dir', 'url', 'uri', 'endpoint', 'host', 'refs?', 'names?', 'ids?', 'arn', 'urn',
  'length', 'min', 'max', 'size', 'count', 'budget', 'limit', 'regex', 'pattern', 'policy',
  'algorithm', 'scheme', 'expiry', 'expires', 'ttl', 'required', 'enabled', 'disabled', 'type', 'version',
].map((word) => fold(word)).join('|');

const SEGMENT_BEFORE = String.raw`(?:(?<![A-Za-z0-9_$])|(?<=[_\-.])|(?<=[a-z])(?=[A-Z]))`;
const NAME_REST = '[A-Za-z0-9_$.-]*?';
const SECRET_NAME = [
  '(?<![A-Za-z0-9_$])',
  String.raw`(?!${NAME_REST}${SEGMENT_BEFORE}(?:${BENIGN_WORD})(?=\s*[:=]))`,
  String.raw`(?=${NAME_REST}${SEGMENT_BEFORE}(?:${SECRET_WORD})(?=[_\-.]|[A-Z]|[^A-Za-z0-9_$]|$))`,
  String.raw`[A-Za-z_$][A-Za-z0-9_$.-]*\s*[:=]\s*`,
].join('');

// `password = "example-password-1"` — the quoted literal. `env(NAME)` is a reference, never a secret.
const ASSIGNED_QUOTED = new RegExp(
  SECRET_NAME + String.raw`['"\`](?!env\([A-Z_][A-Z0-9_]*\)['"\`])([^'"\`\n\s$<{]{12,})['"\`]`,
);
// `DB_PASSWORD=example-password-1` — the compose list-item and dotenv form; the dotenv value has no `:` so
// `password: secret:db/password` and `token: ref:vault/api` stay references, and the end boundary keeps
// calls and member/index references such as `secret = credentialsSource.current` out of the literals.
const ASSIGNED_UNQUOTED = new RegExp(
  SECRET_NAME + String.raw`(?!['"\`]|env\()([A-Za-z0-9_+=-]{12,})(?![A-Za-z0-9_+=.(\[-])`,
);

const NAME_WORD = (word, tail) => new RegExp(`^${NAME_REST}${SEGMENT_BEFORE}(?:${word})${tail}`);
const SECRET_NAME_TEST = NAME_WORD(SECRET_WORD, String.raw`(?:[_\-.]|[A-Z]|[^A-Za-z0-9_$]|$)`);
const BENIGN_TAIL_TEST = NAME_WORD(BENIGN_WORD, '$');

/** True when a bare variable `name` holds secret material as an identifier segment (DB_PASSWORD, dbPassword,
 *  SUPABASE_SERVICE_ROLE_KEY) and does not end in a config suffix (PASSWORD_MIN_LENGTH, SECRET_FILE,
 *  tokenBudget). The same name judgement the `assigned-secret` patterns make, for callers that read keys. */
export const secretNameLike = (name) => SECRET_NAME_TEST.test(name) && !BENIGN_TAIL_TEST.test(name);

export const SECRET_PATTERNS = [
  { name: 'private-key-block', re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/ },
  { name: 'aws-access-key', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'github-token', re: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b|\bgithub_pat_\w{50,}\b/ },
  { name: 'anthropic-key', re: /\bsk-ant-[A-Za-z0-9_-]{20,}/ },
  { name: 'openai-key', re: /\bsk-(?:proj-)?[A-Za-z0-9]{32,}\b/ },
  { name: 'slack-token', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}/ },
  { name: 'google-api-key', re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { name: 'telegram-bot-token', re: /\b\d{8,10}:AA[0-9A-Za-z_-]{33}\b/ },
  { name: 'stripe-secret', re: /\b(?:sk|rk)_live_[0-9A-Za-z]{20,}\b/ },
  { name: 'jwt', re: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
  { name: 'age-secret-key', re: /\bAGE-SECRET-KEY-1[0-9A-Z]{20,}\b/ },
  { name: 'password-connection-string', re: /\b(?:postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|redis):\/\/[^:\s/@]+:[^@\s/${}]{8,}@/iu },
  // A value written `env(NAME)` (the Supabase config.toml reference form) names a variable, not a secret.
  // A keyword-assigned value that names itself a stand-in (a test stub's `accessToken: "fixture-..."`) is no
  // candidate; only this heuristic takes the exemption, never a provider-shaped token above.
  // A spec file's keyword-assigned values are test inputs (a spec's sign-in
  // form password and a mocked accessToken once refused a push): the heuristic skips spec files too.
  // A SCREAMING_SNAKE quoted value in source is a public code (an enum member whose value is an upper-case code), not a credential.
  { name: 'assigned-secret', re: ASSIGNED_QUOTED, sourceCode: /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/, placeholder: /fixture|stub|fake|dummy|placeholder|example|sample|changeme|redacted|mock/i,
    skipFile: /\.(?:spec|test|e2e-spec)\.[cm]?[jt]sx?$/ },
  // An unquoted value in TypeScript or JavaScript source is an identifier or a type (`token: InjectionToken`,
  // `MODULE_OPTIONS_TOKEN: DATABASE_OPTIONS_TOKEN`), never a literal; the unquoted form is the dotenv, compose and toml shape.
  { name: 'assigned-secret', re: ASSIGNED_UNQUOTED, placeholder: /fixture|stub|fake|dummy|placeholder|example|sample|changeme|redacted|mock/i,
    skipFile: /\.(?:spec|test|e2e-spec)\.[cm]?[jt]sx?$|\.[cm]?[jt]sx?$/ },
];


/** The names of the patterns one line of `file` matches (never the value). A stand-in value and a spec file's keyword assignment are no hit. */
export function secretHits(file, text) {
  const names = [];
  for (const rule of SECRET_PATTERNS) {
    if (rule.skipFile?.test(file ?? '')) continue;
    const hit = rule.re.exec(text);
    if (hit && rule.sourceCode?.test(hit[1] ?? '') && /\.[cm]?[jt]sx?$/.test(file ?? '')) continue;
    if (hit && !rule.placeholder?.test(hit[1] ?? '')) names.push(rule.name);
  }
  return names;
}

const BADGE_BEGIN = '<!-- >>> starci app sync (managed block; do not edit) >>> -->';
const BADGE_END = '<!-- <<< starci app sync <<< -->';

/** Provider-shaped credentials remain refused even where the keyword heuristic admits public badge tokens. */
function blankBadgeValue(value) {
  return secretHits('badge.mjs', value).length ? value : ' '.repeat(value.length);
}

/** Only scalar values at the two block-mapping service paths qualify; every other YAML substring remains scanned. */
function manifestBadgeText(text) {
  try { parseYaml(text); } catch { return text; }
  const parents = [];
  return text.split('\n').map(line => {
    if (/^\s*(?:#.*)?$/.test(line)) return line;
    const indent = /^ */.exec(line)[0].length;
    while (parents.length && parents.at(-1).indent >= indent) parents.pop();
    const match = /^( *)(?:([A-Za-z0-9_-]+)|"([A-Za-z0-9_-]+)"|'([A-Za-z0-9_-]+)'):(.*)$/.exec(line);
    if (!match) { parents.push({ indent, key: null }); return line; }
    match[5] = match[5].trimStart();
    const key = match[2] ?? match[3] ?? match[4];
    const keys = [...parents.map(parent => parent.key), key].join('.');
    const container = /^(?:#.*)?$/.test(match[5].trim());
    const nestedScalar = parents.some(parent => parent.container === false);
    parents.push({ indent, key, container });
    if (nestedScalar) return line;
    if (!['services.codecov.badgeToken', 'services.sonar.badgeToken'].includes(keys)) return line;
    const scalar = /^(?:"([A-Za-z0-9_-]{6,128})"|'([A-Za-z0-9_-]{6,128})'|([A-Za-z0-9_-]{6,128}))(?=\s*(?:#|$))/.exec(match[5]);
    if (!scalar) return line;
    const start = line.length - match[5].length;
    return line.slice(0, start) + blankBadgeValue(scalar[0]) + match[5].slice(scalar[0].length);
  }).join('\n');
}

/** Unreadable manifests admit only the default badge hosts; readable Sonar declarations select their own hosts. */
function badgeHosts(manifestText) {
  const hosts = new Set(['codecov.io']);
  let doc;
  try { doc = parseYaml(manifestText); } catch { hosts.add('sonarcloud.io'); return hosts; }
  const sonar = doc?.services?.sonar;
  if (sonar?.provider === 'sonarcloud') hosts.add('sonarcloud.io');
  else for (const host of [sonar?.host?.public, sonar?.host?.local]) {
    try { hosts.add(new URL(host).host); } catch { /* Invalid hosts admit nothing. */ }
  }
  return hosts;
}

/** Only token query values in managed Markdown badge images on declared hosts are blanked; links and other parameters remain scanned. */
function readmeBadgeText(text, manifestText) {
  const begin = text.indexOf(BADGE_BEGIN), end = text.indexOf(BADGE_END, begin + BADGE_BEGIN.length);
  if (begin < 0 || end < 0) return text;
  const hosts = badgeHosts(manifestText);
  const start = begin + BADGE_BEGIN.length;
  const block = text.slice(start, end).replace(/!\[[^\]\n]*\]\((https?:\/\/[^\s)]+)\)/g, (image, address) => {
    let url;
    try { url = new URL(address); } catch { return image; }
    if (!hosts.has(url.host) || url.username || url.password) return image;
    const badgePath = url.host === 'codecov.io' ? url.pathname.endsWith('/graph/badge.svg') : url.pathname === '/api/project_badges/measure';
    if (!badgePath) return image;
    const fragment = address.indexOf('#');
    const queryEnd = fragment < 0 ? address.length : fragment;
    const safe = address.slice(0, queryEnd).replace(/([?&]token=)([^&#)\s]*)/g, (_, prefix, value) => prefix + blankBadgeValue(value));
    return image.replace(address, () => safe + address.slice(queryEnd));
  });
  return text.slice(0, start) + block + text.slice(end);
}

/** Whole-file secret judgement exempts only declared public badge values and preserves original line numbers and every provider shape. */
export function secretHitsInFile(file, fullText, { manifestText } = {}) {
  const normalized = file.replaceAll('\\', '/');
  let text = fullText;
  if (/(?:^|\/)\.starcistacks\/application-stacks\.yaml$/.test(normalized)) text = manifestBadgeText(text);
  if (/(?:^|\/)README\.md$/.test(normalized)) text = readmeBadgeText(text, manifestText);
  return text.split(/\r?\n/).flatMap((line, index) => secretHits(file, line).map(pattern => ({ line: index + 1, pattern })));
}
