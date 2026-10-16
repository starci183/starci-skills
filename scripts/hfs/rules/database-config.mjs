// database-config.mjs - L08 Supabase TOML policy and L09 generated-type drift checks. Parsing and type emission stay
// lazy/injected so applications without Supabase do not load either tool and this rule starts no Docker process.
import { sameText } from '../../lib/same-text.mjs';
import path from 'node:path';
import { parse as parseTomlSync } from 'smol-toml';
import { found, readJson, readText } from './read.mjs';
import {
  CONFIG_FILE, DB_API_EXPOSED, DB_CONFIG_POLICY, DB_EXTENSION_ALLOWED, DB_TYPES_DRIFT, DB_VAULT_WRITE,
  HFS_SEED_PII, isActiveMigration, TYPES_FILE,
} from './database-constants.mjs';
import { databaseExecutableTokens, databaseSqlStatements, databaseSqlTokens, destructiveMigrationFindings } from './database-migrations.mjs';
import { byCodeUnit } from '../../lib/list.mjs';
const ENV_REF = /^env\([A-Za-z_]\w*\)$/;
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

const escapeRegexPart = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);

const tomlLine = (text, key) => {
  const expression = new RegExp(String.raw`^\s*["']?${escapeRegexPart(key)}["']?\s*=`, 'm');
  const match = expression.exec(text);
  return match ? text.slice(0, match.index).split('\n').length : undefined;
};

function credentialConfigFindings(file, text, toml) {
  const findings = [];
  for (const [at, key, value] of tomlEntries(toml)) {
    if (!isCredentialKey(key)) continue;
    const line = tomlLine(text, key);
    if (typeof value !== 'string' || !ENV_REF.test(value)) {
      const lineNote = line ? `:${line}` : '';
      findings.push(found(DB_CONFIG_POLICY, file, `${file}${lineNote} ${at} holds a literal credential; a secret in config.toml is written env(NAME), never a value`, { ...(line ? { line } : {}), key: at }));
    }
  }
  return findings;
}

// A finding for an auth setting of config.toml that differs from what hfs.json supabase.<field> declares; `shown` is the setting as read.
const settingFinding = (file, key, field, shown, declaredValue, note = '') => found(DB_CONFIG_POLICY, file, `${file} ${key} is ${shown}; hfs.json supabase.${field} declares ${declaredValue}${note}`, { key, declared: declaredValue });

const shownSetting = (value) => JSON.stringify(value ?? 'absent');

function signupFindings(file, auth, declared) {
  const findings = [];
  if (declared.enableSignup === undefined) return findings;
  if (auth.enable_signup !== declared.enableSignup) findings.push(settingFinding(file, 'auth.enable_signup', 'enableSignup', shownSetting(auth.enable_signup), declared.enableSignup, ' - the invite posture is a checked fact, not a doc claim'));
  if (auth.email?.enable_signup !== undefined && auth.email.enable_signup !== declared.enableSignup) {
    findings.push(settingFinding(file, 'auth.email.enable_signup', 'enableSignup', JSON.stringify(auth.email.enable_signup), declared.enableSignup));
  }
  return findings;
}

function redirectUrlFindings(file, auth, declared) {
  const findings = [];
  if (declared.redirectUrls === undefined) return findings;
  const configured = Array.isArray(auth.additional_redirect_urls) ? auth.additional_redirect_urls : [];
  for (const url of configured) {
    if (!declared.redirectUrls.includes(url)) findings.push(found(DB_CONFIG_POLICY, file, `${file} auth.additional_redirect_urls holds ${url}, which hfs.json supabase.redirectUrls does not declare; the config states nothing the app did not declare`, { key: 'auth.additional_redirect_urls', url }));
  }
  for (const url of declared.redirectUrls) {
    if (!configured.includes(url)) findings.push(found(DB_CONFIG_POLICY, file, `${file} auth.additional_redirect_urls omits ${url}, which hfs.json supabase.redirectUrls declares; the config and declaration must carry the same redirect set`, { key: 'auth.additional_redirect_urls', url }));
  }
  return findings;
}

