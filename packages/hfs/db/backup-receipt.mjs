// backup-receipt.mjs - encrypted database backup custody, shared by dump and reset; tool output never enters diagnostics.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { parseYaml } from '../runtime/engine/yaml.mjs';
import { readDeclaration } from '../release/index.mjs';
import { resolveTarget, runCli as migrationCli, targetArgs } from './migrate.mjs';
import { failure, refusal } from '../stack/errors.mjs';

export const RECEIPT_SCHEMA = 'starci/db-backup@1';
export function sha256(file) {
  const hash = createHash('sha256');
  const fd = fs.openSync(file, 'r');
  const chunk = Buffer.alloc(1024 * 1024);
  try {
    let bytes;
    while ((bytes = fs.readSync(fd, chunk, 0, chunk.length, null)) > 0) hash.update(chunk.subarray(0, bytes));
  } finally { fs.closeSync(fd); }
  return hash.digest('hex');
}
const inside = (root, file) => { const rel = path.relative(root, file); return rel === '' || (!rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel)); };

/** Backup/restore SQL can hold row values, so even the migration runner's scrubbed stderr must be withheld. */
export function runCli(session, args) {
  try { return migrationCli(session, args); }
  catch { throw failure('DB_BACKUP_CLI_FAILED', `supabase ${args.slice(0, 2).join(' ')} failed; output withheld`); }
}

/** Resolves existing ancestors before checking containment, including symlinked output directories and Git worktree marker files. */
export function outsideRepository(root, output) {
  let ancestor = path.resolve(output);
  const tail = [];
  while (!fs.existsSync(ancestor)) { tail.unshift(path.basename(ancestor)); ancestor = path.dirname(ancestor); }
  const resolved = path.join(fs.realpathSync(ancestor), ...tail);
  if (inside(fs.realpathSync(root), resolved)) throw refusal('DB_DUMP_INSIDE_REPO', '--out must be outside the app repository and every Git worktree');
  for (let dir = resolved; ; dir = path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, '.git'))) throw refusal('DB_DUMP_INSIDE_REPO', '--out must be outside every Git worktree');
    if (dir === path.dirname(dir)) break;
  }
  return resolved;
}

/** Uses migrate's linked/password/URL resolution; local is explicitly selected and never silently defaults to linked. */
export function backupSession(ctx, options) {
  const database = readDeclaration(ctx.cwd).database ?? {};
  const selections = [options.linked === true, options.local === true, options.urlEnv !== undefined].filter(Boolean).length;
  if (selections !== 1) throw refusal('DB_USAGE', 'select exactly one of --linked, --local or --url-env');
  const target = options.local ? { kind: 'local', ref: null, env: {}, secrets: [], how: 'local database' }
    : resolveTarget(ctx, { projectRef: null, password: null, ...database }, options);
  if (target.kind === 'linked' && !/^[a-z0-9]{10,40}$/u.test(target.ref)) throw refusal('DB_NOT_LINKED', 'linked project ref is invalid');
  const project = path.basename(ctx.cwd).replace(/[^A-Za-z0-9_-]/gu, '-') || 'database';
  return { ctx, target, database, project };
}

export const backupArgs = (session) => session.target.kind === 'local' ? ['--local', '--workdir', session.ctx.cwd] : targetArgs(session.target, session.ctx.cwd);

/** Queries via the same injected Supabase runner; malformed output is withheld. */
export function queryRows(session, sql) {
  let rows;
  try { rows = JSON.parse(runCli(session, ['db', 'query', sql, '--output', 'json', '--agent', 'no', ...backupArgs(session)]).stdout); }
  catch { throw failure('DB_BACKUP_QUERY_FAILED', 'database inventory query failed; output withheld'); }
  if (!Array.isArray(rows) || rows.some((row) => !row || typeof row !== 'object' || Array.isArray(row))) throw failure('DB_BACKUP_QUERY_FAILED', 'database inventory is not a rows array');
  return rows;
}

/** Executes local tar/age through ctx.spawn, the same seam used by the stack's age installer; never relays tool errors containing data. */
export function backupTool(ctx, command, args, options = {}) {
  const result = ctx.spawn(command, args, { cwd: ctx.cwd, env: ctx.env, ...options });
  if (result.error || result.status !== 0) throw failure('DB_BACKUP_TOOL_FAILED', `${command} failed; output withheld`);
  return result;
}

