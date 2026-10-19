// Explicit-local migration applies only the app's active SQL chain through the Supabase API owner.
// Supabase CLI v2.119.0: db/push, migration-pending, migration-list and db-config.toml-read (read 2026-10-18).
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { parseEnv } from 'node:util';
import { parse as parseToml } from 'smol-toml';
import { databasePush } from '../runtime/scripts/api/supabase/database-push.mjs';
import { isMigrationName, migrationStamp } from '../runtime/scripts/hfs/rules/database-migrations.mjs';
import { CONFIG_FILE, MIGRATIONS_DIR } from '../runtime/scripts/hfs/rules/database-constants.mjs';
import { failure, refusal } from '../stack/errors.mjs';
import { assertLocalDatabase, boundSupabaseLauncher, nativeDatabaseEnvironment } from '../stack/target-binding.mjs';

const configError = (reason) => refusal('DB_CONFIG_INVALID', reason);
const encrypted = (value) => typeof value === 'string' && value.includes('encrypted:');
const byteOrder = (left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right));

/** Never quote a parser/tool diagnostic: config, env and child streams can contain credentials. */
function readFile(file, optional = false) {
  try {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink()) throw configError('local migration inputs must be regular files');
    return fs.readFileSync(file, 'utf8');
  } catch (error) {
    if (optional && error.code === 'ENOENT') return null;
    throw configError('local migration inputs must be readable regular files');
  }
}

function requireDirectory(directory) {
  try {
    const stat = fs.lstatSync(directory);
    if (stat.isDirectory() && !stat.isSymbolicLink()) return;
  } catch { /* The refusal below withholds filesystem diagnostics. */ }
  throw configError('local migration requires the existing app directories, without links');
}

function requirePlainConfig(value) {
  if (encrypted(value)) throw configError('local migration does not decrypt encrypted configuration');
  if (value && typeof value === 'object') for (const item of Object.values(value)) requirePlainConfig(item);
}

