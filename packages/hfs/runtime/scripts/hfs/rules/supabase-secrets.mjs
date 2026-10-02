// supabase-secrets.mjs - L17 extends the one R06 secret scan for edition lite. It keeps the ordinary
// HFS_PLAINTEXT_SECRET judgement, then adds the reduced lite custody tree and provider-shaped literals
// which are meaningful only in the Supabase/FE surface. Findings name shapes, never captured values.
import { secretFindings } from './secrets.mjs';
import { found, readText } from './read.mjs';

const LITE_SECRET_CUSTODY = 'HFS_LITE_SECRET_CUSTODY';

const LOCKFILE = /(^|\/)package-lock\.json$/u;
const ROOT_ENV = /^\.env(?:\..*)?$/iu;
const SECRETS_ENV = /^secrets\.env$/iu;
const SECRETS_DIRECTORY = /^\.secrets(?:\/|$)/iu;
const SEALED_HOME = /^\.starcistacks\/[^/]+\/secrets\/[^/]+\.enc$/iu;

const LITE_SECRET_PATTERNS = Object.freeze([
  { name: 'supabase-publishable-token', re: /\bsbp_[A-Za-z0-9_-]{20,}\b/u },
  { name: 'supabase-secret-token', re: /\bsb_secret_[A-Za-z0-9_-]{20,}\b/u },
  // This catches a copied JWT/service token even when it is truncated before the second/third segment. The generic R06
  // scanner already recognises a complete JWT; the wrapper below gives the more specific lite finding precedence.
  { name: 'supabase-eyj-service-token', re: /\beyJ[A-Za-z0-9_.-]{60,}\b/u },
  { name: 'password-connection-string', re: /\b(?:postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|redis):\/\/[^:\s/@]+:[^@\s/${}]{8,}@/iu },
]);

const inSecretFreeTree = (repo, file) => repo.profile === 'fe' || file === 'fe' || file.startsWith('fe/')
  || file === 'supabase' || file.startsWith('supabase/');

/** L17 findings only. Full edition is unchanged: R06 remains its one custody scanner. */
export function liteSecretCustodyFindings({ repoRoot, files, repo }) {
  if ((repo.edition ?? 'full') !== 'lite') return [];
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
      for (const pattern of LITE_SECRET_PATTERNS) {
        if (!pattern.re.test(lines[index]) || seen.has(pattern.name)) continue;
        seen.add(pattern.name);
        findings.push(found(LITE_SECRET_CUSTODY, file, `${file}:${index + 1} holds a provider-shaped secret (${pattern.name}); lite keeps no secret literal under fe/ or supabase/.`, { line: index + 1, pattern: pattern.name }));
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
  const jwt = new Set(lite.filter(item => item.pattern === 'supabase-eyj-service-token').map(item => `${item.path}:${item.line ?? ''}`));
  return [...ordinary.filter(item => !(item.pattern === 'jwt' && jwt.has(`${item.path}:${item.line ?? ''}`))), ...lite];
}
