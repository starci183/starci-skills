import path from 'node:path';
import { isInside } from './config.mjs';
import { isUnshadowedCommonJsRequire, relativePath, sourceLocation, UNPROVEN_FRAMEWORK, unwrapExpression } from './typescript.mjs';

const SOURCE_LAYOUT_RULE_ID = 'BE_FEATURE_LAYOUT_INVALID';
const SOURCE_NAME_RULE_ID = 'BE_SOURCE_NAME_INVALID';
const FRAMEWORK_EXPORTS = new Map([
  ['@nestjs/graphql', new Set(['Args', 'ArgsType', 'InputType', 'Mutation', 'ObjectType', 'Query', 'registerEnumType'])],
  ['typeorm', new Set(['Entity', 'EntitySchema', 'MigrationInterface', 'ViewEntity'])],
]);
const APPLICATION_ROLES = new Set(['command', 'contracts', 'handler', 'query', 'use-case']);
const TRANSPORT_ROLES = new Set(['consumer', 'controller', 'input', 'request', 'resolver', 'response']);
const APPLICATION_LAYER_ROLES = new Set([...APPLICATION_ROLES, 'mapper']);
const TRANSPORT_LAYER_ROLES = new Set([...TRANSPORT_ROLES, 'enum', 'filter', 'guard', 'interceptor', 'mapper']);
const CLASS_ROLE_SUFFIX = new Map([
  ['adapter', 'Adapter'], ['client', 'Client'], ['command', 'Command'], ['consumer', 'Consumer'],
  ['controller', 'Controller'], ['entity', 'Entity'], ['exception', 'Exception'], ['filter', 'Filter'], ['guard', 'Guard'],
  ['handler', 'Handler'], ['input', 'Input'], ['interceptor', 'Interceptor'], ['mapper', 'Mapper'],
  ['module', 'Module'], ['module-definition', 'Module'], ['policy', 'Policy'], ['processor', 'Processor'],
  ['provider', 'Provider'], ['query', 'Query'], ['repository', 'Repository'], ['request', 'Request'],
  ['resolver', 'Resolver'], ['response', 'Response'], ['service', 'Service'], ['strategy', 'Strategy'],
  ['use-case', 'UseCase'],
]);
const NON_CLASS_ROLES = new Set(['constants', 'contracts', 'decorators', 'enum', 'providers', 'types']);
const KNOWN_HYPHEN_ROLES = [...CLASS_ROLE_SUFFIX.keys()].sort((a, b) => b.length - a.length);
const SPECIAL_BASENAMES = new Set(['config', 'configuration', 'constants', 'decorators', 'env', 'environment', 'index', 'main', 'types']);
const OBJECT_CONTRACT_SUFFIX = /(?:Params|Result|Options|ExceptionMetadata)$/;
const SOURCE_EXTENSION = /\.[cm]?[jt]sx?$/i;

function absoluteRoots(root, relatives) {
  return relatives.map(relative => path.resolve(root, ...relative.split('/')));
}

function insideAny(roots, target) {
  return roots.some(root => isInside(root, target));
}

