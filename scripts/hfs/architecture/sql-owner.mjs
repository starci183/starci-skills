import path from 'node:path';
import { analyzeSql, HOLE } from './sql-tokens.mjs';
import { machineKit } from './machine-ast.mjs';
import { contextModelOf } from './context-map.mjs';
import { supabaseTablesOf } from './supabase-tables.mjs';

/**
 * R86 `sql-owner` (BE_SQL_TABLE_OWNER). Every `sql` tagged template (the tag declared in platform/database) of a
 * `<name>.sql.ts` file in a capability's `persistence/` is read with the tokenizer of sql-tokens.mjs and judged against the
 * schema authority of the whole program:
 *   - it writes (INSERT INTO, UPDATE, DELETE FROM, MERGE INTO, TRUNCATE) only tables the file's own capability declares;
 *   - it reads (FROM, JOIN, USING) only tables of its own CONTEXT (the connection its capability's arrays are registered on): its own
 *     capability's, or those of a same-context capability its owner may import (the tier matrix, through `resolver.importAllowed`
 *     to the table owner's public entry); a table of another context is refused (cross-context data comes only by events);
 *   - every table it names is declared by some entity under TypeORM authority, or by the generated
 *     `Database['public']['Tables']` contract under Supabase authority;
 *   - a SELECT carries LIMIT, or constrains the primary key or a unique key of its first table with `=`, or selects only
 *     aggregates without GROUP BY.
 * Table positions that hold a `${...}` substitution (SqlIdent) are dynamic; they are counted in the coverage and judged by
 * nobody. Joined tables are not part of the bound: a to-many join under a key-constrained first table is a review point.
 */
export const SQL_OWNER_RULE_IDS = ['BE_SQL_TABLE_OWNER'];

const RULE = 'BE_SQL_TABLE_OWNER';
const TYPEORM = 'typeorm';

const literalStrings = (ts, node) => {
  if (!node) return null;
  if (ts.isStringLiteralLike(node)) return [node.text];
  if (ts.isArrayLiteralExpression(node) && node.elements.every(item => ts.isStringLiteralLike(item))) return node.elements.map(item => item.text);
  return null;
};

function isTypeormDecorator(kit, checker, node, ...names) {
  const call = kit.ts.isCallExpression(node.expression) ? node.expression.expression : node.expression;
  const binding = kit.importBinding(checker, call);
  return binding?.module === TYPEORM && names.includes(binding.name);
}

function entityTableInfo(kit, checker, statement) {
  const { ts } = kit;
  const entity = kit.decorators(statement).find(decorator => isTypeormDecorator(kit, checker, decorator, 'Entity'));
  if (!entity) return null;
  const argument = ts.isCallExpression(entity.expression) ? entity.expression.arguments[0] : null;
  let table = argument && ts.isStringLiteralLike(argument) ? argument.text : null;
  if (table === null && argument && ts.isObjectLiteralExpression(argument)) {
    const property = kit.propertyOf(argument, 'name');
    if (property && ts.isStringLiteralLike(kit.valueOfProperty(property))) table = kit.valueOfProperty(property).text;
  }
  return { table };
}

function mappedColumnName(kit, member, property) {
  const { ts } = kit;
  let column = property;
  for (const decorator of kit.decorators(member)) {
    const args = ts.isCallExpression(decorator.expression) ? decorator.expression.arguments : [];
    for (const item of args) if (ts.isObjectLiteralExpression(item)) {
      const named = kit.propertyOf(item, 'name');
      if (named && ts.isStringLiteralLike(kit.valueOfProperty(named))) column = kit.valueOfProperty(named).text;
    }
  }
  return column;
}

function addUniqueColumnSet(kit, checker, decorator, column, primary, sets) {
  const { ts } = kit;
  const args = ts.isCallExpression(decorator.expression) ? decorator.expression.arguments : [];
  const uniqueOption = args.some(item => ts.isObjectLiteralExpression(item) && kit.propertyOf(item, 'unique')
    && kit.valueOfProperty(kit.propertyOf(item, 'unique')).kind === ts.SyntaxKind.TrueKeyword);
  if (isTypeormDecorator(kit, checker, decorator, 'PrimaryColumn', 'PrimaryGeneratedColumn')) primary.push(column.toLowerCase());
  else if (isTypeormDecorator(kit, checker, decorator, 'Column', 'Index') && uniqueOption) sets.push([column.toLowerCase()]);
}

function entityColumnSets(kit, checker, statement) {
  const { ts } = kit;
  const dbName = new Map();
  const primary = [];
  const sets = [];
  for (const member of statement.members) {
    if (!ts.isPropertyDeclaration(member) || !member.name || !ts.isIdentifier(member.name)) continue;
    const property = member.name.text;
    const column = mappedColumnName(kit, member, property);
    dbName.set(property, column.toLowerCase());
    for (const decorator of kit.decorators(member)) addUniqueColumnSet(kit, checker, decorator, column, primary, sets);
  }
  if (primary.length) sets.push(primary);
  return { dbName, sets };
}

