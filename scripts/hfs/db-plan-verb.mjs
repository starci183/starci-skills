// app db plan: compare migration-owned state without fetching commands or Vault values.
import fs from 'node:fs';
import path from 'node:path';
import { sha256 } from '../../engine/digest.mjs';
import pg from 'libpg-query';
import { parse as parseToml } from 'smol-toml';
import { invocationDir } from '../lib/roots.mjs';
import { sqlStringParts, walkSqlAst as walk, sqlParser, sqlCallArgument as argument, sqlStringLiteral as literal } from '../lib/sql-ast.mjs';
import { DbVerbError, dbOptions, dbAppRoot, dbSqlFiles, runDbSupabase, dbFailure } from './db-baseline-verb.mjs';

await pg.loadModule();

// The pinned Supabase CLI uses positional SQL, --output json and --agent no for a plain rows array.
// Contract: supabase/cli apps/cli/src/commands/db/query/{query.command,query.handler}.ts at the pinned CLI tag.
const PRESENCE_SQL = `select
  pg_catalog.to_regclass('supabase_migrations.schema_migrations') is not null as migrations,
  pg_catalog.to_regclass('cron.job') is not null as cron,
  pg_catalog.to_regclass('pgmq.meta') is not null as queues,
  pg_catalog.to_regclass('vault.secrets') is not null as vault;`;
const INVENTORIES = {
  migrations: 'select version from supabase_migrations.schema_migrations order by version;',
  cron: 'select jobname as name, schedule, pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(command, \'UTF8\')), \'hex\') as "commandHash", active from cron.job order by jobid;',
  queues: 'select queue_name as name from pgmq.meta order by queue_name;',
  vault: 'select name from vault.secrets order by name;',
};
const names = (nodes) => sqlStringParts(nodes).join('.');
const OWNERSHIP_CALLS = new Set(['pgmq.create', 'pgmq.drop_queue', 'cron.schedule', 'cron.unschedule', 'cron.schedule_in_database', 'cron.alter_job']);

const parseSql = sqlParser(pg, () => { throw new DbVerbError('migration SQL could not be inventoried safely'); });

function requiredLiteral(call, index, aliases) {
  const value = literal(argument(call, index, aliases));
  if (value === null || value.length === 0) throw new DbVerbError('queue and cron ownership requires literal migration declarations');
  return value;
}

function inventoryCall(state, call) {
  const name = names(call.funcname);
  if (name === 'pgmq.create') {
    state.queues.set(requiredLiteral(call, 0, ['queue_name']), null);
  } else if (name === 'pgmq.drop_queue') {
    state.queues.delete(requiredLiteral(call, 0, ['queue_name']));
  } else if (name === 'cron.schedule') {
    const job = requiredLiteral(call, 0, ['job_name']);
    const schedule = requiredLiteral(call, 1, ['schedule']);
    const command = requiredLiteral(call, 2, ['command']);
    state.cron.set(job, { schedule, commandHash: sha256(command), active: true });
  } else if (name === 'cron.unschedule') {
    state.cron.delete(requiredLiteral(call, 0, ['job_name']));
  } else if (name === 'cron.schedule_in_database' || name === 'cron.alter_job') {
    throw new DbVerbError('database plan requires cron.schedule and named cron.unschedule ownership');
  }
}

function ownershipCalls(tree) {
  const calls = [];
  walk(tree, (node) => { if (node.FuncCall && OWNERSHIP_CALLS.has(names(node.FuncCall.funcname))) calls.push(node.FuncCall); });
  return calls;
}

function flatDeclaration(tree, call) {
  const node = tree.SelectStmt ?? (tree.stmts?.length === 1 && tree.stmts[0].stmt.SelectStmt);
  const constrained = ['fromClause', 'withClause', 'whereClause', 'intoClause', 'limitCount', 'limitOffset', 'groupClause', 'havingClause', 'distinctClause', 'windowClause'];
  return node && /^SETOP_NONE$/.test(node.op) && node.targetList?.length === 1
    && !constrained.some((key) => node[key]) && node.targetList[0].ResTarget?.val?.FuncCall === call;
}

function inventoryTree(state, tree) {
  const calls = ownershipCalls(tree);
  if (!calls.length) return;
  if (calls.length !== 1 || !flatDeclaration(tree, calls[0])) throw new DbVerbError('database ownership requires one unconditional migration SELECT per declaration');
  inventoryCall(state, calls[0]);
}

function conditionalBlock(item) {
  if (item.PLpgSQL_stmt_block?.exceptions) return true;
  return Object.keys(item).some((key) => key.startsWith('PLpgSQL_stmt_')
    && !['PLpgSQL_stmt_block', 'PLpgSQL_stmt_perform', 'PLpgSQL_stmt_execsql'].includes(key)
    && !(key === 'PLpgSQL_stmt_return' && item[key].lineno === undefined));
}

