import path from 'node:path';
import { isInside } from './config.mjs';
import { relativePath, unwrapExpression } from './typescript.mjs';
import { commonJsRequireReasons, decoratorCallee, moduleExportsOf, nodeDecorators, normalizedSymbol, normalizedSymbolValue, programSourcesOf, returnedExpressions, selectedNode, valueSymbol, violation } from './ast-walks.mjs';
import { createBackendSourceShapeChecker } from './source-names-shape.mjs';

const SOURCE_LAYOUT_RULE_ID = 'BE_FEATURE_LAYOUT_INVALID';
const SOURCE_NAME_RULE_ID = 'BE_SOURCE_FORM';
const FRAMEWORK_EXPORTS = new Map([
  ['@nestjs/graphql', new Set(['Args', 'ArgsType', 'InputType', 'Mutation', 'ObjectType', 'Query', 'registerEnumType'])],
  ['typeorm', new Set(['Entity', 'EntitySchema', 'MigrationInterface', 'ViewEntity'])],
]);
const APPLICATION_ROLES = new Set(['command', 'contracts', 'handler', 'query']);
const TRANSPORT_ROLES = new Set(['args', 'cli', 'consumer', 'controller', 'gateway', 'input', 'processor', 'request', 'resolver', 'response', 'type']);
const APPLICATION_LAYER_ROLES = new Set([...APPLICATION_ROLES, 'mapper']);
const TRANSPORT_LAYER_ROLES = new Set([...TRANSPORT_ROLES, 'enum', 'filter', 'guard', 'interceptor', 'mapper']);
// Class-bearing roles of the CLOSED suffix list of BE-CONVENTION 1.15 (class name = PascalCase of file + role). A role that is
// not in that list (adapter, exception, provider, repository, strategy, use-case) is never an allowed role here.
const CLASS_ROLE_SUFFIX = new Map([
  ['args', 'Args'], ['cli', 'Cli'], ['client', 'Client'], ['command', 'Command'], ['consumer', 'Consumer'],
  ['controller', 'Controller'], ['entity', 'Entity'], ['error', 'Error'], ['filter', 'Filter'], ['gateway', 'Gateway'],
  ['guard', 'Guard'], ['handler', 'Handler'], ['input', 'Input'], ['interceptor', 'Interceptor'], ['processor', 'Processor'], ['event', 'Event'], ['queue', 'Queue'],
  ['projection', 'Projection'], ['projection-entity', 'ProjectionEntity'], ['step', 'Step'], ['mapper', 'Mapper'], ['module', 'Module'], ['module-definition', 'Module'], ['policy', 'Policy'], ['query', 'Query'],
  ['request', 'Request'], ['resolver', 'Resolver'], ['response', 'Response'], ['service', 'Service'], ['type', 'Type'],
]);
// Transport object contracts (interfaces and object aliases) named by their file role: <Action>Input in *.input.ts,
// <Action>Request in *.request.ts, <Name>Row in *.rows.ts ... Domain values in *.contracts.ts and *.options.ts carry no suffix.
const TRANSPORT_OBJECT_SUFFIX = new Map([
  ['args', 'Args'], ['input', 'Input'], ['request', 'Request'], ['response', 'Response'], ['rows', 'Row'], ['type', 'Type'],
]);
// A class that implements an interface declared in a file with one of these roles may be named <Qualifier><InterfaceName>.
const PORT_DECLARATION_ROLES = new Set(['contracts', 'port']);
const NON_CLASS_ROLES = new Set(['constants', 'contracts', 'decorators', 'enum', 'providers', 'types']);
const KNOWN_HYPHEN_ROLES = [...CLASS_ROLE_SUFFIX.keys()].sort((a, b) => b.length - a.length);
const SPECIAL_BASENAMES = new Set(['config', 'configuration', 'constants', 'decorators', 'env', 'environment', 'index', 'main', 'types']);
const NO_PROGRAM_CHECKER = 'a TypeScript program checker could not be associated with its source';
const SOURCE_EXTENSION = /\.[cm]?[jt]sx?$/i;

