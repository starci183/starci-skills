// PL/pgSQL inspection for DB_DYNAMIC_DDL and DB_DEFINER_SAFE. Function and DO bodies are parsed by libpg-query;
// dynamic query expressions are then parsed as PostgreSQL expressions instead of matched as raw migration text.
import { found } from './read.mjs';
import { eachInOrder } from '../../lib/in-order.mjs';
import { parsePlpgsqlBody, parseSql } from '../sql/pg-parse.mjs';
import { DB_DEFINER_SAFE, DB_DYNAMIC_DDL } from './database-constants.mjs';

const sval = (node) => node?.String?.sval;
const nameOf = (list, defaultSchema) => {
  const parts = (list ?? []).map(sval).filter((part) => part !== undefined);
  return parts.length === 1 && defaultSchema ? `${defaultSchema}.${parts[0]}` : parts.join('.');
};

const functionOption = (node, key) => (node.options ?? []).filter((option) => option?.DefElem?.defname === key).map((option) => option.DefElem);
const securityDefiner = (node) => functionOption(node, 'security').some((option) => option.arg?.Boolean?.boolval === true || option.arg?.Integer?.ival === 1);
const functionLanguage = (node) => functionOption(node, 'language').map((option) => option.arg?.String?.sval).findLast(Boolean) ?? 'sql';
const functionBody = (node) => functionOption(node, 'as').flatMap((option) => (option.arg?.List?.items ?? []).map((item) => item?.String?.sval ?? '')).join('') || null;
const functionReturnKind = (node) => {
  const name = node.returnType?.names?.map(sval).findLast(Boolean);
  if (name === 'void') return 'void';
  if (name === 'trigger' || name === 'event_trigger') return 'trigger';
  return node.returnType?.setof ? 'setof' : 'scalar';
};

/** The statement kinds that run a dynamic query, with the field holding its query expression. */
const DYNAMIC_QUERY_FIELDS = new Map([['PLpgSQL_stmt_dynexecute', 'query'], ['PLpgSQL_stmt_dynfors', 'query'], ['PLpgSQL_stmt_open', 'dynquery']]);

function collectDynamicQueries(value, out) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const item of value) collectDynamicQueries(item, out);
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    const field = DYNAMIC_QUERY_FIELDS.get(key);
    const text = field === undefined ? undefined : child?.[field]?.PLpgSQL_expr?.query;
    if (text !== undefined) out.push({ text, lineno: child.lineno });
    collectDynamicQueries(child, out);
  }
}

/** Every dynamic query expression in one parsed PL/pgSQL function. */
function dynamicQueries(root) {
  const out = [];
  collectDynamicQueries(root, out);
  return out;
}

async function plpgsqlOf(body, parameters, returnKind) {
  try {
    return await parsePlpgsqlBody(body, parameters, returnKind);
  } catch {
    return null;
  }
}

/** Parse a PL/pgSQL dynamic-query source as one PostgreSQL expression. */
async function expressionOf(text) {
  try {
    const parsed = await parseSql(`select ${text}`);
    return parsed.stmts?.[0]?.stmt?.SelectStmt?.targetList?.[0]?.ResTarget?.val ?? null;
  } catch {
    return null;
  }
}

const stringValue = (node) => node?.A_Const?.sval?.sval;
const formatName = (node) => node?.FuncCall?.funcname?.map(sval).filter(Boolean).join('.').toLowerCase() === 'format';
const operatorName = (node) => node?.A_Expr?.name?.map(sval).filter(Boolean).join('');
const FORMAT_SPECIFIER = /%(?:(\d+)\$)?-?(?:\d+|\*(?:\d+\$)?)?([sIL%])/g;

/** Every format() conversion, or null when the template contains an invalid/unreadable percent sequence. */
function formatSpecifiers(template) {
  const specs = [];
  let cursor = 0;
  for (const match of template.matchAll(FORMAT_SPECIFIER)) {
    if (template.slice(cursor, match.index).includes('%')) return null;
    specs.push({ position: match[1] ? Number(match[1]) - 1 : null, type: match[2] });
    cursor = match.index + match[0].length;
  }
  return template.slice(cursor).includes('%') ? null : specs;
}

/** The text one format() conversion renders to; an argument that is no string literal marks the render incomplete. */
function substituteSpecifier(spec, args, state) {
  if (spec.type === '%') return '%';
  const argumentIndex = spec.position ?? state.sequential;
  if (spec.position === null) state.sequential += 1;
  if (spec.type === 'I') return 'hfs_identifier';
  if (spec.type === 'L') return "'hfs_literal'";
  const value = stringValue(args[argumentIndex + 1]);
  if (value !== undefined) return value;
  state.complete = false;
  return 'hfs_dynamic';
}

