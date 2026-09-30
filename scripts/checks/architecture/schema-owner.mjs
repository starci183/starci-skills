import path from 'node:path';
import { machineKit, pascal } from './machine-ast.mjs';
import { treeOf } from './required-files.mjs';

/**
 * R35 `schema-owner` (BE_SCHEMA_OWNER, BE-CONVENTION 1.4.6). Schema lives with the capability that owns the table:
 *
 *   - a TypeORM `@Entity` class and a class implementing `MigrationInterface` sit in `persistence/entities/` and
 *     `persistence/migrations/` of a domain or platform capability (slot be.persistence), and nowhere else; a file in a
 *     folder named `entities` or `migrations` outside be.persistence is refused too;
 *   - `persistence/connection.ts` exports `CONNECTION` whose value resolves to a connection of hfs.json;
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
    if (persistence && persistence.below.length === 1 && persistence.below[0] === 'connection.ts') {
      const declaration = file.sourceFile.statements.filter(ts.isVariableStatement).flatMap(statement => statement.declarationList.declarations)
        .find(item => ts.isIdentifier(item.name) && item.name.text === 'CONNECTION');
      if (!declaration?.initializer) report(file, file.sourceFile, `${file.rel} must export \`CONNECTION\`, the connection of hfs.json that holds the tables of this capability.`);
      else {
        const value = kit.stringValue(checker, declaration.initializer);
        if (value === null) report(file, declaration, 'CONNECTION does not resolve to a string constant; write `export const CONNECTION = <NAME>_CONNECTION` with the constant of platform/database.');
        else if (!connections.has(value)) report(file, declaration, `CONNECTION is "${value}", which hfs.json does not declare (declared: ${[...connections].sort().join(', ') || 'none'}); a capability's tables live on one declared connection.`, { connection: value });
      }
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
  return { violations, coverage: { status: 'checked', entities, migrations, capabilities: found.size, connections: connections.size } };
}
