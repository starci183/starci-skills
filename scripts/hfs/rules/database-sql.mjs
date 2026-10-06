// PostgreSQL AST extraction and the migration-local checks DB_RLS_REQUIRED, DB_POLICY_SHAPE and
// DB_STORAGE_POLICY. PL/pgSQL inspection lives in database-plpgsql.mjs to keep every rule module bounded.
import { found } from './read.mjs';
import { parseSql } from '../sql/pg-parse.mjs';
import { plpgsqlFindings } from './database-plpgsql.mjs';
import { DB_MIGRATION_SHAPE, DB_POLICY_SHAPE, DB_RLS_REQUIRED, DB_STORAGE_POLICY } from './database-constants.mjs';
const POLICY_ACTIONS = ['select', 'insert', 'update', 'delete', 'all'];
const WRITE_COMMANDS = new Set(['all', 'insert', 'update', 'delete']);
const PUBLIC_READ_SUFFIX = '_public_read';

const sval = (node) => node?.String?.sval;
const nameOf = (list) => (list ?? []).map(sval).filter((part) => part !== undefined).join('.');
const schemaOf = (relation, defaultSchema = 'public') => relation?.schemaname ?? defaultSchema;
const roleOf = (roleSpec) => (roleSpec?.RoleSpec?.roletype === 'ROLESPEC_PUBLIC' ? 'public' : roleSpec?.RoleSpec?.rolename ?? null);
const isTrue = (expression) => expression?.A_Const?.boolval?.boolval === true;
const asBool = (expression) => (expression?.A_Const?.boolval === undefined ? null : expression.A_Const.boolval.boolval === true);
const asString = (expression) => expression?.A_Const?.sval?.sval;
const isNull = (expression) => expression?.A_Const?.isnull === true;

function lineIndexOf(text) {
  const bytes = Buffer.from(text, 'utf8');
  const starts = [0];
  for (let index = 0; index < bytes.length; index += 1) if (bytes[index] === 0x0a) starts.push(index + 1);
  return (offset) => {
    let low = 0;
    let high = starts.length - 1;
    while (low < high) {
      const middle = (low + high + 1) >> 1;
      if (starts[middle] <= offset) low = middle;
      else high = middle - 1;
    }
    return low + 1;
  };
}

function statementList(stmts, lineAt) {
  return (stmts ?? []).map((entry, index) => {
    const type = Object.keys(entry.stmt ?? {})[0] ?? '';
    const node = entry.stmt?.[type] ?? {};
    const nodeOffset = node.location >= 0 ? node.location : 0;
    const offset = entry.stmt_location >= 0 ? entry.stmt_location : nodeOffset;
    return { type, node, index, line: lineAt(offset) };
  });
}

/** Whether a function SET option pins search_path to literal values rather than FROM CURRENT. */
function isSearchPathSet(element) {
  const value = element?.arg?.VariableSetStmt;
  return element?.defname === 'set' && value?.name === 'search_path' && value?.kind === 'VAR_SET_VALUE'
    && (value.args ?? []).length > 0
    && value.args.every((argument) => argument?.A_Const?.sval !== undefined || argument?.A_Const?.isnull === true);
}

function searchPathSchema(node, current) {
  if (node.name !== 'search_path') return current;
  if (node.kind === 'VAR_RESET') return 'public';
  if (node.kind !== 'VAR_SET_VALUE') return current;
  const schemas = (node.args ?? []).map((argument) => argument?.A_Const?.sval?.sval).filter((value) => typeof value === 'string');
  return schemas.find((schema) => schema && schema !== '$user') ?? 'public';
}

