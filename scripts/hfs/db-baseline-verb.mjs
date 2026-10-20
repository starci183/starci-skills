// app db baseline: schema-only dump, explicit cutover and repair commands; preview writes nothing.
import fs from 'node:fs';
import path from 'node:path';
import pg from 'libpg-query';
import { invocationDir } from '../lib/roots.mjs';
import { sqlStringParts as names, walkSqlAst as walk, sqlParser } from '../lib/sql-ast.mjs';
import { databaseDump } from '../api/supabase/database-dump.mjs';
import { databaseQuery } from '../api/supabase/database-query.mjs';
import { migrationRepair } from '../api/supabase/migration-repair.mjs';
import { migrationStamp, isMigrationName, databaseSqlTokens, databaseExecutableTokens } from './rules/database-migrations.mjs';
import { baselineMarkers, baselineSourceFindings } from './rules/database-baseline.mjs';
import { databaseQueueDeclarations } from './rules/database-queues.mjs';
import { MIGRATIONS_DIR, MIGRATIONS_ARCHIVE_DIR } from './rules/database-constants.mjs';
import { dbPlanMain } from './db-plan-verb.mjs';

await pg.loadModule();

export class DbVerbError extends Error {}
const LINKED_PASSWORD_ENV = 'SUPABASE_DB_PASSWORD';
const TELEMETRY_DISABLED_ENV = 'SUPABASE_TELEMETRY_DISABLED';
const TELEMETRY_DEBUG_ENV = 'SUPABASE_TELEMETRY_DEBUG';
const CLI_DEBUG_ENV = 'SUPABASE_DEBUG';

/** Strict shared options; unknown flags never reach the database CLI. */
export function dbOptions(argv, allowed) {
  const opts = {};
  for (let index = 0; index < argv.length; index += 1) {
    const [flag, inline] = argv[index].split(/=(.*)/s);
    const name = flag.slice(2);
    if (!flag.startsWith('--') || !allowed.includes(name) || Object.hasOwn(opts, name)) throw new DbVerbError('unknown or duplicate database option');
    if (['apply', 'local', 'json'].includes(name)) {
      if (inline !== undefined && !['true', 'false'].includes(inline)) throw new DbVerbError(`${flag} expects true or false`);
      opts[name] = inline !== 'false';
    } else {
      const value = inline ?? argv[++index];
      if (!value || value.startsWith('--')) throw new DbVerbError(`${flag} requires a value`);
      opts[name] = value;
    }
  }
  return opts;
}

export function dbAppRoot(cwd, opts) {
  const root = path.resolve(cwd, opts.cwd ?? '.');
  let declaration;
  try { declaration = JSON.parse(fs.readFileSync(path.join(root, 'hfs.json'), 'utf8')); } catch { throw new DbVerbError('run at an app root containing hfs.json'); }
  if (declaration.kind !== 'app' || !['lite', 'full'].includes(declaration.edition ?? 'full')) throw new DbVerbError('database verbs require a lite or full app');
  return root;
}

/** Immediate SQL files only, never secrets or Supabase's temporary credential files. */
export function dbSqlFiles(root, directory = MIGRATIONS_DIR) {
  const dir = path.join(root, directory);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isFile() && entry.name.endsWith('.sql')).map((entry) => {
    const match = /^(\d{14})_/.exec(entry.name);
    if (!isMigrationName(entry.name) || !match || migrationStamp(match[1]) === null) throw new DbVerbError('migration filenames must carry valid UTC stamps');
    return { file: `${directory}/${entry.name}`, name: entry.name, stamp: match[1] };
  }).sort((left, right) => left.name < right.name ? -1 : Number(left.name > right.name));
}

/** Supabase adapter uses supabaseSpawn's (repoRoot, args, options) contract; raw failures are private. */
const DB_CALLS = { 'db dump': databaseDump, 'db query': databaseQuery, 'migration repair': migrationRepair };

