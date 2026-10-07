import path from 'node:path';
import { canonical } from './config.mjs';
import { referencedExports, relativePath, unwrapExpression } from './typescript.mjs';
import { commonJsRequireReasons, decoratorCallee, moduleExportsOf, mutableDecoratorKind, programSourcesOf, selectedNode, valueSymbol } from './ast-walks.mjs';
import { sourceLocation } from '../../lib/ts-ast.mjs';
import { byCodeUnit } from '../../lib/list.mjs';

const REGISTRATION_RULE_IDS = ['BE_MODULE_HANDLER_REGISTRATION', 'BE_MODULE_PROVIDER_REREGISTRATION'];
const FRAMEWORK = new Map([
  ['Module', '@nestjs/common'],
  ['CommandHandler', '@nestjs/cqrs'],
  ['QueryHandler', '@nestjs/cqrs'],
]);

function frameworkDecorator(ts, checker, decorator, targets) {
  const selected = selectedNode(ts, decoratorCallee(ts, decorator));
  if (!selected) return null;
  const symbol = valueSymbol(ts, checker, selected);
  for (const [name, target] of targets) if (symbol === target) return name;
  return null;
}

/* This module's framework map keys decorator names, not symbols - invert it (first name wins, as the old
 * `for...of` scan did) for the shared symbol-keyed lookup. */
const mutableFrameworkAlias = (ts, checker, decorator, targets) => {
  const bySymbol = new Map();
  for (const [name, symbol] of targets) if (!bySymbol.has(symbol)) bySymbol.set(symbol, name);
  return mutableDecoratorKind(ts, checker, decorator, bySymbol);
};

function collectFrameworkStatement(config, context, checker, sourceFile, statement, targets, reasons) {
  const bound = moduleExportsOf(context.ts, checker, statement);
  if (!bound || ![...FRAMEWORK.values()].includes(bound.specifier)) return;
  const expected = new Set([...FRAMEWORK].filter(([, packageName]) => packageName === bound.specifier).map(([name]) => name));
  const selected = referencedExports(context.ts, statement, expected);
  if (!selected.length) return;
  if (!bound.symbol) {
    reasons.push(`${relativePath(config.root, sourceFile.fileName)} cannot resolve ${bound.specifier}`);
    return;
  }
  for (const name of selected) {
    const target = bound.exports.get(name);
    if (!target) {
      reasons.push(`${relativePath(config.root, sourceFile.fileName)} cannot resolve ${name} from ${bound.specifier}`);
      continue;
    }
    targets.set(name, target);
  }
}

function frameworkTargets(config, context, checker, localFiles) {
  const targets = new Map();
  const reasons = [];
  const files = programSourcesOf(context, checker, localFiles);
  if (!files) return { targets, reasons: ['a TypeScript program checker could not be associated with its source'] };
  for (const sourceFile of files) {
    for (const statement of sourceFile.statements) collectFrameworkStatement(config, context, checker, sourceFile, statement, targets, reasons);
    commonJsRequireReasons(context.ts, checker, sourceFile, (specifier) => [...FRAMEWORK.values()].includes(specifier),
      reasons, relativePath(config.root, sourceFile.fileName), 'whose decorator identity cannot be proved', 'Nest framework binding');
  }
  return { targets, reasons };
}

function classToken(ts, checker, node, localFiles) {
  const symbol = valueSymbol(ts, checker, node);
  const declarations = (symbol?.getDeclarations?.() ?? []).filter(declaration => ts.isClassDeclaration(declaration)) ?? [];
  const local = declarations.filter(declaration => localFiles.has(canonical(declaration.getSourceFile().fileName)));
  const keys = [...new Set(local.map(declaration => `${canonical(declaration.getSourceFile().fileName)}#${declaration.getStart(declaration.getSourceFile())}`))];
  return { key: keys.length === 1 ? keys[0] : null, external: declarations.length > 0 && local.length === 0 };
}

function localClassKey(ts, checker, node, localFiles) {
  return classToken(ts, checker, node, localFiles).key;
}

function propertyName(ts, property) {
  if (!property.name) return null;
  if (ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name)) return property.name.text;
  return null;
}

