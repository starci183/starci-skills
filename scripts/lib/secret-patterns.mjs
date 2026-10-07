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
  // A value written `env(NAME)` (the Supabase config.toml reference form) names a variable, not a secret.
  // A keyword-assigned value that names itself a stand-in (a test stub's `accessToken: "fixture-..."`) is no
  // candidate; only this heuristic takes the exemption, never a provider-shaped token above.
  // A spec file's keyword-assigned values are test inputs (a spec's sign-in
  // form password and a mocked accessToken once refused a push): the heuristic skips spec files too.
  { name: 'assigned-secret', re: new RegExp([
    String.raw`\b(?:password|passwd|secret|api[_-]?key|access[_-]?token|client[_-]?secret)`,
    String.raw`\b\s*[:=]\s*['"](?!env\([A-Z_][A-Z0-9_]*\)['"])([^'"\s$<{]{12,})`,
    `['"]`,
  ].join(''), 'i'), placeholder: /fixture|stub|fake|dummy|placeholder|example|sample|changeme|redacted|mock/i,
    skipFile: /\.(?:spec|test|e2e-spec)\.[cm]?[jt]sx?$/ },
];


/** The names of the patterns one line of `file` matches (never the value). A stand-in value and a spec file's keyword assignment are no hit. */
export function secretHits(file, text) {
  const names = [];
  for (const rule of SECRET_PATTERNS) {
    if (rule.skipFile?.test(file ?? '')) continue;
    const hit = rule.re.exec(text);
    if (hit && !rule.placeholder?.test(hit[1] ?? '')) names.push(rule.name);
  }
  return names;
}
