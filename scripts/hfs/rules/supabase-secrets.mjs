// supabase-secrets.mjs - L17 extends the one R06 secret scan for edition lite. It keeps the ordinary
// HFS_PLAINTEXT_SECRET judgement, then adds the reduced lite custody tree and provider-shaped literals
// which are meaningful only in the Supabase/FE surface. Findings name shapes, never captured values.
import { Buffer } from 'node:buffer';
import { secretFindings } from './secrets.mjs';
import { found, readText } from './read.mjs';

const LITE_SECRET_CUSTODY = 'HFS_LITE_SECRET_CUSTODY';

const LOCKFILE = /(^|\/)package-lock\.json$/u;
const ROOT_ENV = /^\.env(?:\..*)?$/iu;
const SECRETS_ENV = /^secrets\.env$/iu;
const SECRETS_DIRECTORY = /^\.secrets(?:\/|$)/iu;
const SEALED_HOME = /^\.starcistacks\/[^/]+\/secrets\/[^/]+\.enc$/iu;

const LITE_SECRET_PATTERNS = Object.freeze([
  { name: 'supabase-personal-access-token', re: /\bsbp_[A-Za-z0-9_-]{20,}\b/u },
  { name: 'supabase-publishable-key', re: /\bsb_publishable_[A-Za-z0-9_-]{20,}\b/u },
  { name: 'supabase-secret-token', re: /\bsb_secret_[A-Za-z0-9_-]{20,}\b/u },
  { name: 'password-connection-string', re: /\b(?:postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|redis):\/\/[^:\s/@]+:[^@\s/${}]{8,}@/iu },
]);
const JWT_CANDIDATE = /(?<![A-Za-z0-9_-])eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}(?![A-Za-z0-9_-])/gu;

const jsonObject = segment => {
  try {
    const value = JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
};

const validJwt = candidate => {
  const [header, payload, signature, extra] = candidate.split('.');
  if (extra !== undefined || !signature) return false;
  const decodedHeader = jsonObject(header);
  const decodedPayload = jsonObject(payload);
  return typeof decodedHeader?.alg === 'string' && decodedHeader.alg.toLowerCase() !== 'none' && decodedPayload !== null;
};

const liteSecretPatterns = line => {
  const names = LITE_SECRET_PATTERNS.filter(pattern => pattern.re.test(line)).map(pattern => pattern.name);
  if ([...line.matchAll(JWT_CANDIDATE)].some(match => validJwt(match[0]))) names.push('supabase-eyj-service-token');
  return names;
};

const inSecretFreeTree = (repo, file) => repo.profile === 'fe' || file.startsWith('fe/') || file.startsWith('supabase/');

/** Raw L17 findings. The catalog-driven findings filter decides which editions judge them. */
export function liteSecretCustodyFindings({ repoRoot, files, repo }) {
  const findings = [];
  for (const file of files) {
    if (repo.profile === 'app') {
      if (ROOT_ENV.test(file) || SECRETS_ENV.test(file) || SECRETS_DIRECTORY.test(file)) {
        findings.push(found(LITE_SECRET_CUSTODY, file, `${file} is forbidden at the lite app root; lite keeps no .env*, secrets.env or .secrets/ custody path.`, { pattern: 'lite-forbidden-entry' }));
        continue;
      }
      if (file.endsWith('.enc') && !SEALED_HOME.test(file)) {
        findings.push(found(LITE_SECRET_CUSTODY, file, `${file} is a sealed file outside .starcistacks/<env>/secrets/; lite has exactly one encrypted custody path.`, { pattern: 'sealed-file-home' }));
      }
    } else if (file.endsWith('.enc')) {
      findings.push(found(LITE_SECRET_CUSTODY, file, `${file} is a sealed file inside a side tree; lite keeps *.enc only at the app root under .starcistacks/<env>/secrets/.`, { pattern: 'sealed-file-home' }));
    }
    if (!inSecretFreeTree(repo, file) || LOCKFILE.test(file)) continue;
    const text = readText(repoRoot, file);
    if (text === null) continue;
    const seen = new Set();
    const lines = text.split(/\r?\n/u);
    for (let index = 0; index < lines.length; index += 1) {
      for (const pattern of liteSecretPatterns(lines[index])) {
        if (seen.has(pattern)) continue;
        seen.add(pattern);
        findings.push(found(LITE_SECRET_CUSTODY, file, `${file}:${index + 1} holds a provider-shaped secret (${pattern}); lite keeps no secret literal under fe/ or supabase/.`, { line: index + 1, pattern }));
      }
    }
  }
  return findings;
}

/**
 * Drop-in extension of secretFindings for scripts/hfs/check.mjs. When an L17 finding identifies the same file/line as
 * the generic R06 scanner (a complete JWT, for example), the specific lite code wins so one physical issue is emitted once.
 */
export function supabaseSecretFindings(input) {
  const ordinary = secretFindings(input);
  const lite = liteSecretCustodyFindings(input);
  const liteJwtAuthority = (input.repo.edition ?? 'full') === 'lite';
  return [...ordinary.filter(item => !(liteJwtAuthority && item.pattern === 'jwt' && inSecretFreeTree(input.repo, item.path))), ...lite];
}