/** Reads public recipients only from creation_rules age fields, including nested SOPS key_groups. */
export function backupRecipients(root) {
  let rules;
  try { rules = parseYaml(fs.readFileSync(path.join(root, '.sops.yaml'), 'utf8')).creation_rules; } catch { rules = []; }
  const found = [];
  const visit = (value) => {
    if (!value || typeof value !== 'object') return;
    for (const [key, item] of Object.entries(value)) {
      if (key === 'age') found.push(...(JSON.stringify(item).match(/age1[0-9a-z]{50,}/gu) ?? []));
      else if (typeof item === 'object') visit(item);
    }
  };
  visit(rules);
  if (!found.length) throw refusal('DB_BACKUP_NO_RECIPIENT', 'no age recipient in .sops.yaml creation_rules');
  return [...new Set(found)];
}

/** Header and size checks prove an age envelope exists; proving decryption requires the owner's identity separately. */
function checkArchive(file) {
  const size = fs.statSync(file).size;
  const fd = fs.openSync(file, 'r');
  const header = Buffer.alloc(22);
  try { fs.readSync(fd, header, 0, header.length, 0); } finally { fs.closeSync(fd); }
  if (size < 100 || !header.toString('ascii').startsWith('age-encryption.org/v1\n')) throw failure('DB_BACKUP_ARCHIVE_INVALID', 'encrypted archive has no valid age header or payload');
  return size;
}

export function encryptFile(ctx, input, output, recipients) {
  backupTool(ctx, 'age', [...recipients.flatMap((recipient) => ['-r', recipient]), '-o', output, input]);
  return checkArchive(output);
}

/** Validates a complete, recent, full-data receipt and its encrypted bytes before any destructive reset call. */
export function validateReceipt(session, receiptPath) {
  if (!receiptPath) throw refusal('DB_RESET_BACKUP_MISSING', '--backup must name an encrypted backup receipt');
  let receipt;
  try { receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8')); } catch { throw refusal('DB_RESET_BACKUP_INVALID', 'backup receipt is missing or invalid JSON'); }
  const valid = receipt && receipt.schema === RECEIPT_SCHEMA && receipt.target === 'linked' && receipt.schemaOnly === false
    && typeof receipt.project === 'string' && typeof receipt.ref === 'string' && typeof receipt.file === 'string'
    && path.basename(receipt.file) === receipt.file && receipt.file.endsWith('.age') && Number.isSafeInteger(receipt.bytes) && receipt.bytes >= 100
    && /^[a-f0-9]{64}$/u.test(receipt.sha256 ?? '') && Array.isArray(receipt.parts)
    && ['roles.sql', 'schema.sql', 'auth-storage-schema.sql', 'data.sql', 'auth-storage-data.sql', 'rowcounts.json'].every((part) => receipt.parts.includes(part))
    && Number.isSafeInteger(receipt.rowcounts?.tables) && receipt.rowcounts.tables >= 0 && /^\d+$/u.test(receipt.rowcounts?.rows ?? '')
    && typeof receipt.at === 'string' && Number.isFinite(Date.parse(receipt.at));
  if (!valid) throw refusal('DB_RESET_BACKUP_INVALID', 'backup receipt is not a full starci/db-backup@1 linked backup');
  if (receipt.ref !== session.target.ref) throw refusal('DB_RESET_BACKUP_PROJECT', 'backup targets a different project ref');
  const maxAge = session.database.reset?.backupMaxAgeHours ?? 24;
  if (!Number.isFinite(maxAge) || maxAge <= 0) throw refusal('DB_CONFIG_INVALID', 'database.reset.backupMaxAgeHours must be positive');
  const age = session.ctx.now() - Date.parse(receipt.at);
  if (age < 0 || age > maxAge * 3600000) throw refusal('DB_RESET_BACKUP_STALE', 'backup is future-dated or older than the allowed backup age');
  const file = path.resolve(path.dirname(receiptPath), receipt.file);
  if (!fs.existsSync(file)) throw refusal('DB_RESET_BACKUP_ARCHIVE_MISSING', 'backup archive is absent');
  try {
    if (checkArchive(file) !== receipt.bytes || sha256(file) !== receipt.sha256) throw new Error('mismatch');
  } catch { throw refusal('DB_RESET_BACKUP_HASH', 'backup archive size, header or sha256 differs from the receipt'); }
  return receipt;
}
