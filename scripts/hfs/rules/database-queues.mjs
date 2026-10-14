// R258: queue declarations and pg_cron ticks have one migration owner in either edition.
// Initialize PostgreSQL's WASM parser at module load; the exported finder itself is synchronous.
// SQL and TypeScript ASTs keep comments, quoted identifiers and inert string literals out of the inventory.
import pg from 'libpg-query';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTypescript } from '../../lib/package-at.mjs';
import { found, readJson, readText } from './read.mjs';
import { DB_CRON_OWNED, DB_PGMQ_DECLARED, isActiveMigration } from './database-constants.mjs';

await pg.loadModule();

const HERE = path.dirname(fileURLToPath(import.meta.url));
const QUEUE_FILE = /^(?:be\/)?src\/modules\/queues\/.*\.ts$/;
const SOURCE_FILE = /^(?:be\/)?(?:src|apps)\/.*\.[cm]?[jt]s$/;
const TEST_FILE = /(?:\.(?:spec|test)|-spec)\.[cm]?[jt]s$|\/(?:tests|__tests__)\//;
const PURE_CALLS = new Set(['jsonb_build_object', 'json_build_object', 'jsonb_build_array', 'json_build_array', 'to_jsonb', 'now', 'clock_timestamp']);
const TABLE_PRIVILEGES = ['select', 'insert', 'update', 'delete', 'truncate', 'references', 'trigger', 'maintain'];
const strings = (nodes) => (nodes ?? []).map((node) => node?.String?.sval).filter((value) => value !== undefined);
const sqlName = (nodes) => strings(nodes).join('.');
const callName = (call) => sqlName(call.funcname);
const qualified = (name, schema = 'public') => name.includes('.') ? name : `${schema}.${name}`;

function walk(value, visit) {
  if (!value || typeof value !== 'object') return;
  visit(value);
  for (const child of Object.values(value)) walk(child, visit);
}

function sqlTree(text) {
  try { return pg.parseSync(text); } catch { return null; }
}

function walkExecutable(node, visit) {
  if (!node || typeof node !== 'object' || node.CreateFunctionStmt) return;
  visit(node);
  for (const child of Object.values(node)) walkExecutable(child, visit);
}

function callsOf(tree) {
  const calls = [];
  walkExecutable(tree, (node) => { if (node.FuncCall) calls.push(node.FuncCall); });
  return calls;
}

function argument(call, position, names = []) {
  const args = call.args ?? [];
  return args.find((item) => names.includes(item?.NamedArgExpr?.name))?.NamedArgExpr?.arg
    ?? args.filter((item) => !item.NamedArgExpr)[position];
}

function sqlLiteral(node) {
  if (node?.TypeCast) return sqlLiteral(node.TypeCast.arg);
  return node?.A_Const?.sval?.sval ?? null;
}

function problem(state, code, file, message) {
  state.findings.push(found(code, file, `${file}: ${message}`));
}

function sourceValue(ts, node) {
  while (node && (ts.isAsExpression(node) || ts.isParenthesizedExpression(node) || ts.isSatisfiesExpression(node))) node = node.expression;
  return node;
}

function sourceImports(ts, source) {
  const imports = new Map();
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const module = statement.moduleSpecifier.text;
    const clause = statement.importClause;
    if (clause?.name) imports.set(clause.name.text, { name: 'default', module });
    const named = clause?.namedBindings;
    if (named && ts.isNamespaceImport(named)) imports.set(named.name.text, { name: '*', module });
    for (const item of named?.elements ?? []) imports.set(item.name.text, { name: (item.propertyName ?? item.name).text, module });
  }
  return imports;
}

function sourceExports(ts, source) {
  const exports = new Map();
  const stars = [];
  for (const statement of source.statements) {
    if (!ts.isExportDeclaration(statement)) continue;
    const module = statement.moduleSpecifier?.text ?? null;
    if (!statement.exportClause && module) stars.push(module);
    for (const item of statement.exportClause?.elements ?? []) exports.set(item.name.text, { name: (item.propertyName ?? item.name).text, module });
  }
  return { exports, stars };
}

