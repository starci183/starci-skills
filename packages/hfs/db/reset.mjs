// reset.mjs - linked reset requires explicit custody choices, a recent verified encrypted backup and the migration arming rule.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runVerb } from '../release/index.mjs';
import { requireArmed } from './migrate.mjs';
import { failure, refusal } from '../stack/errors.mjs';
import { backupSession, backupArgs, backupRecipients, backupTool, encryptFile, queryRows, validateReceipt, runCli } from './backup-receipt.mjs';

/** Metadata fingerprints allow verification without printing or retaining rows, object keys or auth identities in the result. */
function inventory(session, schema) {
  const tables = queryRows(session, `select tablename from pg_catalog.pg_tables where schemaname = '${schema}' and tablename not in ('schema_migrations', 'migrations') order by tablename;`);
  return tables.map(({ tablename }) => {
    if (typeof tablename !== 'string' || !/^[a-z_][a-z0-9_]*$/u.test(tablename)) throw failure('DB_RESET_VERIFY_FAILED', 'invalid preservation table inventory');
    const rows = queryRows(session, `begin read only; select count(*)::text as count, md5(coalesce(string_agg(md5(row_to_json(t)::text), '' order by md5(row_to_json(t)::text)), '')) as hash from "${schema}"."${tablename}" t; commit;`);
    if (rows.length !== 1 || !/^\d+$/u.test(String(rows[0].count)) || !/^[a-f0-9]{32}$/u.test(rows[0].hash ?? '')) throw failure('DB_RESET_VERIFY_FAILED', 'invalid preservation fingerprint');
    return { table: tablename, count: String(rows[0].count), hash: rows[0].hash };
  });
}

/** age reads identity bytes on stdin or the configured identity file; neither identity nor SQL is placed in argv or diagnostics. */
function decryptPart(ctx, encrypted, plaintext) {
  const key = ctx.env.SOPS_AGE_KEY;
  const identity = key ? '-' : ctx.env.SOPS_AGE_KEY_FILE;
  if (!identity) throw refusal('DB_RESET_IDENTITY_MISSING', '--auth/--storage keep needs SOPS_AGE_KEY or SOPS_AGE_KEY_FILE to restore the temporary encrypted part');
  backupTool(ctx, 'age', ['--decrypt', '--identity', identity, '-o', plaintext, encrypted], key ? { input: `${key}\n` } : {});
}

function preservePart(session, scratch, schema, recipients) {
  const before = inventory(session, schema);
  const plain = path.join(scratch, `${schema}.sql`);
  const encrypted = `${plain}.age`;
  runCli(session, ['db', 'dump', '--data-only', '--schema', schema, '--exclude', `${schema}.schema_migrations,${schema}.migrations`, '--file', plain, ...backupArgs(session)]);
  encryptFile(session.ctx, plain, encrypted, recipients);
  fs.rmSync(plain, { force: true });
  // Prove the selected identity can restore this exact part before the destructive call.
  decryptPart(session.ctx, encrypted, plain);
  fs.rmSync(plain, { force: true });
  return { schema, before, encrypted, plain };
}

function restorePart(session, part) {
  // Supabase retains some managed tables. Replace their data to avoid duplicate users, buckets or migration-independent metadata.
  decryptPart(session.ctx, part.encrypted, part.plain);
  const tables = part.before.map((row) => `"${part.schema}"."${row.table}"`);
  const source = fs.readFileSync(part.plain, 'utf8');
  fs.writeFileSync(part.plain, `begin;\nset constraints all deferred;\n${tables.length ? `truncate ${tables.join(', ')} cascade;\n` : ''}${source}\ncommit;\n`, { mode: 0o600 });
  try { runCli(session, ['db', 'query', '--file', part.plain, '--output', 'json', '--agent', 'no', ...backupArgs(session)]); }
  finally { fs.rmSync(part.plain, { force: true }); }
  if (JSON.stringify(inventory(session, part.schema)) !== JSON.stringify(part.before)) throw failure('DB_RESET_VERIFY_FAILED', `${part.schema} data differs after restore; use the full backup receipt for recovery`);
}

function expectedHead(session) {
  const dir = path.join(session.ctx.cwd, session.database.migrationsDir ?? 'supabase/migrations');
  let expected;
  try { expected = fs.readdirSync(dir).filter((name) => /^\d{14}_[A-Za-z0-9_-]+\.sql$/u.test(name)).map((name) => name.slice(0, 14)).sort(); }
  catch { throw refusal('DB_MIGRATIONS_MISSING', 'migration directory is not readable'); }
  if (!expected.length || new Set(expected).size !== expected.length) throw refusal('DB_MIGRATIONS_MISSING', 'migration versions must be present and unique');
  return expected;
}