function addEntityUniqueSets(kit, checker, statement, dbName, sets) {
  const { ts } = kit;
  for (const decorator of kit.decorators(statement)) {
    const args = ts.isCallExpression(decorator.expression) ? decorator.expression.arguments : [];
    const list = args.find(item => ts.isArrayLiteralExpression(item) && literalStrings(ts, item));
    const columns = list ? literalStrings(ts, list) : null;
    const unique = isTypeormDecorator(kit, checker, decorator, 'Unique') || (isTypeormDecorator(kit, checker, decorator, 'Index') && args.some(item => ts.isObjectLiteralExpression(item) && kit.propertyOf(item, 'unique')
      && kit.valueOfProperty(kit.propertyOf(item, 'unique')).kind === ts.SyntaxKind.TrueKeyword));
    if (unique && columns) sets.push(columns.map(column => (dbName.get(column) ?? column).toLowerCase()));
  }
}

/** Records the entities one `.entity.ts` file declares into `tables`; returns how many of its entities have no readable table name. */
function addFileEntities(kit, file, tables) {
  const checker = kit.checkerOf(file.sourceFile);
  let unreadable = 0;
  for (const statement of file.sourceFile.statements) {
    if (!kit.ts.isClassDeclaration(statement)) continue;
    const entity = entityTableInfo(kit, checker, statement);
    if (!entity) continue;
    if (entity.table === null) { unreadable += 1; continue; }
    const { dbName, sets } = entityColumnSets(kit, checker, statement);
    addEntityUniqueSets(kit, checker, statement, dbName, sets);
    const key = entity.table.toLowerCase();
    if (!tables.has(key)) tables.set(key, { table: entity.table, owner: file.owner.root, rel: file.rel, uniqueSets: sets });
  }
  return unreadable;
}

export function entitiesOf(kit, graph) {
  const tables = new Map();
  let unreadable = 0;
  for (const file of graph.files.values()) {
    if (file.slot !== 'be.persistence' || !path.posix.basename(file.rel).endsWith('.entity.ts') || !file.owner) continue;
    unreadable += addFileEntities(kit, file, tables);
  }
  return { tables, unreadable };
}

const capabilityTable = root => path.posix.basename(root).replaceAll('-', '_').toLowerCase();

/** Supabase declarations, with an owner when the generated table name matches a capability's persistence folder. */
function supabaseDeclarations(graph, appRoot, ts) {
  const generated = supabaseTablesOf(appRoot, ts);
  const tables = new Map([...generated].map(table => [table, { table, owner: null, rel: null, uniqueSets: [] }]));
  for (const file of graph.files.values()) {
    if (file.slot !== 'be.persistence' || !file.owner) continue;
    const key = capabilityTable(file.owner.root);
    const declaration = tables.get(key);
    if (declaration?.owner === null) tables.set(key, { ...declaration, owner: file.owner.root, rel: file.rel });
  }
  return tables;
}

function reportSqlWrite({ tables, supabase, file, ownTable, report }, write) {
  const declaration = tables.get(write.table.toLowerCase());
  if (!declaration) {
    report(supabase
      ? `SQL writes table ${write.table}, which Database['public']['Tables'] does not declare; regenerate supabase/types/database.types.ts from the migrations.`
      : `SQL writes table ${write.table}, which no @Entity declares; declare the entity in the owning capability's persistence/entities.`, { table: write.table });
  } else if (supabase) {
    if (write.table.toLowerCase() === ownTable) return;
    const ownerNote = declaration.owner ? `, owned by ${declaration.owner}` : '';
    report(`SQL in ${file.owner.root} writes table ${write.table}${ownerNote}; under Supabase schema authority a capability writes only its own table (${ownTable}), named for that capability.`, { table: write.table, ...(declaration.owner ? { tableOwner: declaration.owner } : {}) });
  } else if (declaration.owner !== file.owner.root) {
    report(`SQL in ${file.owner.root} writes table ${write.table}, owned by ${declaration.owner}; a capability writes only the tables of its own entities, call the owner's public API instead.`, { table: write.table, tableOwner: declaration.owner });
  }
}

function reportSqlWrites(input) {
  for (const write of input.result.writes) reportSqlWrite(input, write);
}