function sourceBindings(ts, source) {
  const bindings = new Map();
  const visit = (node) => {
    if ((ts.isVariableDeclaration(node) || ts.isFunctionDeclaration(node)) && node.name && ts.isIdentifier(node.name)) bindings.set(node.name.text, node.initializer ?? node.body);
    if (ts.isExportAssignment(node)) bindings.set('default', node.expression);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return { source, bindings, imports: sourceImports(ts, source), ...sourceExports(ts, source) };
}

function sourceFacts(state, files) {
  const ts = loadTypescript(state.repoRoot, HERE);
  const sources = new Map();
  if (!ts) {
    if (files.some((file) => QUEUE_FILE.test(file))) problem(state, DB_PGMQ_DECLARED, 'hfs.json', 'queue declarations require the TypeScript parser');
    return { ts, sources };
  }
  for (const file of files.filter((item) => SOURCE_FILE.test(item) && !TEST_FILE.test(item))) {
    const text = readText(state.repoRoot, file);
    if (text === null) continue;
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    sources.set(file, sourceBindings(ts, source));
    if (QUEUE_FILE.test(file)) addQueueConstants(state, ts, source, file);
    addSourceSql(state, ts, source, file);
  }
  return { ts, sources };
}

function addQueueConstants(state, ts, source, file) {
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && /(?:^QUEUE$|_QUEUE(?:_NAME)?$|^QUEUE_)/.test(node.name.text)) {
      const value = sourceValue(ts, node.initializer);
      if (value && ts.isStringLiteralLike(value)) state.constants.set(value.text, file);
      else problem(state, DB_PGMQ_DECLARED, file, 'queue names must be literal constants so migration parity can be checked');
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}

function templateSql(ts, node) {
  if (ts.isStringLiteralLike(node)) return node.text;
  if (!ts.isTemplateExpression(node)) return null;
  return node.head.text + node.templateSpans.map((span) => `NULL${span.literal.text}`).join('');
}

function addSourceSql(state, ts, source, file) {
  const visit = (node) => {
    let text = null;
    if (ts.isTaggedTemplateExpression(node) && /(?:^|\.)sql$/.test(node.tag.getText(source))) text = templateSql(ts, node.template);
    if (ts.isCallExpression(node) && /(?:^|\.)(?:query|execute)$/.test(node.expression.getText(source)) && node.arguments[0]) text = templateSql(ts, node.arguments[0]);
    if (text !== null) inspectCalls(state, sqlTree(text), file, false);
    ts.forEachChild(node, visit);
  };
  visit(source);
}

function importedFile(files, from, specifier) {
  const prefix = from.startsWith('be/') ? 'be/' : '';
  let target = null;
  if (specifier.startsWith('@modules/')) target = `${prefix}src/modules/${specifier.slice(9)}`;
  else if (specifier.startsWith('.')) target = path.posix.normalize(path.posix.join(path.posix.dirname(from), specifier));
  if (target === null) return null;
  return [target, target.replace(/\.js$/, '.ts'), `${target}.ts`, `${target}/index.ts`].find((file) => files.has(file)) ?? null;
}

function schedulerBinding(ts, sources, file, name, seen) {
  const key = `binding:${file}:${name}`;
  if (seen.has(key)) return [];
  seen.add(key);
  const info = sources.get(file);
  const local = info?.bindings.get(name);
  if (local) return schedulerValues(ts, sources, file, local, seen);
  const imported = info?.imports.get(name) ?? info?.exports.get(name);
  if (imported) {
    const target = imported.module ? importedFile(sources, file, imported.module) : file;
    return target ? schedulerBinding(ts, sources, target, imported.name, seen) : [];
  }
  const values = [];
  for (const module of info?.stars ?? []) {
    const target = importedFile(sources, file, module);
    if (target) values.push(...schedulerBinding(ts, sources, target, name, seen));
  }
  return values;
}

function schedulerMember(ts, sources, file, node, seen) {
  if (!ts.isPropertyAccessExpression(node) || !ts.isIdentifier(node.expression)) return null;
  const imported = sources.get(file)?.imports.get(node.expression.text);
  if (imported?.name !== '*') return null;
  const target = importedFile(sources, file, imported.module);
  return target ? schedulerBinding(ts, sources, target, node.name.text, seen) : [];
}

function schedulerValues(ts, sources, file, node, seen = new Set()) {
  node = sourceValue(ts, node);
  if (!node) return [];
  const key = `${file}:${node.pos}`;
  if (seen.has(key)) return [];
  seen.add(key);
  if (ts.isIdentifier(node)) return schedulerBinding(ts, sources, file, node.text, seen);
  const member = schedulerMember(ts, sources, file, node, seen);
  if (member) return member;
  const values = [];
  if (ts.isStringLiteralLike(node)) values.push(node.text);
  ts.forEachChild(node, (child) => { values.push(...schedulerValues(ts, sources, file, child, seen)); });
  return values;
}

function apiSchedulers({ ts, sources }) {
  const values = new Map();
  if (!ts) return values;
  for (const [file, info] of sources) {
    if (!/^(?:be\/)?apps\//.test(file)) continue;
    const visit = (node) => {
      if ((ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node)) && node.name.getText(info.source).replaceAll('"', '').replaceAll("'", '') === 'schedulers') {
        for (const value of schedulerValues(ts, sources, file, node.initializer ?? node.name)) values.set(value, file);
      }
      ts.forEachChild(node, visit);
    };
    visit(info.source);
  }
  return values;
}

function inspectCalls(state, tree, file, migration) {
  walkExecutable(tree, (node) => {
    if (node.GrantStmt || node.AlterDefaultPrivilegesStmt) recordGrant(state, node, file, migration);
  });
  for (const call of callsOf(tree)) {
    inspectQueueCall(state, call, file, migration);
    inspectCronCall(state, call, file, migration);
  }
}

function inspectQueueCall(state, call, file, migration) {
  const name = callName(call);
  if (name !== 'pgmq.create' && name !== 'pgmq.drop_queue') return;
  const queue = sqlLiteral(argument(call, 0, ['queue_name']));
  if (name === 'pgmq.create') {
    if (!migration || queue === null) problem(state, DB_PGMQ_DECLARED, file, 'pgmq.create must declare a literal queue in an active migration');
    else state.created.set(queue, file);
  } else if (migration && queue !== null) {
    state.created.delete(queue);
    state.queueAcls.delete(`pgmq.q_${queue}`);
    state.queueAcls.delete(`pgmq.a_${queue}`);
  }
}

function recordSchedule(state, call, file) {
  const entry = { call, file, created: new Map(state.created), functions: new Map(state.functions) };
  state.schedules.push(entry);
  const job = sqlLiteral(argument(call, 0, ['job_name']));
  const schedule = sqlLiteral(argument(call, 1, ['schedule']));
  const command = sqlLiteral(argument(call, 2, ['command']));
  if (job !== null && schedule !== null && command !== null) {
    state.activeCron.set(job, { name: job, schedule, command });
    state.liveSchedules.set(job, entry);
  }
}

function inspectCronCall(state, call, file, migration) {
  const name = callName(call);
  if (name === 'cron.schedule' || name === 'cron.schedule_in_database') {
    if (!migration || name !== 'cron.schedule') problem(state, DB_CRON_OWNED, file, 'cron jobs must be declared by cron.schedule in an active migration');
    else recordSchedule(state, call, file);
    return;
  }
  if (name !== 'cron.unschedule' || !migration) return;
  const job = sqlLiteral(argument(call, 0, ['job_name']));
  if (job !== null) {
    state.unschedules.push({ name: job, file });
    state.activeCron.delete(job);
    state.liveSchedules.delete(job);
  }
  else problem(state, DB_CRON_OWNED, file, 'cron.unschedule must identify the migration-owned job by literal name');
}

function plpgsqlTree(body, parameters = []) {
  let tag = '$hfs_queue$';
  while (body.includes(tag)) tag = `${tag.slice(0, -1)}_$`;
  const args = parameters.map((item) => item.FunctionParameter?.name).filter(Boolean).map((name) => `"${name.replaceAll('"', '""')}" text`).join(',');
  try { return pg.parsePlPgSQLSync(`create function hfs_probe(${args}) returns void language plpgsql as ${tag}${body}${tag};`); } catch { return null; }
}

function dynamicOwnership(state, expression, file, migration) {
  const fragments = [];
  walk(expression, (node) => {
    const literal = node.A_Const?.sval?.sval ?? null;
    if (literal !== null) fragments.push(literal);
  });
  for (const sql of [...fragments, fragments.join('')]) {
    const tree = sqlTree(sql.replace(/%[ILs]/g, 'NULL'));
    walkExecutable(tree, (node) => { if (node.GrantStmt || node.AlterDefaultPrivilegesStmt) recordGrant(state, node, file, migration); });
    for (const call of callsOf(tree)) {
      if (callName(call) === 'pgmq.create') problem(state, DB_PGMQ_DECLARED, file, 'dynamic SQL cannot own a queue declaration; write the call as static migration SQL');
      if (callName(call).startsWith('cron.')) problem(state, DB_CRON_OWNED, file, 'dynamic SQL cannot own a cron declaration; write the call as static migration SQL');
    }
  }
}

function inspectDo(state, node, file) {
  const option = (key) => (node.args ?? []).find((item) => item.DefElem?.defname === key)?.DefElem?.arg?.String?.sval;
  const tree = plpgsqlTree(option('as') ?? '');
  walk(tree, (item) => {
    if (item.PLpgSQL_expr && item.PLpgSQL_expr.parseMode === 0) inspectCalls(state, sqlTree(item.PLpgSQL_expr.query), file, true);
    if (item.PLpgSQL_stmt_dynexecute) {
      const expression = sqlTree(`select ${item.PLpgSQL_stmt_dynexecute.query?.PLpgSQL_expr?.query ?? ''}`);
      dynamicOwnership(state, expression, file, true);
    }
  });
}

function grantCheck(state, node, file) {
  const defaults = node.AlterDefaultPrivilegesStmt;
  const grant = node.GrantStmt ?? defaults?.action;
  if (!grant?.is_grant) return;
  const schemaNames = defaults?.options?.flatMap((item) => item.DefElem?.defname === 'schemas' ? strings(item.DefElem.arg?.List?.items) : []) ?? [];
  const objects = (grant.objects ?? []).map((item) => item.RangeVar ? `${item.RangeVar.schemaname}.${item.RangeVar.relname}` : sqlName(item.ObjectWithArgs?.objname ?? item.List?.items ?? [item]));
  if (![...schemaNames, ...objects].some((name) => /^(?:pgmq|pgmq_public)(?:\.|$)/.test(name))) return;
  const roles = (grant.grantees ?? []).map((item) => item.RoleSpec?.roletype === 'ROLESPEC_PUBLIC' ? 'public' : item.RoleSpec?.rolename);
  const ownedTables = !defaults && grant.targtype === 'ACL_TARGET_OBJECT' && grant.objtype === 'OBJECT_TABLE'
    && objects.every((name) => /^pgmq\.[qa]_/.test(name) && state.created.has(name.slice(7)));
  if (!ownedTables || roles.length === 0 || roles.some((role) => role !== state.appRole)) problem(state, DB_PGMQ_DECLARED, file, `pgmq grants name only q_<queue> and a_<queue> tables of declared queues, and only the ${state.appRole} role`);
}

function recordGrant(state, node, file, executed) {
  state.grants.push({ node, file, created: new Map(state.created), executed });
  const grant = node.GrantStmt;
  if (!executed || !grant || grant.objtype !== 'OBJECT_TABLE' || grant.targtype !== 'ACL_TARGET_OBJECT') return;
  if (!(grant.grantees ?? []).some((item) => item.RoleSpec?.rolename === state.appRole)) return;
  const privileges = grant.privileges?.map((item) => item.AccessPriv?.priv_name).filter(Boolean) ?? TABLE_PRIVILEGES;
  for (const object of grant.objects ?? []) {
    const table = object.RangeVar && `${object.RangeVar.schemaname}.${object.RangeVar.relname}`;
    if (!table || !/^pgmq\.[qa]_/.test(table)) continue;
    const acl = state.queueAcls.get(table) ?? new Map();
    for (const privilege of privileges) updateQueuePrivilege(acl, grant, privilege);
    state.queueAcls.set(table, acl);
  }
}

function updateQueuePrivilege(acl, grant, privilege) {
  if (grant.is_grant) acl.set(privilege, Boolean(grant.grant_option || acl.get(privilege)));
  else if (!grant.grant_option) acl.delete(privilege);
  else if (acl.has(privilege)) acl.set(privilege, false);
}

function migrationStatement(state, node, file) {
  if (node.CreateFunctionStmt) {
    const fn = node.CreateFunctionStmt;
    state.functions.set(qualified(sqlName(fn.funcname)), { node: fn, file });
    inspectFunctionDeclarations(state, fn, file);
  }
  if (node.DropStmt?.removeType === 'OBJECT_FUNCTION') {
    for (const item of node.DropStmt.objects ?? []) {
      const name = qualified(sqlName(item.ObjectWithArgs?.objname));
      state.drops.push({ name, file });
      state.functions.delete(name);
    }
  }
  if (node.DoStmt) inspectDo(state, node.DoStmt, file);
}

function migrationFacts(state, files) {
  for (const file of files.filter((item) => item.endsWith('.sql') && !item.includes('/_archive/')).sort((left, right) => left.localeCompare(right))) {
    const text = readText(state.repoRoot, file);
    if (text === null) continue;
    const tree = sqlTree(text);
    const active = isActiveMigration(file);
    const scheduleStart = state.schedules.length;
    for (const entry of tree?.stmts ?? []) {
      inspectCalls(state, { stmts: [entry] }, file, active);
      if (active) migrationStatement(state, entry.stmt, file);
    }
    completeScheduleInventory(state, scheduleStart);
  }
}

function completeScheduleInventory(state, start) {
  for (const schedule of state.schedules.slice(start)) {
    for (const [queue, file] of state.created) if (!schedule.created.has(queue)) schedule.created.set(queue, file);
    for (const [name, fn] of state.functions) if (!schedule.functions.has(name)) schedule.functions.set(name, fn);
  }
}

function singleCall(tree) {
  if (tree?.stmts?.length !== 1) return null;
  if (tree.stmts[0].stmt?.ReturnStmt) return tree.stmts[0].stmt.ReturnStmt.returnval?.FuncCall ?? null;
  const select = tree.stmts[0].stmt?.SelectStmt;
  if (!select || select.targetList?.length !== 1 || !/^SETOP_NONE$/.test(select.op) || Object.keys(select).some((key) => !['targetList', 'op', 'limitOption'].includes(key))) return null;
  return select.targetList[0].ResTarget?.val?.FuncCall ?? null;
}

function enqueue(state, call) {
  if (callName(call) !== 'pgmq.send') return null;
  const queue = sqlLiteral(argument(call, 0, ['queue_name']));
  const safe = pureArguments(call);
  return queue !== null && state.created.has(queue) && safe ? queue : null;
}

function pureArguments(call) {
  let safe = callsOf(call).every((nested) => PURE_CALLS.has(callName(nested).replace(/^pg_catalog\./, '')));
  walk(call.args, (node) => {
    if (['SubLink', 'SelectStmt', 'InsertStmt', 'UpdateStmt', 'DeleteStmt', 'MergeStmt'].some((key) => node[key])) safe = false;
  });
  return safe;
}

function functionBody(fn) {
  const option = (name) => (fn.options ?? []).find((item) => item.DefElem?.defname === name)?.DefElem?.arg;
  return { body: strings(option('as')?.List?.items).join(''), language: option('language')?.String?.sval ?? 'sql' };
}

function inspectFunctionDeclarations(state, fn, file) {
  const { body, language } = functionBody(fn);
  if (language === 'sql') {
    inspectCalls(state, sqlTree(body), file, false);
    inspectCalls(state, fn.sql_body, file, false);
  }
  if (language === 'plpgsql') {
    walk(plpgsqlTree(body, fn.parameters), (node) => {
      if (node.PLpgSQL_expr?.parseMode === 0) inspectCalls(state, sqlTree(node.PLpgSQL_expr.query), file, false);
      if (node.PLpgSQL_stmt_dynexecute) dynamicOwnership(state, sqlTree(`select ${node.PLpgSQL_stmt_dynexecute.query?.PLpgSQL_expr?.query ?? ''}`), file, false);
    });
  }
}

function standardSqlBody(node) {
  if (!node) return [];
  if (node.List) return node.List.items.flatMap(standardSqlBody);
  return [{ stmts: [{ stmt: node }] }];
}

function plpgsqlTickTrees(fn, body) {
  const tree = plpgsqlTree(body, fn.parameters);
  if (!tree) return null;
  const trees = [];
  let safe = true;
  walk(tree, (item) => {
    for (const key of Object.keys(item)) {
      if (key.startsWith('PLpgSQL_stmt_') && !['PLpgSQL_stmt_block', 'PLpgSQL_stmt_perform', 'PLpgSQL_stmt_return'].includes(key)) safe = false;
      if (key === 'PLpgSQL_expr') trees.push(sqlTree(item[key].query));
    }
  });
  return safe ? trees : null;
}

function tickTrees(fn) {
  const { body, language } = functionBody(fn);
  if (language === 'plpgsql') return plpgsqlTickTrees(fn, body);
  if (language !== 'sql') return null;
  if (fn.sql_body) return standardSqlBody(fn.sql_body);
  return sqlTree(body)?.stmts?.map((entry) => ({ stmts: [entry] })) ?? null;
}

function tickQueues(state, fn) {
  const trees = tickTrees(fn.node);
  if (!trees) return null;
  const queues = trees.map((tree) => singleCall(tree)).map((call) => call && enqueue(state, call));
  return queues.length && queues.every(Boolean) ? queues : null;
}

function scheduleTarget(state, command) {
  const target = singleCall(sqlTree(command));
  if (!target) return { tick: null, queues: null };
  if (!callName(target).endsWith('_tick')) return { tick: null, queues: enqueue(state, target) };
  const tick = qualified(callName(target));
  const fn = state.functions.get(tick);
  const queues = fn && pureArguments(target) && tickQueues(state, fn);
  return { tick, queues };
}

function tickRemoval(state, tick, name) {
  if (!tick) return;
  for (const drop of state.drops.filter((item) => item.name === tick)) {
    if (!state.unschedules.some((item) => item.name === name && item.file === drop.file)) problem(state, DB_CRON_OWNED, drop.file, 'removing a scheduled tick requires cron.unschedule of its job name in the same migration');
  }
}

function scheduleCheck(state, schedule, names, schedulers, ticks) {
  const { call, file } = schedule;
  const name = sqlLiteral(argument(call, 0, ['job_name']));
  const command = sqlLiteral(argument(call, 2, ['command']));
  if (name === null || command === null || sqlLiteral(argument(call, 1, ['schedule'])) === null) {
    problem(state, DB_CRON_OWNED, file, 'cron.schedule requires literal job name, cadence and command for migration ownership');
    return;
  }
  if (names.has(name)) problem(state, DB_CRON_OWNED, file, 'cron job names must be unique across active migrations');
  names.add(name);
  const historical = { ...state, created: schedule.created, functions: schedule.functions };
  const { tick, queues } = scheduleTarget(historical, command);
  if (!queues) problem(state, DB_CRON_OWNED, file, 'a cron command is one pgmq.send to an existing queue or one existing *_tick function that only enqueues; business DML, dynamic SQL and network calls are refused');
  if (state.liveSchedules.get(name) === schedule && !scheduleTarget(state, command).queues) problem(state, DB_CRON_OWNED, file, 'the live cron job targets a missing queue or tick, or its current tick no longer only enqueues');
  tickOwner(state, tick, file, ticks);
  const owners = [name, ...(tick ? [tick, tick.split('.').at(-1)] : []), ...[queues ?? []].flat()];
  if (owners.some((owner) => schedulers.has(owner))) problem(state, DB_CRON_OWNED, file, 'the tick is also declared in an application scheduler list; give it one owner');
  tickRemoval(state, tick, name);
}

function tickOwner(state, tick, file, ticks) {
  if (!tick) return;
  if (ticks.has(tick)) problem(state, DB_CRON_OWNED, file, 'a tick function has more than one cron owner');
  ticks.add(tick);
}

function queueState({ repoRoot, files = [], all = files, repo = {} }) {
  const paths = [...new Set(all)];
  const declaration = readJson(repoRoot, 'hfs.json') ?? repo;
  const connected = ['be', 'fe'].some((side) => (declaration.sides?.[side]?.connections ?? []).some((item) => item.provider === 'supabase'));
  if (repo.edition !== 'lite' && declaration.edition !== 'lite' && !declaration.supabase && !connected && !paths.some((file) => file.startsWith('supabase/'))) return null;
  const state = { repoRoot, appRole: declaration.supabase?.appRole ?? 'app_be', findings: [], constants: new Map(), created: new Map(), functions: new Map(), schedules: [], activeCron: new Map(), liveSchedules: new Map(), unschedules: [], drops: [], grants: [], queueAcls: new Map() };
  state.sources = sourceFacts(state, paths);
  migrationFacts(state, paths);
  return state;
}

function validateQueues(state, inScope) {
  for (const [queue, file] of state.constants) if (!state.created.has(queue)) problem(state, DB_PGMQ_DECLARED, file, 'a queue constant has no pgmq.create in an active migration');
  for (const [queue, file] of state.created) if (!state.constants.has(queue)) problem(state, DB_PGMQ_DECLARED, file, 'pgmq.create has no corresponding queue constant under modules/queues');
  for (const { node, file, created, executed } of state.grants) grantCheck({ ...state, created: executed ? created : state.created }, node, file);
  const names = new Set();
  const ticks = new Set();
  const schedulers = apiSchedulers(state.sources);
  for (const schedule of state.schedules) scheduleCheck(state, schedule, names, schedulers, ticks);
  return state.findings.filter((finding) => inScope(finding.path));
}

/** Cross-file R258 findings. A full app participates when it declares or contains Supabase files. */
export function databaseQueuesFindings(context) {
  const state = queueState(context);
  return state ? validateQueues(state, context.inScope ?? (() => true)) : [];
}

/** Migration-owned operational metadata for a baseline; callers refuse a cutover when findings are present. */
export function databaseQueueDeclarations(context) {
  const state = queueState(context);
  if (!state) return { queues: [], cron: [], grants: [], findings: [] };
  return {
    queues: [...state.created.keys()].sort((left, right) => left.localeCompare(right)),
    cron: [...state.activeCron.values()].sort((left, right) => left.name.localeCompare(right.name)),
    grants: queueGrantDeclarations(state),
    findings: validateQueues(state, () => true),
  };
}

function queueGrantDeclarations(state) {
  const grants = [];
  for (const [table, acl] of state.queueAcls) {
    if (!state.created.has(table.slice(7))) continue;
    for (const grantOption of [false, true]) {
      let privileges = [...acl].filter(([, option]) => option === grantOption).map(([privilege]) => privilege);
      if (!privileges.length) continue;
      if (TABLE_PRIVILEGES.every((privilege) => privileges.includes(privilege))) privileges = ['all'];
      grants.push({ privileges, tables: [table], roles: [state.appRole], grantOption });
    }
  }
  return grants;
}