function absoluteRoots(root, relatives) {
  return relatives.map(relative => path.resolve(root, ...relative.split('/')));
}

function canonical(file) {
  return path.resolve(file);
}

function addFrameworkTargets(config, context, checker, sourceFile, statement, bySymbol, reasons) {
  const bound = moduleExportsOf(context.ts, checker, statement);
  if (!bound || !FRAMEWORK_EXPORTS.has(bound.specifier)) return;
  if (!bound.symbol) {
    reasons.push(`${relativePath(config.root, sourceFile.fileName)} cannot resolve ${bound.specifier}`);
    return;
  }
  const selected = FRAMEWORK_EXPORTS.get(bound.specifier);
  for (const [name, target] of bound.exports) if (selected.has(name) && target) bySymbol.set(target, name);
}

function frameworkTargets(config, context, checker, localFiles) {
  const reasons = [];
  const bySymbol = new Map();
  const files = programSourcesOf(context, checker, localFiles);
  if (!files) return { bySymbol, reasons: [NO_PROGRAM_CHECKER] };
  for (const sourceFile of files) {
    for (const statement of sourceFile.statements) {
      addFrameworkTargets(config, context, checker, sourceFile, statement, bySymbol, reasons);
    }
    commonJsRequireReasons(context.ts, checker, sourceFile, (specifier) => FRAMEWORK_EXPORTS.has(specifier),
      reasons, relativePath(config.root, sourceFile.fileName), 'binding whose source role cannot be proved');
  }
  return { bySymbol, reasons };
}

function decoratorKind(ts, checker, decorator, targets) {
  const selected = selectedNode(ts, decoratorCallee(ts, decorator));
  return selected ? targets.get(valueSymbol(ts, checker, selected)) ?? null : null;
}

/* This module's trace descends `new X()` callees too; the framework map keys symbols directly. */
const TRACE_NEW = { newExpression: true };

function hasModifier(ts, node, kind) {
  return (ts.canHaveModifiers(node) ? ts.getModifiers(node) ?? [] : node.modifiers ?? []).some(modifier => modifier.kind === kind);
}



function sourceRole(ts, sourceFile) {
  const file = path.basename(sourceFile.fileName).replace(SOURCE_EXTENSION, '');
  const base = file.replace(/\.(?:int-)?spec$/i, '');
  const segments = base.split('.');
  if (segments.length > 1) return { base, role: segments.at(-1).toLowerCase(), spec: base !== file };
  const lower = base.toLowerCase();
  const known = KNOWN_HYPHEN_ROLES.find(role => lower === role || lower.endsWith(`-${role}`));
  if (known) return { base, role: known, spec: base !== file };
  const topLevel = sourceFile.statements;
  if (topLevel.some(statement => ts.isEnumDeclaration(statement))) return { base, role: 'enum', spec: base !== file };
  return { base, role: null, spec: base !== file };
}

function kebabSourceBase(base) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)*$/.test(base);
}

function exportedDeclarations(ts, checker, sourceFile) {
  const exported = new Set();
  const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
  for (const symbol of moduleSymbol ? checker.getExportsOfModule(moduleSymbol) : []) {
    const target = normalizedSymbolValue(ts, checker, symbol);
    for (const declaration of target?.getDeclarations?.() ?? []) if (declaration.getSourceFile() === sourceFile) exported.add(declaration);
  }
  return exported;
}

function combineClassValue(results) {
  if (results.some(result => result.status === 'unavailable')) return { status: 'unavailable', names: [] };
  const classes = results.filter(result => result.status === 'class');
  if (!classes.length) return { status: 'not-class', names: [] };
  if (classes.length !== results.length) return { status: 'unavailable', names: [] };
  return { status: 'class', names: [...new Set(classes.flatMap(result => result.names))] };
}

