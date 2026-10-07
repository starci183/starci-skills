import path from 'node:path';
import { machineKit, pascal } from './machine-ast.mjs';
import { treeOf } from './required-files.mjs';
import { DATABASE_DIR } from './connection-map.mjs';
import { collectRegistrations, isPerConnection, persistenceOfFactory } from './context-map.mjs';
import { byCodeUnit } from '../../lib/list.mjs';

/**
 * R35 `schema-owner` (BE_SCHEMA_OWNER, BE-CONVENTION 1.4.6). Schema lives with the capability that owns the table:
 *
 *   - a TypeORM `@Entity` class and a class implementing `MigrationInterface` sit in `persistence/entities/` and
 *     `persistence/migrations/` of a domain or platform capability (slot be.persistence), and nowhere else; a file in a
 *     folder named `entities` or `migrations` outside be.persistence is refused too;
 *   - `persistence/connection.ts` declares `<c>Entities` / `<c>Migrations`, the arrays the apps register; a capability has no
 *     `CONNECTION` alias (C0 lead decision 2026-09-30): its connection is the one those arrays are REGISTERED on, in the
 *     `entities` / `migrations` of a connection literal of `DatabaseModule.register` and of the cli app. The arrays are
 *     registered under exactly one connection across all apps, that connection is declared in hfs.json, and every
 *     `Inject<Conn>EntityManager()` used inside the capability is that same connection;
 *   - the capability's `index.ts` exports `<c>Entities` when it has entities and `<c>Migrations` when it has migrations
 *     (`<c>` the camelCase capability name), and no other name coming from `persistence/`;
 *   - a migration file is `<epochMs13>-<kebab-name>.ts`, holds a class `<Pascal><epochMs13>` and a `name` property equal to
 *     that class name, and has no unit spec beside it.
 */
export const SCHEMA_OWNER_RULE_IDS = ['BE_SCHEMA_OWNER'];

const RULE = 'BE_SCHEMA_OWNER';
const PERSISTENCE_SLOT = 'be.persistence';
const SCHEMA_FOLDERS = new Set(['entities', 'migrations']);
const MIGRATION_FILE = /^(\d{13})-([a-z0-9]+(?:-[a-z0-9]+)*)\.ts$/u;
const camel = name => { const text = pascal(name); return text[0].toLowerCase() + text.slice(1); };

function noteSchemaOwner(found, persistence, kind) {
  const key = path.posix.dirname(persistence.root);
  if (!found.has(key)) found.set(key, { name: persistence.capability, entities: false, migrations: false });
  found.get(key)[kind] = true;
}

function reportSchemaFolders(tree, resolver, plain) {
  for (const rel of [...tree.files].sort(byCodeUnit)) {
    const classified = resolver.classifyPath(rel);
    if (classified.status === 'no-slot' || !classified.slot?.startsWith('be.') || classified.slot === PERSISTENCE_SLOT) continue;
    const folder = rel.split('/').slice(0, -1).find(segment => SCHEMA_FOLDERS.has(segment));
    if (folder) plain(rel, `${rel} sits in a ${folder}/ folder outside the persistence of a capability; ${folder} live only in src/modules/{domain,platform}/<capability>/persistence/${folder}/ of the capability that owns the table.`, { folder });
  }
}

function reportMigrationPaths(tree, persistenceOf, plain) {
  for (const rel of [...tree.files].sort(byCodeUnit)) {
    const persistence = persistenceOf(rel);
    if (persistence?.folder !== 'migrations') continue;
    if (/\.spec\.[cm]?tsx?$/u.test(rel)) plain(rel, `${rel} is a unit spec of a migration; a migration has no spec, the e2e run over the same migrations is its proof. Delete it.`);
    else if (!MIGRATION_FILE.test(persistence.below.at(-1)) || persistence.below.length !== 2) plain(rel, `${rel} is not named <epochMs13>-<kebab-name>.ts (13 digits of epoch milliseconds, a dash, a kebab-case name) directly in persistence/migrations/.`);
  }
}

