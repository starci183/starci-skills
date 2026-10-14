import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import pg from 'libpg-query';
import { databaseQueueDeclarations } from '../../scripts/hfs/rules/database-queues.mjs';
import { databaseBaselineFindings } from '../../scripts/hfs/rules/database-baseline.mjs';
import { checkDatabase } from '../../scripts/hfs/rules/database.mjs';
import { migrationsDigest } from '../../packages/hfs/emit/db-types.mjs';
import { byCodeUnit } from '../../scripts/lib/list.mjs';

await pg.loadModule();
const repoRoot = path.resolve(import.meta.dirname, '../../examples/lite-app');
const migration = 'supabase/migrations/20261017000000_app-queue-access.sql';
const source = fs.readFileSync(path.join(repoRoot, migration), 'utf8');
const statements = pg.parseSync(source).stmts;
const sqlName = (nodes) => (nodes ?? []).map((item) => item.String.sval).join('.');
const functions = new Map(statements.filter((item) => item.stmt.CreateFunctionStmt).map((item) => [sqlName(item.stmt.CreateFunctionStmt.funcname), item]));
const operations = new Map([
  ['private.queue_send', 'pgmq.send'],
  ['private.queue_read', 'pgmq.read'],
  ['private.queue_archive', 'pgmq.archive'],
  ['private.queue_set_vt', 'pgmq.set_vt'],
]);

function nodesOf(value, kind, found = []) {
  if (!value || typeof value !== 'object') return found;
  if (value[kind]) found.push(value[kind]);
  for (const child of Object.values(value)) nodesOf(child, kind, found);
  return found;
}

function bodyOf(entry) {
  const end = entry.stmt_len ? entry.stmt_location + entry.stmt_len : undefined;
  return pg.parsePlPgSQLSync(source.slice(entry.stmt_location, end));
}

function optionOf(entry, name) {
  return entry.stmt.CreateFunctionStmt.options.find((item) => item.DefElem.defname === name)?.DefElem.arg;
}

function callOf(query) {
  const text = query.trim();
  const statement = text.toLowerCase().startsWith('select ') ? text : `select ${text}`;
  return nodesOf(pg.parseSync(statement), 'FuncCall');
}

function aclOf(name, granted) {
  return statements.map((item) => item.stmt.GrantStmt).filter((grant) => grant && Boolean(grant.is_grant) === granted
    && grant.objects.some((item) => sqlName(item.ObjectWithArgs?.objname) === name));
}

const roleOf = (role) => role.RoleSpec.roletype === 'ROLESPEC_PUBLIC' ? 'public' : role.RoleSpec.rolename;

function inventory() {
  const queueRoot = path.join(repoRoot, 'be/src/modules/queues');
  const queues = fs.readdirSync(queueRoot).flatMap((directory) => fs.readdirSync(path.join(queueRoot, directory)).map((name) => `be/src/modules/queues/${directory}/${name}`));
  const migrations = fs.readdirSync(path.join(repoRoot, 'supabase/migrations')).filter((name) => name.endsWith('.sql')).map((name) => `supabase/migrations/${name}`);
  const archive = fs.readdirSync(path.join(repoRoot, 'supabase/migrations/_archive')).map((name) => `supabase/migrations/_archive/${name}`);
  return [...queues, ...migrations, ...archive];
}

test('the lite baseline archives only unchanged migrations from its committed main history', () => {
  assert.deepEqual(databaseBaselineFindings({ repoRoot, all: inventory(), repo: { edition: 'lite' }, isRoot: true, base: 'main' }), []);
});

test('the lite database migration parser accepts the queue doors and existing access policies', async () => {
  const files = [...inventory(), 'supabase/config.toml', 'supabase/types/database.types.ts'];
  assert.deepEqual(await checkDatabase({ repoRoot, files, base: 'main' }), []);
});

test('the lite queue doors validate exactly the migration-owned queue names before every privileged operation', () => {
  const declaration = databaseQueueDeclarations({ repoRoot, all: inventory(), repo: { edition: 'lite' } });
  assert.deepEqual(declaration.findings, []);
  const guard = bodyOf(functions.get('private.require_app_queue'));
  const branch = nodesOf(guard, 'PLpgSQL_stmt_if')[0];
  const condition = pg.parseSync(`select ${branch.cond.PLpgSQL_expr.query}`);
  assert.equal(nodesOf(condition, 'BoolExpr')[0].boolop, 'OR_EXPR');
  assert.equal(nodesOf(condition, 'NullTest')[0].nulltesttype, 'IS_NULL');
  const membership = nodesOf(condition, 'A_Expr')[0];
  assert.equal(membership.kind, 'AEXPR_IN');
  assert.equal(sqlName(membership.name), '<>');
  const allowed = membership.rexpr.List.items.map((item) => item.A_Const.sval.sval).sort(byCodeUnit);
  assert.deepEqual(allowed, declaration.queues);
  assert.equal(nodesOf(branch.then_body, 'PLpgSQL_stmt_raise').length, 1);
  for (const [name, target] of operations) {
    const body = bodyOf(functions.get(name));
    const guardCalls = nodesOf(body, 'PLpgSQL_stmt_perform');
    assert.equal(guardCalls.length, 1, name);
    assert.equal(sqlName(callOf(guardCalls[0].expr.PLpgSQL_expr.query)[0].funcname), 'private.require_app_queue', name);
    const calls = nodesOf(body, 'PLpgSQL_expr').flatMap((expr) => callOf(expr.query));
    assert.deepEqual(calls.map((call) => sqlName(call.funcname)), ['private.require_app_queue', target], name);
    assert.equal(nodesOf(body, 'PLpgSQL_stmt_dynexecute').length, 0, name);
  }
});

test('private queue doors have an empty search path and grant only app_be execution', () => {
  for (const name of operations.keys()) {
    const entry = functions.get(name);
    assert.equal(optionOf(entry, 'security').Boolean.boolval, true, name);
    assert.equal(optionOf(entry, 'set').VariableSetStmt.name, 'search_path', name);
    assert.equal(optionOf(entry, 'set').VariableSetStmt.args[0].A_Const.sval.sval, '', name);
    const grants = aclOf(name, true);
    assert.equal(grants.length, 1, name);
    assert.deepEqual(grants[0].privileges.map((item) => item.AccessPriv.priv_name), ['execute'], name);
    assert.deepEqual(grants[0].grantees.map(roleOf), ['app_be'], name);
    assert.deepEqual(aclOf(name, false)[0].grantees.map(roleOf).sort(byCodeUnit), ['anon', 'authenticated', 'public'], name);
  }
  assert.deepEqual(aclOf('private.require_app_queue', true), []);
  assert.deepEqual(aclOf('private.require_app_queue', false)[0].grantees.map(roleOf).sort(byCodeUnit), ['anon', 'app_be', 'authenticated', 'public']);
});

test('the transport calls private queue doors and the public database type body remains current', () => {
  const caller = fs.readFileSync(path.join(repoRoot, 'be/src/modules/platform/queue/persistence/queue.sql.ts'), 'utf8');
  const calls = [...caller.matchAll(/sql`([^`]+)`/g)].flatMap((item) => nodesOf(pg.parseSync(item[1]), 'FuncCall')).map((call) => sqlName(call.funcname));
  assert.deepEqual(calls, [...operations.keys()]);
  const types = fs.readFileSync(path.join(repoRoot, 'supabase/types/database.types.ts'), 'utf8');
  assert.equal(types.split(/\r?\n/)[0], `// migrations-sha256: ${migrationsDigest(repoRoot)}`);
  assert.doesNotMatch(types, /"private"\s*:/);
});