function classDeclarationResults(ts, checker, expression, declaration, nextSeen, depth) {
  const results = [];
  if (ts.isClassDeclaration(declaration)) results.push({ status: 'class', names: declaration.name ? [declaration.name.text] : [] });
  if (ts.isVariableDeclaration(declaration) && declaration.initializer) {
    if (ts.isCallExpression(expression)
      && (ts.isArrowFunction(declaration.initializer) || ts.isFunctionExpression(declaration.initializer))) {
      for (const returned of returnedExpressions(ts, declaration.initializer)) results.push(classValueStatus(ts, checker, returned, nextSeen, depth + 1));
    } else results.push(classValueStatus(ts, checker, declaration.initializer, nextSeen, depth + 1));
  }
  if (ts.isCallExpression(expression)) for (const returned of returnedExpressions(ts, declaration)) {
    results.push(classValueStatus(ts, checker, returned, nextSeen, depth + 1));
  }
  return results;
}

function classSymbolStatus(ts, checker, expression, seen, depth) {
  const selected = selectedNode(ts, ts.isCallExpression(expression) ? expression.expression : expression);
  const symbol = selected ? normalizedSymbol(ts, checker, selected) : null;
  if (!symbol || seen.has(symbol)) return { status: 'not-class', names: [] };
  const nextSeen = new Set(seen).add(symbol);
  const results = [];
  for (const declaration of symbol.getDeclarations?.() ?? []) results.push(...classDeclarationResults(ts, checker, expression, declaration, nextSeen, depth));
  return results.length ? combineClassValue(results) : { status: 'not-class', names: [] };
}

function classValueStatus(ts, checker, expression, seen = new Set(), depth = 0) {
  if (!expression) return { status: 'not-class', names: [] };
  if (depth > 10) return { status: 'unavailable', names: [] };
  expression = unwrapExpression(ts, expression);
  if (ts.isClassExpression(expression)) return { status: 'class', names: expression.name ? [expression.name.text] : [] };
  if (ts.isConditionalExpression(expression)) return combineClassValue([
    classValueStatus(ts, checker, expression.whenTrue, seen, depth + 1),
    classValueStatus(ts, checker, expression.whenFalse, seen, depth + 1),
  ]);
  return classSymbolStatus(ts, checker, expression, seen, depth);
}

function combineObjectStatus(statuses) {
  if (statuses.includes('object')) return 'object';
  if (statuses.includes('unavailable')) return 'unavailable';
  return 'not-object';
}

function objectTypeStatus(ts, checker, node, seen = new Set(), depth = 0) {
  if (!node || depth > 12) return 'unavailable';
  if (ts.isTypeLiteralNode(node) || ts.isMappedTypeNode(node)) return 'object';
  if (ts.isParenthesizedTypeNode(node)) return objectTypeStatus(ts, checker, node.type, seen, depth + 1);
  if (ts.isIntersectionTypeNode(node) || ts.isUnionTypeNode(node)) {
    return combineObjectStatus(node.types.map(type => objectTypeStatus(ts, checker, type, seen, depth + 1)));
  }
  if (ts.isTypeReferenceNode(node)) {
    const symbol = normalizedSymbol(ts, checker, node.typeName);
    if (!symbol || seen.has(symbol)) return 'unavailable';
    const nextSeen = new Set(seen).add(symbol);
    const declarations = symbol.getDeclarations?.() ?? [];
    if (!declarations.length) return 'unavailable';
    return combineObjectStatus(declarations.map(declaration => {
      if (ts.isInterfaceDeclaration(declaration)) return 'object';
      if (ts.isTypeAliasDeclaration(declaration)) return objectTypeStatus(ts, checker, declaration.type, nextSeen, depth + 1);
      if (ts.isTypeParameterDeclaration(declaration)) return 'unavailable';
      if (ts.isClassDeclaration(declaration)) return 'unavailable';
      return 'not-object';
    }));
  }
  if (ts.isConditionalTypeNode(node) || ts.isIndexedAccessTypeNode(node) || ts.isInferTypeNode(node) || ts.isTypeQueryNode(node)) return 'unavailable';
  return 'not-object';
}