function inventoryDo(state, node) {
  const option = (key) => (node.args ?? []).find((item) => item.DefElem?.defname === key)?.DefElem?.arg?.String?.sval;
  if (option('language') && option('language') !== 'plpgsql') throw new DbVerbError('database plan requires statically readable migration blocks');
  const body = option('as') ?? '';
  let delimiter = '$starci_plan$';
  while (body.includes(delimiter)) delimiter = `${delimiter.slice(0, -1)}_$`;
  let tree;
  try { tree = pg.parsePlPgSQLSync(`create function starci_plan_probe() returns void language plpgsql as ${delimiter}${body}${delimiter};`); }
  catch { throw new DbVerbError('migration block could not be inventoried safely'); }
  const statements = [];
  let conditional = false;
  walk(tree, (item) => {
    conditional ||= conditionalBlock(item);
    if (item.PLpgSQL_stmt_dynexecute) throw new DbVerbError('dynamic migration blocks cannot prove database inventory');
    if (item.PLpgSQL_expr?.parseMode === 0) statements.push(parseSql(item.PLpgSQL_expr.query));
  });
  if (conditional && statements.some((statement) => ownershipCalls(statement).length)) throw new DbVerbError('conditional migration blocks cannot prove database inventory');
  for (const statement of statements) inventoryTree(state, statement);
}

function quotedEnd(text, start) {
  const quote = text[start];
  const delimiter = text.startsWith(quote.repeat(3), start) ? quote.repeat(3) : quote;
  let cursor = start + delimiter.length;
  while (cursor < text.length) {
    if (quote === '"' && text[cursor] === '\\') { cursor += 2; continue; }
    if (text.startsWith(delimiter, cursor)) {
      let end = cursor + delimiter.length;
      if (delimiter.length === 3) while (text[end] === quote) end += 1;
      return end;
    }
    cursor += 1;
  }
  throw new DbVerbError('Supabase config contains an unterminated string');
}

// Advance over an assignment value without collecting, decoding or resolving its content.
function valueEnd(text, start) {
  let cursor = start;
  let depth = 0;
  while (cursor < text.length) {
    const character = text[cursor];
    if (character === '"' || character === "'") { cursor = quotedEnd(text, cursor); continue; }
    if (character === '#') {
      cursor = text.indexOf('\n', cursor);
      if (cursor < 0) return text.length;
      if (depth === 0) return cursor + 1;
    } else if (character === '[' || character === '{') depth += 1;
    else if (character === ']' || character === '}') depth -= 1;
    else if (character === '\n' && depth === 0) return cursor + 1;
    cursor += 1;
  }
  return cursor;
}

function assignmentEnd(text, start) {
  let cursor = start;
  while (cursor < text.length && !['=', '\n', '#'].includes(text[cursor])) {
    if (text[cursor] === '"' || text[cursor] === "'") cursor = quotedEnd(text, cursor);
    else cursor += 1;
  }
  return cursor;
}

function vaultKeys(table, key) {
  // The TOML parser sees only the table/key syntax and an invented empty value.
  let metadata;
  try { metadata = parseToml(`${table}\n${key} = ""`); }
  catch { throw new DbVerbError('Supabase config keys could not be inventoried safely'); }
  const vault = metadata.db?.vault ?? {};
  if (typeof vault !== 'object' || Object.values(vault).some((value) => typeof value !== 'string')) throw new DbVerbError('Vault config requires individual named keys');
  return Object.keys(vault);
}

function configToken(text, cursor, table) {
  if (/\s/.test(text[cursor])) return { cursor: cursor + 1, table, keys: [] };
  if (text[cursor] === '#' || text[cursor] === '[') {
    const end = text.indexOf('\n', cursor);
    const line = text.slice(cursor, end < 0 ? undefined : end);
    return { cursor: end < 0 ? text.length : end + 1, table: text[cursor] === '[' ? line : table, keys: [] };
  }
  const end = assignmentEnd(text, cursor);
  if (text[end] !== '=') throw new DbVerbError('Supabase config keys could not be inventoried safely');
  return { cursor: valueEnd(text, end + 1), table, keys: vaultKeys(table, text.slice(cursor, end)) };
}

function configVaultNames(root) {
  const file = path.join(root, 'supabase/config.toml');
  if (!fs.existsSync(file)) return new Map();
  const text = fs.readFileSync(file, 'utf8');
  const configured = new Map();
  let token = { cursor: 0, table: '' };
  while (token.cursor < text.length) {
    token = configToken(text, token.cursor, token.table);
    for (const name of token.keys) {
      if (configured.has(name)) throw new DbVerbError('Vault config names must be unique');
      configured.set(name, null);
    }
  }
  return configured;
}