/** The pinned CLI searches these exact files; interpolation/escapes are held rather than partially interpreted. */
function projectEnvironment(root, ambient) {
  const selected = ambient.SUPABASE_ENV || 'development';
  if (!/^[A-Za-z0-9_-]+$/.test(selected)) throw configError('local migration requires an unambiguous Supabase environment selector');
  const names = [`.env.${selected}.local`, ...(selected === 'test' ? [] : ['.env.local']), `.env.${selected}`, '.env'];
  const values = {};
  const files = [];
  for (const dir of [path.join(root, 'supabase'), root]) {
    for (const name of names) {
      const file = path.join(dir, name);
      const text = readFile(file, true);
      files.push([file, text]);
      if (text === null) continue;
      // Pinned godotenv expansion and double-quote unescaping can synthesize the encryption prefix.
      if (encrypted(text) || /[$\\]/.test(text)) throw configError('local migration requires literal unencrypted dotenv inputs');
      // Keep only the common literal assignment grammar shared by Node and the pinned CLI.
      for (const line of text.split(/\r?\n/)) {
        if (/^\s*(?:#.*)?$/.test(line)) continue;
        if (!/^\s*(?:export\s+)?[A-Za-z_][A-Za-z0-9_]*\s*=\s*(?:"[^"\r\n]*"|'[^'\r\n]*'|[^'"#\r\n]*)(?:\s+#.*)?\s*$/.test(line)) {
          throw configError('local migration requires literal single-line dotenv assignments');
        }
      }
      let parsed;
      try { parsed = parseEnv(text); } catch { throw configError('local migration dotenv inputs are not readable assignments'); }
      for (const [key, value] of Object.entries(parsed)) {
        if (!Object.hasOwn(ambient, key) && !Object.hasOwn(values, key)) values[key] = value;
      }
    }
  }
  return { values: { ...values, ...ambient }, files };
}

function expanded(value, env) {
  if (typeof value !== 'string') return value;
  const reference = /^env\(([A-Za-z_][A-Za-z0-9_]*)\)$/.exec(value);
  const result = reference ? env[reference[1]] : value;
  if (typeof result !== 'string' || result.startsWith('env(')) throw configError('local migration configuration has an unresolved environment reference');
  return result;
}

const overridden = (name, value, env) => expanded(typeof env[name] === 'string' && env[name] !== '' ? env[name] : value, env);

function targetIdentity(config, env) {
  const project = overridden('SUPABASE_PROJECT_ID', config.project_id, env);
  const portValue = overridden('SUPABASE_DB_PORT', config.db?.port, env);
  const port = typeof portValue === 'string' && /^\d+$/.test(portValue) ? Number(portValue) : portValue;
  const enabled = overridden('SUPABASE_DB_MIGRATIONS_ENABLED', config.db?.migrations?.enabled ?? true, env);
  if (typeof project !== 'string' || !/^[A-Za-z0-9_-]+$/.test(project) || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw configError('local migration requires an explicit local project identity and database port');
  }
  if (enabled !== true && !(typeof enabled === 'string' && /^(?:1|t|T|true|TRUE|True)$/.test(enabled))) {
    throw configError('local migration requires migrations to be explicitly enabled by the effective configuration');
  }
  return { project, port };
}

/** Snapshot only in memory; no plaintext configuration, values or hashes reach the result. */
function inputs(ctx, nativeTarget = null) {
  const root = path.resolve(ctx.cwd);
  requireDirectory(root);
  requireDirectory(path.join(root, 'supabase'));
  requireDirectory(path.join(root, MIGRATIONS_DIR));
  const appText = readFile(path.join(root, 'hfs.json'));
  let app;
  try { app = JSON.parse(appText); } catch { throw configError('local migration requires a readable app declaration'); }
  if (app?.kind !== 'app' || !['full', 'lite'].includes(app.edition ?? 'full')) throw configError('local migration requires a lite or full app');
  const configText = readFile(path.join(root, CONFIG_FILE));
  let config;
  try { config = parseToml(configText); } catch { throw configError('local migration requires valid Supabase TOML'); }
  requirePlainConfig(config);
  for (const value of Object.values(ctx.env)) if (encrypted(value)) throw configError('local migration does not decrypt encrypted environment values');
  const { values: env, files: envFiles } = projectEnvironment(root, ctx.env);
  if (nativeTarget && (config.experimental?.stack === true
    || env.SUPABASE_EXPERIMENTAL_STACK && !/^(?:0|false)$/i.test(env.SUPABASE_EXPERIMENTAL_STACK)
    || env.SUPABASE_CLI_BINARY_OVERRIDE)) throw configError('the bound local target requires the declared legacy Supabase backend and installed launcher');
  const launcher = nativeTarget ? boundSupabaseLauncher(root) : null;
  const target = targetIdentity(config, env);
  let names;
  try { names = fs.readdirSync(path.join(root, MIGRATIONS_DIR)).sort(byteOrder); } catch { throw configError('local migrations are not readable'); }
  // Match the pinned CLI's unanchored first-entry legacy-init skip, including nested names.
  const legacy = /([0-9]{14})_init\.sql/.exec(names[0] ?? '');
  if (legacy && Number(legacy[1]) < 20211209000000) throw refusal('DB_STAMP_ORDER', 'the local chain contains a legacy init migration the installed CLI skips');
  const migrations = [];
  const stamps = new Set();
  for (const name of names.filter((entry) => entry.endsWith('.sql'))) {
    const stamp = name.slice(0, name.indexOf('_'));
    if (!isMigrationName(name) || migrationStamp(stamp) === null) throw refusal('DB_MIGRATION_NAME', 'local migrations require valid UTC-stamped filenames');
    if (stamps.has(stamp)) throw refusal('DB_STAMP_COLLISION', 'local migrations contain a duplicate timestamp');
    stamps.add(stamp);
    migrations.push([name, readFile(path.join(root, MIGRATIONS_DIR, name))]);
  }
  const digest = createHash('sha256').update(JSON.stringify({ root, appText, configText, envFiles, env, target, migrations })).digest('hex');
  return { root, target, names: migrations.map(([name]) => name), digest, nativeTarget, launcher };
}

function unchanged(ctx, snapshot) {
  const current = inputs(ctx, snapshot.nativeTarget);
  if (current.digest !== snapshot.digest) throw failure('DB_FINAL_MISMATCH', 'local migration inputs changed during the operation');
  return current;
}

/** Only the specific Supabase owner can spawn; failures and malformed JSON never expose child output. */
function push(ctx, snapshot, dryRun) {
  const env = snapshot.nativeTarget ? nativeDatabaseEnvironment(ctx.env, snapshot.nativeTarget,
    { 'SUPABASE_SERVICES_HOSTNAME': '127.0.0.1', 'SUPABASE_EXPERIMENTAL_STACK': '0' }) : ctx.env;
  const run = snapshot.nativeTarget ? (file, args, options) => {
    if (file !== process.execPath || args[0] !== snapshot.launcher) throw failure('DB_CLI_MISSING', 'the bound database launcher cannot fall back to a global tool');
    return ctx.spawn(file, args, options);
  } : ctx.spawn;
  const result = databasePush(snapshot.root, ['--local', '--skip-vault', '--workdir', snapshot.root, '--output-format', 'json',
    ...(snapshot.nativeTarget ? ['--profile', 'supabase'] : []), ...(dryRun ? ['--dry-run'] : ['--yes'])], { env, run });
  if (result?.error || result?.signal || result?.status !== 0) throw failure('DB_CLI_FAILED', 'the local Supabase migration command failed; database output was withheld');
  let payload;
  try { payload = JSON.parse(result.stdout); } catch { throw failure('DB_CLI_FAILED', 'the local migration command returned unreadable JSON'); }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || Object.hasOwn(payload, 'error') || payload._tag === 'Error' || payload.dryRun !== dryRun || typeof payload.upToDate !== 'boolean'
    || !Array.isArray(payload.migrations) || !payload.migrations.every((name) => typeof name === 'string')
    || !Array.isArray(payload.seeds) || payload.seeds.length !== 0 || !Array.isArray(payload.roles) || payload.roles.length !== 0) {
    throw failure('DB_PUSH_STRAY', 'the local migration command returned an unexpected result');
  }
  const pending = payload.migrations;
  const expected = snapshot.names.slice(snapshot.names.length - pending.length);
  if (pending.length > snapshot.names.length || pending.some((name, index) => name !== expected[index]) || payload.upToDate !== (pending.length === 0)) {
    throw failure('DB_PUSH_STRAY', 'the local migration result is not an ordered suffix of the authored chain');
  }
  return pending;
}

/** Preview by default; the caller admits execute only after the existing database arming check. No history repair, reset or linked fallback. */
export function migrateLocalDatabase(ctx, { execute = false, nativeTarget = null } = {}) {
  const snapshot = inputs(ctx, nativeTarget);
  assertLocalDatabase(nativeTarget, snapshot.target);
  const pending = push(ctx, snapshot, true);
  unchanged(ctx, snapshot);
  let applied = [];
  if (execute && pending.length > 0) {
    const fresh = push(ctx, snapshot, true);
    unchanged(ctx, snapshot);
    if (fresh.some((name, index) => name !== pending[index]) || fresh.length !== pending.length) throw failure('DB_FINAL_MISMATCH', 'the local migration plan changed before apply');
    applied = push(ctx, snapshot, false);
    unchanged(ctx, snapshot);
    if (applied.length !== fresh.length || applied.some((name, index) => name !== fresh[index])) {
      throw failure('DB_FINAL_MISMATCH', 'the applied local migrations differ from the reviewed pending plan');
    }
    if (push(ctx, snapshot, true).length !== 0) throw failure('DB_FINAL_MISMATCH', 'the local migration version history is not fully applied');
    unchanged(ctx, snapshot);
  }
  return {
    ok: true,
    lines: [`target         local project ${snapshot.target.project}`, `pending SQL    ${pending.join(', ') || 'none'}`, execute && applied.length ? `applied         ${applied.length} migration(s); local version history is current` : 'nothing applied'],
    data: { target: 'local', pending, pushed: applied, executed: execute && applied.length > 0, done: pending.length === 0 || execute },
  };
}