function objectContractStatus(ts, checker, node) {
  if (ts.isInterfaceDeclaration(node)) return 'object';
  return ts.isTypeAliasDeclaration(node) ? objectTypeStatus(ts, checker, node.type) : 'not-object';
}

function companionInterfaceAllowed(ts, sourceFile, name) {
  if (!/^I[A-Z]/.test(name)) return false;
  const companion = name.slice(1);
  return sourceFile.statements.some(statement => ts.isClassDeclaration(statement) && statement.name?.text === companion
    && nodeDecorators(ts, statement).length > 0);
}

function camelCase(value) {
  return /^[a-z][A-Za-z0-9]*$/.test(value);
}

function staticProperty(ts, object, name) {
  if (!ts.isObjectLiteralExpression(object)) return { status: 'dynamic' };
  const matching = object.properties.filter(property => {
    if (!property.name) return false;
    if (ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name)) return property.name.text === name;
    return false;
  });
  if (!matching.length) return { status: 'missing' };
  if (matching.length !== 1 || !ts.isPropertyAssignment(matching[0])) return { status: 'dynamic', node: matching[0] };
  const initializer = unwrapExpression(ts, matching[0].initializer);
  return ts.isStringLiteralLike(initializer)
    ? { status: 'literal', value: initializer.text, node: initializer }
    : { status: 'dynamic', node: matching[0].initializer };
}

function graphqlField({ config, context, sourceFile, node, decorator, kind, namingReasons, violations }) {
  const call = decorator.expression;
  if (!context.ts.isCallExpression(call)) {
    namingReasons.push(`${relativePath(config.root, sourceFile.fileName)} has a non-call @${kind} decorator`);
    return;
  }
  const options = call.arguments.find(argument => context.ts.isObjectLiteralExpression(unwrapExpression(context.ts, argument)));
  const selected = options ? staticProperty(context.ts, unwrapExpression(context.ts, options), 'name') : { status: 'missing' };
  if (selected.status === 'dynamic') {
    namingReasons.push(`${relativePath(config.root, sourceFile.fileName)} has a dynamic @${kind} field name`);
    return;
  }
  const methodName = node.name && (context.ts.isIdentifier(node.name) || context.ts.isStringLiteralLike(node.name)) ? node.name.text : null;
  const name = selected.status === 'literal' ? selected.value : methodName;
  if (!name) namingReasons.push(`${relativePath(config.root, sourceFile.fileName)} cannot prove the @${kind} field name`);
  else if (!camelCase(name)) violations.push(violation(config, sourceFile, selected.node ?? node.name ?? node, SOURCE_NAME_RULE_ID,
    `GraphQL field name ${name} must be camelCase.`));
}

function graphqlArgument(config, context, sourceFile, node, decorator, namingReasons, violations) {
  const call = decorator.expression;
  if (!context.ts.isCallExpression(call) || call.arguments.length === 0) {
    namingReasons.push(`${relativePath(config.root, sourceFile.fileName)} cannot prove the @Args input name`);
    return;
  }
  const selected = unwrapExpression(context.ts, call.arguments[0]);
  if (!context.ts.isStringLiteralLike(selected)) {
    namingReasons.push(`${relativePath(config.root, sourceFile.fileName)} has a dynamic @Args input name`);
  } else if (selected.text !== 'input') violations.push(violation(config, sourceFile, selected, SOURCE_NAME_RULE_ID,
    'GraphQL request arguments use the literal name input.'));
}

