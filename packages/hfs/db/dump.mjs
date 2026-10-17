// dump.mjs - full Supabase backup, encrypted outside Git; every plaintext part is removed even when a tool fails.
import fs from 'node:fs';
import path from 'node:path';
import { runVerb } from '../release/index.mjs';
import { failure, refusal } from '../stack/errors.mjs';
import { RECEIPT_SCHEMA, outsideRepository, backupSession, backupArgs, backupRecipients, backupTool, encryptFile, queryRows, sha256, runCli } from './backup-receipt.mjs';

/** Counts every ordinary table with quoted identifiers in a read-only transaction, including auth and storage. */
export function rowcounts(session) {
  const tables = queryRows(session, "select schemaname, tablename from pg_catalog.pg_tables where schemaname not in ('pg_catalog', 'information_schema') order by schemaname, tablename;");
  const quote = (name) => `"${String(name).replaceAll('"', '""')}"`;
  return tables.map((table) => {
    if (typeof table.schemaname !== 'string' || typeof table.tablename !== 'string') throw failure('DB_BACKUP_QUERY_FAILED', 'invalid table inventory');
    const rows = queryRows(session, `begin read only; select count(*)::text as count from ${quote(table.schemaname)}.${quote(table.tablename)}; commit;`);
    if (rows.length !== 1 || !/^\d+$/u.test(String(rows[0].count))) throw failure('DB_BACKUP_QUERY_FAILED', 'invalid rowcount');
    return { schema: table.schemaname, table: table.tablename, count: String(rows[0].count) };
  });
}

/** Writes only ciphertext and its receipt permanently; a receipt is published only after header, size and hash checks. */
function dumpDatabase(ctx, options = {}) {
  if (!options.out) throw refusal('DB_USAGE', '--out is required');
  const out = outsideRepository(ctx.cwd, path.resolve(ctx.cwd, options.out));
  const session = backupSession(ctx, options);
  const recipients = backupRecipients(ctx.cwd);
  fs.mkdirSync(out, { recursive: true, mode: 0o700 });
  const at = new Date(ctx.now()).toISOString();
  const stamp = at.replace(/[-:.]/gu, '');
  const name = `${session.project}-${stamp}`;
  const dir = path.join(out, name);
  fs.mkdirSync(dir, { mode: 0o700 });
  const scratch = path.join(dir, '.plaintext');
  const archive = path.join(dir, `${name}.tar.age`);
  const receiptPath = path.join(dir, `${name}.receipt.json`);
  let complete = false;
  try {
    fs.mkdirSync(scratch, { mode: 0o700 });
    const jobs = [['roles.sql', ['--role-only']], ['schema.sql', []], ['auth-storage-schema.sql', ['--schema', 'auth,storage']]];
    if (!options.schemaOnly) jobs.push(['data.sql', ['--data-only']], ['auth-storage-data.sql', ['--data-only', '--schema', 'auth,storage']]);
    for (const [file, flags] of jobs) runCli(session, ['db', 'dump', ...flags, '--file', path.join(scratch, file), ...backupArgs(session)]);
    const counts = rowcounts(session);
    fs.writeFileSync(path.join(scratch, 'rowcounts.json'), `${JSON.stringify(counts, null, 2)}\n`, { mode: 0o600 });
    const parts = [...jobs.map(([file]) => file), 'rowcounts.json'];
    const tar = path.join(scratch, 'backup.tar');
    backupTool(ctx, 'tar', ['-cf', tar, '-C', scratch, ...parts]);
    const bytes = encryptFile(ctx, tar, archive, recipients);
    const receipt = { schema: RECEIPT_SCHEMA, project: session.project, target: session.target.kind, ref: session.target.ref ?? null,
      at, file: path.basename(archive), bytes, sha256: sha256(archive), parts,
      rowcounts: { tables: counts.length, rows: counts.reduce((sum, row) => sum + BigInt(row.count), 0n).toString(), tablesByName: counts }, schemaOnly: options.schemaOnly === true };
    fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600 });
    complete = true;
    return { ok: true, lines: [JSON.stringify(receipt, null, 2), `receipt: ${receiptPath}`, 'age header, size and sha256 verified; decryption requires the owner identity'], data: { receipt, receiptPath } };
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
    if (!complete) { fs.rmSync(archive, { force: true }); fs.rmSync(receiptPath, { force: true }); }
  }
}

export function dbDumpMain(argv, io = {}) {
  return runVerb({ label: 'starci app db dump', name: 'db dump', code: 'DB_USAGE', io, argv,
    spec: { boolean: ['--linked', '--local', '--schema-only', '--json'], value: ['--url-env', '--out'] },
    run: (ctx, flags, positional) => {
      if (positional.length) throw refusal('DB_USAGE', 'dump takes flags only');
      return dumpDatabase(ctx, { linked: flags.linked, local: flags.local, urlEnv: flags['url-env'], out: flags.out, schemaOnly: flags['schema-only'] });
    } });
}