/** Fold each statement to the facts consumed by the rule checks. */
function factsOf(statements) {
  const facts = {
    tables: [], enables: [], forces: [], policies: [], policyEvents: [], grants: [], defaultPrivileges: [],
    functions: [], alterFunctions: [], doBlocks: [], buckets: [], bucketCalls: [], isSearchPathSet,
  };
  let defaultSchema = 'public';
  for (const statement of statements) {
    const { node } = statement;
    if (statement.type === 'VariableSetStmt') {
      defaultSchema = searchPathSchema(node, defaultSchema);
    } else if (statement.type === 'CreateStmt' || statement.type === 'CreateTableAsStmt') {
      const relation = statement.type === 'CreateStmt' ? node.relation : node.into?.rel;
      if (!relation || node.partbound || relation.relpersistence === 't') continue;
      facts.tables.push({ schema: schemaOf(relation, defaultSchema), name: relation.relname, index: statement.index, line: statement.line });
    } else if (statement.type === 'AlterTableStmt') {
      for (const command of node.cmds ?? []) {
        const subtype = command?.AlterTableCmd?.subtype;
        const item = { schema: schemaOf(node.relation, defaultSchema), name: node.relation?.relname, index: statement.index };
        if (subtype === 'AT_EnableRowSecurity') facts.enables.push(item);
        else if (subtype === 'AT_ForceRowSecurity') facts.forces.push(item);
      }
    } else if (statement.type === 'CreatePolicyStmt') {
      const policy = {
        name: node.policy_name,
        schema: schemaOf(node.table, defaultSchema),
        table: node.table?.relname,
        cmd: String(node.cmd_name ?? 'all').toLowerCase(),
        roles: node.roles?.length ? node.roles.map(roleOf) : ['public'],
        implicitPublic: (node.roles ?? []).some((role) => role?.RoleSpec?.roletype === 'ROLESPEC_PUBLIC' && role.RoleSpec.location === -1),
        qual: node.qual,
        withCheck: node.with_check,
        index: statement.index,
        line: statement.line,
      };
      facts.policies.push(policy);
      facts.policyEvents.push({ kind: 'create', policy, index: statement.index });
    } else if (statement.type === 'AlterPolicyStmt') {
      facts.policyEvents.push({
        kind: 'alter',
        schema: schemaOf(node.table, defaultSchema),
        table: node.table?.relname,
        name: node.policy_name,
        ...(node.roles !== undefined ? {
          roles: node.roles.map(roleOf),
          implicitPublic: node.roles.some((role) => role?.RoleSpec?.roletype === 'ROLESPEC_PUBLIC' && role.RoleSpec.location === -1),
        } : {}),
        ...(node.qual !== undefined ? { qual: node.qual } : {}),
        ...(node.with_check !== undefined ? { withCheck: node.with_check } : {}),
        index: statement.index,
      });
    } else if (statement.type === 'DropStmt' && node.removeType === 'OBJECT_POLICY') {
      for (const object of node.objects ?? []) {
        const parts = object?.List?.items?.map(sval).filter(Boolean) ?? [];
        const [schema, table, name] = parts.length === 3 ? parts : [defaultSchema, ...parts];
        facts.policyEvents.push({ kind: 'drop', schema, table, name, index: statement.index });
      }
    } else if (statement.type === 'GrantStmt') {
      facts.grants.push({
        grant: node.is_grant === true,
        targtype: node.targtype,
        objtype: node.objtype,
        objects: node.objects ?? [],
        privileges: (node.privileges ?? []).map((privilege) => String(privilege?.AccessPriv?.priv_name ?? '').toLowerCase()),
        grantees: (node.grantees ?? []).map(roleOf),
        defaultSchema,
        index: statement.index,
        line: statement.line,
      });
    } else if (statement.type === 'AlterDefaultPrivilegesStmt') {
      const action = node.action ?? {};
      facts.defaultPrivileges.push({
        grant: action.is_grant === true,
        objtype: action.objtype,
        privileges: (action.privileges ?? []).map((privilege) => String(privilege?.AccessPriv?.priv_name ?? '').toLowerCase()),
        grantees: (action.grantees ?? []).map(roleOf),
        index: statement.index,
        line: statement.line,
      });
    } else if (statement.type === 'CreateFunctionStmt') {
      const parts = (node.funcname ?? []).map(sval).filter(Boolean);
      const schema = parts.length > 1 ? parts[0] : defaultSchema;
      facts.functions.push({ node, name: parts.length > 1 ? parts.join('.') : `${schema}.${parts[0]}`, schema, index: statement.index, line: statement.line });
    } else if (statement.type === 'AlterFunctionStmt') {
      const rawName = nameOf(node.func?.objname);
      const name = rawName.includes('.') ? rawName : `${defaultSchema}.${rawName}`;
      facts.alterFunctions.push({ name, setsPath: (node.actions ?? []).some((action) => isSearchPathSet(action?.DefElem)), index: statement.index, line: statement.line });
    } else if (statement.type === 'DoStmt') {
      const option = (key) => (node.args ?? []).find((argument) => argument?.DefElem?.defname === key)?.DefElem?.arg;
      facts.doBlocks.push({ body: option('as')?.String?.sval, language: option('language')?.String?.sval ?? 'plpgsql', index: statement.index, line: statement.line });
    } else if (statement.type === 'InsertStmt' && node.relation?.schemaname === 'storage' && node.relation?.relname === 'buckets') {
      facts.buckets.push({ node, index: statement.index, line: statement.line });
    } else if (statement.type === 'SelectStmt') {
      for (const target of node.targetList ?? []) {
        const call = target?.ResTarget?.val?.FuncCall;
        if (call && nameOf(call.funcname).toLowerCase() === 'storage.create_bucket') facts.bucketCalls.push({ node: call, index: statement.index, line: statement.line });
      }
    }
  }
  return facts;
}