function graphqlEnumRegistration(config, context, sourceFile, call, namingReasons, violations) {
  if (call.arguments.length < 2) {
    namingReasons.push(`${relativePath(config.root, sourceFile.fileName)} cannot prove the registered GraphQL enum name`);
    return;
  }
  const selected = staticProperty(context.ts, unwrapExpression(context.ts, call.arguments[1]), 'name');
  if (selected.status !== 'literal') namingReasons.push(`${relativePath(config.root, sourceFile.fileName)} has a dynamic registered GraphQL enum name`);
  else if (!/^[A-Z][A-Za-z0-9]*$/.test(selected.value)) violations.push(violation(config, sourceFile, selected.node, SOURCE_NAME_RULE_ID,
    `Registered GraphQL enum name ${selected.value} must be PascalCase.`));
}

function selectedCallKind(ts, checker, call, targets) {
  const selected = selectedNode(ts, call.expression);
  return selected ? targets.get(valueSymbol(ts, checker, selected)) ?? null : null;
}

function callsNamedHelper(ts, checker, call, name) {
  const selected = selectedNode(ts, call.expression);
  const symbol = selected ? normalizedSymbol(ts, checker, selected) : null;
  return (symbol?.getDeclarations?.() ?? []).some(declaration => {
    const declarationName = declaration.name;
    return declarationName && (ts.isIdentifier(declarationName) || ts.isStringLiteralLike(declarationName)) && declarationName.text === name;
  });
}

function implementsFramework(ts, checker, declaration, targets, name) {
  return (declaration.heritageClauses ?? []).some(clause => clause.token === ts.SyntaxKind.ImplementsKeyword
    && clause.types.some(type => targets.get(valueSymbol(ts, checker, type.expression)) === name));
}

/** Names of the interfaces a class implements that are declared in a *.port.ts or *.contracts.ts file (resolved by the type checker). */
function portNamesForImplementedType(ts, checker, type) {
  const names = [];
  const symbol = normalizedSymbol(ts, checker, type.expression);
  for (const target of symbol?.getDeclarations?.() ?? []) {
    if (!ts.isInterfaceDeclaration(target) && !ts.isTypeAliasDeclaration(target)) continue;
    const declaredRole = path.basename(target.getSourceFile().fileName).replace(SOURCE_EXTENSION, '').split('.').at(-1);
    if (PORT_DECLARATION_ROLES.has(declaredRole)) names.push(target.name.text);
  }
  return names;
}

function implementedPortNames(ts, checker, declaration) {
  return (declaration.heritageClauses ?? []).filter(clause => clause.token === ts.SyntaxKind.ImplementsKeyword)
    .flatMap(clause => clause.types.flatMap(type => portNamesForImplementedType(ts, checker, type)));
}

function locatedRoot(roots, fileName) {
  return roots.find(root => isInside(root, fileName)) ?? null;
}

/** Check the adopted domain-first backend source layout without inferring semantic ownership from folder names alone. */
const checkBackendSourceShapeImpl = createBackendSourceShapeChecker({
  absoluteRoots, canonical, frameworkTargets, locatedRoot, sourceRole, kebabSourceBase, exportedDeclarations,
  classValueStatus, objectContractStatus, companionInterfaceAllowed, hasModifier, graphqlField, graphqlArgument,
  graphqlEnumRegistration, selectedCallKind, callsNamedHelper, implementsFramework, implementedPortNames, decoratorKind,
  SOURCE_LAYOUT_RULE_ID, SOURCE_NAME_RULE_ID, APPLICATION_ROLES, TRANSPORT_ROLES, APPLICATION_LAYER_ROLES,
  TRANSPORT_LAYER_ROLES, CLASS_ROLE_SUFFIX, TRANSPORT_OBJECT_SUFFIX, NON_CLASS_ROLES, SPECIAL_BASENAMES,
  TRACE_NEW,
});

export function checkBackendSourceShape(config, context) {
  return checkBackendSourceShapeImpl(config, context);
}
export { SOURCE_LAYOUT_RULE_ID, SOURCE_NAME_RULE_ID };