function isEntityDeclaration(kit, checker, statement) {
  return kit.decorators(statement).some(decorator => {
    const call = kit.ts.isCallExpression(decorator.expression) ? decorator.expression.expression : decorator.expression;
    return kit.isImportOf(checker, call, 'Entity', 'typeorm');
  });
}

function isMigrationDeclaration(kit, checker, statement) {
  const heritage = (statement.heritageClauses ?? []).flatMap(clause => clause.types.map(type => type.expression));
  return heritage.some(expression => kit.isImportOf(checker, expression, 'MigrationInterface', 'typeorm'));
}

function inspectEntityDeclaration(resolver, file, statement, persistence, found, report) {
  // The table of a projection belongs to the projection that alone writes it: `<name>.projection-entity.ts` of slot be.projections.
  const ownProjectionTable = resolver.classifyPath(file.rel).slot === 'be.projections' && file.rel.endsWith('.projection-entity.ts');
  if (ownProjectionTable) noteSchemaOwner(found, { root: path.posix.join(path.posix.dirname(file.rel), 'persistence'), capability: path.posix.basename(path.posix.dirname(file.rel)) }, 'entities');
  else if (persistence?.folder !== 'entities') report(file, statement.name, `Entity ${statement.name.text} is declared outside persistence/entities/ of a domain or platform capability; an entity lives with the capability that owns its table, in src/modules/{domain,platform}/<capability>/persistence/entities/<table>.entity.ts.`, { class: statement.name.text });
  else noteSchemaOwner(found, persistence, 'entities');
}

function inspectMigrationDeclaration(kit, file, statement, persistence, checker, found, report) {
  if (persistence?.folder !== 'migrations') {
    report(file, statement.name, `Migration ${statement.name.text} is declared outside persistence/migrations/ of a domain or platform capability; a migration lives with the capability that owns the table, in persistence/migrations/<epochMs13>-<kebab-name>.ts.`, { class: statement.name.text });
    return;
  }
  noteSchemaOwner(found, persistence, 'migrations');
  const match = MIGRATION_FILE.exec(path.posix.basename(file.rel));
  if (!match) return;
  const expected = `${pascal(match[2])}${match[1]}`;
  if (statement.name.text !== expected) report(file, statement.name, `Migration class ${statement.name.text} must be named ${expected}: the PascalCase of the file name followed by its 13-digit epoch, because TypeORM reads the timestamp from the class name.`, { class: statement.name.text, expected });
  const nameProperty = statement.members.find(member => kit.ts.isPropertyDeclaration(member) && kit.propertyNameText(member.name) === 'name');
  const nameValue = nameProperty?.initializer ? kit.stringValue(checker, nameProperty.initializer) : null;
  if (nameValue !== statement.name.text) report(file, nameProperty ?? statement.name, `Migration ${statement.name.text} must declare \`name = "${statement.name.text}"\`, equal to its class name; TypeORM records that value in its migrations table.`, { class: statement.name.text });
}

function inspectSchemaClass(scan, site, statement) {
  const { kit, found, counts, report } = scan;
  const { file, persistence, checker } = site;
  if (!kit.ts.isClassDeclaration(statement) || !statement.name) return;
  const isEntity = isEntityDeclaration(kit, checker, statement);
  const isMigration = isMigrationDeclaration(kit, checker, statement);
  if (isEntity) {
    counts.entities += 1;
    inspectEntityDeclaration(kit.resolver, file, statement, persistence, found, report);
  }
  if (!isMigration) return;
  counts.migrations += 1;
  inspectMigrationDeclaration(kit, file, statement, persistence, checker, found, report);
}

function inspectSchemaFiles(input, kit, persistenceOf, found, report) {
  const { graph } = input;
  const counts = { entities: 0, migrations: 0 };
  const scan = { kit, found, counts, report };
  for (const file of graph.files.values()) {
    const persistence = persistenceOf(file.rel);
    const checker = kit.checkerOf(file.sourceFile);
    for (const statement of file.sourceFile.statements) inspectSchemaClass(scan, { file, persistence, checker }, statement);
  }
  return counts;
}