function rlsFindings(file, facts, exposed, forceRls) {
  const findings = [];
  for (const table of facts.tables) {
    if (!exposed.has(table.schema)) continue;
    const qualified = `${table.schema}.${table.name}`;
    if (!facts.enables.some((enable) => enable.schema === table.schema && enable.name === table.name && enable.index > table.index)) {
      findings.push(found(DB_RLS_REQUIRED, file, `${file}:${table.line} creates ${qualified} in the exposed schema ${table.schema} without a later \`alter table ${qualified} enable row level security\` in the same migration`, { line: table.line, table: qualified }));
    }
    if (forceRls.has(qualified) && !facts.forces.some((force) => force.schema === table.schema && force.name === table.name && force.index > table.index)) {
      findings.push(found(DB_RLS_REQUIRED, file, `${file}:${table.line} creates ${qualified}, which hfs.json supabase.forceRls declares definer-owned, without \`alter table ${qualified} force row level security\` in the same migration`, { line: table.line, table: qualified }));
    }
  }
  return findings;
}

function localPolicyFindings(file, facts) {
  const findings = [];
  for (const policy of facts.policies) {
    const qualified = `${policy.schema}.${policy.table}`;
    if (policy.name === undefined || !policy.name.startsWith(`${policy.table}_`)) {
      findings.push(found(DB_POLICY_SHAPE, file, `${file}:${policy.line} policy ${JSON.stringify(policy.name)} on ${qualified} is not named <table>_<role>_<action>`, { line: policy.line, policy: policy.name }));
    } else {
      const tail = policy.name.slice(policy.table.length + 1);
      if (tail !== 'public_read' && !new RegExp(`^[a-z][a-z0-9_]*_(${POLICY_ACTIONS.join('|')})$`).test(tail)) {
        findings.push(found(DB_POLICY_SHAPE, file, `${file}:${policy.line} policy ${policy.name} on ${qualified} is not named <table>_<role>_<action>`, { line: policy.line, policy: policy.name }));
      }
    }
    const publicRead = typeof policy.name === 'string' && policy.name.endsWith(PUBLIC_READ_SUFFIX);
    if (WRITE_COMMANDS.has(policy.cmd) && isTrue(policy.qual)) findings.push(found(DB_POLICY_SHAPE, file, `${file}:${policy.line} policy ${policy.name} on ${qualified} is FOR ${policy.cmd.toUpperCase()} with USING (true)`, { line: policy.line, policy: policy.name }));
    if (WRITE_COMMANDS.has(policy.cmd) && isTrue(policy.withCheck)) findings.push(found(DB_POLICY_SHAPE, file, `${file}:${policy.line} policy ${policy.name} on ${qualified} is FOR ${policy.cmd.toUpperCase()} with WITH CHECK (true)`, { line: policy.line, policy: policy.name }));
    if (policy.cmd === 'select' && isTrue(policy.qual) && !publicRead) findings.push(found(DB_POLICY_SHAPE, file, `${file}:${policy.line} policy ${policy.name} on ${qualified} is FOR SELECT with USING (true); a world-readable table declares it with *_public_read`, { line: policy.line, policy: policy.name }));
    if ((policy.roles.includes('anon') || policy.roles.includes('public')) && !(policy.cmd === 'select' && publicRead)) {
      const roleName = policy.roles.includes('anon') ? 'anon' : 'public';
      const role = policy.implicitPublic ? 'the implicit TO public default' : `TO ${roleName}`;
      findings.push(found(DB_POLICY_SHAPE, file, `${file}:${policy.line} policy ${policy.name} on ${qualified} reaches ${role}; anonymous access is only FOR SELECT with *_public_read`, { line: policy.line, policy: policy.name }));
    }
  }
  for (const grant of facts.grants) {
    if (!grant.grant) continue;
    if (grant.grantees.includes('service_role')) findings.push(found(DB_POLICY_SHAPE, file, `${file}:${grant.line} grants to service_role; the service role bypasses RLS and is never granted`, { line: grant.line }));
    const broadRole = grant.grantees.find((role) => ['anon', 'authenticated', 'public'].includes(role));
    if (grant.targtype === 'ACL_TARGET_ALL_IN_SCHEMA' && grant.objtype === 'OBJECT_TABLE' && broadRole) {
      findings.push(found(DB_POLICY_SHAPE, file, `${file}:${grant.line} grants on all tables in a schema to ${broadRole}; table privileges are declared per table beside the matching policies`, { line: grant.line, role: broadRole }));
    }
  }
  for (const defaults of facts.defaultPrivileges) {
    if (!defaults.grant) continue;
    if (defaults.grantees.includes('service_role')) findings.push(found(DB_POLICY_SHAPE, file, `${file}:${defaults.line} grants default privileges to service_role; the service role bypasses RLS and is never granted`, { line: defaults.line }));
    const broadRole = defaults.grantees.find((role) => ['anon', 'public'].includes(role));
    if (defaults.objtype === 'OBJECT_TABLE' && broadRole) {
      findings.push(found(DB_POLICY_SHAPE, file, `${file}:${defaults.line} alters default table privileges for ${broadRole}; anonymous grants are explicit per table beside *_public_read policies`, { line: defaults.line, role: broadRole }));
    }
  }
  return findings;
}