function canonical(file) {
  return path.resolve(file);
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

function selectedNode(ts, expression) {
  expression = unwrapExpression(ts, expression);
  if (ts.isIdentifier(expression)) return expression;
  if (ts.isPropertyAccessExpression(expression)) return expression.name;
  if (ts.isElementAccessExpression(expression) && ts.isStringLiteralLike(expression.argumentExpression)) return expression.argumentExpression;
  return null;
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

function frameworkTargets(config, context, checker, localFiles) {
  const bySymbol = new Map();
  const reasons = [];
  const program = context.programs.find(candidate => candidate.getTypeChecker() === checker);
  if (!program) return { bySymbol, reasons: ['a TypeScript program checker could not be associated with its source'] };
  for (const sourceFile of program.getSourceFiles()) {
    if (!localFiles.has(canonical(sourceFile.fileName))) continue;
    for (const statement of sourceFile.statements) {
      const specifierNode = (context.ts.isImportDeclaration(statement) || context.ts.isExportDeclaration(statement))
        && statement.moduleSpecifier && context.ts.isStringLiteralLike(statement.moduleSpecifier) ? statement.moduleSpecifier : null;
      const specifier = specifierNode?.text;
      if (!specifier || !FRAMEWORK_EXPORTS.has(specifier)) continue;
      const moduleSymbol = checker.getSymbolAtLocation(specifierNode);
      if (!moduleSymbol) {
        reasons.push(`${relativePath(config.root, sourceFile.fileName)} cannot resolve ${specifier}`);
        continue;
      }
      const selected = FRAMEWORK_EXPORTS.get(specifier);
      for (const exported of checker.getExportsOfModule(moduleSymbol)) if (selected.has(exported.getName())) {
        const target = normalizedSymbolValue(context.ts, checker, exported);
        if (target) bySymbol.set(target, exported.getName());
      }
    }
    const visit = node => {
      if (context.ts.isCallExpression(node) && isUnshadowedCommonJsRequire(context.ts, checker, node.expression)
        && node.arguments.length === 1 && context.ts.isStringLiteralLike(node.arguments[0]) && FRAMEWORK_EXPORTS.has(node.arguments[0].text)) {
        reasons.push(`${relativePath(config.root, sourceFile.fileName)} uses a CommonJS ${node.arguments[0].text} binding whose source role cannot be proved`);
      }
      context.ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }
  return { bySymbol, reasons };
}

function calledExpression(ts, decorator) {
  return ts.isCallExpression(decorator.expression) ? decorator.expression.expression : decorator.expression;
}

function decoratorKind(ts, checker, decorator, targets) {
  const selected = selectedNode(ts, calledExpression(ts, decorator));
  return selected ? targets.get(valueSymbol(ts, checker, selected)) ?? null : null;
}

function mutableDecoratorKind(ts, checker, decorator, targets) {
  const selected = selectedNode(ts, calledExpression(ts, decorator));
  const symbol = selected ? normalizedSymbol(ts, checker, selected) : null;
  const declarations = symbol?.getDeclarations?.() ?? [];
  if (declarations.length !== 1 || !ts.isVariableDeclaration(declarations[0]) || !declarations[0].initializer
    || (ts.getCombinedNodeFlags(declarations[0].parent) & ts.NodeFlags.Const)) return null;
  return targets.get(valueSymbol(ts, checker, declarations[0].initializer)) ?? null;
}

function returnedExpressions(ts, declaration) {
  if ((ts.isArrowFunction(declaration) || ts.isFunctionExpression(declaration)) && !ts.isBlock(declaration.body)) return [declaration.body];
  const body = ts.isFunctionDeclaration(declaration) || ts.isMethodDeclaration(declaration)
    || ts.isArrowFunction(declaration) || ts.isFunctionExpression(declaration) ? declaration.body : null;
  if (!body || !ts.isBlock(body)) return [];
  const returned = [];
  const visit = node => {
    if (node !== body && (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node) || ts.isMethodDeclaration(node))) return;
    if (ts.isReturnStatement(node) && node.expression) returned.push(node.expression);
    else ts.forEachChild(node, visit);
  };
  visit(body);
  return returned;
}

function tracedFrameworkKinds(ts, checker, expression, targets, seen = new Set(), depth = 0) {
  if (!expression) return new Set();
  if (depth > 10) return new Set([UNPROVEN_FRAMEWORK]);
  expression = unwrapExpression(ts, expression);
  const selected = selectedNode(ts, expression);
  const symbol = selected ? normalizedSymbol(ts, checker, selected) : null;
  const direct = symbol ? targets.get(symbol) : null;
  if (direct) return new Set([direct]);
  if (ts.isArrowFunction(expression) || ts.isFunctionExpression(expression)) {
    const kinds = new Set();
    for (const returned of returnedExpressions(ts, expression)) {
      for (const kind of tracedFrameworkKinds(ts, checker, returned, targets, seen, depth + 1)) kinds.add(kind);
    }
    return kinds;
  }
  if (ts.isCallExpression(expression)) {
    const kinds = tracedFrameworkKinds(ts, checker, expression.expression, targets, seen, depth + 1);
    if (kinds.size) return kinds;
  }
  if (ts.isNewExpression(expression)) return tracedFrameworkKinds(ts, checker, expression.expression, targets, seen, depth + 1);
  if (!symbol || seen.has(symbol)) return new Set();
  const nextSeen = new Set(seen).add(symbol);
  const kinds = new Set();
  for (const declaration of symbol.getDeclarations?.() ?? []) {
    if (ts.isVariableDeclaration(declaration) && declaration.initializer) {
      for (const kind of tracedFrameworkKinds(ts, checker, declaration.initializer, targets, nextSeen, depth + 1)) kinds.add(kind);
    }
    for (const returned of returnedExpressions(ts, declaration)) {
      for (const kind of tracedFrameworkKinds(ts, checker, returned, targets, nextSeen, depth + 1)) kinds.add(kind);
    }
  }
  return kinds;
}

function constructedDecoratorKind(ts, checker, decorator, targets) {
  const kinds = tracedFrameworkKinds(ts, checker, calledExpression(ts, decorator), targets);
  if (kinds.has(UNPROVEN_FRAMEWORK)) return 'unproven framework';
  return kinds.size === 1 ? [...kinds][0] : kinds.size ? 'multiple framework' : null;
}

function decorators(ts, node) {
  return ts.canHaveDecorators(node) ? ts.getDecorators(node) ?? [] : node.decorators ?? [];
}

function hasModifier(ts, node, kind) {
  return (ts.canHaveModifiers(node) ? ts.getModifiers(node) ?? [] : node.modifiers ?? []).some(modifier => modifier.kind === kind);
}

function violation(config, sourceFile, node, ruleId, message, extra = {}) {
  return { ruleId, path: relativePath(config.root, sourceFile.fileName), ...sourceLocation(sourceFile, node), message, ...extra };
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
  if (topLevel.some(statement => ts.isClassDeclaration(statement) && statement.name?.text.endsWith('Exception'))) return { base, role: 'exception', spec: base !== file };
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

function classValueStatus(ts, checker, expression, seen = new Set(), depth = 0) {
  if (!expression) return { status: 'not-class', names: [] };
  if (depth > 10) return { status: 'unavailable', names: [] };
  expression = unwrapExpression(ts, expression);
  if (ts.isClassExpression(expression)) return { status: 'class', names: expression.name ? [expression.name.text] : [] };
  if (ts.isConditionalExpression(expression)) return combineClassValue([
    classValueStatus(ts, checker, expression.whenTrue, seen, depth + 1),
    classValueStatus(ts, checker, expression.whenFalse, seen, depth + 1),
  ]);
  const selected = selectedNode(ts, ts.isCallExpression(expression) ? expression.expression : expression);
  const symbol = selected ? normalizedSymbol(ts, checker, selected) : null;
  if (!symbol || seen.has(symbol)) return { status: 'not-class', names: [] };
  const nextSeen = new Set(seen).add(symbol);
  const results = [];
  for (const declaration of symbol.getDeclarations?.() ?? []) {
    if (ts.isClassDeclaration(declaration)) results.push({ status: 'class', names: declaration.name ? [declaration.name.text] : [] });
    if (ts.isVariableDeclaration(declaration) && declaration.initializer) {
      if (ts.isCallExpression(expression)
        && (ts.isArrowFunction(declaration.initializer) || ts.isFunctionExpression(declaration.initializer))) {
        for (const returned of returnedExpressions(ts, declaration.initializer)) {
          results.push(classValueStatus(ts, checker, returned, nextSeen, depth + 1));
        }
      } else results.push(classValueStatus(ts, checker, declaration.initializer, nextSeen, depth + 1));
    }
    if (ts.isCallExpression(expression)) for (const returned of returnedExpressions(ts, declaration)) {
      results.push(classValueStatus(ts, checker, returned, nextSeen, depth + 1));
    }
  }
  return results.length ? combineClassValue(results) : { status: 'not-class', names: [] };
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
    && decorators(ts, statement).length > 0);
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

function graphqlField(config, context, sourceFile, node, decorator, kind, namingReasons, violations) {
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
    namingReasons.push(`${relativePath(config.root, sourceFile.fileName)} cannot prove the @Args request name`);
    return;
  }
  const selected = unwrapExpression(context.ts, call.arguments[0]);
  if (!context.ts.isStringLiteralLike(selected)) {
    namingReasons.push(`${relativePath(config.root, sourceFile.fileName)} has a dynamic @Args request name`);
  } else if (selected.text !== 'request') violations.push(violation(config, sourceFile, selected, SOURCE_NAME_RULE_ID,
    'GraphQL request arguments use the literal name request.'));
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

function locatedRoot(roots, fileName) {
  return roots.find(root => isInside(root, fileName)) ?? null;
}

/** Check the adopted domain-first backend source layout without inferring semantic ownership from folder names alone. */
export function checkBackendSourceShape(config, context) {
  const ts = context.ts;
  const featureRoots = absoluteRoots(config.root, config.backend.features);
  const moduleRoots = absoluteRoots(config.root, config.backend.modules);
  const legacyRoots = absoluteRoots(config.root, config.backend.legacyRoots);
  const localFiles = new Set(context.files.map(file => canonical(file.fileName)));
  const frameworkByChecker = new Map();
  const violations = [];
  const layoutReasons = [];
  const namingReasons = [];
  const legacyFiles = [];
  let checkedFiles = 0;

  for (const sourceFile of context.files) {
    const fileName = canonical(sourceFile.fileName);
    const featureRoot = locatedRoot(featureRoots, fileName);
    const moduleRoot = locatedRoot(moduleRoots, fileName);
    if (!featureRoot && !moduleRoot) continue;
    checkedFiles += 1;
    if (insideAny(legacyRoots, fileName)) {
      legacyFiles.push(relativePath(config.root, fileName));
      continue;
    }
    const checker = context.checkerFor(fileName);
    if (!frameworkByChecker.has(checker)) frameworkByChecker.set(checker, frameworkTargets(config, context, checker, localFiles));
    const framework = frameworkByChecker.get(checker);
    const relativeToOwner = relativePath(featureRoot ?? moduleRoot, fileName);
    const parts = relativeToOwner.split('/');
    const directories = parts.slice(0, -1).map(part => part.toLowerCase());
    const applicationIndex = directories.indexOf('application');
    const transportIndex = directories.indexOf('transport');
    const inApplication = applicationIndex >= 0;
    const inTransport = transportIndex >= 0;
    const role = sourceRole(ts, sourceFile);
    const relative = relativePath(config.root, fileName);
    const migrationName = /^\d{10,}-[A-Z][A-Za-z0-9]*$/.test(role.base);
    const persistencePath = !role.spec && (migrationName || directories.includes('migrations'));
    const special = SPECIAL_BASENAMES.has(role.base.toLowerCase()) || migrationName
      || ['constants', 'enums', 'errors', 'migrations'].some(folder => directories.includes(folder));
    const publicDeclarations = exportedDeclarations(ts, checker, sourceFile);

    if (!migrationName && !kebabSourceBase(role.base)) violations.push(violation(config, sourceFile, sourceFile, SOURCE_NAME_RULE_ID,
      `Source basename ${role.base} must use kebab-case segments plus an explicit role suffix.`));
    if (!role.role && !special) namingReasons.push(`${relative} has no statically identifiable source role`);

    if (featureRoot) {
      if (inApplication && inTransport) violations.push(violation(config, sourceFile, sourceFile, SOURCE_LAYOUT_RULE_ID,
        'A feature source cannot belong to both application and transport layers.'));
      if (role.role && APPLICATION_ROLES.has(role.role) && !inApplication) violations.push(violation(config, sourceFile, sourceFile,
        SOURCE_LAYOUT_RULE_ID, `${role.role} source belongs under the feature application/ layer.`));
      if (role.role && TRANSPORT_ROLES.has(role.role) && !inTransport) violations.push(violation(config, sourceFile, sourceFile,
        SOURCE_LAYOUT_RULE_ID, `${role.role} source belongs under the feature transport/<protocol>/ layer.`));
      if (inApplication && role.role && TRANSPORT_ROLES.has(role.role)) violations.push(violation(config, sourceFile, sourceFile,
        SOURCE_LAYOUT_RULE_ID, `Transport role ${role.role} cannot live in application/.`));
      if (inTransport && role.role && APPLICATION_ROLES.has(role.role)) violations.push(violation(config, sourceFile, sourceFile,
        SOURCE_LAYOUT_RULE_ID, `Application role ${role.role} cannot live in transport/.`));
      if (inTransport && transportIndex >= directories.length - 1) violations.push(violation(config, sourceFile, sourceFile,
        SOURCE_LAYOUT_RULE_ID, 'Feature transport source must name a protocol below transport/.'));
      const topLevelFeatureFile = directories.length === 1 && (role.base === 'index' || role.role === 'module' || role.spec);
      if (inApplication && role.base !== 'index' && (!role.role || !APPLICATION_LAYER_ROLES.has(role.role))
        && !(role.role && (TRANSPORT_ROLES.has(role.role) || role.role === 'entity'))) {
        layoutReasons.push(`${relative} role ${role.role ?? '(unclassified)'} is not a selected application-layer role`);
      }
      if (inTransport && role.base !== 'index' && (!role.role || !TRANSPORT_LAYER_ROLES.has(role.role))
        && !(role.role && (APPLICATION_ROLES.has(role.role) || role.role === 'entity'))) {
        layoutReasons.push(`${relative} role ${role.role ?? '(unclassified)'} is not a selected transport-layer role`);
      }
      if (!inApplication && !inTransport && !topLevelFeatureFile && role.role && role.role !== 'entity'
        && !APPLICATION_ROLES.has(role.role) && !TRANSPORT_ROLES.has(role.role)) {
        layoutReasons.push(`${relative} role ${role.role} has no statically selected feature layer`);
      }
      if (!inApplication && !inTransport && !topLevelFeatureFile && !role.role && !persistencePath) {
        layoutReasons.push(`${relative} has no statically selected feature layer`);
      }
      if (persistencePath) violations.push(violation(config, sourceFile, sourceFile, SOURCE_LAYOUT_RULE_ID,
        'Migration source cannot be owned by a feature; place it under the declared persistence module.'));
      if (role.role === 'entity') violations.push(violation(config, sourceFile, sourceFile, SOURCE_LAYOUT_RULE_ID,
        'Entity source cannot be owned by a feature; place schema under the declared persistence module.'));
    }

    const classDeclarations = sourceFile.statements.filter(statement => ts.isClassDeclaration(statement));
    for (const declaration of classDeclarations) {
      const declarationDecorators = decorators(ts, declaration);
      const kinds = declarationDecorators.map(decorator => decoratorKind(ts, checker, decorator, framework.bySymbol)).filter(Boolean);
      const graphQlDto = kinds.some(kind => kind === 'ArgsType' || kind === 'InputType' || kind === 'ObjectType');
      if (graphQlDto && (!featureRoot || !inTransport || directories[transportIndex + 1] !== 'graphql')) {
        violations.push(violation(config, sourceFile, declaration.name ?? declaration, SOURCE_LAYOUT_RULE_ID,
          'GraphQL DTO classes belong under a feature transport/graphql/ boundary.'));
      }
      const persistenceSchema = kinds.includes('Entity') || kinds.includes('ViewEntity')
        || implementsFramework(ts, checker, declaration, framework.bySymbol, 'MigrationInterface');
      if (persistenceSchema && featureRoot) violations.push(violation(config, sourceFile, declaration.name ?? declaration, SOURCE_LAYOUT_RULE_ID,
        'TypeORM entities and migrations cannot be owned by a feature; place schema under its declared persistence module.'));
      const classSuffix = role.role && !NON_CLASS_ROLES.has(role.role) ? CLASS_ROLE_SUFFIX.get(role.role) : null;
      if (publicDeclarations.has(declaration) && !declaration.name) namingReasons.push(`${relative} exports an anonymous class whose role name cannot be proved`);
      else if (publicDeclarations.has(declaration) && declaration.name && classSuffix && !declaration.name.text.endsWith(classSuffix)) {
        violations.push(violation(config, sourceFile, declaration.name, SOURCE_NAME_RULE_ID,
          `Exported class ${declaration.name.text} must end in ${classSuffix} for a ${role.role} source file.`));
      } else if (publicDeclarations.has(declaration) && declaration.name && role.role && !NON_CLASS_ROLES.has(role.role) && !classSuffix) {
        namingReasons.push(`${relative} declares exported class ${declaration.name.text} with unclassified file role ${role.role}`);
      }
    }

    for (const statement of sourceFile.statements) if (ts.isVariableStatement(statement)) for (const declaration of statement.declarationList.declarations) {
      if (!publicDeclarations.has(declaration) || !declaration.initializer) continue;
      const classValue = classValueStatus(ts, checker, declaration.initializer);
      if (classValue.status === 'unavailable') {
        namingReasons.push(`${relative} exports a class-valued declaration whose role identity is not statically proved`);
        continue;
      }
      if (classValue.status !== 'class') continue;
      const classSuffix = role.role && !NON_CLASS_ROLES.has(role.role) ? CLASS_ROLE_SUFFIX.get(role.role) : null;
      if (!classSuffix || !ts.isIdentifier(declaration.name)) {
        namingReasons.push(`${relative} exports a class-valued declaration without a statically selected class role`);
        continue;
      }
      const names = [declaration.name.text, ...classValue.names];
      const invalid = names.find(name => !name.endsWith(classSuffix));
      if (invalid) violations.push(violation(config, sourceFile, declaration.name, SOURCE_NAME_RULE_ID,
        `Exported class value ${invalid} must end in ${classSuffix} for a ${role.role} source file.`));
    }

    for (const statement of sourceFile.statements) {
      if (ts.isEnumDeclaration(statement)) {
        if (hasModifier(ts, statement, ts.SyntaxKind.ConstKeyword) || !/^[A-Z][A-Za-z0-9]*$/.test(statement.name.text)) {
          violations.push(violation(config, sourceFile, statement.name, SOURCE_NAME_RULE_ID,
            'Enums must be non-const declarations with PascalCase names.'));
        }
        for (const member of statement.members) {
          const name = ts.isIdentifier(member.name) || ts.isStringLiteralLike(member.name) ? member.name.text : null;
          const initializer = member.initializer && unwrapExpression(ts, member.initializer);
          if (!name || !/^[A-Z][A-Za-z0-9]*$/.test(name) || !initializer || !ts.isStringLiteralLike(initializer)) {
            violations.push(violation(config, sourceFile, member.name, SOURCE_NAME_RULE_ID,
              'Enum members must use PascalCase names with explicit static string values.'));
          }
        }
      }
      const contractStatus = objectContractStatus(ts, checker, statement);
      if (publicDeclarations.has(statement) && contractStatus === 'unavailable') {
        namingReasons.push(`${relative} exports ${statement.name?.text ?? 'a type'} whose object contract identity is not statically proved`);
      }
      if (contractStatus === 'object' && publicDeclarations.has(statement)
        && !OBJECT_CONTRACT_SUFFIX.test(statement.name.text) && !companionInterfaceAllowed(ts, sourceFile, statement.name.text)) {
        const transportSuffix = role.role && ['input', 'request', 'response'].includes(role.role)
          ? `${role.role[0].toUpperCase()}${role.role.slice(1)}` : null;
        if (role.role === 'contracts' || role.role === 'options' || (inApplication && role.role === 'use-case')
          || (inTransport && transportSuffix && !statement.name.text.endsWith(transportSuffix))) {
          violations.push(violation(config, sourceFile, statement.name, SOURCE_NAME_RULE_ID,
            `Public object contract ${statement.name.text} must use the suffix selected by its application or transport role.`));
        } else if (!inTransport || !transportSuffix) {
          namingReasons.push(`${relative} exports object contract ${statement.name.text} whose public contract role is not statically selected`);
        }
      }
    }

    const visit = node => {
      for (const decorator of decorators(ts, node)) {
        const kind = decoratorKind(ts, checker, decorator, framework.bySymbol);
        if (!kind) {
          const dynamic = mutableDecoratorKind(ts, checker, decorator, framework.bySymbol)
            ?? constructedDecoratorKind(ts, checker, decorator, framework.bySymbol);
          if (dynamic) {
            const detail = `${relative} uses a mutable or constructed ${dynamic} decorator identity`;
            if (['Entity', 'ViewEntity', 'ArgsType', 'InputType', 'ObjectType', 'multiple framework', 'unproven framework'].includes(dynamic)) layoutReasons.push(detail);
            if (!['Entity', 'ViewEntity'].includes(dynamic)) namingReasons.push(detail);
          }
        }
        if (kind === 'Mutation' || kind === 'Query') graphqlField(config, context, sourceFile, node, decorator, kind, namingReasons, violations);
        if (kind === 'Args') graphqlArgument(config, context, sourceFile, node, decorator, namingReasons, violations);
      }
      if (ts.isCallExpression(node)) {
        if (selectedCallKind(ts, checker, node, framework.bySymbol) === 'registerEnumType') {
          graphqlEnumRegistration(config, context, sourceFile, node, namingReasons, violations);
        } else if (callsNamedHelper(ts, checker, node, 'createEnumType')) {
          namingReasons.push(`${relative} calls a project GraphQL enum adapter whose emitted type name is not statically proved`);
        }
      }
      const exportedFactoryCall = ts.isCallExpression(node) && ts.isVariableDeclaration(node.parent) && publicDeclarations.has(node.parent);
      if ((ts.isNewExpression(node) || exportedFactoryCall) && featureRoot) {
        const constructed = tracedFrameworkKinds(ts, checker, node, framework.bySymbol);
        if (constructed.has('EntitySchema')) violations.push(violation(config, sourceFile, node.expression, SOURCE_LAYOUT_RULE_ID,
          'TypeORM EntitySchema cannot be owned by a feature; place schema under its declared persistence module.'));
        if (constructed.has(UNPROVEN_FRAMEWORK)) layoutReasons.push(`${relative} has a constructed provider identity beyond the bounded static trace`);
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }

  for (const framework of frameworkByChecker.values()) {
    layoutReasons.push(...framework.reasons);
    namingReasons.push(...framework.reasons.filter(reason => reason.includes('@nestjs/graphql')));
  }
  if (checkedFiles === 0) {
    layoutReasons.push('the checked TypeScript program contains no configured backend feature or module source');
    namingReasons.push('the checked TypeScript program contains no configured backend feature or module source');
  }
  if (legacyFiles.length) {
    const roots = config.backend.legacyRoots.join(', ');
    layoutReasons.push(`unsupported legacy source roots contain ${legacyFiles.length} checked file(s): ${roots}`);
    namingReasons.push(`unsupported legacy source roots contain ${legacyFiles.length} checked file(s): ${roots}`);
  }
  const coverage = {
    files: checkedFiles,
    legacyFiles: legacyFiles.sort(),
    layout: layoutReasons.length
      ? { status: 'unavailable', reason: 'one or more backend source placement relations are not statically proved', details: [...new Set(layoutReasons)].sort() }
      : { status: 'checked' },
    naming: namingReasons.length
      ? { status: 'unavailable', reason: 'one or more backend source naming relations are not statically proved', details: [...new Set(namingReasons)].sort() }
      : { status: 'checked' },
  };
  return { violations, coverage };
}

export { SOURCE_LAYOUT_RULE_ID, SOURCE_NAME_RULE_ID };