function reportRegistrationSites(registered, connections, resolver, report) {
  for (const [key, { name, connections: sites }] of registered) {
    for (const [connection, site] of sites) {
      if (!connections.has(connection)) report(site.file, site.node, `The ${name} capability is registered on connection "${connection}", which hfs.json does not declare (declared: ${[...connections].sort(byCodeUnit).join(', ') || 'none'}); the tables of a capability live on one declared connection.`, { connection, capability: name });
    }
    if (sites.size > 1 && !isPerConnection(resolver, key, name)) {
      const all = [...sites.keys()].sort(byCodeUnit).join(' and ');
      for (const [connection, site] of [...sites].slice(1)) report(site.file, site.node, `The ${name} capability's entities and migrations are registered on connections ${all}; a capability's tables live on exactly one connection, so register its arrays under one connection across every app.`, { connection, capability: name });
    }
  }
}

function reportDeclaredPersistenceArrays(key, kinds, registered, graph, ts, plain) {
  if (!registered.get(key)?.connections.size) plain(`${key}/persistence/connection.ts`, `The ${kinds.name} capability has entities or migrations but no app registers them; add ${camel(kinds.name)}Entities and ${camel(kinds.name)}Migrations to a connection of DatabaseModule.register and of the cli app.`, { capability: kinds.name });
  const connectionFile = graph.files.get(`${key}/persistence/connection.ts`);
  const declared = new Set((connectionFile?.sourceFile.statements.filter(ts.isVariableStatement).flatMap(statement => statement.declarationList.declarations) ?? []).map(item => item.name.text));
  for (const [kind, has] of [['Entities', kinds.entities], ['Migrations', kinds.migrations]]) {
    if (has && !declared.has(`${camel(kinds.name)}${kind}`)) plain(`${key}/persistence/connection.ts`, `${key}/persistence/connection.ts must export ${camel(kinds.name)}${kind}, the ${kind.toLowerCase()} of the ${kinds.name} capability, the one file that lists them for the apps.`, { capability: kinds.name });
  }
}

function reportEntityManagerUse(kit, capability, file, checker, report) {
  const { kinds, only, home, connections } = capability;
  kit.walk(file.sourceFile, node => {
    if (!kit.ts.isCallExpression(node)) return;
    const declaration = kit.declarationsOf(checker, node.expression)[0];
    const rel = declaration ? kit.graphPath(declaration) : null;
    const used = rel ? [...connections].find(name => rel === `${DATABASE_DIR}/${name}.decorators.ts`) : null;
    if (used && only.size > 1 && !only.has(used)) report(file, node, `${file.rel} injects the entity manager of connection ${used}, but the ${kinds.name} capability's tables are registered on ${[...only.keys()].sort(byCodeUnit).join(' and ')}; register the capability on ${used} too or inject one of its connections.`, { connection: used, expected: [...only.keys()].sort(byCodeUnit).join(','), capability: kinds.name });
    else if (used && only.size === 1 && used !== home) report(file, node, `${file.rel} injects the entity manager of connection ${used}, but the ${kinds.name} capability's tables are registered on ${home}; a capability reads only its own database, so use Inject${pascal(home)}EntityManager or move the tables.`, { connection: used, expected: home, capability: kinds.name });
  });
}

function reportEntityManagerUses(input, kit, key, kinds, only, connections, report) {
  const capability = { kinds, only, home: [...only.keys()][0], connections };
  for (const file of input.graph.files.values()) {
    if (!file.rel.startsWith(`${key}/`)) continue;
    reportEntityManagerUse(kit, capability, file, kit.checkerOf(file.sourceFile), report);
  }
}

function reportFoundCapability(input, kit, key, kinds, view) {
  const { registered, connections, plain, report } = view;
  const { graph } = input;
  const { resolver } = kit;
  reportDeclaredPersistenceArrays(key, kinds, registered, graph, kit.ts, plain);
  const only = registered.get(key)?.connections;
  if (!only || only.size < 1) return;
  // A per-connection platform capability (event-bus, jobs) lives on every connection that uses it; any other on exactly one (reported above).
  const perConnection = only.size > 1 && isPerConnection(resolver, key, kinds.name);
  if (only.size > 1 && !perConnection) return;
  reportEntityManagerUses(input, kit, key, kinds, only, connections, report);
}