function runDatabaseCommand(root, args, options) {
  const call = DB_CALLS[args.slice(0, 2).join(' ')];
  if (!call) throw new DbVerbError('unsupported database command');
  return call(root, args.slice(2), options);
}

export function runDbSupabase(root, args, ports = {}) {
  const env = ports.env ?? process.env;
  // The linked CLI can mint a temporary remote login when no existing password is supplied.
  // Check custody presence only; the value stays within the CLI environment.
  if (args.includes('--linked') && !ports.runSupabase && !ports.run && (typeof env[LINKED_PASSWORD_ENV] !== 'string' || env[LINKED_PASSWORD_ENV].length === 0)) throw new DbVerbError('linked database operations require an existing SUPABASE_DB_PASSWORD in the CLI environment');
  const cliEnv = { ...env, [TELEMETRY_DISABLED_ENV]: '1', [TELEMETRY_DEBUG_ENV]: '0', [CLI_DEBUG_ENV]: '0' };
  const result = (ports.runSupabase ?? runDatabaseCommand)(root, args, { env: cliEnv, ...(ports.run ? { run: ports.run } : {}) });
  if (result?.error || !(result?.ok === true || result?.status === 0)) throw new DbVerbError('Supabase command failed; inspect the CLI privately');
  return String(result.stdout ?? '');
}

export const repairArgs = (stamp, status, local) => ['migration', 'repair', stamp, '--status', status, local ? '--local' : '--linked'];
export const dbFailure = (verb, error, stderr) => { stderr(`starci app db ${verb}: ${error instanceof DbVerbError ? error.message : 'operation failed; database output was withheld'}\n`); return 2; };

function baselinePlan(root, opts, now) {
  const active = dbSqlFiles(root);
  if (!active.length) throw new DbVerbError('baseline requires an existing active migration chain');
  const archived = dbSqlFiles(root, MIGRATIONS_ARCHIVE_DIR);
  const oldStamps = [...active, ...archived].map((entry) => entry.stamp);
  const last = oldStamps.toSorted((left, right) => left.localeCompare(right)).at(-1);
  const stamp = opts.stamp ?? now().toISOString().replace(/\D/g, '').slice(0, 14);
  if (!/^\d{14}$/.test(stamp) || migrationStamp(stamp) === null || stamp <= last) throw new DbVerbError('--stamp must be a valid UTC version after the archive boundary');
  const file = `${MIGRATIONS_DIR}/${stamp}_baseline.sql`;
  if (fs.existsSync(path.join(root, file)) || active.some((entry) => fs.existsSync(path.join(root, MIGRATIONS_ARCHIVE_DIR, entry.name)))) throw new DbVerbError('baseline would overwrite an existing migration');
  return { active, last, stamp, file };
}

const EXCLUDED_SCHEMAS = new Set(['information_schema', '_analytics', '_realtime', '_supavisor', 'auth', 'etl', 'extensions', 'pgbouncer', 'realtime', 'storage', 'supabase_functions', 'supabase_migrations', 'cron', 'dbdev', 'graphql', 'graphql_public', 'net', 'pgmq', 'pgmq_public', 'pgsodium', 'pgsodium_masks', 'pgtle', 'repack', 'tiger', 'tiger_data', 'topology', 'vault']);
const ROLE_OPTIONS = new Set(['canlogin', 'inherit', 'superuser', 'createdb', 'createrole', 'isreplication', 'bypassrls', 'connectionlimit']);
const identifier = (name) => `"${name.replaceAll('"', '""')}"`;
const literal = (value) => `'${value.replaceAll("'", "''")}'`;
const excludedSchema = (name) => EXCLUDED_SCHEMAS.has(name) || /^(?:pg_|timescaledb_|_timescaledb_)/.test(name ?? '');

