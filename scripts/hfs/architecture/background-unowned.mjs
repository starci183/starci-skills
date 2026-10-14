import path from 'node:path';
import { machineKit } from './machine-ast.mjs';

/**
 * R46 `background-unowned` (BE_BACKGROUND_UNOWNED, BE-CONVENTION 1.6 and 1.13). Background work is a transport that only
 * a worker or api app runs (an api app composes the message transport of its own service; a separate worker is opt-in):
 *
 *   - a processor, consumer, scheduler, saga or event handler is composed by an app of kind `worker` or `api`: its file is
 *     reachable, through runtime imports, from an app root declared in hfs.json. Context comes from its file role or framework
 *     decorators, never a method name. Infrastructure restrictions on scheduler libraries remain R90 BE_INFRA_OWNER's concern;
 *   - methods in those contexts, and methods they call transitively, are reachable from a composed background entry point:
 *     its imports and the files of its own feature (command handlers are registered with the bus). Platform mechanisms are
 *     exempt. Resolvers and controllers are user entry points and never background, even when called by a background method.
 *
 * Classification follows statically resolved calls; ownership follows runtime imports, re-exports and the entry point's feature.
 */
export const BACKGROUND_UNOWNED_RULE_IDS = ['BE_BACKGROUND_UNOWNED'];

const RULE = 'BE_BACKGROUND_UNOWNED';
const BACKGROUND_ROLES = new Set(['processor', 'consumer', 'scheduler', 'saga', 'event-handler']);
const USER_ROLES = new Set(['resolver', 'controller']);
const CLASS_DECORATORS = new Map([
  ['@nestjs/bull:Processor', 'processor'], ['@nestjs/bullmq:Processor', 'processor'],
  ['@nestjs/cqrs:EventsHandler', 'event-handler'],
]);
const METHOD_DECORATORS = new Map([
  ['@nestjs/cqrs:Saga', 'saga'], ['@nestjs/event-emitter:OnEvent', 'event-handler'],
  ...['Cron', 'Interval', 'Timeout'].map(name => [`@nestjs/schedule:${name}`, 'scheduler']),
]);
const USER_DECORATORS = new Map([['@nestjs/graphql:Resolver', 'resolver'], ['@nestjs/common:Controller', 'controller']]);

const roleOf = rel => {
  const parts = path.posix.basename(rel).split('.');
  return parts.length >= 3 && parts.at(-1) === 'ts' ? parts.at(-2) : null;
};

const decoratedRole = (kit, checker, node, roles) => {
  for (const decorator of kit.decorators(node)) {
    const expression = decorator.expression;
    const callee = kit.ts.isCallExpression(expression) ? expression.expression : expression;
    const binding = kit.importBinding(checker, callee);
    const role = binding ? roles.get(`${binding.module}:${binding.name}`) : null;
    if (role) return role;
  }
  return null;
};

const adjacencyOf = edges => {
  const adjacency = new Map();
  for (const edge of edges) {
    if (!edge.runtime) continue;
    if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
    adjacency.get(edge.from).push(edge.to);
  }
  return adjacency;
};

