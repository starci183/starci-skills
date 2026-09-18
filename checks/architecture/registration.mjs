import fs from 'node:fs';
import path from 'node:path';
import { isUnshadowedCommonJsRequire, relativePath, sourceLocation } from './typescript.mjs';

const REGISTRATION_RULE_IDS = ['BE_MODULE_HANDLER_REGISTRATION', 'BE_MODULE_PROVIDER_REREGISTRATION'];
const FRAMEWORK = new Map([
  ['Module', '@nestjs/common'],
  ['CommandHandler', '@nestjs/cqrs'],
  ['QueryHandler', '@nestjs/cqrs'],
]);

function canonical(file) {
  const absolute = path.resolve(file);
  try { return path.resolve(fs.realpathSync(absolute)); } catch { return absolute; }
}

function normalizedSymbolValue(ts, checker, value) {
  let symbol = value ?? null;
  const seen = new Set();
  while (symbol && (symbol.flags & ts.SymbolFlags.Alias) && !seen.has(symbol)) {
    seen.add(symbol);
    const target = checker.getAliasedSymbol(symbol);
    if (!target || target === symbol) break;
    symbol = target;
  }
  return symbol;
}

function normalizedSymbol(ts, checker, node) {
  return normalizedSymbolValue(ts, checker, checker?.getSymbolAtLocation(node) ?? null);
}

function valueSymbol(ts, checker, node, seen = new Set()) {
  const selected = selectedNode(ts, node) ?? node;
  const symbol = normalizedSymbol(ts, checker, selected);
  if (!symbol || seen.has(symbol)) return symbol;
  seen.add(symbol);
  const declarations = symbol.getDeclarations?.() ?? [];
  if (declarations.length === 1 && ts.isVariableDeclaration(declarations[0]) && declarations[0].initializer
    && (ts.getCombinedNodeFlags(declarations[0].parent) & ts.NodeFlags.Const)) {
    return valueSymbol(ts, checker, declarations[0].initializer, seen);
  }
  return symbol;
}

function calledExpression(ts, decorator) {
  const expression = decorator.expression;
  return ts.isCallExpression(expression) ? expression.expression : expression;
}

function unwrapExpression(ts, expression) {
  while (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression)
    || ts.isNonNullExpression(expression) || (ts.isSatisfiesExpression?.(expression) ?? false)) expression = expression.expression;
  return expression;
}

function selectedNode(ts, expression) {
  expression = unwrapExpression(ts, expression);
  if (ts.isIdentifier(expression)) return expression;
  if (ts.isPropertyAccessExpression(expression)) return expression.name;
  if (ts.isElementAccessExpression(expression) && ts.isStringLiteralLike(expression.argumentExpression)) return expression.argumentExpression;
  return null;
}

function frameworkDecorator(ts, checker, decorator, targets) {
  const selected = selectedNode(ts, calledExpression(ts, decorator));
  if (!selected) return null;
  const symbol = valueSymbol(ts, checker, selected);
  for (const [name, target] of targets) if (symbol === target) return name;
  return null;
}

function mutableFrameworkAlias(ts, checker, decorator, targets) {
  const selected = selectedNode(ts, calledExpression(ts, decorator));
  const symbol = selected ? normalizedSymbol(ts, checker, selected) : null;
  const declarations = symbol?.getDeclarations?.() ?? [];
  if (declarations.length !== 1 || !ts.isVariableDeclaration(declarations[0]) || !declarations[0].initializer
    || (ts.getCombinedNodeFlags(declarations[0].parent) & ts.NodeFlags.Const)) return null;
  const target = valueSymbol(ts, checker, declarations[0].initializer);
  for (const [name, expected] of targets) if (target === expected) return name;
  return null;
}

function referencedExports(ts, statement, expected) {
  if (ts.isImportDeclaration(statement)) {
    const bindings = statement.importClause?.namedBindings;
    if (!bindings || ts.isNamespaceImport(bindings)) return bindings ? [...expected] : [];
    return bindings.elements.map(element => element.propertyName?.text ?? element.name.text).filter(name => expected.has(name));
  }
  if (ts.isExportDeclaration(statement)) {
    if (!statement.exportClause || ts.isNamespaceExport(statement.exportClause)) return [...expected];
    return statement.exportClause.elements.map(element => element.propertyName?.text ?? element.name.text).filter(name => expected.has(name));
  }
  return [...expected];
}