function inspectTokenElement(ts, checker, element, localFiles, field, tokens) {
  if (ts.isSpreadElement(element)) return true;
  let key;
  let node = element;
  if (ts.isObjectLiteralExpression(element)) {
    if (element.properties.some(property => ts.isSpreadAssignment(property))) return true;
    const providers = element.properties.filter(property => propertyName(ts, property) === 'provide');
    if (providers.length !== 1 || !ts.isPropertyAssignment(providers[0])) return true;
    node = providers[0].initializer;
    key = localClassKey(ts, checker, node, localFiles);
  } else {
    const token = classToken(ts, checker, element, localFiles);
    key = token.key;
    if (!key) return field === 'providers' && !token.external;
  }
  if (key) {
    if (!tokens.has(key)) tokens.set(key, []);
    tokens.get(key).push(node);
  }
  return false;
}

function tokenEntries(ts, checker, initializer, localFiles, field) {
  initializer = unwrapExpression(ts, initializer);
  if (!ts.isArrayLiteralExpression(initializer)) return { tokens: new Map(), unknown: true };
  const tokens = new Map();
  let unknown = false;
  for (const element of initializer.elements) {
    if (inspectTokenElement(ts, checker, element, localFiles, field, tokens)) unknown = true;
  }
  return { tokens, unknown };
}

function metadataTokens(ts, checker, metadata, field, localFiles) {
  metadata = unwrapExpression(ts, metadata);
  if (!ts.isObjectLiteralExpression(metadata)) return { tokens: new Map(), unknown: true };
  if (metadata.properties.some(property => ts.isSpreadAssignment(property))) return { tokens: new Map(), unknown: true };
  const matches = metadata.properties.filter(property => propertyName(ts, property) === field);
  if (!matches.length) return { tokens: new Map(), unknown: false };
  if (matches.length !== 1 || !ts.isPropertyAssignment(matches[0])) return { tokens: new Map(), unknown: true };
  return tokenEntries(ts, checker, matches[0].initializer, localFiles, field);
}

function moduleRecord(config, context, sourceFile, declaration, decorator, checker, localFiles) {
  const call = decorator.expression;
  const location = declaration.name ?? declaration;
  const base = {
    key: declaration.name ? localClassKey(context.ts, checker, declaration.name, localFiles) : null,
    name: declaration.name?.text ?? '(anonymous)',
    path: relativePath(config.root, sourceFile.fileName),
    ...sourceLocation(sourceFile, location),
    providers: new Map(),
    exports: new Map(),
    unknown: false,
  };
  if (!context.ts.isCallExpression(call) || call.arguments.length !== 1 || !base.key) return { ...base, unknown: true };
  const providers = metadataTokens(context.ts, checker, call.arguments[0], 'providers', localFiles);
  const exports = metadataTokens(context.ts, checker, call.arguments[0], 'exports', localFiles);
  return { ...base, providers: providers.tokens, exports: exports.tokens, unknown: providers.unknown || exports.unknown };
}

function registrationFinding(module, node, ruleId, message, extra = {}) {
  return { ruleId, path: module.path, ...sourceLocation(node.getSourceFile(), node), module: module.name, message, ...extra };
}

const modulesByFileOf = (config, modules) => {
  const byFile = new Map();
  for (const module of modules) {
    const file = canonical(path.resolve(config.root, ...module.path.split('/')));
    if (!byFile.has(file)) byFile.set(file, []);
    byFile.get(file).push(module);
  }
  return byFile;
};

/** The modules whose file the runtime import edges reach from `rootFile`, in first-visit order; each is added to `bound`. */
const reachableModules = (context, byFile, rootFile, bound) => {
  const queue = [rootFile];
  const seen = new Set();
  const reachable = [];
  for (const file of queue) {
    if (seen.has(file)) continue;
    seen.add(file);
    for (const module of byFile.get(file) ?? []) {
      reachable.push(module);
      bound.add(module);
    }
    for (const edge of context.edges.get(file) ?? []) if (edge.runtime && !seen.has(edge.to)) queue.push(edge.to);
  }
  return reachable;
};