const closureOf = (adjacency, starts) => {
  const seen = new Set(starts);
  const queue = [...starts];
  while (queue.length) {
    for (const next of adjacency.get(queue.shift()) ?? []) {
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return seen;
};

const appRootsOf = (apps, graph) => {
  const rootOf = app => `apps/${app.name}/src/app.module.ts`;
  const workers = apps.filter(app => app.kind === 'worker').map(rootOf).filter(rel => graph.files.has(rel));
  const services = apps.filter(app => app.kind === 'api').map(rootOf).filter(rel => graph.files.has(rel));
  return { workers, composed: [...workers, ...services] };
};

const reportUncomposedFiles = (background, composed, workerRoots, report) => {
  for (const { file, role } of background) {
    if (file.tier === 'platform' || composed.has(file.rel)) continue;
    report(file, file.sourceFile, `${file.rel} is a ${role} that no service app composes${workerRoots.length ? '' : ' (hfs.json declares no worker app)'}; its module must be imported by the root module of an app of kind worker or api.`, { role });
  }
};

const rootsOfRunningFeatures = (running, files) => {
  const roots = new Set();
  for (const { file } of running) {
    roots.add(file.rel);
    const owner = file.owner?.root;
    if (owner) for (const other of files.values()) if (other.owner?.root === owner) roots.add(other.rel);
  }
  return roots;
};

const callableKey = (kit, node) => `${kit.graphPath(node)}:${node.getStart()}`;
const callableBody = (ts, declaration) => {
  const node = declaration.initializer ?? declaration;
  return ts.isFunctionLike(node) && node.body ? node : null;
};
const methodMember = (ts, node) => {
  if (ts.isMethodDeclaration(node)) return node;
  return ts.isPropertyDeclaration(node.parent) && node.parent.initializer === node ? node.parent : null;
};

const isUserClass = (kit, checker, node) => USER_ROLES.has(roleOf(kit.graphPath(node) ?? ''))
  || Boolean(decoratedRole(kit, checker, node, USER_DECORATORS));

const seedClass = (scope, file, checker, node, role) => {
  scope.background.set(file.rel, { file, role });
  scope.contextFiles.add(file.rel);
  for (const symbol of checker.getTypeAtLocation(node).getProperties()) {
    for (const declaration of symbol.declarations ?? []) {
      const body = callableBody(scope.kit.ts, declaration);
      if (body) scope.inherited.push(body);
    }
  }
};

const classContext = (scope, file, checker, node, state) => {
  const user = state.user || isUserClass(scope.kit, checker, node);
  if (!state.nested && user) scope.userFiles.add(file.rel);
  let classRole = null;
  if (!state.nested && !user) {
    const fileRole = BACKGROUND_ROLES.has(state.fileRole) ? state.fileRole : null;
    classRole = decoratedRole(scope.kit, checker, node, CLASS_DECORATORS) ?? fileRole;
  }
  if (classRole) seedClass(scope, file, checker, node, classRole);
  return { ...state, user, classRole };
};

const recordCallable = (scope, file, checker, node, state) => {
  const { kit } = scope;
  const member = methodMember(kit.ts, node);
  const canSeed = member && !state.user && !state.nested;
  const role = canSeed ? decoratedRole(kit, checker, member, METHOD_DECORATORS) ?? state.classRole : null;
  const entry = { file, node, checker, user: state.user, member, name: member ? kit.propertyNameText(member.name) : null };
  scope.callables.set(callableKey(kit, node), entry);
  if (role) {
    scope.background.set(file.rel, { file, role });
    scope.contextFiles.add(file.rel);
    scope.seeds.push(entry);
  }
};

const indexCallables = (scope, file, checker, node, state) => {
  const { ts } = scope.kit;
  if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) state = classContext(scope, file, checker, node, state);
  const callable = ts.isFunctionLike(node);
  if (callable && node.body) recordCallable(scope, file, checker, node, state);
  const childState = { ...state, nested: state.nested || callable };
  ts.forEachChild(node, child => indexCallables(scope, file, checker, child, childState));
};

/** Index callable bodies once; a resolver/controller is a barrier to background propagation. */
const backgroundContextOf = (graph, kit) => {
  const callables = new Map();
  const background = new Map();
  const seeds = [];
  const inherited = [];
  const scope = { kit, callables, background, seeds, inherited, userFiles: new Set(), contextFiles: new Set() };
  for (const file of graph.files.values()) {
    const checker = kit.checkerOf(file.sourceFile);
    const fileRole = roleOf(file.rel);
    if (BACKGROUND_ROLES.has(fileRole)) background.set(file.rel, { file, role: fileRole });
    indexCallables(scope, file, checker, file.sourceFile, { fileRole, classRole: null, user: USER_ROLES.has(fileRole), nested: false });
  }
  // Request context overrides a file suffix; mixed files can still hold a separate background class.
  for (const rel of scope.userFiles) if (!scope.contextFiles.has(rel)) background.delete(rel);
  for (const body of inherited) {
    const entry = callables.get(callableKey(kit, body));
    if (entry) seeds.push(entry);
  }
  return { callables, background: [...background.values()], seeds };
};

const calledBodies = (kit, checker, call) => {
  const { ts } = kit;
  const expression = call.expression;
  if (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression)) {
    const receiver = checker.getNonNullableType(checker.getTypeAtLocation(expression.expression));
    if (receiver.getSymbol()?.declarations?.some(declaration => isUserClass(kit, checker, declaration))) return [];
  }
  const target = ts.isPropertyAccessExpression(expression) ? expression.name : expression;
  const declarations = [...kit.declarationsOf(checker, target)];
  const signature = checker.getResolvedSignature(call)?.declaration;
  if (signature) declarations.push(signature);
  return declarations.map(declaration => callableBody(ts, declaration)).filter(Boolean);
};

const checkBackgroundMethods = ({ kit, context, reachable, report }) => {
  const { callables, seeds } = context;
  const seen = new Set();
  const queue = [...seeds];
  let methods = 0;
  while (queue.length) {
    const entry = queue.pop();
    const { file, node, checker, user, member, name } = entry;
    const key = callableKey(kit, node);
    if (user || seen.has(key)) continue;
    seen.add(key);
    if (name && file.tier !== 'platform') {
      methods += 1;
      if (!reachable.has(file.rel)) report(file, member.name, `${name} is background work that no background entry point composed by a worker or api app can reach. Compose the processor, consumer, scheduler, saga or event handler that runs it in a worker or api app.`, { method: name });
    }
    kit.walk(node.body, inner => {
      // Nested bodies run only through a resolved call or when passed as a callback.
      if (kit.ts.isFunctionLike(inner) || kit.ts.isClassDeclaration(inner) || kit.ts.isClassExpression(inner)) return false;
      if (!kit.ts.isCallExpression(inner)) return;
      const callbacks = inner.arguments.filter(argument => kit.ts.isArrowFunction(argument) || kit.ts.isFunctionExpression(argument));
      for (const body of [...calledBodies(kit, checker, inner), ...callbacks]) {
        const called = callables.get(callableKey(kit, body));
        if (called) queue.push(called);
      }
    });
  }
  return methods;
};

export function checkBackgroundUnowned(input) {
  const { graph } = input;
  const kit = machineKit(input);
  const { resolver } = kit;
  const violations = [];
  const report = (file, node, message, extra = {}) => violations.push({ ruleId: RULE, path: file.rel, ...kit.at(file.rel, file.sourceFile, node), message, ...extra });

  const adjacency = adjacencyOf(graph.edges);
  const closure = starts => closureOf(adjacency, starts);
  const { workers: workerRoots, composed: appRoots } = appRootsOf(resolver.repo.apps, graph);
  const composed = closure(appRoots);
  const context = backgroundContextOf(graph, kit);
  const { background } = context;
  const running = background.filter(({ file }) => composed.has(file.rel));
  reportUncomposedFiles(background, composed, workerRoots, report);

  // Everything a composed background entry point can reach: its imports and its own feature's command handlers.
  const roots = rootsOfRunningFeatures(running, graph.files);
  const reachable = closure([...roots]);
  const methods = checkBackgroundMethods({ kit, context, reachable, report });
  return { violations, coverage: { status: 'checked', workers: workerRoots.length, jobsAndConsumers: background.length, composed: running.length, backgroundMethods: methods } };
}