const policyKey = (policy) => `${policy.schema}\0${policy.table}\0${policy.name}`;

/** Anonymous table grants are covered by the final policy state across the ordered migration set. */
export function migrationSetPolicyFindings(analyses) {
  const policies = new Map();
  for (const { facts } of analyses) {
    for (const event of [...facts.policyEvents].sort((left, right) => left.index - right.index)) {
      const key = policyKey(event.kind === 'create' ? event.policy : event);
      if (event.kind === 'create') policies.set(key, event.policy);
      else if (event.kind === 'drop') policies.delete(key);
      else if (policies.has(key)) policies.set(key, { ...policies.get(key), ...event });
    }
  }
  const finalPolicies = [...policies.values()];
  const findings = [];
  for (const { file, facts } of analyses) {
    for (const grant of facts.grants) {
      if (!grant.grant || grant.targtype !== 'ACL_TARGET_OBJECT' || grant.objtype !== 'OBJECT_TABLE') continue;
      if (!grant.grantees.includes('anon') && !grant.grantees.includes('public')) continue;
      for (const object of grant.objects) {
        const relation = object?.RangeVar;
        if (!relation) continue;
        const schema = schemaOf(relation, grant.defaultSchema);
        const table = relation.relname;
        const covered = finalPolicies.some((policy) => policy.schema === schema && policy.table === table && policy.cmd === 'select'
          && typeof policy.name === 'string' && policy.name.endsWith(PUBLIC_READ_SUFFIX)
          && (policy.roles.includes('anon') || policy.roles.includes('public')));
        if (!covered) findings.push(found(DB_POLICY_SHAPE, file, `${file}:${grant.line} grants an anonymous role on ${schema}.${table} but the migration set ends without a *_public_read FOR SELECT policy`, { line: grant.line, table: `${schema}.${table}` }));
      }
    }
  }
  return findings;
}

const valueRows = (node) => (node.selectStmt?.SelectStmt?.valuesLists ?? []).map((list) => list?.List?.items ?? []);
const unwrap = (expression) => expression?.TypeCast ? unwrap(expression.TypeCast.arg) : expression;
const columnName = (expression) => unwrap(expression)?.ColumnRef?.fields?.map(sval).findLast(Boolean);
const literalString = (expression) => asString(unwrap(expression));