function reportFoundCapabilities(input, kit, found, registered, connections, plain, report) {
  const view = { registered, connections, plain, report };
  for (const [key, kinds] of found) reportFoundCapability(input, kit, key, kinds, view);
}

function reportPersistenceExport(capabilityRoot, index, statement, element, wanted, report) {
  const from = statement.moduleSpecifier?.text;
  const inPersistence = from?.startsWith('.') && path.posix.join(capabilityRoot, from).split('/').includes('persistence');
  if (inPersistence && !Object.values(wanted).includes(element.name.text)) {
    report(index, element, `${element.name.text} is exported from persistence/; the persistence of a capability is exposed only as ${wanted.Entities} and ${wanted.Migrations}.`, { name: element.name.text });
  }
}

function addStatementExports(kit, capabilityRoot, index, statement, wanted, report, exported) {
  const { ts } = kit;
  if (ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
    for (const element of statement.exportClause.elements) {
      exported.add(element.name.text);
      reportPersistenceExport(capabilityRoot, index, statement, element, wanted, report);
    }
  } else if (ts.isVariableStatement(statement) && kit.isExported(statement)) {
    for (const declaration of statement.declarationList.declarations) if (ts.isIdentifier(declaration.name)) exported.add(declaration.name.text);
  }
}

function collectIndexExports(kit, capabilityRoot, index, wanted, report) {
  const exported = new Set();
  for (const statement of index.sourceFile.statements) addStatementExports(kit, capabilityRoot, index, statement, wanted, report, exported);
  return exported;
}

function reportCapabilityIndex(input, kit, capabilityRoot, kinds, report) {
  const { graph } = input;
  const index = graph.files.get(`${capabilityRoot}/index.ts`);
  if (!index) return;
  const wanted = { Entities: `${camel(kinds.name)}Entities`, Migrations: `${camel(kinds.name)}Migrations` };
  const exported = collectIndexExports(kit, capabilityRoot, index, wanted, report);
  for (const [kind, has] of [['Entities', kinds.entities], ['Migrations', kinds.migrations]]) {
    if (has && !exported.has(wanted[kind])) report(index, index.sourceFile, `${capabilityRoot}/index.ts must export ${wanted[kind]}, the ${kind.toLowerCase()} of the capability; apps concatenate them per connection into DatabaseModule.register.`, { capability: kinds.name, expected: wanted[kind] });
  }
}

function reportCapabilityIndexes(input, kit, found, report) {
  // The owner's index exports `<c>Entities` and `<c>Migrations`, the only persistence names.
  for (const [capabilityRoot, kinds] of found) reportCapabilityIndex(input, kit, capabilityRoot, kinds, report);
}

export function checkSchemaOwner(input) {
  const { config, graph } = input;
  const kit = machineKit(input);
  const { resolver } = kit;
  const connections = new Set(resolver.repo.connections.map(item => item.name));
  const violations = [];
  const report = (file, node, message, extra = {}) => violations.push({ ruleId: RULE, path: file.rel, ...kit.at(file.rel, file.sourceFile, node), message, ...extra });
  const plain = (rel, message, extra = {}) => violations.push({ ruleId: RULE, path: rel, line: 1, column: 1, message, ...extra });
  const persistenceOf = persistenceOfFactory(resolver);
  const tree = treeOf(config.root);
  reportSchemaFolders(tree, resolver, plain);
  reportMigrationPaths(tree, persistenceOf, plain);
  const found = new Map(); // capability root -> {name, entities, migrations}
  const counts = inspectSchemaFiles(input, kit, persistenceOf, found, report);
  const { registered, registrations } = collectRegistrations({ kit, graph, persistenceOf });
  reportRegistrationSites(registered, connections, resolver, report);
  reportFoundCapabilities(input, kit, found, registered, connections, plain, report);
  reportCapabilityIndexes(input, kit, found, report);
  return { violations, coverage: { status: 'checked', entities: counts.entities, migrations: counts.migrations, capabilities: found.size, connections: connections.size, registrations } };
}