function frameworkTargets(config, context, checker, localFiles) {
  const targets = new Map();
  const reasons = [];
  const program = context.programs.find(candidate => candidate.getTypeChecker() === checker);
  if (!program) return { targets, reasons: ['a TypeScript program checker could not be associated with its source'] };
  for (const sourceFile of program.getSourceFiles()) {
    if (!localFiles.has(canonical(sourceFile.fileName))) continue;
    for (const statement of sourceFile.statements) {
      const moduleSpecifier = (context.ts.isImportDeclaration(statement) || context.ts.isExportDeclaration(statement))
        && statement.moduleSpecifier && context.ts.isStringLiteralLike(statement.moduleSpecifier) ? statement.moduleSpecifier : null;
      const importEquals = context.ts.isImportEqualsDeclaration(statement) && context.ts.isExternalModuleReference(statement.moduleReference)
        && statement.moduleReference.expression && context.ts.isStringLiteralLike(statement.moduleReference.expression)
        ? statement.moduleReference.expression : null;
      const specifier = (moduleSpecifier ?? importEquals)?.text;
      if (!specifier || ![...FRAMEWORK.values()].includes(specifier)) continue;
      const expected = new Set([...FRAMEWORK].filter(([, packageName]) => packageName === specifier).map(([name]) => name));
      const selected = referencedExports(context.ts, statement, expected);
      if (!selected.length) continue;
      const moduleSymbol = checker.getSymbolAtLocation(moduleSpecifier ?? importEquals);
      if (!moduleSymbol) {
        reasons.push(`${relativePath(config.root, sourceFile.fileName)} cannot resolve ${specifier}`);
        continue;
      }
      const exports = new Map(checker.getExportsOfModule(moduleSymbol).map(symbol => [symbol.getName(), normalizedSymbolValue(context.ts, checker, symbol)]));
      for (const name of selected) {
        const target = exports.get(name);
        if (target) targets.set(name, target);
        else reasons.push(`${relativePath(config.root, sourceFile.fileName)} cannot resolve ${name} from ${specifier}`);
      }
    }
    const visitRequire = node => {
      if (context.ts.isCallExpression(node) && isUnshadowedCommonJsRequire(context.ts, checker, node.expression)
        && node.arguments.length === 1 && context.ts.isStringLiteralLike(node.arguments[0])
        && [...FRAMEWORK.values()].includes(node.arguments[0].text)) {
        reasons.push(`${relativePath(config.root, sourceFile.fileName)} uses a CommonJS Nest framework binding whose decorator identity cannot be proved`);
      }
      context.ts.forEachChild(node, visitRequire);
    };
    visitRequire(sourceFile);
  }
  return { targets, reasons };
}

