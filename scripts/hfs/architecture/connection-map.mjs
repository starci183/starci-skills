import fs from 'node:fs';
import path from 'node:path';
import { machineKit, pascal, upperSnake } from './machine-ast.mjs';
import { locateDeclaration } from '../slots.mjs';

/**
 * R84 `connection-map` (BE_CONNECTION_DUPLICATE), folding RED01 and RED02. One physical database is one connection, one
 * `Inject<Conn>EntityManager()` injector, one config; the `hfs.json` connections, the connection files, the injectors, the
 * database module registration of every app and the env of every stack correspond one to one.
 *
 *   - per declared connection `<name>`: `src/modules/platform/database/<name>.connection.ts` exports
 *     `<NAME>_CONNECTION = "<name>"`, `<name>.decorators.ts` exports `Inject<Pascal>EntityManager`, `<name>.config.ts`
 *     exists and reads only `<ENVPREFIX>_*` keys;
 *   - a connection file for a name hfs.json does not declare is refused;
 *   - `getEntityManagerToken(` and `InjectEntityManager(` (from @nestjs/typeorm) resolve their argument through the
 *     checker to a connection name and may be called only in that connection's decorators file, once; the DataSource
 *     forms only in platform/database, the migrate app and the test fixtures; an exported `Inject*EntityManager`
 *     anywhere else (a capability-specific injector, a duplicate) is refused;
 *   - inside one app every connection is passed to the platform/database module registration once;
 *   - in every `.starcistacks/<env>/runtime/env` two connections whose `<PREFIX>_HOST`, `<PREFIX>_PORT` and
 *     `<PREFIX>_NAME` (or `_DATABASE`, whichever the config reads) resolve to one triple are the same database.
 */
export const CONNECTION_RULE_IDS = ['BE_CONNECTION_DUPLICATE'];

const RULE = 'BE_CONNECTION_DUPLICATE';
export const DATABASE_DIR = 'src/modules/platform/database';
const TYPEORM = '@nestjs/typeorm';
const MANAGER_CALLS = new Set(['getEntityManagerToken', 'InjectEntityManager']);
const SOURCE_CALLS = new Set(['getDataSourceToken', 'InjectDataSource']);
const ENV_KEY = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/u;
const INJECTOR_NAME = /^Inject[A-Za-z0-9]*EntityManager$/u;