function verifyHead(session) {
  const expected = expectedHead(session);
  const actual = queryRows(session, 'select version from supabase_migrations.schema_migrations order by version;').map((row) => row.version);
  if (JSON.stringify(expected) !== JSON.stringify(actual)) throw failure('DB_RESET_HEAD_MISMATCH', 'reset migration history differs from repository migration versions');
  return expected;
}

/** Dry run validates custody and prints a plan; execute preserves chosen managed data, resets, restores and verifies the exact migration head. */
export function resetDatabase(ctx, options = {}) {
  if (options.linked !== true || options.local || options.urlEnv !== undefined) throw refusal('DB_RESET_LINKED_REQUIRED', 'reset requires --linked; use npm run db:reset for a local database');
  if (!['keep', 'drop'].includes(options.auth) || !['keep', 'drop'].includes(options.storage)) throw refusal('DB_RESET_CHOICE_MISSING', 'explicit --auth keep|drop and --storage keep|drop are required');
  const session = backupSession(ctx, options);
  const receipt = validateReceipt(session, options.backup ? path.resolve(ctx.cwd, options.backup) : undefined);
  const lines = [`target: linked project ${session.target.ref}`, `backup: verified encrypted receipt from ${receipt.at}`,
    options.auth === 'keep' ? 'auth: encrypt all auth data tables before reset, restore in a transaction and verify' : 'auth: users and identities are deleted',
    options.storage === 'keep' ? 'storage: preserve and verify buckets and objects metadata' : 'storage: empty storage.objects metadata; files in the storage backend are not deleted by SQL',
    'reset: supabase db reset --linked; verify migration versions against repository'];
  if (!options.execute) return { ok: true, lines: [...lines, 'dry run: nothing changed'], data: { executed: false, auth: options.auth, storage: options.storage, ref: session.target.ref } };
  requireArmed(ctx);
  // Refuse unsupported CLI file execution before resetting: SQL containing identity data must never travel in argv.
  if (options.auth === 'keep' || options.storage === 'keep') {
    const help = runCli(session, ['db', 'query', '--help']).text;
    if (!help.includes('--file')) throw refusal('DB_RESET_QUERY_FILE_UNSUPPORTED', 'the Supabase CLI must support db query --file for transactional restore');
  }
  expectedHead(session);
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-db-reset-'));
  const parts = [];
  let resetStarted = false;
  let complete = false;
  try {
    const keep = ['auth', 'storage'].filter((schema) => options[schema] === 'keep');
    const recipients = keep.length ? backupRecipients(ctx.cwd) : [];
    for (const schema of keep) parts.push(preservePart(session, scratch, schema, recipients));
    resetStarted = true;
    runCli(session, ['db', 'reset', '--yes', ...backupArgs(session)]);
    for (const part of parts) restorePart(session, part);
    if (options.auth === 'drop') {
      const rows = queryRows(session, 'select (select count(*) from auth.users)::text as users, (select count(*) from auth.identities)::text as identities;');
      if (rows.length !== 1 || String(rows[0].users) !== '0' || String(rows[0].identities) !== '0') throw failure('DB_RESET_VERIFY_FAILED', 'auth users or identities remain after reset');
    }
    if (options.storage === 'drop') {
      runCli(session, ['db', 'query', 'begin; delete from storage.objects; commit;', '--output', 'json', '--agent', 'no', ...backupArgs(session)]);
      const rows = queryRows(session, 'select count(*)::text as count from storage.objects;');
      if (rows.length !== 1 || String(rows[0].count) !== '0') throw failure('DB_RESET_VERIFY_FAILED', 'storage.objects metadata was not emptied');
    }
    const versions = verifyHead(session);
    complete = true;
    return { ok: true, lines: [...lines, 'reset completed; managed data choices and migration head verified'], data: { executed: true, auth: options.auth, storage: options.storage, ref: session.target.ref, versions } };
  } finally {
    // Preserve encrypted recovery parts after a reset/restore failure; remove every plaintext file on every exit.
    for (const name of fs.readdirSync(scratch)) if (!name.endsWith('.age')) fs.rmSync(path.join(scratch, name), { force: true });
    if (complete || !resetStarted) fs.rmSync(scratch, { recursive: true, force: true });
    else ctx.stderr(`DB_RESET_RECOVERY_PARTS: encrypted recovery parts retained at ${scratch}\n`);
  }
}

export function dbResetMain(argv, io = {}) {
  return runVerb({ label: 'starci app db reset', name: 'db reset', code: 'DB_USAGE', io, argv,
    spec: { boolean: ['--linked', '--execute', '--json', '--local'], value: ['--auth', '--storage', '--backup', '--url-env'] },
    run: (ctx, flags, positional) => {
      if (positional.length) throw refusal('DB_USAGE', 'reset takes flags only');
      return resetDatabase(ctx, { linked: flags.linked, local: flags.local, urlEnv: flags['url-env'], execute: flags.execute, auth: flags.auth, storage: flags.storage, backup: flags.backup });
    } });
}