/** Inventory source paths only; no credential, generated or vendor tree is traversed. */
function baselineFiles(root) {
  const files = [];
  const visit = (directory) => {
    const full = path.join(root, directory);
    if (!fs.existsSync(full)) return;
    for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const file = `${directory}/${entry.name}`;
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile() && /\.(?:sql|[cm]?[jt]sx?)$/.test(entry.name)) files.push(file);
    }
  };
  for (const directory of ['supabase', 'be/src', 'be/apps', 'src', 'apps']) visit(directory);
  return files;
}

const parsed = sqlParser(pg, () => { throw new DbVerbError('migration SQL could not be prepared safely for a baseline'); });

function statementSql(text, entry) {
  const bytes = Buffer.from(text);
  const start = entry.stmt_location ?? 0;
  const statement = bytes.subarray(start, entry.stmt_len ? start + entry.stmt_len : bytes.length).toString('utf8');
  return `${statement.slice(databaseSqlTokens(statement)[0]?.index ?? 0).trim().replace(/;\s*$/, '')};\n`;
}

function ownedSchemas(node) {
  const schemas = [node.relation?.schemaname, node.table?.schemaname, node.schemaname, node.newschema];
  for (const field of ['funcname', 'typeName', 'typename', 'type', 'object', 'domainname', 'collname', 'opfamilyname', 'opclassname']) {
    const parts = names(Array.isArray(node[field]) ? node[field] : node[field]?.names ?? node[field]?.List?.items);
    if (parts.length > 1) schemas.push(parts[0]);
  }
  for (const object of node.objects ?? []) {
    const parts = names(object.List?.items ?? object.ObjectWithArgs?.objname);
    schemas.push(object.RangeVar?.schemaname);
    if (parts.length > 1 || /^OBJECT_SCHEMA$/.test(node.objtype ?? node.removeType ?? '')) schemas.push(parts[0]);
  }
  return schemas;
}

function excludedOwnership(stmt) {
  if (ownedSchemas(stmt).some(excludedSchema)) return true;
  let unsupported = false;
  walk(stmt, (node) => {
    if (node.DefElem?.defname === 'schemas' && names(node.DefElem.arg?.List?.items).some(excludedSchema)) unsupported = true;
    if (node.FuncCall && names(node.FuncCall.funcname)[0] === 'vault') unsupported = true;
  });
  if (stmt.name === 'search_path') unsupported ||= (stmt.args ?? []).some((node) => excludedSchema(node.A_Const?.sval?.sval));
  return unsupported;
}

function dataMutation(stmt) {
  if (stmt.CreateFunctionStmt || stmt.CreateTrigStmt || stmt.CreatePolicyStmt || stmt.AlterPolicyStmt || stmt.CreateStmt || stmt.ViewStmt) return false;
  let mutation = false;
  walk(stmt, (node) => { if (['InsertStmt', 'UpdateStmt', 'DeleteStmt', 'MergeStmt', 'CopyStmt', 'TruncateStmt', 'IntoClause'].some((key) => node[key])) mutation = true; });
  return mutation;
}

function unsupportedCall(call) {
  const name = names(call.funcname).join('.');
  const args = (call.args ?? []).map((arg) => arg.NamedArgExpr?.arg ?? arg);
  if (name === 'pgmq.create' || name === 'pgmq.drop_queue') return args.length !== 1 || !args[0]?.A_Const?.sval;
  if (name === 'cron.schedule' || name === 'cron.unschedule') return false;
  if (name === 'pg_catalog.set_config') return args[0]?.A_Const?.sval?.sval !== 'search_path' || args[1]?.A_Const?.sval?.sval !== '';
  return true;
}

function sourceExecution(stmt) {
  if (stmt.CallStmt) return true;
  if (!stmt.SelectStmt) return false;
  let unsupported = false;
  walk(stmt, (node) => { if (node.FuncCall && unsupportedCall(node.FuncCall)) unsupported = true; });
  return unsupported;
}

