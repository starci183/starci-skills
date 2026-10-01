import path from 'node:path';
import { machineKit, pascal } from './machine-ast.mjs';
import { treeOf } from './required-files.mjs';
import { DATABASE_DIR } from './connection-map.mjs';

/**
 * R35 `schema-owner` (BE_SCHEMA_OWNER, BE-CONVENTION 1.4.6). Schema lives with the capability that owns the table:
 *
 *   - a TypeORM `@Entity` class and a class implementing `MigrationInterface` sit in `persistence/entities/` and
 *     `persistence/migrations/` of a domain or platform capability (slot be.persistence), and nowhere else; a file in a
 *     folder named `entities` or `migrations` outside be.persistence is refused too;
 *   - `persistence/connection.ts` declares `<c>Entities` / `<c>Migrations`, the arrays the apps register; a capability has no
 *     `CONNECTION` alias (C0 lead decision 2026-09-30): its connection is the one those arrays are REGISTERED on, in the
 *     `entities` / `migrations` of a connection literal of `DatabaseModule.register` and of the migrate app. The arrays are
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
const SCHEMA_FOLDERS = ['entities', 'migrations'];
const MIGRATION_FILE = /^(\d{13})-([a-z0-9]+(?:-[a-z0-9]+)*)\.ts$/u;
const camel = name => { const text = pascal(name); return text[0].toLowerCase() + text.slice(1); };

export function checkSchemaOwner(input) {
  const { config, graph } = input;
  const kit = machineKit(input);
  const { ts, resolver } = kit;
  const connections = new Set(resolver.repo.connections.map(item => item.name));
  const violations = [];
  const report = (file, node, message, extra = {}) => violations.push({ ruleId: RULE, path: file.rel, ...kit.at(file.rel, file.sourceFile, node), message, ...extra });
  const plain = (rel, message, extra = {}) => violations.push({ ruleId: RULE, path: rel, line: 1, column: 1, message, ...extra });

  /** {root, capability, folder, below} of a be.persistence file: `folder` is the directory below persistence/ ('' at its root). */
  const persistenceOf = rel => {
    const classified = resolver.classifyPath(rel);
    if (classified.slot !== PERSISTENCE_SLOT) return null;
    const below = rel.slice(classified.root.length + 1).split('/');
    return { root: classified.root, capability: path.posix.basename(path.posix.dirname(classified.root)), folder: below.length > 1 ? below[0] : '', below };
  };

  let entities = 0;
  let migrations = 0;
  const found = new Map(); // capability root -> {name, entities, migrations}
  const note = (persistence, kind) => {
    const key = path.posix.dirname(persistence.root);
    if (!found.has(key)) found.set(key, { name: persistence.capability, entities: false, migrations: false });
    found.get(key)[kind] = true;
  };

  const tree = treeOf(config.root);
  for (const rel of [...tree.files].sort()) {
    const classified = resolver.classifyPath(rel);
    if (classified.status === 'no-slot' || !classified.slot?.startsWith('be.') || classified.slot === PERSISTENCE_SLOT) continue;
    const folder = rel.split('/').slice(0, -1).find(segment => SCHEMA_FOLDERS.includes(segment));
    if (folder) plain(rel, `${rel} sits in a ${folder}/ folder outside the persistence of a capability; ${folder} live only in src/modules/{domain,platform}/<capability>/persistence/${folder}/ of the capability that owns the table.`, { folder });
  }
  for (const rel of [...tree.files].sort()) {
    const persistence = persistenceOf(rel);
    if (!persistence || persistence.folder !== 'migrations') continue;
    if (/\.spec\.[cm]?tsx?$/u.test(rel)) plain(rel, `${rel} is a unit spec of a migration; a migration has no spec, the e2e run over the same migrations is its proof. Delete it.`);
    else if (!MIGRATION_FILE.test(persistence.below.at(-1)) || persistence.below.length !== 2) plain(rel, `${rel} is not named <epochMs13>-<kebab-name>.ts (13 digits of epoch milliseconds, a dash, a kebab-case name) directly in persistence/migrations/.`);
  }

  for (const file of graph.files.values()) {
    const persistence = persistenceOf(file.rel);
    const checker = kit.checkerOf(file.sourceFile);
    const heritage = statement => (statement.heritageClauses ?? []).flatMap(clause => clause.types.map(type => type.expression));
    for (const statement of file.sourceFile.statements) {
      if (!ts.isClassDeclaration(statement) || !statement.name) continue;
      const isEntity = kit.decorators(statement).some(decorator => {
        const call = ts.isCallExpression(decorator.expression) ? decorator.expression.expression : decorator.expression;
        return kit.isImportOf(checker, call, 'Entity', 'typeorm');
      });
      const isMigration = heritage(statement).some(expression => kit.isImportOf(checker, expression, 'MigrationInterface', 'typeorm'));
      if (isEntity) {
        entities += 1;
        if (persistence?.folder !== 'entities') report(file, statement.name, `Entity ${statement.name.text} is declared outside persistence/entities/ of a domain or platform capability; an entity lives with the capability that owns its table, in src/modules/{domain,platform}/<capability>/persistence/entities/<table>.entity.ts.`, { class: statement.name.text });
        else note(persistence, 'entities');
      }
      if (!isMigration) continue;
      migrations += 1;
      if (persistence?.folder !== 'migrations') {
        report(file, statement.name, `Migration ${statement.name.text} is declared outside persistence/migrations/ of a domain or platform capability; a migration lives with the capability that owns the table, in persistence/migrations/<epochMs13>-<kebab-name>.ts.`, { class: statement.name.text });
        continue;
      }
      note(persistence, 'migrations');
      const match = MIGRATION_FILE.exec(path.posix.basename(file.rel));
      if (!match) continue;
      const expected = `${pascal(match[2])}${match[1]}`;
      if (statement.name.text !== expected) report(file, statement.name, `Migration class ${statement.name.text} must be named ${expected}: the PascalCase of the file name followed by its 13-digit epoch, because TypeORM reads the timestamp from the class name.`, { class: statement.name.text, expected });
      const nameProperty = statement.members.find(member => ts.isPropertyDeclaration(member) && kit.propertyNameText(member.name) === 'name');
      const nameValue = nameProperty?.initializer ? kit.stringValue(checker, nameProperty.initializer) : null;
      if (nameValue !== statement.name.text) report(file, nameProperty ?? statement.name, `Migration ${statement.name.text} must declare \`name = "${statement.name.text}"\`, equal to its class name; TypeORM records that value in its migrations table.`, { class: statement.name.text });
    }
  }

  // The connection of a capability is where its arrays are registered (no CONNECTION alias in persistence/connection.ts).
  const unparen = node => { let current = node; while (current && (ts.isParenthesizedExpression(current) || ts.isAsExpression(current) || ts.isSatisfiesExpression?.(current) || ts.isNonNullExpression(current))) current = current.expression; return current; };
  const returned = declaration => {
    const fn = ts.isVariableDeclaration(declaration) && declaration.initializer ? unparen(declaration.initializer) : declaration;
    if (!(ts.isArrowFunction(fn) || ts.isFunctionDeclaration(fn) || ts.isFunctionExpression(fn) || ts.isMethodDeclaration(fn)) || !fn.body) return null;
    if (!ts.isBlock(fn.body)) return fn.body;
    const statements = fn.body.statements.filter(ts.isReturnStatement);
    return statements.length === 1 ? statements[0].expression ?? null : null;
  };
  const propertySources = new Map(); // property name -> [{declaration, initializer, checker}] over the program
  const assignmentsOf = name => {
    if (propertySources.has(name)) return propertySources.get(name);
    const list = [];
    for (const file of graph.files.values()) {
      if (!file.sourceFile.text.includes(name)) continue;
      const checker = kit.checkerOf(file.sourceFile);
      kit.walk(file.sourceFile, node => {
        if (ts.isPropertyAssignment(node) && kit.propertyNameText(node.name) === name && ts.isObjectLiteralExpression(node.parent)) {
          // the property of the type the literal is checked against, so a typed const and a typed return meet the same declaration
          const contextual = checker.getContextualType(node.parent)?.getProperty(name);
          const symbol = contextual ?? checker.getSymbolAtLocation(node.name);
          list.push({ declaration: symbol?.declarations?.[0] ?? null, initializer: node.initializer, checker });
        }
        return true;
      });
    }
    propertySources.set(name, list);
    return list;
  };
  const nameOfLiteral = (checker, literal, depth) => {
    const own = kit.propertyOf(literal, 'name');
    if (own) return kit.stringValue(checker, kit.valueOfProperty(own));
    for (const property of literal.properties) {
      if (!ts.isSpreadAssignment(property)) continue;
      const value = nameOfExpression(checker, property.expression, depth + 1);
      if (value) return value;
    }
    return null;
  };
  const nameOfExpression = (checker, expression, depth) => {
    const node = unparen(expression);
    if (!node || depth > 5) return null;
    if (ts.isObjectLiteralExpression(node)) return nameOfLiteral(checker, node, depth);
    if (ts.isCallExpression(node)) {
      for (const declaration of kit.declarationsOf(checker, node.expression)) {
        const body = returned(declaration);
        const value = body ? nameOfExpression(kit.checkerOf(declaration.getSourceFile()), body, depth + 1) : null;
        if (value) return value;
      }
      return null;
    }
    if (ts.isIdentifier(node)) {
      const declaration = kit.declarationsOf(checker, node)[0];
      return declaration && ts.isVariableDeclaration(declaration) && declaration.initializer ? nameOfExpression(kit.checkerOf(declaration.getSourceFile()), declaration.initializer, depth + 1) : null;
    }
    if (ts.isPropertyAccessExpression(node)) {
      const target = kit.declarationsOf(checker, node.name)[0];
      if (!target) return null;
      const names = new Set(assignmentsOf(node.name.text).filter(item => item.declaration === target).map(item => nameOfExpression(item.checker, item.initializer, depth + 1)).filter(Boolean));
      return names.size === 1 ? [...names][0] : null;
    }
    return null;
  };
  /** The capability arrays (`<c>Entities` / `<c>Migrations` of persistence/connection.ts) an expression lists. */
  const arraysIn = (checker, expression, out, depth) => {
    const node = unparen(expression);
    if (!node || depth > 6) return;
    if (ts.isArrayLiteralExpression(node)) { for (const element of node.elements) arraysIn(checker, ts.isSpreadElement(element) ? element.expression : element, out, depth + 1); return; }
    if (!ts.isIdentifier(node) && !ts.isPropertyAccessExpression(node)) return;
    const declaration = kit.declarationsOf(checker, ts.isPropertyAccessExpression(node) ? node.name : node)[0];
    if (!declaration || !ts.isVariableDeclaration(declaration) || !ts.isIdentifier(declaration.name)) return;
    const rel = kit.graphPath(declaration);
    const owner = rel ? persistenceOf(rel) : null;
    if (owner && owner.below.length === 1 && owner.below[0] === 'connection.ts' && [`${camel(owner.capability)}Entities`, `${camel(owner.capability)}Migrations`].includes(declaration.name.text)) {
      out.push({ key: path.posix.dirname(owner.root), name: owner.capability });
    } else if (declaration.initializer) arraysIn(kit.checkerOf(declaration.getSourceFile()), declaration.initializer, out, depth + 1);
  };
  const registered = new Map(); // capability root -> {name, connections: Map(connection -> first site)}
  let registrations = 0;
  for (const file of graph.files.values()) {
    const checker = kit.checkerOf(file.sourceFile);
    kit.walk(file.sourceFile, node => {
      if (!ts.isObjectLiteralExpression(node)) return true;
      const arrays = [];
      for (const key of ['entities', 'migrations']) {
        const property = kit.propertyOf(node, key);
        if (property) arraysIn(checker, kit.valueOfProperty(property), arrays, 0);
      }
      if (!arrays.length) return true;
      registrations += 1;
      const connection = nameOfLiteral(checker, node, 0);
      if (connection === null) return true;
      for (const { key, name } of new Map(arrays.map(item => [item.key, item])).values()) {
        if (!registered.has(key)) registered.set(key, { name, connections: new Map() });
        const sites = registered.get(key).connections;
        if (!sites.has(connection)) sites.set(connection, { file, node });
      }
      return true;
    });
  }
  for (const { name, connections: sites } of registered.values()) {
    for (const [connection, site] of sites) {
      if (!connections.has(connection)) report(site.file, site.node, `The ${name} capability is registered on connection "${connection}", which hfs.json does not declare (declared: ${[...connections].sort().join(', ') || 'none'}); the tables of a capability live on one declared connection.`, { connection, capability: name });
    }
    if (sites.size > 1) {
      const all = [...sites.keys()].sort().join(' and ');
      for (const [connection, site] of [...sites].slice(1)) report(site.file, site.node, `The ${name} capability's entities and migrations are registered on connections ${all}; a capability's tables live on exactly one connection, so register its arrays under one connection across every app.`, { connection, capability: name });
    }
  }
  for (const [key, kinds] of found) {
    if (!registered.get(key)?.connections.size) plain(`${key}/persistence/connection.ts`, `The ${kinds.name} capability has entities or migrations but no app registers them; add ${camel(kinds.name)}Entities and ${camel(kinds.name)}Migrations to a connection of DatabaseModule.register and of the migrate app.`, { capability: kinds.name });
    const connectionFile = graph.files.get(`${key}/persistence/connection.ts`);
    const declared = new Set((connectionFile?.sourceFile.statements.filter(ts.isVariableStatement).flatMap(statement => statement.declarationList.declarations) ?? []).map(item => item.name.text));
    for (const [kind, has] of [['Entities', kinds.entities], ['Migrations', kinds.migrations]]) {
      if (has && !declared.has(`${camel(kinds.name)}${kind}`)) plain(`${key}/persistence/connection.ts`, `${key}/persistence/connection.ts must export ${camel(kinds.name)}${kind}, the ${kind.toLowerCase()} of the ${kinds.name} capability, the one file that lists them for the apps.`, { capability: kinds.name });
    }
    const only = registered.get(key)?.connections;
    if (!only || only.size !== 1) continue;
    const home = [...only.keys()][0];
    for (const file of graph.files.values()) {
      if (!file.rel.startsWith(`${key}/`)) continue;
      const checker = kit.checkerOf(file.sourceFile);
      kit.walk(file.sourceFile, node => {
        if (!ts.isCallExpression(node)) return true;
        const declaration = kit.declarationsOf(checker, node.expression)[0];
        const rel = declaration ? kit.graphPath(declaration) : null;
        const used = rel ? [...connections].find(name => rel === `${DATABASE_DIR}/${name}.decorators.ts`) : null;
        if (used && used !== home) report(file, node, `${file.rel} injects the entity manager of connection ${used}, but the ${kinds.name} capability's tables are registered on ${home}; a capability reads only its own database, so use Inject${pascal(home)}EntityManager or move the tables.`, { connection: used, expected: home, capability: kinds.name });
        return true;
      });
    }
  }

  // The owner's index exports `<c>Entities` and `<c>Migrations`, the only persistence names.
  for (const [capabilityRoot, kinds] of found) {
    const index = graph.files.get(`${capabilityRoot}/index.ts`);
    if (!index) continue;
    const wanted = { Entities: `${camel(kinds.name)}Entities`, Migrations: `${camel(kinds.name)}Migrations` };
    const exported = new Set();
    for (const statement of index.sourceFile.statements) {
      if (ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
        for (const element of statement.exportClause.elements) {
          exported.add(element.name.text);
          const from = statement.moduleSpecifier?.text;
          const inPersistence = from?.startsWith('.') && path.posix.join(capabilityRoot, from).split('/').includes('persistence');
          if (inPersistence && !Object.values(wanted).includes(element.name.text)) {
            report(index, element, `${element.name.text} is exported from persistence/; the persistence of a capability is exposed only as ${wanted.Entities} and ${wanted.Migrations}.`, { name: element.name.text });
          }
        }
      } else if (ts.isVariableStatement(statement) && kit.isExported(statement)) {
        for (const declaration of statement.declarationList.declarations) if (ts.isIdentifier(declaration.name)) exported.add(declaration.name.text);
      }
    }
    for (const [kind, has] of [['Entities', kinds.entities], ['Migrations', kinds.migrations]]) {
      if (has && !exported.has(wanted[kind])) report(index, index.sourceFile, `${capabilityRoot}/index.ts must export ${wanted[kind]}, the ${kind.toLowerCase()} of the capability; apps concatenate them per connection into DatabaseModule.register.`, { capability: kinds.name, expected: wanted[kind] });
    }
  }
  return { violations, coverage: { status: 'checked', entities, migrations, capabilities: found.size, connections: connections.size, registrations } };
}
