// database-config.mjs - L08 Supabase TOML policy and L09 generated-type drift checks. Parsing and type emission stay
// lazy/injected so applications without Supabase do not load either tool and this rule starts no Docker process.
import { sameText } from '../../lib/same-text.mjs';
import { found, readText } from './read.mjs';
import { DB_CONFIG_POLICY, DB_TYPES_DRIFT, TYPES_FILE } from './database-constants.mjs';
const ENV_REF = /^env\([A-Za-z_][A-Za-z0-9_]*\)$/;
const PUBLIC_KEYS = new Set(['anon_key', 'publishable_key', 'public_key']);


function tomlEntries(value, path = []) {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap((item) => tomlEntries(item, path));
  return Object.entries(value).flatMap(([key, child]) => {
    const at = [...path, key];
    if (child && typeof child === 'object') {
      if (Array.isArray(child)) {
        if (child.every((item) => item && typeof item === 'object' && !Array.isArray(item))) return child.flatMap((item) => tomlEntries(item, at));
      } else return tomlEntries(child, at);
    }
    return [[at.join('.'), key, child]];
  });
}

const isCredentialKey = (key) => {
  const leaf = key.toLowerCase();
  return ['secret', 'client_id', 'key', 'pass', 'password', 'token'].includes(leaf)
    || /_(secret|password|token|client_id|api_key)$/.test(leaf)
    || (leaf.endsWith('_key') && !PUBLIC_KEYS.has(leaf));
};

const tomlLine = (text, key) => {
  const expression = new RegExp(`^\\s*["']?${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']?\\s*=`, 'm');
  const match = expression.exec(text);
  return match ? text.slice(0, match.index).split('\n').length : undefined;
};

/** The parsed TOML of `text`, or null when it does not parse. */
export async function parseToml(text) {
  try {
    const module = await import('smol-toml');
    return (module.default?.parse ?? module.parse)(text);
  } catch {
    return null;
  }
}

/** L08 policy findings in one already-parsed supabase/config.toml. */
export function configFindings({ file, text, toml, supabase }) {
  const findings = [];
  for (const [at, key, value] of tomlEntries(toml)) {
    if (!isCredentialKey(key)) continue;
    const line = tomlLine(text, key);
    if (typeof value !== 'string' || !ENV_REF.test(value)) {
      findings.push(found(DB_CONFIG_POLICY, file, `${file}${line ? `:${line}` : ''} ${at} holds a literal credential; a secret in config.toml is written env(NAME), never a value`, { ...(line ? { line } : {}), key: at }));
    }
  }
  const auth = toml?.auth ?? {};
  if (auth.jwt_expiry !== undefined && (typeof auth.jwt_expiry !== 'number' || auth.jwt_expiry > 3600)) {
    findings.push(found(DB_CONFIG_POLICY, file, `${file} auth.jwt_expiry is ${JSON.stringify(auth.jwt_expiry)}; the access token lives at most 3600 seconds`, { key: 'auth.jwt_expiry' }));
  }
  if (!supabase) return findings;
  const declared = {
    enableSignup: supabase.enableSignup, jwtExpiry: supabase.jwtExpiry, siteUrl: supabase.siteUrl,
    redirectUrls: Array.isArray(supabase.redirectUrls) ? supabase.redirectUrls : undefined,
  };
  if (declared.jwtExpiry !== undefined && auth.jwt_expiry !== declared.jwtExpiry) {
    findings.push(found(DB_CONFIG_POLICY, file, `${file} auth.jwt_expiry is ${JSON.stringify(auth.jwt_expiry ?? 'absent')}; hfs.json supabase.jwtExpiry declares ${declared.jwtExpiry}`, { key: 'auth.jwt_expiry', declared: declared.jwtExpiry }));
  }
  if (declared.enableSignup !== undefined) {
    if (auth.enable_signup !== declared.enableSignup) findings.push(found(DB_CONFIG_POLICY, file, `${file} auth.enable_signup is ${JSON.stringify(auth.enable_signup ?? 'absent')}; hfs.json supabase.enableSignup declares ${declared.enableSignup} - the invite posture is a checked fact, not a doc claim`, { key: 'auth.enable_signup', declared: declared.enableSignup }));
    if (auth.email?.enable_signup !== undefined && auth.email.enable_signup !== declared.enableSignup) {
      findings.push(found(DB_CONFIG_POLICY, file, `${file} auth.email.enable_signup is ${JSON.stringify(auth.email.enable_signup)}; hfs.json supabase.enableSignup declares ${declared.enableSignup}`, { key: 'auth.email.enable_signup', declared: declared.enableSignup }));
    }
  }
  if (declared.siteUrl !== undefined && auth.site_url !== declared.siteUrl) {
    findings.push(found(DB_CONFIG_POLICY, file, `${file} auth.site_url is ${JSON.stringify(auth.site_url ?? 'absent')}; hfs.json supabase.siteUrl declares ${declared.siteUrl}`, { key: 'auth.site_url', declared: declared.siteUrl }));
  }
  if (declared.redirectUrls !== undefined) {
    const configured = Array.isArray(auth.additional_redirect_urls) ? auth.additional_redirect_urls : [];
    for (const url of configured) {
      if (!declared.redirectUrls.includes(url)) findings.push(found(DB_CONFIG_POLICY, file, `${file} auth.additional_redirect_urls holds ${url}, which hfs.json supabase.redirectUrls does not declare; the config states nothing the app did not declare`, { key: 'auth.additional_redirect_urls', url }));
    }
    for (const url of declared.redirectUrls) {
      if (!configured.includes(url)) findings.push(found(DB_CONFIG_POLICY, file, `${file} auth.additional_redirect_urls omits ${url}, which hfs.json supabase.redirectUrls declares; the config and declaration must carry the same redirect set`, { key: 'auth.additional_redirect_urls', url }));
    }
  }
  return findings;
}

/** L09 drift findings for the committed generated database type file. */
export async function typesFindings({ repoRoot, files, emitTypes, declaration }) {
  if (typeof emitTypes !== 'function') return [];
  const tracked = new Set(files);
  let emitted;
  try { emitted = await emitTypes({ repoRoot, declaration }); } catch (error) {
    return [found(DB_TYPES_DRIFT, TYPES_FILE, `${TYPES_FILE} cannot be verified: the types emit failed (${String(error?.message ?? error).split('\n').filter(Boolean).slice(0, 3).join(' | ')})`, { drift: 'emit-failed' })];
  }
  const committed = tracked.has(TYPES_FILE) ? readText(repoRoot, TYPES_FILE) : null;
  if (committed === null) return [found(DB_TYPES_DRIFT, TYPES_FILE, `${TYPES_FILE} is not committed; run \`npm run contract:emit\` and commit the generated types`, { drift: 'not-committed' })];
  if (!sameText(committed, String(emitted))) return [found(DB_TYPES_DRIFT, TYPES_FILE, `${TYPES_FILE} differs from what \`contract:emit\` generates from the migrations now; run \`npm run contract:emit\` and commit the result`, { drift: 'stale' })];
  return [];
}