function reportSqlRead(tables, supabase, file, model, resolver, report, read) {
  const declaration = tables.get(read.table.toLowerCase());
  if (!declaration) {
    report(supabase
      ? `SQL reads table ${read.table}, which Database['public']['Tables'] does not declare; regenerate supabase/types/database.types.ts from the migrations.`
      : `SQL reads table ${read.table}, which no @Entity declares; declare the entity in the owning capability's persistence/entities.`, { table: read.table });
    return;
  }
  if (!declaration.owner || declaration.owner === file.owner.root) return;
  const ownContext = model.contextOfCapability(file.owner.root);
  const tableContext = model.contextOfCapability(declaration.owner);
  if (ownContext && tableContext && ownContext !== tableContext) {
    report(`SQL in ${file.owner.root} (context ${ownContext}) reads table ${read.table}, owned by ${declaration.owner} (context ${tableContext}); a context reads and writes only its own context's tables, so a cross-context JOIN or subquery is refused. Keep a local copy fed by the other context's events (a reactor), or read a projection.`, { table: read.table, tableOwner: declaration.owner, context: ownContext, tableContext });
    return;
  }
  const verdict = resolver.importAllowed(file.rel, `${declaration.owner}/index.ts`);
  if (!verdict.allowed) report(`SQL in ${file.owner.root} reads table ${read.table}, owned by ${declaration.owner}, which ${file.owner.root} may not import (${verdict.reason}); read it through the owner's public API.`, { table: read.table, tableOwner: declaration.owner, reason: verdict.reason });
}

function reportSqlReads({ result, tables, supabase, file, model, resolver, report }) {
  for (const read of result.reads) reportSqlRead(tables, supabase, file, model, resolver, report, read);
}

function reportSqlSelects({ result, tables, report }) {
  for (const select of result.selects) {
    if (select.bounded || (select.table && !tables.has(select.table.toLowerCase()))) continue;
    const tableNote = select.table ? `on ${select.table} ` : '';
    report(`SELECT ${tableNote}has no LIMIT and does not constrain a primary key or unique column with =; bound it with LIMIT (PAGE_SIZE_MAX, LIST_ROWS_MAX or BATCH_ROWS from platform/database), filter by key, or select only aggregates.`, { table: select.table ?? undefined });
  }
}

function inspectSqlTag(input, state, file, checker, node) {
  const { kit, ts, tables, supabase, model, resolver } = input;
  if (!ts.isTaggedTemplateExpression(node)) return true;
  const home = kit.declarationsOf(checker, node.tag).map(kit.ownerOfDeclaration).find(Boolean);
  if (home?.tier !== 'platform' || home?.name !== 'database') { state.foreignTags += 1; return true; }
  state.templates += 1;
  const template = node.template;
  const text = ts.isNoSubstitutionTemplateLiteral(template) ? template.text
    : template.head.text + template.templateSpans.map(span => HOLE + span.literal.text).join('');
  const seen = new Set();
  const report = (message, extra = {}) => {
    const key = `${message}`;
    if (seen.has(key)) return;
    seen.add(key);
    state.violations.push({ ruleId: RULE, path: file.rel, ...kit.at(file.rel, file.sourceFile, node), message, ...extra });
  };
  const result = analyzeSql(text, { uniqueSetsOf: table => tables.get(table.toLowerCase())?.uniqueSets ?? null });
  state.dynamic += result.dynamic;
  const ownTable = capabilityTable(file.owner.root);
  reportSqlWrites({ result, tables, supabase, file, ownTable, report });
  reportSqlReads({ result, tables, supabase, file, model, resolver, report });
  reportSqlSelects({ result, tables, report });
  return true;
}

function inspectSqlFile(input, state, file) {
  const { kit } = input;
  if (file.slot !== 'be.persistence' || !path.posix.basename(file.rel).endsWith('.sql.ts') || !file.owner) return;
  const checker = kit.checkerOf(file.sourceFile);
  kit.walk(file.sourceFile, node => inspectSqlTag(input, state, file, checker, node));
}

export function checkSqlOwner(input) {
  const { config, graph } = input;
  const kit = machineKit(input);
  const { ts, resolver } = kit;
  const supabase = resolver.ruleParams().schemaAuthority === 'supabase';
  const entityDeclarations = supabase ? { tables: new Map(), unreadable: 0 } : entitiesOf(kit, graph);
  const tables = supabase ? supabaseDeclarations(graph, config.packageRoot, ts) : entityDeclarations.tables;
  const model = contextModelOf(kit, graph);
  const state = { violations: [], templates: 0, dynamic: 0, foreignTags: 0 };
  const inspection = { kit, ts, tables, supabase, model, resolver };
  for (const file of graph.files.values()) inspectSqlFile(inspection, state, file);
  return { violations: state.violations, coverage: { status: 'checked', entities: entityDeclarations.tables.size, unreadableEntities: entityDeclarations.unreadable,
    ...(supabase ? { supabaseTables: tables.size } : {}), templates: state.templates, dynamicIdentifiers: state.dynamic, foreignTags: state.foreignTags } };
}
