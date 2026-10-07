import path from 'node:path';
import { pascal } from './machine-ast.mjs';
import { DATABASE_DIR } from './connection-map.mjs';

const camel = name => { const text = pascal(name); return text[0].toLowerCase() + text.slice(1); };

const unparenWhile = (node, isWrapper) => {
  let current = node;
  while (current && isWrapper(current)) current = current.expression;
  return current;
};

const isExpressionWrapper = (ts, node) => ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isNonNullExpression(node);

const unparenRegistration = (ts, node) => unparenWhile(node, current => isExpressionWrapper(ts, current) || ts.isSatisfiesExpression?.(current));

const returnedExpression = (ts, declaration) => {
  const fn = ts.isVariableDeclaration(declaration) && declaration.initializer ? unparenRegistration(ts, declaration.initializer) : declaration;
  if (!(ts.isArrowFunction(fn) || ts.isFunctionDeclaration(fn) || ts.isFunctionExpression(fn) || ts.isMethodDeclaration(fn)) || !fn.body) return null;
  if (!ts.isBlock(fn.body)) return fn.body;
  const statements = fn.body.statements.filter(ts.isReturnStatement);
  return statements.length === 1 ? statements[0].expression ?? null : null;
};

/** Every `name:` property assignment of an object literal over the program: [{declaration, initializer, checker}], memoised per name. */
const assignmentsOf = (ctx, name) => {
  if (ctx.propertySources.has(name)) return ctx.propertySources.get(name);
  const { kit } = ctx;
  const { ts } = kit;
  const list = [];
  for (const file of ctx.graph.files.values()) {
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
  ctx.propertySources.set(name, list);
  return list;
};

const nameOfLiteral = (ctx, checker, literal, depth) => {
  const { kit } = ctx;
  const own = kit.propertyOf(literal, 'name');
  if (own) return kit.stringValue(checker, kit.valueOfProperty(own));
  for (const property of literal.properties) {
    if (!kit.ts.isSpreadAssignment(property)) continue;
    const value = nameOfExpression(ctx, checker, property.expression, depth + 1);
    if (value) return value;
  }
  return null;
};

const nameFromCall = (ctx, checker, node, depth) => {
  const { kit } = ctx;
  for (const declaration of kit.declarationsOf(checker, node.expression)) {
    const body = returnedExpression(kit.ts, declaration);
    const value = body ? nameOfExpression(ctx, kit.checkerOf(declaration.getSourceFile()), body, depth + 1) : null;
    if (value) return value;
  }
  return null;
};

const nameFromIdentifier = (ctx, checker, node, depth) => {
  const { kit } = ctx;
  const declaration = kit.declarationsOf(checker, node)[0];
  return declaration && kit.ts.isVariableDeclaration(declaration) && declaration.initializer
    ? nameOfExpression(ctx, kit.checkerOf(declaration.getSourceFile()), declaration.initializer, depth + 1) : null;
};

const nameFromProperty = (ctx, checker, node, depth) => {
  const target = ctx.kit.declarationsOf(checker, node.name)[0];
  if (!target) return null;
  const names = new Set(assignmentsOf(ctx, node.name.text).filter(item => item.declaration === target)
    .map(item => nameOfExpression(ctx, item.checker, item.initializer, depth + 1)).filter(Boolean));
  return names.size === 1 ? [...names][0] : null;
};

function nameOfExpression(ctx, checker, expression, depth) {
  const { ts } = ctx.kit;
  const node = unparenRegistration(ts, expression);
  if (!node || depth > 5) return null;
  if (ts.isObjectLiteralExpression(node)) return nameOfLiteral(ctx, checker, node, depth);
  if (ts.isCallExpression(node)) return nameFromCall(ctx, checker, node, depth);
  if (ts.isIdentifier(node)) return nameFromIdentifier(ctx, checker, node, depth);
  if (ts.isPropertyAccessExpression(node)) return nameFromProperty(ctx, checker, node, depth);
  return null;
}

const isCapabilityArray = (owner, name) => owner?.below.length === 1 && owner.below[0] === 'connection.ts' && [`${camel(owner.capability)}Entities`, `${camel(owner.capability)}Migrations`].includes(name);

const arrayDeclarationOf = (kit, checker, node) => {
  const { ts } = kit;
  const declaration = kit.declarationsOf(checker, ts.isPropertyAccessExpression(node) ? node.name : node)[0];
  return declaration && ts.isVariableDeclaration(declaration) && ts.isIdentifier(declaration.name) ? declaration : null;
};

/** The capability arrays (`<c>Entities` / `<c>Migrations` of persistence/connection.ts) an expression lists. */
function arraysIn(ctx, checker, expression, out, depth) {
  const { kit } = ctx;
  const { ts } = kit;
  const node = unparenRegistration(ts, expression);
  if (!node || depth > 6) return;
  if (ts.isArrayLiteralExpression(node)) {
    for (const element of node.elements) { arraysIn(ctx, checker, ts.isSpreadElement(element) ? element.expression : element, out, depth + 1); }
    return;
  }
  if (!ts.isIdentifier(node) && !ts.isPropertyAccessExpression(node)) return;
  const declaration = arrayDeclarationOf(kit, checker, node);
  if (!declaration) return;
  const rel = kit.graphPath(declaration);
  const owner = rel ? ctx.persistenceOf(rel) : null;
  if (isCapabilityArray(owner, declaration.name.text)) {
    out.push({ key: path.posix.dirname(owner.root), name: owner.capability });
  } else if (declaration.initializer) arraysIn(ctx, kit.checkerOf(declaration.getSourceFile()), declaration.initializer, out, depth + 1);
}

const registrationArrays = (ctx, checker, literal) => {
  const arrays = [];
  for (const key of ['entities', 'migrations']) {
    const property = ctx.kit.propertyOf(literal, key);
    if (property) arraysIn(ctx, checker, ctx.kit.valueOfProperty(property), arrays, 0);
  }
  return arrays;
};

const recordRegistration = (registered, arrays, connection, site) => {
  for (const { key, name } of new Map(arrays.map(item => [item.key, item])).values()) {
    if (!registered.has(key)) registered.set(key, { name, connections: new Map() });
    const sites = registered.get(key).connections;
    if (!sites.has(connection)) sites.set(connection, site);
  }
};

/**
 * Where the persistence arrays of every capability are registered: the object literals (`DatabaseModule.register` connections and the
 * migrate/cli app's) that list `<c>Entities` / `<c>Migrations` of a capability's `persistence/connection.ts` under a connection `name`.
 * The one walk BE_SCHEMA_OWNER and the bounded-context rules (R174 to R178) share, so a capability's context is decided once, by origin.
 *
 * @param {{kit: object, graph: object, persistenceOf: (rel: string) => ({root: string, capability: string, folder: string, below: string[]} | null)}} input
 * @returns {{registered: Map<string, {name: string, connections: Map<string, {file: object, node: object}>}>, registrations: number, all: Array<{file: object, node: object, connection: string | null}>}}
 *   `registered`: capability root -> its name and the connections it is registered on (first site each).
 */
export function collectRegistrations({ kit, graph, persistenceOf }) {
  const { ts } = kit;
  const ctx = { kit, graph, persistenceOf, propertySources: new Map() }; // property name -> [{declaration, initializer, checker}] over the program
  const all = []; // every registration literal: {file, node, connection | null when the name cannot be resolved}
  const registered = new Map(); // capability root -> {name, connections: Map(connection -> first site)}
  let registrations = 0;
  for (const file of graph.files.values()) {
    const checker = kit.checkerOf(file.sourceFile);
    kit.walk(file.sourceFile, node => {
      if (!ts.isObjectLiteralExpression(node)) return;
      const arrays = registrationArrays(ctx, checker, node);
      if (!arrays.length) return;
      registrations += 1;
      const connection = nameOfLiteral(ctx, checker, node, 0);
      all.push({ file, node, connection });
      if (connection !== null) recordRegistration(registered, arrays, connection, { file, node });
    });
  }
  return { registered, registrations, all };
}

const PERSISTENCE_SLOT = 'be.persistence';
/** The slot tiers whose capabilities belong to a bounded context: the domain and the projections (a projection is owned by the context whose connection holds its tables). */
const CONTEXT_TIERS = new Set(['domain', 'projections']);

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

/** The declared connection named by a decorator whose callee is declared in src/modules/platform/database/<conn>.decorators.ts, else null. */
const connectionOfDecorators = (kit, declared, checker, declaration) => {
  const { ts } = kit;
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

const managerTarget = (ts, node) => {
  if (ts.isPropertyAccessExpression(node)) return node.name;
  return ts.isIdentifier(node) ? node : null;
};

/** The receiver expression of the `.transaction(callback)` call whose first callback parameter is `declaration`, else null. */
const transactionReceiver = (ts, declaration) => {
  const callback = declaration.parent;
  if (!ts.isParameter(declaration) || !(ts.isArrowFunction(callback) || ts.isFunctionExpression(callback)) || callback.parameters[0] !== declaration) return null;
  const call = callback.parent;
  if (!ts.isCallExpression(call) || !call.arguments.includes(callback) || !ts.isPropertyAccessExpression(call.expression) || call.expression.name.text !== 'transaction') return null;
  return call.expression.expression;
};

/**
 * The declared connection whose entity manager `expression` is: a property or parameter injected with `Inject<Conn>EntityManager`, or the
 * manager parameter of the callback of a `.transaction(...)` on such a manager. Null when the origin cannot be proven (never guessed).
 */
function connectionOfManagerIn(kit, declared, checker, expression, depth = 0) {
  const { ts } = kit;
  const node = unparenWhile(expression, current => isExpressionWrapper(ts, current));
  if (!node || depth > 4) return null;
  const target = managerTarget(ts, node);
  if (!target) return null;
  const declaration = kit.declarationsOf(checker, target)[0];
  if (!declaration) return null;
  if (ts.isPropertyDeclaration(declaration) || ts.isParameter(declaration)) {
    const direct = connectionOfDecorators(kit, declared, checker, declaration);
    if (direct) return direct;
  }
  const receiver = transactionReceiver(ts, declaration);
  return receiver ? connectionOfManagerIn(kit, declared, checker, receiver, depth + 1) : null;
}

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
  /** The context of the capability owning `rel` when that capability is of a context tier (domain, projections), else null: only these are bounded contexts. */
  const contextOfFile = rel => {
    const file = graph.files.get(rel);
    if (!file?.owner || !CONTEXT_TIERS.has(file.tier)) return null;
    return contextOfCapability(file.owner.root);
  };
  const model = {
    declared, registered, registrations: all, perConnection, contextOfCapability, contextOfFile,
    connectionOfManager: (checker, expression) => connectionOfManagerIn(kit, declared, checker, expression),
    unparen: node => unparenWhile(node, current => isExpressionWrapper(ts, current)),
  };
  MODELS.set(graph, model);
  return model;
}

const composedConnection = (kit, declared, checker, inner) => {
  const { ts } = kit;
  const parent = inner.parent;
  if (parent?.name === inner && (ts.isPropertyAssignment(parent) || ts.isPropertyAccessExpression(parent))) return null;
  if (!(ts.isIdentifier(inner) || ts.isStringLiteralLike(inner) || ts.isPropertyAccessExpression(inner))) return null;
  const value = kit.stringValue(checker, inner);
  return value !== null && declared.has(value) ? value : null;
};

const collectComposedConnections = (kit, declared, checker, call, items) => {
  for (const argument of call.arguments) {
    kit.walk(argument, inner => {
      const value = composedConnection(kit, declared, checker, inner);
      if (value === null) return true;
      items.push({ connection: value, node: inner });
      return false;
    });
  }
};

/** The declared connection names the composition root of `app` passes to the database module registration, as [{connection, node}] in source order. */
export function connectionsComposedBy(kit, app) {
  const { ts } = kit;
  const root = kit.appRoot(app);
  if (!root) return { root: null, items: [] };
  const declared = new Set(kit.resolver.repo.connections.map(connection => connection.name));
  const checker = kit.checkerOf(root.sourceFile);
  const items = [];
  kit.walk(root.sourceFile, node => {
    if (!(ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'register')) return;
    const owner = kit.declarationsOf(checker, node.expression.expression).map(kit.ownerOfDeclaration).find(Boolean);
    if (owner?.tier !== 'platform' || owner.name !== 'database') return;
    collectComposedConnections(kit, declared, checker, node, items);
  });
  return { root, items };
}