function classToken(ts, checker, node, localFiles) {
  const symbol = valueSymbol(ts, checker, node);
  const declarations = symbol?.getDeclarations?.().filter(declaration => ts.isClassDeclaration(declaration)) ?? [];
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

function tokenEntries(ts, checker, initializer, localFiles, field) {
  initializer = unwrapExpression(ts, initializer);
  if (!ts.isArrayLiteralExpression(initializer)) return { tokens: new Map(), unknown: true };
  const tokens = new Map();
  let unknown = false;
  const add = (key, node) => {
    if (!tokens.has(key)) tokens.set(key, []);
    tokens.get(key).push(node);
  };
  for (const element of initializer.elements) {
    if (ts.isSpreadElement(element)) { unknown = true; continue; }
    if (ts.isObjectLiteralExpression(element)) {
      if (element.properties.some(property => ts.isSpreadAssignment(property))) { unknown = true; continue; }
      const providers = element.properties.filter(property => propertyName(ts, property) === 'provide');
      if (providers.length !== 1 || !ts.isPropertyAssignment(providers[0])) { unknown = true; continue; }
      const key = localClassKey(ts, checker, providers[0].initializer, localFiles);
      if (key) add(key, providers[0].initializer);
      continue;
    }
    const token = classToken(ts, checker, element, localFiles);
    if (token.key) add(token.key, element);
    else if (field === 'providers' && !token.external) unknown = true;
  }
  return { tokens, unknown };
}

function metadataTokens(ts, checker, metadata, field, localFiles) {
  metadata = unwrapExpression(ts, metadata);
  if (!ts.isObjectLiteralExpression(metadata)) return { tokens: new Map(), unknown: true };
  const matches = metadata.properties.filter(property => propertyName(ts, property) === field);
  const hasSpread = metadata.properties.some(property => ts.isSpreadAssignment(property));
  if (!matches.length) return { tokens: new Map(), unknown: hasSpread };
  if (matches.length !== 1 || !ts.isPropertyAssignment(matches[0])) return { tokens: new Map(), unknown: true };
  // A spread that occurs BEFORE the explicit field in source order (`{...base, providers: [...]}`) cannot
  // shadow it - object-literal evaluation is left to right, so the later, explicit `providers:` always
  // wins and is exactly what nivo's own `static register(): DynamicModule { const base = super.register
  // (options); return {...base, providers: [...base.providers ?? [], Handler]}; }` pattern relies on. A
  // spread AFTER the field could still silently override it, so that case is still `unknown`.
  const matchIndex = metadata.properties.indexOf(matches[0]);
  const shadowedBySpread = metadata.properties.some((property, index) => ts.isSpreadAssignment(property) && index > matchIndex);
  if (shadowedBySpread) return { tokens: new Map(), unknown: true };
  return tokenEntries(ts, checker, matches[0].initializer, localFiles, field);
}

/** A static method declaration on `declaration` literally named `name` (e.g. a ConfigurableModuleBuilder
 * capability's own `static register(options): DynamicModule { ... }`), or null if there isn't one. */
function staticMethod(ts, declaration, name) {
  return declaration.members.find(member => ts.isMethodDeclaration(member) && member.name
    && (ts.isIdentifier(member.name) || ts.isStringLiteralLike(member.name)) && member.name.text === name
    && ts.canHaveModifiers(member) && (ts.getModifiers(member) ?? []).some(modifier => modifier.kind === ts.SyntaxKind.StaticKeyword)) ?? null;
}

/** Every `return <expr>` inside `method`'s own body, not crossing into a nested function's body. */
function methodReturnExpressions(ts, method) {
  const results = [];
  const visit = node => {
    if (ts.isReturnStatement(node)) { if (node.expression) results.push(node.expression); return; }
    if (node !== method && (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node)
      || ts.isMethodDeclaration(node) || ts.isGetAccessor(node) || ts.isSetAccessor(node))) return;
    ts.forEachChild(node, visit);
  };
  if (method.body) visit(method.body);
  return results;
}

function mergeTokens(into, from) {
  for (const [key, nodes] of from) {
    if (!into.has(key)) into.set(key, []);
    into.get(key).push(...nodes);
  }
}

/**
 * Reads a Nest module's providers/exports from its `@Module({...})` decorator argument AND, when the
 * class declares its own `static register(...)` (nivo's `ConfigurableModuleBuilder` capability-module
 * convention - see `agent-workspace-operations.module.ts`: `@Module({}) export class X extends
 * ConfigurableModuleClass { static register(): DynamicModule { ...; return {...base, providers:[...]} }
 * }`), from that method's own returned object literal too. A module using this convention always
 * declares an empty (or near-empty) decorator argument and assembles its real metadata inside
 * `register()`; reading only the decorator argument made every such module look like it registered no
 * providers at all, which produced a false BE_MODULE_HANDLER_REGISTRATION violation on nivo's own shape.
 */
function moduleRecord(config, context, sourceFile, declaration, decorator, checker, localFiles) {
  const ts = context.ts;
  const call = decorator.expression;
  const location = declaration.name ?? declaration;
  const base = {
    key: declaration.name ? localClassKey(ts, checker, declaration.name, localFiles) : null,
    name: declaration.name?.text ?? '(anonymous)',
    path: relativePath(config.root, sourceFile.fileName),
    ...sourceLocation(sourceFile, location),
    providers: new Map(),
    exports: new Map(),
    unknown: false,
  };
  if (!ts.isCallExpression(call) || call.arguments.length !== 1 || !base.key) return { ...base, unknown: true };
  const providers = metadataTokens(ts, checker, call.arguments[0], 'providers', localFiles);
  const exportsFound = metadataTokens(ts, checker, call.arguments[0], 'exports', localFiles);
  const providerTokens = providers.tokens;
  const exportTokens = exportsFound.tokens;
  let unknown = providers.unknown || exportsFound.unknown;

  const registerMethod = staticMethod(ts, declaration, 'register');
  if (registerMethod) {
    const returns = methodReturnExpressions(ts, registerMethod);
    if (returns.length !== 1) unknown = true;
    else {
      const literal = unwrapExpression(ts, returns[0]);
      const extraProviders = metadataTokens(ts, checker, literal, 'providers', localFiles);
      const extraExports = metadataTokens(ts, checker, literal, 'exports', localFiles);
      mergeTokens(providerTokens, extraProviders.tokens);
      mergeTokens(exportTokens, extraExports.tokens);
      unknown = unknown || extraProviders.unknown || extraExports.unknown;
    }
  }
  return { ...base, providers: providerTokens, exports: exportTokens, unknown };
}