function renderFormat(args) {
  const template = stringValue(args[0]);
  if (template === undefined) return { text: 'hfs_dynamic', complete: false };
  const specs = formatSpecifiers(template);
  if (specs === null) return { text: template, complete: false };
  const state = { sequential: 0, specIndex: 0, complete: true };
  const text = template.replace(FORMAT_SPECIFIER, () => {
    const spec = specs[state.specIndex];
    state.specIndex += 1;
    return substituteSpecifier(spec, args, state);
  });
  return { text, complete: state.complete };
}

/** Render enough of a dynamic expression to let the PostgreSQL parser identify its generated statement kind. */
function renderExpression(node) {
  const literal = stringValue(node);
  if (literal !== undefined) return { text: literal, complete: true };
  if (node?.TypeCast) return renderExpression(node.TypeCast.arg);
  if (operatorName(node) === '||') {
    const left = renderExpression(node.A_Expr.lexpr);
    const right = renderExpression(node.A_Expr.rexpr);
    return { text: `${left.text}${right.text}`, complete: left.complete && right.complete };
  }
  if (formatName(node)) return renderFormat(node.FuncCall.args ?? []);
  return { text: 'hfs_dynamic', complete: false };
}

/** DDL statement kinds forbidden behind dynamic execution. */
function containsDynamicDdl(parsed) {
  for (const entry of parsed.stmts ?? []) {
    const type = Object.keys(entry.stmt ?? {})[0];
    if (['CreateStmt', 'CreateTableAsStmt', 'CreatePolicyStmt', 'CreateFunctionStmt', 'AlterTableStmt', 'AlterFunctionStmt', 'AlterPolicyStmt', 'AlterDefaultPrivilegesStmt', 'GrantStmt', 'GrantRoleStmt', 'RenameStmt'].includes(type)) return true;
    if (type === 'DropStmt' && ['OBJECT_TABLE', 'OBJECT_POLICY', 'OBJECT_FUNCTION'].includes(entry.stmt.DropStmt?.removeType)) return true;
  }
  return false;
}

async function dynamicQueryAnalysis(text) {
  const expression = await expressionOf(text);
  if (expression === null) return { buildsDdl: false, opaque: true };
  const rendered = renderExpression(expression);
  try {
    const parsed = await parseSql(rendered.text);
    return { buildsDdl: containsDynamicDdl(parsed), opaque: false };
  } catch {
    return { buildsDdl: false, opaque: !rendered.complete };
  }
}

async function dynamicDdlFindings(file, queries, where, baseLine) {
  const findings = [];
  await eachInOrder(queries, async ({ text, lineno }) => {
    const line = lineno ? baseLine + lineno - 1 : undefined;
    const lineNote = line ? `${file}:${line}` : file;
    const analysis = await dynamicQueryAnalysis(text);
    if (analysis.buildsDdl) {
      findings.push(found(DB_DYNAMIC_DDL, file, `${lineNote} ${where} builds DDL dynamically (\`${String(text).slice(0, 120)}\`); write the create/alter/drop or grant/revoke out as statements so the parser sees every one`, { ...(line ? { line } : {}), query: text }));
    } else if (analysis.opaque) {
      findings.push(found(DB_DYNAMIC_DDL, file, `${lineNote} ${where} runs dynamic SQL the pass cannot read (\`${String(text).slice(0, 120)}\`); dynamic DDL is refused and a query built from an opaque value cannot be judged`, { ...(line ? { line } : {}), query: text }));
    }
  });
  return findings;
}

/** A definer expression is safe when it consists only of literals and format() calls whose conversions quote. */
function safeDefinerExpression(node) {
  if (stringValue(node) !== undefined) return true;
  if (node?.TypeCast) return safeDefinerExpression(node.TypeCast.arg);
  if (operatorName(node) === '||') return safeDefinerExpression(node.A_Expr.lexpr) && safeDefinerExpression(node.A_Expr.rexpr);
  if (!formatName(node)) return false;
  const template = stringValue(node.FuncCall.args?.[0]);
  if (template === undefined) return false;
  const specs = formatSpecifiers(template);
  return specs?.every((spec) => ['I', 'L', '%'].includes(spec.type)) ?? false;
}