function expressionScopesBucket(expression, bucket) {
  if (!expression || typeof expression !== 'object') return false;
  if (Array.isArray(expression)) return expression.some((item) => expressionScopesBucket(item, bucket));
  const operation = expression.A_Expr;
  if (operation) {
    const operator = operation.name?.map(sval).filter(Boolean).join('');
    if (operator === '=') {
      if ((columnName(operation.lexpr) === 'bucket_id' && literalString(operation.rexpr) === bucket)
        || (columnName(operation.rexpr) === 'bucket_id' && literalString(operation.lexpr) === bucket)) return true;
    }
    if (operation.kind === 'AEXPR_IN' && columnName(operation.lexpr) === 'bucket_id'
      && (operation.rexpr ?? []).some((item) => literalString(item) === bucket)) return true;
  }
  return Object.values(expression).some((child) => expressionScopesBucket(child, bucket));
}

function storageFindings(file, facts) {
  const findings = [];
  const declarations = [];
  for (const { node, line } of facts.buckets) {
    const columns = (node.cols ?? []).map((column) => column?.ResTarget?.name);
    const rows = valueRows(node);
    if (!columns.length || !rows.length) {
      findings.push(found(DB_STORAGE_POLICY, file, `${file}:${line} inserts into storage.buckets without a literal column list and VALUES`, { line }));
      continue;
    }
    for (const row of rows) {
      const cell = (name) => row[columns.indexOf(name)];
      declarations.push({ id: asString(cell('id')), publicValue: asBool(cell('public')), fileSize: cell('file_size_limit'), mimeTypes: cell('allowed_mime_types'), line });
    }
  }
  for (const { node, line } of facts.bucketCalls) {
    const positional = (node.args ?? []).filter((argument) => !argument?.NamedArgExpr);
    const named = new Map((node.args ?? []).filter((argument) => argument?.NamedArgExpr).map((argument) => [argument.NamedArgExpr.name, argument.NamedArgExpr.arg]));
    declarations.push({
      id: asString(positional[0]),
      publicValue: asBool(named.get('public') ?? positional[2]),
      fileSize: named.get('file_size_limit') ?? positional[3],
      mimeTypes: named.get('allowed_mime_types') ?? positional[4],
      line,
    });
  }
  for (const declaration of declarations) {
    const { id, publicValue, fileSize, mimeTypes, line } = declaration;
    if (id === undefined) {
      findings.push(found(DB_STORAGE_POLICY, file, `${file}:${line} storage.buckets row has no literal id`, { line }));
      continue;
    }
    if (publicValue === null || (publicValue && !id.endsWith('_public'))) {
      findings.push(found(DB_STORAGE_POLICY, file, `${file}:${line} bucket ${JSON.stringify(id)} declares public = ${publicValue === null ? 'absent' : publicValue}; public must be explicit and only an *_public id may be public`, { line, bucket: id }));
    }
    for (const [column, value] of [['file_size_limit', fileSize], ['allowed_mime_types', mimeTypes]]) {
      if (value === undefined || isNull(value)) findings.push(found(DB_STORAGE_POLICY, file, `${file}:${line} bucket ${JSON.stringify(id)} declares no ${column}`, { line, bucket: id, column }));
    }
    const covered = facts.policies.some((policy) => policy.schema === 'storage' && policy.table === 'objects'
      && (expressionScopesBucket(policy.qual, id) || expressionScopesBucket(policy.withCheck, id)));
    if (!covered) findings.push(found(DB_STORAGE_POLICY, file, `${file}:${line} bucket ${JSON.stringify(id)} has no storage.objects policy whose bucket_id predicate names it in this migration`, { line, bucket: id }));
  }
  return findings;
}

/** Parse and judge one migration file. */
export async function sqlAnalysis({ file, text, exposed, forceRls }) {
  const lineAt = lineIndexOf(text);
  let parsed;
  try {
    parsed = await parseSql(text);
  } catch (error) {
    const position = error?.sqlDetails?.cursorPosition;
    const line = position ? lineAt(position - 1) : undefined;
    return { findings: [found(DB_MIGRATION_SHAPE, file, `${file}${line ? `:${line}` : ''} is not valid PostgreSQL (${String(error?.message ?? error).split('\n')[0]})`, { ...(line ? { line } : {}) })], facts: null };
  }
  const facts = factsOf(statementList(parsed.stmts, lineAt));
  return { facts, findings: [
    ...rlsFindings(file, facts, exposed, forceRls),
    ...await plpgsqlFindings(file, facts, exposed),
    ...localPolicyFindings(file, facts),
    ...storageFindings(file, facts),
  ] };
}