function repositoryState(root) {
  const migrations = dbSqlFiles(root);
  const state = { migrations: new Map(migrations.map((entry) => [entry.stamp, null])), cron: new Map(), queues: new Map(), vault: configVaultNames(root) };
  if (state.migrations.size !== migrations.length) throw new DbVerbError('active migrations must have unique versions');
  for (const entry of migrations) {
    const tree = parseSql(fs.readFileSync(path.join(root, entry.file), 'utf8'));
    for (const statement of tree.stmts ?? []) {
      // Creating a function does not execute its body. Inert SQL strings never declare remote state.
      if (statement.stmt.CreateFunctionStmt) continue;
      if (statement.stmt.DoStmt) inventoryDo(state, statement.stmt.DoStmt);
      else inventoryTree(state, statement.stmt);
    }
  }
  return state;
}

function queryRows(root, sql, local, ports) {
  // The pinned CLI otherwise creates this cache in its linked-query finalizer.
  // Existing metadata is sufficient; never inspect the cache or credential files.
  if (!local && !ports.runSupabase && !ports.run && !fs.existsSync(path.join(root, 'supabase/.temp/linked-project.json'))) throw new DbVerbError('link the existing project before running a read-only database plan');
  const output = runDbSupabase(root, ['db', 'query', sql, local ? '--local' : '--linked', '--output', 'json', '--agent', 'no'], ports);
  let rows;
  try { rows = JSON.parse(output); } catch { throw new DbVerbError('Supabase returned unreadable inventory; database output was withheld'); }
  if (!Array.isArray(rows) || rows.some((row) => !row || typeof row !== 'object' || Array.isArray(row))) throw new DbVerbError('Supabase returned an invalid inventory; database output was withheld');
  return rows;
}

function remoteState(root, local, ports) {
  const rows = queryRows(root, PRESENCE_SQL, local, ports);
  if (rows.length !== 1 || Object.keys(INVENTORIES).some((key) => typeof rows[0][key] !== 'boolean')) throw new DbVerbError('Supabase returned invalid inventory availability');
  const state = {};
  for (const [key, sql] of Object.entries(INVENTORIES)) state[key] = rows[0][key] ? queryRows(root, sql, local, ports) : [];
  return state;
}

function compare(expected, actual, kind) {
  const unmatched = new Set(expected.keys());
  let unexpected = 0;
  let changed = 0;
  for (const row of actual) {
    const key = kind === 'migrations' ? row.version : row.name;
    if (key !== null && (typeof key !== 'string' || key.length === 0)) throw new DbVerbError('Supabase returned an invalid inventory identifier');
    if (kind === 'cron' && (typeof row.schedule !== 'string' || !/^[a-f0-9]{64}$/.test(row.commandHash ?? '') || typeof row.active !== 'boolean')) throw new DbVerbError('Supabase returned invalid cron metadata');
    if (!unmatched.delete(key)) unexpected += 1;
    else if (kind === 'cron') {
      const desired = expected.get(key);
      if (desired.schedule !== row.schedule || desired.commandHash !== row.commandHash || desired.active !== row.active) changed += 1;
    }
  }
  return { expected: expected.size, remote: actual.length, missing: unmatched.size, unexpected, changed };
}

/** Numeric exit codes: 0 equal, 1 drift, 2 invalid/failed; all IO and CLI calls are injectable. */
export function dbPlanMain(argv, { cwd = invocationDir(), stdout = (text) => process.stdout.write(text), stderr = (text) => process.stderr.write(text), ...ports } = {}) {
  try {
    const opts = dbOptions(argv, ['cwd', 'local', 'json', 'apply']);
    const root = dbAppRoot(cwd, opts);
    const expected = repositoryState(root);
    const actual = remoteState(root, opts.local, ports);
    const summaries = Object.fromEntries(Object.keys(INVENTORIES).map((kind) => [kind, compare(expected[kind], actual[kind], kind)]));
    const drift = Object.values(summaries).some((item) => item.missing || item.unexpected || item.changed);
    // --apply is accepted for shared verb ergonomics; a plan never mutates history, queues or jobs.
    if (opts.json) stdout(`${JSON.stringify({ readOnly: true, drift, ...summaries })}\n`);
    else {
      stdout(`read-only database plan: ${drift ? 'drift detected' : 'repo and database agree'}\n`);
      for (const [kind, item] of Object.entries(summaries)) stdout(`${kind}: repo ${item.expected}, remote ${item.remote}, missing ${item.missing}, unexpected ${item.unexpected}, changed ${item.changed}\n`);
    }
    return drift ? 1 : 0;
  } catch (error) { return dbFailure('plan', error, stderr); }
}
