import path from 'node:path';
import { pascal } from './machine-ast.mjs';
import { DATABASE_DIR } from './connection-map.mjs';

const camel = name => { const text = pascal(name); return text[0].toLowerCase() + text.slice(1); };

/**
 * Where the persistence arrays of every capability are registered: the object literals (`DatabaseModule.register` connections and the
 * migrate/cli app's) that list `<c>Entities` / `<c>Migrations` of a capability's `persistence/connection.ts` under a connection `name`.
 * The one walk BE_SCHEMA_OWNER and the bounded-context rules (R131 to R135) share, so a capability's context is decided once, by origin.
 *
 * @param {{kit: object, graph: object, persistenceOf: (rel: string) => ({root: string, capability: string, folder: string, below: string[]} | null)}} input
 * @returns {{registered: Map<string, {name: string, connections: Map<string, {file: object, node: object}>}>, registrations: number, all: Array<{file: object, node: object, connection: string | null}>}}
 *   `registered`: capability root -> its name and the connections it is registered on (first site each).
 */
export function collectRegistrations({ kit, graph, persistenceOf }) {
  const { ts } = kit;
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
  const all = []; // every registration literal: {file, node, connection | null when the name cannot be resolved}
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
      all.push({ file, node, connection });
      if (connection === null) return true;
      for (const { key, name } of new Map(arrays.map(item => [item.key, item])).values()) {
        if (!registered.has(key)) registered.set(key, { name, connections: new Map() });
        const sites = registered.get(key).connections;
        if (!sites.has(connection)) sites.set(connection, { file, node });
      }
      return true;
    });
  }
  return { registered, registrations, all };
}

const PERSISTENCE_SLOT = 'be.persistence';

/** True for a platform capability the manifest lists as `perConnection` (its tables exist on every connection that uses it); `root` is the capability root. */
export const isPerConnection = (resolver, root, name) => root.split('/').includes('platform') && (resolver.slot(PERSISTENCE_SLOT)?.perConnection ?? []).includes(name);

/**
 * `persistenceOf(rel)`: {root, capability, folder, below} of a be.persistence file (`folder` the directory below persistence/, '' at its root),
 * null for any other file. `root` is the persistence root, its dirname the capability root.
 */
export const persistenceOfFactory = resolver => rel => {
  const classified = resolver.classifyPath(rel);
  if (classified.slot !== PERSISTENCE_SLOT) return null;
  const below = rel.slice(classified.root.length + 1).split('/');
  return { root: classified.root, capability: path.posix.basename(path.posix.dirname(classified.root)), folder: below.length > 1 ? below[0] : '', below };
};

/**
 * The bounded-context model of a program: which context (declared connection) each capability belongs to, and which connection an expression's
 * entity manager is. A context is a connection; a capability belongs to the one declared connection its persistence arrays are registered on
 * (collectRegistrations), a platform capability named by the manifest's `perConnection` list to none (it is infrastructure on every connection).
 * Everything is decided by declarations and origins: the registration literal, the `Inject<Conn>EntityManager` decorator's home file, the
 * transaction callback parameter's receiver. Nothing is matched by a variable name.
 */
const MODELS = new WeakMap();