function unsupportedDo(node) {
  const body = (node.args ?? []).find((item) => item.DefElem?.defname === 'as')?.DefElem?.arg?.String?.sval ?? '';
  const tokens = databaseExecutableTokens(body);
  const unsupported = tokens.some((token, index) => {
    const next = tokens[index + 1]?.v;
    return (token.t === 'word' && ['execute', 'role', 'user', 'extension', 'insert', 'update', 'delete', 'merge', 'copy', 'truncate'].includes(token.v))
      || (excludedSchema(token.v) && next === '.' && !['pgmq', 'cron'].includes(token.v));
  });
  if (unsupported) return true;
  let tree;
  try { tree = pg.parsePlPgSQLSync(`do ${literal(body)};`); } catch { return true; }
  let effects = false;
  walk(tree, (item) => {
    if (item.PLpgSQL_expr?.parseMode !== 0) return;
    const sql = parsed(item.PLpgSQL_expr.query);
    if ((sql.stmts ?? []).some((entry) => dataMutation(entry.stmt) || sourceExecution(entry.stmt))) effects = true;
  });
  return effects;
}

function roleDeclaration(stmt, sql, roles) {
  const create = stmt.CreateRoleStmt;
  const alter = stmt.AlterRoleStmt;
  const setting = stmt.AlterRoleSetStmt;
  const declaration = create ?? alter ?? setting;
  if (!declaration) return false;
  const name = create?.role ?? declaration.role?.rolename;
  if (!name || name.startsWith('pg_') || (declaration.options ?? []).some((option) => !ROLE_OPTIONS.has(option.DefElem?.defname))) throw new DbVerbError('baseline role declarations require static non-secret role attributes');
  if (setting && setting.setstmt?.name !== 'search_path') throw new DbVerbError('baseline supports only non-secret search_path role settings');
  if (create) roles.set(name, [sql]);
  else {
    if (!roles.has(name)) throw new DbVerbError('baseline cannot reconstruct alterations to a role it does not declare');
    roles.get(name).push(sql);
  }
  return true;
}

function extensionDeclaration(stmt, sql, extensions) {
  if (stmt.CreateExtensionStmt) {
    extensions.set(stmt.CreateExtensionStmt.extname, sql.replace(/\bcreate\s+extension\s+(?!if\s+not\s+exists\b)/i, 'create extension if not exists '));
    return true;
  }
  if (!/^OBJECT_EXTENSION$/.test(stmt.DropStmt?.removeType ?? '')) return false;
  for (const object of stmt.DropStmt.objects ?? []) extensions.delete(names(object.List?.items)[0]);
  return true;
}

function baselineStatement(state, stmt, sql) {
  if (roleDeclaration(stmt, sql, state.roles) || extensionDeclaration(stmt, sql, state.extensions)) return;
  if (stmt.DropRoleStmt) {
    for (const role of stmt.DropRoleStmt.roles ?? []) state.roles.delete(role.RoleSpec?.rolename);
    return;
  }
  if (stmt.GrantRoleStmt || stmt.AlterExtensionStmt || stmt.AlterExtensionContentsStmt || /^OBJECT_ROLE$/.test(stmt.RenameStmt?.renameType ?? '')) throw new DbVerbError('baseline cannot reconstruct role membership, role renames or extension alterations');
  if (dataMutation(stmt) || sourceExecution(stmt)) throw new DbVerbError('baseline cannot reconstruct migration-owned data changes or custom execution from a schema-only dump');
  const node = Object.values(stmt)[0];
  const queueGrant = stmt.GrantStmt && (node.objects ?? []).every((object) => object.RangeVar?.schemaname === 'pgmq');
  if ((excludedOwnership(node) && !queueGrant) || (stmt.DoStmt && unsupportedDo(node))) throw new DbVerbError('baseline cannot reconstruct application changes to excluded managed schemas or dynamic operational declarations');
}