/** A module belongs to an app only when its runtime source is reachable from that app's composition root. */
function applicationGraphs(config, context, modules) {
  const roots = modules.filter(module => /^apps\/[^/]+\/src\/app\.module\.ts$/.test(module.path))
    .sort((a, b) => a.path.localeCompare(b.path));
  // Small architecture fixtures without app composition retain the original single-graph relation.
  if (!roots.length) return [modules];
  const byFile = modulesByFileOf(config, modules);
  const bound = new Set();
  const graphs = roots.map(root => reachableModules(context, byFile, canonical(path.resolve(config.root, ...root.path.split('/'))), bound));
  // A module outside every proven app graph can still contain a duplicate in its own metadata.
  return [...graphs, ...modules.filter(module => !bound.has(module)).map(module => [module])];
}

function decoratorKinds(ts, checker, node, framework) {
  const decorators = ts.canHaveDecorators(node) ? ts.getDecorators(node) ?? [] : node.decorators ?? [];
  return decorators.map(decorator => ({ decorator, kind: frameworkDecorator(ts, checker, decorator, framework.targets) }));
}

function recordMutableDecoratorReasons(config, ts, checker, sourceFile, kinds, framework, reasons) {
  for (const { decorator, kind } of kinds) {
    const dynamic = kind ? null : mutableFrameworkAlias(ts, checker, decorator, framework.targets);
    if (dynamic) reasons.push(`${relativePath(config.root, sourceFile.fileName)} uses mutable ${dynamic} decorator identity`);
  }
}

function recordModuleDecorator(config, context, sourceFile, node, checker, localFiles, kinds, modules, reasons) {
  const moduleDecorators = kinds.filter(item => item.kind === 'Module');
  if (moduleDecorators.length === 1) modules.push(moduleRecord(config, context, sourceFile, node, moduleDecorators[0].decorator, checker, localFiles));
  else if (moduleDecorators.length > 1) reasons.push(`${relativePath(config.root, sourceFile.fileName)} has multiple resolved @Module decorators`);
}

function recordHandlerDecorator(ts, config, sourceFile, node, checker, localFiles, kinds, handlers, reasons) {
  const handlerDecorators = kinds.filter(item => item.kind === 'CommandHandler' || item.kind === 'QueryHandler');
  if (handlerDecorators.length === 1) handlers.push({
    key: node.name ? localClassKey(ts, checker, node.name, localFiles) : null,
    name: node.name?.text ?? '(anonymous)',
    kind: handlerDecorators[0].kind,
    path: relativePath(config.root, sourceFile.fileName),
    ...sourceLocation(sourceFile, node.name ?? node),
  });
  else if (handlerDecorators.length > 1) reasons.push(`${relativePath(config.root, sourceFile.fileName)} has multiple resolved CQRS handler decorators`);
}

function inspectRegistrationClass(config, context, sourceFile, checker, localFiles, framework, node, modules, handlers, reasons) {
  const { ts } = context;
  if (!ts.isClassDeclaration(node)) return;
  const kinds = decoratorKinds(ts, checker, node, framework);
  recordMutableDecoratorReasons(config, ts, checker, sourceFile, kinds, framework, reasons);
  recordModuleDecorator(config, context, sourceFile, node, checker, localFiles, kinds, modules, reasons);
  recordHandlerDecorator(ts, config, sourceFile, node, checker, localFiles, kinds, handlers, reasons);
}