async function definerDynamicFindings(file, fn, queries, baseLine) {
  const findings = [];
  await eachInOrder(queries, async ({ text, lineno }) => {
    const line = lineno ? baseLine + lineno - 1 : undefined;
    const lineNote = line ? `${file}:${line}` : file;
    const expression = await expressionOf(text);
    if (expression !== null && safeDefinerExpression(expression)) return;
    findings.push(found(DB_DEFINER_SAFE, file, `${lineNote} security definer function ${fn.name} builds dynamic SQL without quoting every parameter through format() %I or %L (\`${String(text).slice(0, 120)}\`)`, { ...(line ? { line } : {}), function: fn.name, query: text }));
  });
  return findings;
}

function revokedRolesFor(fn, grants) {
  const roles = new Set();
  for (const grant of grants) {
    if (grant.grant || grant.objtype !== 'OBJECT_FUNCTION') continue;
    if (!grant.privileges.includes('execute') && !grant.privileges.includes('all')) continue;
    const matches = grant.objects.some((object) => nameOf(object?.ObjectWithArgs?.objname, grant.defaultSchema) === fn.name);
    if (matches) for (const role of grant.grantees) roles.add(role);
  }
  return roles;
}

async function doBlockFindings(file, block) {
  if (block.body === undefined || block.language !== 'plpgsql') {
    return [found(DB_DYNAMIC_DDL, file, `${file}:${block.line} DO block in ${block.language} cannot be inspected; a DO block is plpgsql so a static pass sees its statements`, { line: block.line })];
  }
  const ast = await plpgsqlOf(block.body);
  if (ast === null) return [found(DB_DYNAMIC_DDL, file, `${file}:${block.line} DO block body is not valid plpgsql; the pass must see every statement a migration runs`, { line: block.line })];
  return dynamicDdlFindings(file, dynamicQueries(ast), 'DO block', block.line);
}

function definerDeclarationFindings(file, fn, facts, exposed, definer) {
  if (!definer) return [];
  const findings = [];
  const pathSet = functionOption(fn.node, 'set').some((option) => facts.isSearchPathSet(option))
    || facts.alterFunctions.some((alter) => alter.name === fn.name && alter.setsPath && alter.index > fn.index);
  if (!pathSet) findings.push(found(DB_DEFINER_SAFE, file, `${file}:${fn.line} security definer function ${fn.name} sets no search_path; add \`set search_path = ''\` (or a pinned schema list) on the create, or an alter function in the same migration`, { line: fn.line, function: fn.name }));
  if (exposed.has(fn.schema)) {
    const revoked = revokedRolesFor(fn, facts.grants);
    if (!revoked.has('public') || !revoked.has('anon')) findings.push(found(DB_DEFINER_SAFE, file, `${file}:${fn.line} security definer function ${fn.name} lives in the exposed schema ${fn.schema}; keep it in a non-exposed schema or revoke execute from public and anon in the same migration`, { line: fn.line, function: fn.name }));
  }
  if (!fn.node.is_procedure && !fn.node.returnType) findings.push(found(DB_DEFINER_SAFE, file, `${file}:${fn.line} security definer function ${fn.name} declares no return type`, { line: fn.line, function: fn.name }));
  return findings;
}

async function functionBodyFindings(file, fn, definer) {
  if (functionLanguage(fn.node) !== 'plpgsql') return [];
  const body = functionBody(fn.node);
  if (body === null) return [];
  const ast = await plpgsqlOf(body, fn.node.parameters, functionReturnKind(fn.node));
  if (ast === null) {
    if (definer) return [found(DB_DEFINER_SAFE, file, `${file}:${fn.line} security definer function ${fn.name} has a body the pass cannot read; a definer body must be plain plpgsql`, { line: fn.line, function: fn.name })];
    return [];
  }
  const queries = dynamicQueries(ast);
  const findings = await dynamicDdlFindings(file, queries, `function ${fn.name}`, fn.line);
  if (definer) findings.push(...await definerDynamicFindings(file, fn, queries, fn.line));
  return findings;
}

async function functionFindings(file, fn, facts, exposed) {
  const definer = securityDefiner(fn.node);
  const findings = definerDeclarationFindings(file, fn, facts, exposed, definer);
  findings.push(...await functionBodyFindings(file, fn, definer));
  return findings;
}

/** All PL/pgSQL-backed L04/L06 findings for one migration's extracted facts. */
export async function plpgsqlFindings(file, facts, exposed) {
  const findings = [];
  await eachInOrder(facts.doBlocks, async (block) => { findings.push(...await doBlockFindings(file, block)); });
  await eachInOrder(facts.functions, async (fn) => { findings.push(...await functionFindings(file, fn, facts, exposed)); });
  return findings;
}