function baselineMetadata(root, plan, files) {
  const queues = databaseQueueDeclarations({ repoRoot: root, files, all: files });
  if (queues.findings.length) throw new DbVerbError('baseline requires valid migration-owned queues, grants and cron declarations');
  const state = { roles: new Map(), extensions: new Map() };
  for (const migration of plan.active) {
    const text = fs.readFileSync(path.join(root, migration.file), 'utf8');
    for (const entry of parsed(text).stmts ?? []) baselineStatement(state, entry.stmt, statementSql(text, entry));
  }
  return { ...queues, roles: [...state.roles.values()].flat().join(''), extensions: [...state.extensions.values()].join('') };
}

function metadataSql(metadata) {
  const queueSql = metadata.queues.map((queue) => `select pgmq.create(${literal(queue)});\n`).join('');
  const grants = (metadata.grants ?? []).map((grant) => `grant ${grant.privileges.join(', ')} on table ${grant.tables.map((table) => table.split('.').map(identifier).join('.')).join(', ')} to ${grant.roles.map(identifier).join(', ')}${grant.grantOption ? ' with grant option' : ''};\n`).join('');
  const cron = metadata.cron.map((job) => `select cron.schedule(${literal(job.name)}, ${literal(job.schedule)}, ${literal(job.command)});\n`).join('');
  return `${queueSql}${grants}${cron}`;
}

/** Numeric CLI exit code, injectable IO/clock/CLI; neither files nor history change without --apply. */
export function dbBaselineMain(argv, { cwd = invocationDir(), stdout = (text) => process.stdout.write(text), stderr = (text) => process.stderr.write(text), now = () => new Date(), ...ports } = {}) {
  try {
    const opts = dbOptions(argv, ['cwd', 'stamp', 'apply', 'local']);
    const root = dbAppRoot(cwd, opts);
    const plan = baselinePlan(root, opts, now);
    const files = baselineFiles(root);
    if (baselineSourceFindings({ repoRoot: root, files, all: files, git: ports.git }).length) throw new DbVerbError('baseline sources and archives must match committed migration history');
    const metadata = baselineMetadata(root, plan, files);
    if (dbPlanMain(['--json', ...(opts.local ? ['--local'] : [])], { ...ports, cwd: root, stdout: () => {}, stderr: () => {} }) !== 0) throw new DbVerbError('baseline requires a clean database plan with all local migrations already applied');
    const schema = runDbSupabase(root, ['db', 'dump', opts.local ? '--local' : '--linked'], ports);
    if (!schema.trim() || baselineMarkers(schema).length || /\bvault\.(?:create_secret|update_secret)\s*\(|\bpassword\s+'[^']+'/i.test(schema)) throw new DbVerbError('schema dump is empty or contains unsupported secret/baseline statements');
    const repairs = [...plan.active.map((entry) => repairArgs(entry.stamp, 'reverted', opts.local)), repairArgs(plan.stamp, 'applied', opts.local)];
    stdout(`${opts.apply ? 'apply' : 'preview'} baseline ${plan.file}; archive ${plan.active.length} migrations\n`);
    for (const args of repairs) stdout(`supabase ${args.join(' ')}\n`);
    if (!opts.apply) return 0;
    for (const args of repairs) runDbSupabase(root, args, ports);
    fs.mkdirSync(path.join(root, MIGRATIONS_ARCHIVE_DIR), { recursive: true });
    fs.writeFileSync(path.join(root, plan.file), `-- starci:baseline ${plan.last}\n${metadata.extensions}${metadata.roles}${schema.replace(/^\s+/, '')}\n${metadataSql(metadata)}`, { flag: 'wx' });
    for (const entry of plan.active) fs.renameSync(path.join(root, entry.file), path.join(root, MIGRATIONS_ARCHIVE_DIR, entry.name));
    return 0;
  } catch (error) { return dbFailure('baseline', error, stderr); }
}