function readEnvFiles(target) {
  const merged = new Map();
  const readFile = file => {
    let text;
    try { text = fs.readFileSync(file, 'utf8'); } catch { return; }
    for (const raw of text.split(/\r?\n/u)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/u.exec(line);
      if (!match) continue;
      let value = match[2].trim();
      if (/^(['"]).*\1$/u.test(value)) value = value.slice(1, -1);
      merged.set(match[1], value.trim());
    }
  };
  let stat;
  try { stat = fs.statSync(target); } catch { return null; }
  if (stat.isFile()) readFile(target);
  else for (const entry of fs.readdirSync(target, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.isFile() && !entry.name.toLowerCase().endsWith('.md')) readFile(path.join(target, entry.name));
  }
  return merged;
}

export function checkConnectionMap(input) {
  const { config, graph } = input;
  const kit = machineKit(input);
  const { ts } = kit;
  const declared = config.hfs.repo.connections ?? [];
  const byName = new Map(declared.map(connection => [connection.name, connection]));
  const violations = [];
  const report = (rel, message, extra = {}) => violations.push({ ruleId: RULE, path: rel, message, ...extra });
  const decoratorsFile = name => `${DATABASE_DIR}/${name}.decorators.ts`;
  const databaseFiles = [...graph.files.values()].filter(file => file.rel.startsWith(`${DATABASE_DIR}/`));

  // 1. The three files of each declared connection, and no file of an undeclared one.
  for (const connection of declared) {
    const connectionRel = `${DATABASE_DIR}/${connection.name}.connection.ts`;
    const constant = `${upperSnake(connection.name)}_CONNECTION`;
    const connectionFile = kit.graphFile(connectionRel);
    if (!connectionFile) report(connectionRel, `hfs.json declares connection ${connection.name} but ${connectionRel} does not exist; declare \`export const ${constant} = "${connection.name}"\` there.`, { connection: connection.name });
    else {
      const checker = kit.checkerOf(connectionFile.sourceFile);
      const statement = connectionFile.sourceFile.statements.find(item => ts.isVariableStatement(item) && kit.isExported(item)
        && item.declarationList.declarations.some(declaration => ts.isIdentifier(declaration.name) && declaration.name.text === constant));
      const initializer = statement?.declarationList.declarations.find(declaration => declaration.name.text === constant)?.initializer;
      if (!statement || kit.stringValue(checker, initializer) !== connection.name) {
        report(connectionRel, `${connectionRel} must export \`${constant} = "${connection.name}"\` (the connection name declared in hfs.json).`, { connection: connection.name });
      }
    }
    const decorators = kit.graphFile(decoratorsFile(connection.name));
    const injector = `Inject${pascal(connection.name)}EntityManager`;
    const exported = decorators?.sourceFile.statements.some(item => (ts.isVariableStatement(item) && kit.isExported(item)
      && item.declarationList.declarations.some(declaration => ts.isIdentifier(declaration.name) && declaration.name.text === injector))
      || (ts.isFunctionDeclaration(item) && kit.isExported(item) && item.name?.text === injector));
    if (!exported) report(decoratorsFile(connection.name), `Connection ${connection.name} needs ${decoratorsFile(connection.name)} exporting ${injector}, the one injector of its shared EntityManager.`, { connection: connection.name });
    const configRel = `${DATABASE_DIR}/${connection.name}.config.ts`;
    const configFile = kit.graphFile(configRel);
    if (!configFile) {
      report(configRel, `Connection ${connection.name} needs ${configRel}, the one place its ${connection.envPrefix}_* keys are read.`, { connection: connection.name });
      continue;
    }
    kit.walk(configFile.sourceFile, node => {
      let key = null;
      if (ts.isStringLiteralLike(node) && ENV_KEY.test(node.text)) key = node.text;
      else if (ts.isPropertyAccessExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'env'
        && ts.isIdentifier(node.expression.expression) && node.expression.expression.text === 'process' && ENV_KEY.test(node.name.text)) key = node.name.text;
      if (key === null) return true;
      const own = key.startsWith(`${connection.envPrefix}_`);
      const foreign = declared.find(other => other !== connection && key.startsWith(`${other.envPrefix}_`));
      if (!own || foreign) {
        report(configRel, `${configRel} reads ${key}; the config of connection ${connection.name} reads only ${connection.envPrefix}_* keys.`, { ...kit.at(configRel, configFile.sourceFile, node), connection: connection.name });
      }
      return false;
    });
  }
  for (const file of databaseFiles) {
    const match = /^(.+)\.(connection|decorators|config)\.ts$/u.exec(path.posix.basename(file.rel));
    if (match && path.posix.dirname(file.rel) === DATABASE_DIR && !byName.has(match[1])) {
      report(file.rel, `${file.rel} belongs to connection ${match[1]}, which hfs.json does not declare; declare the database in hfs.json connections or delete the file.`, { connection: match[1] });
    }
  }

  // 2. Every entity manager token and injector in the program: one home per connection.
  const perDecorators = new Map();
  for (const file of graph.files.values()) {
    const checker = kit.checkerOf(file.sourceFile);
    const slotIs = id => file.slot === id;
    kit.walk(file.sourceFile, node => {
      if (ts.isCallExpression(node)) {
        const binding = kit.importBinding(checker, node.expression);
        if (binding?.module === TYPEORM && MANAGER_CALLS.has(binding.name)) {
          const value = kit.stringValue(checker, node.arguments[0]);
          const home = value === null ? null : decoratorsFile(value);
          if (value === null || !byName.has(value)) {
            report(file.rel, `${binding.name}() names ${value === null ? 'a connection that cannot be resolved to a constant' : `connection ${value}, which hfs.json does not declare`}; only the declared connections have an entity manager token.`, kit.at(file.rel, file.sourceFile, node));
          } else if (file.rel !== home) {
            report(file.rel, `${binding.name}(${value}) belongs in ${home} only; inject the shared manager with Inject${pascal(value)}EntityManager() instead of a second path to connection ${value}.`, { ...kit.at(file.rel, file.sourceFile, node), connection: value });
          } else {
            perDecorators.set(value, (perDecorators.get(value) ?? 0) + 1);
            if (perDecorators.get(value) > 1) report(file.rel, `${home} resolves connection ${value} more than once; one connection has one injector.`, { ...kit.at(file.rel, file.sourceFile, node), connection: value });
          }
        } else if (binding?.module === TYPEORM && SOURCE_CALLS.has(binding.name)) {
          const allowed = file.rel.startsWith(`${DATABASE_DIR}/`) || slotIs('be.app.migrate') || slotIs('be.tests.fixtures');
          if (!allowed) report(file.rel, `${binding.name}() reaches the DataSource outside platform/database and the migrate app; inject the shared EntityManager of the connection instead.`, kit.at(file.rel, file.sourceFile, node));
        }
      }
      const exportedName = (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && ts.isVariableStatement(node.parent?.parent) && kit.isExported(node.parent.parent)) ? node.name.text
        : (ts.isFunctionDeclaration(node) && kit.isExported(node) && node.name ? node.name.text : null);
      if (exportedName && INJECTOR_NAME.test(exportedName)) {
        const home = [...byName.keys()].find(name => `Inject${pascal(name)}EntityManager` === exportedName);
        if (!home || file.rel !== decoratorsFile(home)) {
          report(file.rel, `${exportedName} is exported here, but the only injector of an entity manager is Inject<Conn>EntityManager in src/modules/platform/database/<conn>.decorators.ts, one per declared connection.`, kit.at(file.rel, file.sourceFile, node));
        }
      }
      return true;
    });
  }

  // 3. Each connection is passed to the database module registration once per app.
  let registrations = 0;
  for (const app of config.apps) {
    const root = kit.appRoot(app.name);
    if (!root) continue;
    const checker = kit.checkerOf(root.sourceFile);
    const passed = new Map();
    kit.walk(root.sourceFile, node => {
      if (!(ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'register')) return true;
      const owner = kit.declarationsOf(checker, node.expression.expression).map(kit.ownerOfDeclaration).find(Boolean);
      if (!owner || owner.tier !== 'platform' || owner.name !== 'database') return true;
      registrations += 1;
      for (const argument of node.arguments) {
        kit.walk(argument, inner => {
          if (ts.isPropertyAssignment(inner.parent ?? {}) && inner.parent.name === inner) return true;
          if (ts.isPropertyAccessExpression(inner.parent ?? {}) && inner.parent.name === inner) return true;
          if (!(ts.isIdentifier(inner) || ts.isStringLiteralLike(inner) || ts.isPropertyAccessExpression(inner))) return true;
          const value = kit.stringValue(checker, inner);
          if (value === null || !byName.has(value)) return true;
          passed.set(value, (passed.get(value) ?? 0) + 1);
          if (passed.get(value) > 1) report(root.rel, `App ${app.name} passes connection ${value} to the database module registration more than once; one connection is registered once per app.`, { ...kit.at(root.rel, root.sourceFile, inner), connection: value, app: app.name });
          return false;
        });
      }
      return true;
    });
  }

  // 4. Stacks: two connections that resolve to one host, port and database are one database.
  let stacksChecked = 0;
  let stacksSkipped = 0;
  // .starcistacks sits at the app root: the side folder the machine judges reads its app's tree (locateDeclaration).
  const stacksRoot = path.join(locateDeclaration(config.root).appRoot, '.starcistacks');
  let envs = [];
  try { envs = fs.readdirSync(stacksRoot, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name).sort(); } catch { envs = []; }
  for (const env of envs) {
    // Relative to the side folder the machine judges (`../.starcistacks/...` for a side): the app-relative path once the side is prefixed.
    const rel = path.relative(config.root, path.join(stacksRoot, env, 'runtime', 'env')).split(path.sep).join('/');
    const values = readEnvFiles(path.join(stacksRoot, env, 'runtime', 'env'));
    if (!values || values.size === 0) { stacksSkipped += 1; continue; }
    const seen = new Map();
    let resolved = 0;
    for (const connection of declared) {
      const configFile = kit.graphFile(`${DATABASE_DIR}/${connection.name}.config.ts`);
      const nameKey = configFile?.sourceFile.text.includes(`${connection.envPrefix}_DATABASE`) ? `${connection.envPrefix}_DATABASE` : `${connection.envPrefix}_NAME`;
      const host = values.get(`${connection.envPrefix}_HOST`);
      const port = values.get(`${connection.envPrefix}_PORT`);
      const database = values.get(nameKey);
      if (!host || !port || !database) continue;
      resolved += 1;
      const triple = `${host.toLowerCase()}|${port}|${database}`;
      if (seen.has(triple)) {
        report(rel, `Connections ${seen.get(triple)} and ${connection.name} resolve to the same database (${host}:${port}/${database}) in stack ${env}; one physical database is one connection.`, { connection: connection.name, env });
      } else seen.set(triple, connection.name);
    }
    if (resolved) stacksChecked += 1; else stacksSkipped += 1;
  }

  return { violations, coverage: { status: 'checked', connections: declared.length, registrations, stacksChecked, stacksSkipped } };
}