function registrationFinding(module, node, ruleId, message, extra = {}) {
  return { ruleId, path: module.path, ...sourceLocation(node.getSourceFile(), node), module: module.name, message, ...extra };
}

/** Prove only static exported class-token identity and selected CQRS handler registration. */
export function checkModuleRegistration(config, context) {
  const selected = config.backend.moduleRegistration;
  if (!selected) return { violations: [], coverage: { status: 'unavailable', reason: 'architecture.json does not select Nest module-registration identity checks' } };
  const ts = context.ts;
  const localFiles = new Set(context.files.map(file => canonical(file.fileName)));
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
      if (ts.isClassDeclaration(node)) {
        const decorators = ts.canHaveDecorators(node) ? ts.getDecorators(node) ?? [] : node.decorators ?? [];
        const recognized = decorators.map(decorator => ({ decorator, kind: frameworkDecorator(ts, checker, decorator, framework.targets) })).filter(item => item.kind);
        for (const decorator of decorators) {
          const dynamic = frameworkDecorator(ts, checker, decorator, framework.targets) ? null
            : mutableFrameworkAlias(ts, checker, decorator, framework.targets);
          if (dynamic) reasons.push(`${relativePath(config.root, sourceFile.fileName)} uses mutable ${dynamic} decorator identity`);
        }
        const moduleDecorators = recognized.filter(item => item.kind === 'Module');
        if (moduleDecorators.length === 1) modules.push(moduleRecord(config, context, sourceFile, node, moduleDecorators[0].decorator, checker, localFiles));
        else if (moduleDecorators.length > 1) reasons.push(`${relativePath(config.root, sourceFile.fileName)} has multiple resolved @Module decorators`);
        const handlerDecorators = recognized.filter(item => item.kind === 'CommandHandler' || item.kind === 'QueryHandler');
        if (handlerDecorators.length === 1) handlers.push({
          key: node.name ? localClassKey(ts, checker, node.name, localFiles) : null,
          name: node.name?.text ?? '(anonymous)',
          kind: handlerDecorators[0].kind,
          path: relativePath(config.root, sourceFile.fileName),
          ...sourceLocation(sourceFile, node.name ?? node),
        });
        else if (handlerDecorators.length > 1) reasons.push(`${relativePath(config.root, sourceFile.fileName)} has multiple resolved CQRS handler decorators`);
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }
  for (const module of modules) if (module.unknown) reasons.push(`${module.path} has dynamic or unresolvable @Module providers/exports metadata`);
  for (const handler of handlers) {
    if (!handler.key) reasons.push(`${handler.path} handler class identity is not resolvable`);
    if (!selected.handlerDecorators.includes(handler.kind)) reasons.push(`${handler.path} uses unselected ${handler.kind}`);
  }
  const violations = [];
  const providerOwners = new Map();
  for (const module of modules) for (const key of module.providers.keys()) if (module.exports.has(key)) {
    if (!providerOwners.has(key)) providerOwners.set(key, []);
    providerOwners.get(key).push(module);
  }
  for (const [key, owners] of providerOwners) {
    const orderedOwners = [...owners].sort((a, b) => a.path.localeCompare(b.path));
    const owner = orderedOwners[0];
    const registrations = modules.flatMap(module => (module.providers.get(key) ?? []).map(node => ({ module, node })))
      .sort((a, b) => a.module.path.localeCompare(b.module.path) || a.node.getStart() - b.node.getStart());
    let keptOwnerRegistration = false;
    for (const duplicate of registrations.filter(registration => {
      if (registration.module !== owner || keptOwnerRegistration) return true;
      keptOwnerRegistration = true;
      return false;
    })) violations.push(registrationFinding(duplicate.module, duplicate.node,
      'BE_MODULE_PROVIDER_REREGISTRATION',
      `Class-token provider exported by ${owner.name} is registered again by ${duplicate.module.name}; import the owning module and preserve one class-token registration.`,
      { ownerModule: owner.name, ownerPath: owner.path }));
  }
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
  const coverage = reasons.length
    ? { status: 'unavailable', reason: 'one or more Nest module-registration relations are not statically provable', details: [...new Set(reasons)].sort() }
    : { status: 'checked', modules: modules.length, exportedClassTokenProviders: providerOwners.size, handlers: handlers.length,
      selectedHandlerDecorators: selected.handlerDecorators };
  return { violations, coverage };
}

export { REGISTRATION_RULE_IDS };