function discoverRegistrations(config, context, localFiles) {
  const modules = [];
  const handlers = [];
  const reasons = [];
  const frameworkByChecker = new Map();
  for (const sourceFile of context.files) {
    const checker = context.checkerFor(sourceFile.fileName);
    if (!frameworkByChecker.has(checker)) frameworkByChecker.set(checker, frameworkTargets(config, context, checker, localFiles));
    const framework = frameworkByChecker.get(checker);
    reasons.push(...framework.reasons);
    const visit = node => {
      inspectRegistrationClass(config, context, sourceFile, checker, localFiles, framework, node, modules, handlers, reasons);
      context.ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }
  return { modules, handlers, reasons };
}

function providerOwnersOf(modules) {
  const providerOwners = new Map();
  for (const module of modules) {
    for (const key of module.providers.keys()) {
      if (!module.exports.has(key)) continue;
      if (!providerOwners.has(key)) providerOwners.set(key, []);
      providerOwners.get(key).push(module);
    }
  }
  return providerOwners;
}

const byModulePath = (a, b) => a.module.path.localeCompare(b.module.path) || a.node.getStart() - b.node.getStart();

/** The registrations of `key` in a graph that follow the first one of its owner module: the owner registers it once, every other is a duplicate. */
const duplicateRegistrations = (graph, key, owner) => {
  const registrations = graph.flatMap(module => (module.providers.get(key) ?? []).map(node => ({ module, node })))
    .sort(byModulePath);
  let keptOwnerRegistration = false;
  return registrations.filter(registration => {
    if (registration.module !== owner || keptOwnerRegistration) return true;
    keptOwnerRegistration = true;
    return false;
  });
};

function reregistrationViolations(config, context, modules, providerOwners) {
  const violations = [];
  const reportedRegistrations = new Set();
  const report = (key, owner, duplicate) => {
    const identity = `${key}\0${duplicate.module.path}\0${duplicate.node.getStart()}`;
    if (reportedRegistrations.has(identity)) return;
    reportedRegistrations.add(identity);
    violations.push(registrationFinding(duplicate.module, duplicate.node,
      'BE_MODULE_PROVIDER_REREGISTRATION',
      `Class-token provider exported by ${owner.name} is registered again by ${duplicate.module.name} in one application graph; import the owning module and preserve one class-token registration.`,
      { ownerModule: owner.name, ownerPath: owner.path }));
  };
  for (const graph of applicationGraphs(config, context, modules)) for (const [key] of providerOwners) {
    const owners = graph.filter(module => module.providers.has(key) && module.exports.has(key))
      .sort((a, b) => a.path.localeCompare(b.path));
    if (!owners.length) continue;
    for (const duplicate of duplicateRegistrations(graph, key, owners[0])) report(key, owners[0], duplicate);
  }
  return violations;
}

function handlerRegistrationViolations(modules, handlers, selected) {
  const violations = [];
  for (const handler of handlers.filter(item => item.key && selected.handlerDecorators.includes(item.kind))) {
    const registrations = modules.flatMap(module => (module.providers.get(handler.key) ?? []).map(node => ({ module, node })));
    if (registrations.length !== 1) violations.push({
      ruleId: 'BE_MODULE_HANDLER_REGISTRATION', path: handler.path, line: handler.line, column: handler.column,
      handler: handler.name, decorator: handler.kind,
      message: registrations.length === 0
        ? `${handler.kind} ${handler.name} is not registered as a direct class-token provider in a resolved Nest module.`
        : `${handler.kind} ${handler.name} has multiple direct module registrations; one owner must preserve its handler identity.`,
      modules: registrations.map(registration => ({ name: registration.module.name, path: registration.module.path,
        ...sourceLocation(registration.node.getSourceFile(), registration.node) })),
    });
  }
  return violations;
}

/** Prove only static exported class-token identity and selected CQRS handler registration. */
export function checkModuleRegistration(config, context) {
  const selected = config.backend.moduleRegistration;
  if (!selected) return { violations: [], coverage: { status: 'unavailable', reason: 'hfs.json does not select Nest module-registration identity checks' } };
  const localFiles = new Set(context.files.map(file => canonical(file.fileName)));
  const { modules, handlers, reasons } = discoverRegistrations(config, context, localFiles);
  for (const module of modules) if (module.unknown) reasons.push(`${module.path} has dynamic or unresolvable @Module providers/exports metadata`);
  for (const handler of handlers) {
    if (!handler.key) reasons.push(`${handler.path} handler class identity is not resolvable`);
    if (!selected.handlerDecorators.includes(handler.kind)) reasons.push(`${handler.path} uses unselected ${handler.kind}`);
  }
  const providerOwners = providerOwnersOf(modules);
  const violations = reregistrationViolations(config, context, modules, providerOwners);
  violations.push(...handlerRegistrationViolations(modules, handlers, selected));
  const coverage = reasons.length
    ? { status: 'unavailable', reason: 'one or more Nest module-registration relations are not statically provable', details: [...new Set(reasons)].sort(byCodeUnit) }
    : { status: 'checked', modules: modules.length, exportedClassTokenProviders: providerOwners.size, handlers: handlers.length,
      selectedHandlerDecorators: selected.handlerDecorators };
  return { violations, coverage };
}

export { REGISTRATION_RULE_IDS };