export function contextModelOf(kit, graph) {
  if (MODELS.has(graph)) return MODELS.get(graph);
  const { ts, resolver } = kit;
  const persistenceOf = persistenceOfFactory(resolver);
  const declared = new Map(resolver.repo.connections.map(connection => [connection.name, connection]));
  const { registered, all } = collectRegistrations({ kit, graph, persistenceOf });
  const perConnection = new Set();
  const contextOfRoot = new Map(); // capability root -> declared connection name (single registration only)
  for (const [root, { name, connections }] of registered) {
    if (isPerConnection(resolver, root, name)) { perConnection.add(root); continue; }
    const names = [...connections.keys()].filter(connection => declared.has(connection));
    if (names.length === 1) contextOfRoot.set(root, names[0]);
  }
  /** The declared connection a capability root belongs to, or null (no registration, several, or a per-connection platform capability). */
  const contextOfCapability = root => contextOfRoot.get(root) ?? null;
  /** The context of the capability owning `rel` when that capability is a domain-tier one (domain or projection), else null: only these are bounded contexts. */
  const contextOfFile = rel => {
    const file = graph.files.get(rel);
    if (!file?.owner || file.tier !== 'domain') return null;
    return contextOfCapability(file.owner.root);
  };
  const unparen = node => { let current = node; while (current && (ts.isParenthesizedExpression(current) || ts.isAsExpression(current) || ts.isNonNullExpression(current))) current = current.expression; return current; };
  /** The declared connection named by a decorator whose callee is declared in src/modules/platform/database/<conn>.decorators.ts, else null. */
  const connectionOfDecorators = (checker, declaration) => {
    for (const decorator of kit.decorators(declaration)) {
      const callee = ts.isCallExpression(decorator.expression) ? decorator.expression.expression : decorator.expression;
      for (const target of kit.declarationsOf(checker, callee)) {
        const rel = kit.graphPath(target);
        const name = rel ? [...declared.keys()].find(connection => rel === `${DATABASE_DIR}/${connection}.decorators.ts`) : null;
        if (name) return name;
      }
    }
    return null;
  };
  /**
   * The declared connection whose entity manager `expression` is: a property or parameter injected with `Inject<Conn>EntityManager`, or the
   * manager parameter of the callback of a `.transaction(...)` on such a manager. Null when the origin cannot be proven (never guessed).
   */
  const connectionOfManager = (checker, expression, depth = 0) => {
    const node = unparen(expression);
    if (!node || depth > 4) return null;
    const target = ts.isPropertyAccessExpression(node) ? node.name : (ts.isIdentifier(node) ? node : null);
    if (!target) return null;
    const declaration = kit.declarationsOf(checker, target)[0];
    if (!declaration) return null;
    if (ts.isPropertyDeclaration(declaration) || ts.isParameter(declaration)) {
      const direct = connectionOfDecorators(checker, declaration);
      if (direct) return direct;
    }
    if (ts.isParameter(declaration) && (ts.isArrowFunction(declaration.parent) || ts.isFunctionExpression(declaration.parent)) && declaration.parent.parameters[0] === declaration) {
      const call = declaration.parent.parent;
      if (ts.isCallExpression(call) && call.arguments.includes(declaration.parent) && ts.isPropertyAccessExpression(call.expression) && call.expression.name.text === 'transaction') {
        return connectionOfManager(checker, call.expression.expression, depth + 1);
      }
    }
    return null;
  };
  const model = { declared, registered, registrations: all, perConnection, contextOfCapability, contextOfFile, connectionOfManager, unparen };
  MODELS.set(graph, model);
  return model;
}

/** The declared connection names the composition root of `app` passes to the database module registration, as [{connection, node}] in source order. */
export function connectionsComposedBy(kit, app) {
  const { ts } = kit;
  const root = kit.appRoot(app);
  if (!root) return { root: null, items: [] };
  const declared = new Set(kit.resolver.repo.connections.map(connection => connection.name));
  const checker = kit.checkerOf(root.sourceFile);
  const items = [];
  kit.walk(root.sourceFile, node => {
    if (!(ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'register')) return true;
    const owner = kit.declarationsOf(checker, node.expression.expression).map(kit.ownerOfDeclaration).find(Boolean);
    if (!owner || owner.tier !== 'platform' || owner.name !== 'database') return true;
    for (const argument of node.arguments) {
      kit.walk(argument, inner => {
        if (ts.isPropertyAssignment(inner.parent ?? {}) && inner.parent.name === inner) return true;
        if (ts.isPropertyAccessExpression(inner.parent ?? {}) && inner.parent.name === inner) return true;
        if (!(ts.isIdentifier(inner) || ts.isStringLiteralLike(inner) || ts.isPropertyAccessExpression(inner))) return true;
        const value = kit.stringValue(checker, inner);
        if (value === null || !declared.has(value)) return true;
        items.push({ connection: value, node: inner });
        return false;
      });
    }
    return true;
  });
  return { root, items };
}