function declarationConfigFindings(file, auth, declared) {
  const findings = [];
  if (declared.jwtExpiry !== undefined && auth.jwt_expiry !== declared.jwtExpiry) findings.push(settingFinding(file, 'auth.jwt_expiry', 'jwtExpiry', shownSetting(auth.jwt_expiry), declared.jwtExpiry));
  findings.push(...signupFindings(file, auth, declared));
  if (declared.siteUrl !== undefined && auth.site_url !== declared.siteUrl) findings.push(settingFinding(file, 'auth.site_url', 'siteUrl', shownSetting(auth.site_url), declared.siteUrl));
  findings.push(...redirectUrlFindings(file, auth, declared));
  return findings;
}

/** The parsed TOML of `text`, or null when it does not parse. */
export async function parseToml(text) {
  try {
    const module = await import('smol-toml');
    return module.parse(text);
  } catch {
    return null;
  }
}

/** L08 policy findings in one already-parsed supabase/config.toml. */
export function configFindings({ file, text, toml, supabase }) {
  const findings = credentialConfigFindings(file, text, toml);
  const auth = toml?.auth ?? {};
  if (auth.jwt_expiry !== undefined && (typeof auth.jwt_expiry !== 'number' || auth.jwt_expiry > 3600)) {
    findings.push(found(DB_CONFIG_POLICY, file, `${file} auth.jwt_expiry is ${JSON.stringify(auth.jwt_expiry)}; the access token lives at most 3600 seconds`, { key: 'auth.jwt_expiry' }));
  }
  if (!supabase) return findings;
  const declared = {
    enableSignup: supabase.enableSignup, jwtExpiry: supabase.jwtExpiry, siteUrl: supabase.siteUrl,
    redirectUrls: Array.isArray(supabase.redirectUrls) ? supabase.redirectUrls : undefined,
  };
  findings.push(...declarationConfigFindings(file, auth, declared));
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

const DEFAULT_EXTENSIONS = ['pgmq', 'pg_cron', 'pgcrypto', 'pg_trgm', 'vector', 'uuid-ossp', 'pg_net', 'supabase_vault', 'unaccent'];
const DEFAULT_API_SCHEMAS = ['public', 'graphql_public'];
const FORBIDDEN_API_SCHEMAS = new Set(['pgmq', 'pgmq_public']);
const word = (token, value) => token?.t === 'word' && token.v === value;
const identifier = (token) => token && ['word', 'ident'].includes(token.t) ? token.v : null;

function dbParameters(manifest) {
  const declared = manifest?.ruleParams?.db ?? {};
  return {
    extensions: Array.isArray(declared.extensions) ? declared.extensions : DEFAULT_EXTENSIONS,
    apiSchemas: Array.isArray(declared.apiSchemas) ? declared.apiSchemas : DEFAULT_API_SCHEMAS,
    majorVersion: declared.majorVersion ?? 17,
  };
}

function qualifiedName(tokens, index) {
  const name = identifier(tokens[index]);
  if (name === null) return null;
  return tokens[index + 1]?.v === '.' && identifier(tokens[index + 2]) !== null
    ? { schema: name, name: identifier(tokens[index + 2]), next: index + 3 }
    : { schema: 'public', name, next: index + 1 };
}

function extensionFindings(file, tokens, allowed) {
  const findings = [];
  for (let index = 0; index < tokens.length; index += 1) {
    if (!word(tokens[index], 'create') || !word(tokens[index + 1], 'extension')) continue;
    let at = index + 2;
    if (word(tokens[at], 'if') && word(tokens[at + 1], 'not') && word(tokens[at + 2], 'exists')) at += 3;
    const name = identifier(tokens[at]);
    if (name !== null && !allowed.has(name)) findings.push(found(DB_EXTENSION_ALLOWED, file,
      `${file}:${tokens[index].line} enables extension ${name}, which ruleParams.db.extensions does not allow`, { line: tokens[index].line, extension: name }));
  }
  return findings;
}

function vaultWriteAt(tokens, index) {
  const token = tokens[index];
  if (identifier(token) === 'vault' && tokens[index + 1]?.v === '.' && tokens[index + 3]?.v === '(') {
    return ['create_secret', 'update_secret', 'delete_secret'].includes(identifier(tokens[index + 2]));
  }
  let at = null;
  if (word(token, 'insert') || word(token, 'merge')) at = word(tokens[index + 1], 'into') ? index + 2 : null;
  if (word(token, 'delete')) at = word(tokens[index + 1], 'from') ? index + 2 : null;
  if (word(token, 'update')) at = index + 1;
  if (word(token, 'truncate')) return truncatedVault(tokens, index);
  if (at === null) return false;
  if (word(tokens[at], 'only')) at += 1;
  return qualifiedName(tokens, at)?.schema === 'vault';
}

function truncatedVault(tokens, index) {
  let at = word(tokens[index + 1], 'table') ? index + 2 : index + 1;
  while (at < tokens.length) {
    if (word(tokens[at], 'only')) at += 1;
    const name = qualifiedName(tokens, at);
    if (!name) return false;
    if (name.schema === 'vault') return true;
    if (tokens[name.next]?.v !== ',') return false;
    at = name.next + 1;
  }
  return false;
}

function passwordStatement(statement) {
  const starts = statement.findIndex((token, index) => (word(token, 'create') || word(token, 'alter'))
    && (word(statement[index + 1], 'role') || word(statement[index + 1], 'user')));
  return starts !== -1 && statement.slice(starts + 2).some((token) => word(token, 'password')) ? statement[starts] : null;
}

function custodySqlFindings(file, tokens) {
  const findings = [];
  for (const statement of databaseSqlStatements(tokens)) {
    const password = passwordStatement(statement);
    if (password) findings.push(found(DB_VAULT_WRITE, file,
      `${file}:${password.line} sets a role password in a migration; provision credentials through sealed secret custody`, { line: password.line, operation: 'role-password' }));
    const vault = statement.find((token, index) => vaultWriteAt(statement, index));
    if (vault) findings.push(found(DB_VAULT_WRITE, file,
      `${file}:${vault.line} writes to vault; migration SQL never provisions secret values`, { line: vault.line, operation: 'vault-write' }));
  }
  return findings;
}

function policyTarget(statement, start) {
  const on = statement.findIndex((token, index) => index > start && word(token, 'on'));
  return on === -1 ? null : qualifiedName(statement, on + 1);
}

function policyRoles(statement) {
  const to = statement.findIndex((token) => word(token, 'to'));
  if (to === -1) return null;
  const end = statement.findIndex((token, index) => index > to && (word(token, 'using') || word(token, 'with')));
  return statement.slice(to + 1, end === -1 ? undefined : end).map(identifier).filter(Boolean);
}

function applyPublicReadPolicy(statement, policies) {
  const at = statement.findIndex((token, index) => ['create', 'alter', 'drop'].some((verb) => word(token, verb)) && word(statement[index + 1], 'policy'));
  if (at === -1) return;
  const verb = statement[at].v;
  let nameAt = at + 2;
  if (word(statement[nameAt], 'if') && word(statement[nameAt + 1], 'exists')) nameAt += 2;
  const name = identifier(statement[nameAt]);
  const target = policyTarget(statement, nameAt);
  if (!name || !target) return;
  const key = `${target.schema}.${target.name}.${name}`;
  if (verb === 'drop') { policies.delete(key); return; }
  const rename = statement.findIndex((token) => word(token, 'rename'));
  if (verb === 'alter' && word(statement[rename + 1], 'to')) {
    const nextName = identifier(statement[rename + 2]);
    if (nextName && policies.has(key)) {
      policies.set(`${target.schema}.${target.name}.${nextName}`, { ...policies.get(key), name: nextName });
      policies.delete(key);
    }
    return;
  }
  const roles = policyRoles(statement);
  if (verb === 'alter') {
    if (policies.has(key) && roles !== null) policies.set(key, { ...policies.get(key), roles });
    return;
  }
  const forAt = statement.findIndex((token) => word(token, 'for'));
  policies.set(key, { name, schema: target.schema, select: word(statement[forAt + 1], 'select'), roles: roles ?? ['public'] });
}

function publicReadSchemas(sources) {
  const policies = new Map();
  for (const { tokens } of sources) for (const statement of databaseSqlStatements(tokens)) applyPublicReadPolicy(statement, policies);
  return new Set([...policies.values()].filter((policy) => policy.select && policy.name.endsWith('_public_read')
    && policy.roles.some((role) => ['anon', 'public'].includes(role))).map((policy) => policy.schema));
}

function schemaConfigFindings(file, config, parameters, edition, publicSchemas) {
  const schemas = config.api?.schemas;
  const findings = [];
  const allowed = new Set(parameters.apiSchemas);
  if (!Array.isArray(schemas) || schemas.some((schema) => typeof schema !== 'string' || !allowed.has(schema))) {
    findings.push(found(DB_CONFIG_POLICY, file, `${file} api.schemas must be an array drawn from ruleParams.db.apiSchemas`, { key: 'api.schemas' }));
  }
  if (Array.isArray(schemas) && schemas.some((schema) => FORBIDDEN_API_SCHEMAS.has(schema))) findings.push(found(DB_API_EXPOSED, file,
    `${file} api.schemas exposes a pgmq schema; queues are accessible only to the application role`, { key: 'api.schemas' }));
  const exposed = Array.isArray(schemas) ? schemas : DEFAULT_API_SCHEMAS;
  if (edition === 'lite' && config.api?.enabled !== false && exposed.length > 0 && !exposed.some((schema) => publicSchemas.has(schema))) {
    findings.push(found(DB_API_EXPOSED, file, `${file} enables the lite data API without an exposed *_public_read FOR SELECT policy; disable api or set schemas = []`, { key: 'api.enabled' }));
  }
  return findings;
}

function safetyConfigFindings(file, config, parameters, supabase) {
  const findings = [];
  const anonymous = config.auth?.enable_anonymous_sign_ins;
  if (anonymous !== undefined && (typeof anonymous !== 'boolean' || (anonymous && supabase?.enableAnonymousSignIns !== true))) findings.push(found(DB_CONFIG_POLICY, file,
    `${file} auth.enable_anonymous_sign_ins is enabled without hfs.json supabase.enableAnonymousSignIns`, { key: 'auth.enable_anonymous_sign_ins' }));
  if (config.edge_runtime?.enabled !== false) findings.push(found(DB_CONFIG_POLICY, file,
    `${file} edge_runtime.enabled must be false; application execution belongs to the back end`, { key: 'edge_runtime.enabled' }));
  const storageLimit = config.storage?.file_size_limit;
  if (config.storage?.enabled !== false && (typeof storageLimit !== 'string' || !/^[1-9]\d*(?:B|KB|MB|GB|KiB|MiB|GiB)$/.test(storageLimit))) findings.push(found(DB_CONFIG_POLICY, file,
    `${file} storage.file_size_limit must declare a positive byte limit`, { key: 'storage.file_size_limit' }));
  if (config.db?.major_version !== parameters.majorVersion) findings.push(found(DB_CONFIG_POLICY, file,
    `${file} db.major_version must equal the ruleParams.db.majorVersion pin (${parameters.majorVersion})`, { key: 'db.major_version' }));
  return findings;
}

function seedPattern(value) {
  if (typeof value !== 'string' || !value || value.includes('\\') || path.posix.isAbsolute(value) || /^[A-Za-z]:/.test(value)) return null;
  const relative = path.posix.normalize(`supabase/${value}`);
  if (!relative.startsWith('supabase/')) return null;
  const expression = relative.split(/(\*\*|\*|\?)/).map((part) => {
    if (part === '**') return '.*';
    if (part === '*') return '[^/]*';
    if (part === '?') return '[^/]';
    return escapeRegexPart(part);
  }).join('');
  return new RegExp(`^${expression}$`);
}

function seedConfigResult(repoRoot, files, config) {
  const seeds = new Set(files.filter((file) => /^(?:supabase\/(?:seed\.sql|seeds?\/.+\.sql)|\.starcistacks\/[^/]+\/seeds\/.+\.sql)$/.test(file)));
  const seed = config?.db?.seed;
  if (!seed || seed.enabled === false) return { findings: [], seeds };
  const paths = seed.sql_paths ?? ['./seed.sql'];
  const findings = [];
  if (!Array.isArray(paths) || paths.length === 0) return {
    seeds, findings: [found(DB_CONFIG_POLICY, CONFIG_FILE, `${CONFIG_FILE} db.seed.sql_paths must list tracked SQL seed files`, { key: 'db.seed.sql_paths' })],
  };
  for (const value of paths) {
    const pattern = seedPattern(value);
    const matches = pattern ? files.filter((file) => file.endsWith('.sql') && pattern.test(file) && readText(repoRoot, file) !== null) : [];
    if (matches.length === 0) findings.push(found(DB_CONFIG_POLICY, CONFIG_FILE,
      `${CONFIG_FILE} db.seed.sql_paths contains a path with no readable tracked SQL seed file`, { key: 'db.seed.sql_paths' }));
    for (const file of matches) seeds.add(file);
  }
  return { findings, seeds };
}

const EMAIL_LITERAL = /^[A-Z0-9._%+-]+@([A-Z0-9-]+(?:\.[A-Z0-9-]+)+)$/i;
function piiLiteral(value) {
  if (value.split(/[^\w.%+@-]+/).some((part) => {
    const email = EMAIL_LITERAL.exec(part);
    return email && email[1].toLowerCase() !== 'example.test';
  })) return true;
  if (!/^\+?[\d\s().-]+$/.test(value)) return false;
  const digits = value.replaceAll(/\D/g, '');
  if (digits.length < 9 || digits.length > 15 || /^\d{4}-\d{2}-\d{2}(?:\s|$)/.test(value)) return false;
  return value.startsWith('+') || /[()\s]/.test(value) || /^\d{10,15}$/.test(value);
}

function seedPiiFindings(repoRoot, seeds) {
  const findings = [];
  for (const file of seeds) {
    const text = readText(repoRoot, file);
    if (text === null) continue;
    for (const token of databaseSqlTokens(text)) {
      if (!['string', 'body'].includes(token.t) || !piiLiteral(token.v)) continue;
      findings.push(found(HFS_SEED_PII, file, `${file}:${token.line} contains an email or phone literal; seed data uses synthetic identities and the example.test domain`, { line: token.line }));
    }
  }
  return findings;
}

/** R259 config/content checks, synchronously judged at the app root for both editions. */
export function databaseConfigFindings({ repoRoot, files = [], all = files, repo = {}, manifest, isRoot, inScope = () => true }) {
  if (isRoot === false || ['be', 'fe'].includes(repo.profile)) return [];
  const parameters = dbParameters(manifest);
  const declaration = readJson(repoRoot, 'hfs.json');
  const edition = repo.edition ?? declaration?.edition ?? 'full';
  const migrations = all.filter((file) => isActiveMigration(file) && file.endsWith('.sql')).sort(byCodeUnit);
  const sources = migrations.map((file) => ({ file, tokens: databaseExecutableTokens(readText(repoRoot, file) ?? '') }));
  const findings = [];
  for (const { file, tokens } of sources) findings.push(...extensionFindings(file, tokens, new Set(parameters.extensions)), ...custodySqlFindings(file, tokens));
  findings.push(...destructiveMigrationFindings({ repoRoot, migrations, files: all }));
  let config = null;
  if (all.includes(CONFIG_FILE)) {
    try { const text = readText(repoRoot, CONFIG_FILE); if (text !== null) config = parseTomlSync(text); } catch { /* L08 owns invalid TOML. */ }
  }
  if (config) findings.push(...schemaConfigFindings(CONFIG_FILE, config, parameters, edition, publicReadSchemas(sources)),
    ...safetyConfigFindings(CONFIG_FILE, config, parameters, declaration?.supabase));
  const seeds = seedConfigResult(repoRoot, all, config);
  findings.push(...seeds.findings, ...seedPiiFindings(repoRoot, seeds.seeds));
  return findings.filter((finding) => inScope(finding.path));
}
