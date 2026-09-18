import path from 'node:path';
import { isInside } from './config.mjs';
import { isUnshadowedCommonJsRequire, relativePath, sourceLocation } from './typescript.mjs';

export const PUBLIC_CONTRACT_RULE_ID = 'BE_PUBLIC_CONTRACT_FORM';
export const READONLY_BOUNDARY_RULE_ID = 'BE_READONLY_BOUNDARY';

const FRAMEWORK_EXPORTS = new Map([
  ['@nestjs/common', new Set(['Controller', 'Inject', 'Injectable', 'Module'])],
  ['@nestjs/cqrs', new Set(['CommandHandler', 'QueryHandler'])],
  ['@nestjs/graphql', new Set(['Resolver'])],
]);
const NEST_CREATED = new Set(['CommandHandler', 'Controller', 'Injectable', 'QueryHandler', 'Resolver']);
const MESSAGE_HANDLERS = new Set(['CommandHandler', 'QueryHandler']);
const NON_API_SOURCE_ROLES = new Set(['config', 'configuration', 'constants', 'main', 'module', 'module-definition', 'providers']);
const SOURCE_EXTENSION = /\.[cm]?[jt]sx?$/i;
const UNPROVEN_FRAMEWORK = '(unproven framework identity)';

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

function unwrapExpression(ts, expression) {
  while (expression && (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression)
    || ts.isTypeAssertionExpression(expression) || ts.isNonNullExpression(expression)
    || (ts.isSatisfiesExpression?.(expression) ?? false))) expression = expression.expression;
  return expression;
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

function frameworkKindForSymbol(symbol, targets) {
  const selected = targets.get(symbol);
  if (selected) return selected;
  const name = symbol?.getName?.();
  if (!name) return null;
  for (const [packageName, exports] of FRAMEWORK_EXPORTS) {
    if (!exports.has(name)) continue;
    const marker = `/node_modules/${packageName}/`;
    if ((symbol.getDeclarations?.() ?? []).some(declaration => declaration.getSourceFile().fileName.replaceAll('\\', '/').includes(marker))) return name;
  }
  return null;
}

function returnedExpressions(ts, declaration) {
  if ((ts.isArrowFunction(declaration) || ts.isFunctionExpression(declaration)) && !ts.isBlock(declaration.body)) return [declaration.body];
  const body = ts.isFunctionDeclaration(declaration) || ts.isMethodDeclaration(declaration)
    || ts.isArrowFunction(declaration) || ts.isFunctionExpression(declaration) ? declaration.body : null;
  if (!body || !ts.isBlock(body)) return [];
  const returned = [];
  const visit = node => {
    if (node !== body && (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)
      || ts.isArrowFunction(node) || ts.isMethodDeclaration(node))) return;
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
  const direct = symbol ? frameworkKindForSymbol(valueSymbol(ts, checker, selected), targets) : null;
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
  if (!symbol || seen.has(symbol)) return new Set();
  const nextSeen = new Set(seen).add(symbol);
  const kinds = new Set();
  for (const declaration of symbol.getDeclarations?.() ?? []) {
    if (ts.isVariableDeclaration(declaration) && declaration.initializer) {
      for (const kind of tracedFrameworkKinds(ts, checker, declaration.initializer, targets, nextSeen, depth + 1)) kinds.add(kind);
    }
    if (ts.isShorthandPropertyAssignment(declaration)) {
      const target = normalizedSymbolValue(ts, checker, checker.getShorthandAssignmentValueSymbol?.(declaration));
      const kind = frameworkKindForSymbol(target, targets);
      if (kind) kinds.add(kind);
    }
    if (ts.isPropertyAssignment(declaration)) {
      for (const kind of tracedFrameworkKinds(ts, checker, declaration.initializer, targets, nextSeen, depth + 1)) kinds.add(kind);
    }
    for (const returned of returnedExpressions(ts, declaration)) {
      for (const kind of tracedFrameworkKinds(ts, checker, returned, targets, nextSeen, depth + 1)) kinds.add(kind);
    }
  }
  return kinds;
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
  const bySymbol = new Map();
  const reasons = [];
  const program = context.programs.find(candidate => candidate.getTypeChecker() === checker);
  if (!program) return { bySymbol, reasons: ['a TypeScript program checker could not be associated with its source'] };
  for (const sourceFile of program.getSourceFiles()) {
    if (!localFiles.has(canonical(sourceFile.fileName))
      && !(sourceFile.isDeclarationFile && isInside(config.root, sourceFile.fileName)
        && !sourceFile.fileName.replaceAll('\\', '/').includes('/node_modules/'))) continue;
    for (const statement of sourceFile.statements) {
      const moduleSpecifier = (context.ts.isImportDeclaration(statement) || context.ts.isExportDeclaration(statement))
        && statement.moduleSpecifier && context.ts.isStringLiteralLike(statement.moduleSpecifier) ? statement.moduleSpecifier : null;
      const importEquals = context.ts.isImportEqualsDeclaration(statement) && context.ts.isExternalModuleReference(statement.moduleReference)
        && statement.moduleReference.expression && context.ts.isStringLiteralLike(statement.moduleReference.expression)
        ? statement.moduleReference.expression : null;
      const specifierNode = moduleSpecifier ?? importEquals;
      const specifier = specifierNode?.text;
      if (!specifier || !FRAMEWORK_EXPORTS.has(specifier)) continue;
      const moduleSymbol = checker.getSymbolAtLocation(specifierNode);
      if (!moduleSymbol) {
        reasons.push(`${relativePath(config.root, sourceFile.fileName)} cannot resolve ${specifier}`);
        continue;
      }
      const selected = FRAMEWORK_EXPORTS.get(specifier);
      const exports = new Map(checker.getExportsOfModule(moduleSymbol).map(symbol => [symbol.getName(), normalizedSymbolValue(context.ts, checker, symbol)]));
      for (const name of referencedExports(context.ts, statement, selected)) {
        const target = exports.get(name);
        if (target) bySymbol.set(target, name);
        else reasons.push(`${relativePath(config.root, sourceFile.fileName)} cannot resolve ${name} from ${specifier}`);
      }
    }
    const visitRequire = node => {
      if (context.ts.isCallExpression(node) && isUnshadowedCommonJsRequire(context.ts, checker, node.expression)
        && node.arguments.length === 1 && context.ts.isStringLiteralLike(node.arguments[0])
        && FRAMEWORK_EXPORTS.has(node.arguments[0].text)) {
        reasons.push(`${relativePath(config.root, sourceFile.fileName)} uses a CommonJS ${node.arguments[0].text} binding whose contract role cannot be proved`);
      }
      context.ts.forEachChild(node, visitRequire);
    };
    visitRequire(sourceFile);
  }
  return { bySymbol, reasons };
}

function calledExpression(ts, decorator) {
  return ts.isCallExpression(decorator.expression) ? decorator.expression.expression : decorator.expression;
}

function decoratorKind(ts, checker, decorator, targets) {
  const selected = selectedNode(ts, calledExpression(ts, decorator));
  return selected ? frameworkKindForSymbol(valueSymbol(ts, checker, selected), targets) : null;
}

function constructedDecoratorKind(ts, checker, decorator, targets) {
  const kinds = tracedFrameworkKinds(ts, checker, calledExpression(ts, decorator), targets);
  if (kinds.has(UNPROVEN_FRAMEWORK)) return 'unproven framework';
  return kinds.size === 1 ? [...kinds][0] : kinds.size ? 'multiple framework' : null;
}

function decorators(ts, node) {
  return ts.canHaveDecorators(node) ? ts.getDecorators(node) ?? [] : node.decorators ?? [];
}

function modifiers(ts, node) {
  return ts.canHaveModifiers(node) ? ts.getModifiers(node) ?? [] : node.modifiers ?? [];
}

function hasModifier(ts, node, kind) {
  return modifiers(ts, node).some(modifier => modifier.kind === kind);
}

function isPublicMember(ts, node) {
  return !hasModifier(ts, node, ts.SyntaxKind.PrivateKeyword) && !hasModifier(ts, node, ts.SyntaxKind.ProtectedKeyword);
}

function readonlyMember(ts, node) {
  return hasModifier(ts, node, ts.SyntaxKind.ReadonlyKeyword);
}

function violation(config, sourceFile, node, ruleId, message, extra = {}) {
  return { ruleId, path: relativePath(config.root, sourceFile.fileName), ...sourceLocation(sourceFile, node), message, ...extra };
}

function sourceRole(sourceFile) {
  const normalized = sourceFile.fileName.replaceAll('\\', '/');
  const base = path.basename(sourceFile.fileName).replace(SOURCE_EXTENSION, '').toLowerCase();
  const segments = base.split('.');
  const role = segments.length > 1 ? segments.at(-1) : base === 'use-case' || base.endsWith('-use-case') ? 'use-case' : null;
  return { base, role, transport: normalized.includes('/transport/') };
}

function isFrameworkHelper(sourceFile, declaration, framework) {
  const role = sourceRole(sourceFile);
  if (role.transport || NON_API_SOURCE_ROLES.has(role.role) || NON_API_SOURCE_ROLES.has(role.base)) return true;
  if (declaration && declaration.name && /Module$/.test(declaration.name.text ?? '')) {
    return decorators(framework.ts, declaration).some(decorator => decoratorKind(framework.ts, framework.checker, decorator, framework.targets) === 'Module');
  }
  return false;
}

function builtinSymbol(ts, symbol, name) {
  if (!symbol || symbol.getName?.() !== name) return false;
  const declarations = symbol.getDeclarations?.() ?? [];
  return declarations.length > 0 && declarations.every(declaration => declaration.getSourceFile().isDeclarationFile
    && /(?:^|[/\\])lib\.[^/\\]+\.d\.ts$/i.test(declaration.getSourceFile().fileName));
}

function contractTypeStatus(ts, checker, node, seen = new Set(), depth = 0) {
  if (!node || depth > 12) return 'unavailable';
  if (ts.isParenthesizedTypeNode(node)) return contractTypeStatus(ts, checker, node.type, seen, depth + 1);
  if (ts.isTypeOperatorNode(node) && node.operator === ts.SyntaxKind.ReadonlyKeyword) {
    return contractTypeStatus(ts, checker, node.type, seen, depth + 1);
  }
  if (ts.isTypeReferenceNode(node)) {
    const symbol = normalizedSymbol(ts, checker, node.typeName);
    if (!symbol) return 'unavailable';
    if (builtinSymbol(ts, symbol, 'Promise') || builtinSymbol(ts, symbol, 'Readonly') || builtinSymbol(ts, symbol, 'Awaited')) {
      return node.typeArguments?.length === 1 ? contractTypeStatus(ts, checker, node.typeArguments[0], seen, depth + 1) : 'unavailable';
    }
    if (builtinSymbol(ts, symbol, 'Array') || builtinSymbol(ts, symbol, 'ReadonlyArray')) {
      return node.typeArguments?.length === 1 ? contractTypeStatus(ts, checker, node.typeArguments[0], seen, depth + 1) : 'unavailable';
    }
    if (builtinSymbol(ts, symbol, 'Record') || builtinSymbol(ts, symbol, 'Partial') || builtinSymbol(ts, symbol, 'Pick')
      || builtinSymbol(ts, symbol, 'Omit') || builtinSymbol(ts, symbol, 'Required')) return 'inline';
    const declarations = symbol.getDeclarations?.() ?? [];
    if (!declarations.length) return 'unavailable';
    return declarations.every(declaration => ts.isTypeParameterDeclaration(declaration)
      || ts.isInterfaceDeclaration(declaration) || ts.isTypeAliasDeclaration(declaration)
      || ts.isClassDeclaration(declaration) || ts.isEnumDeclaration(declaration)) ? 'named' : 'unavailable';
  }
  if (ts.isArrayTypeNode(node)) return contractTypeStatus(ts, checker, node.elementType, seen, depth + 1);
  if (ts.isTypeLiteralNode(node) || ts.isMappedTypeNode(node) || ts.isUnionTypeNode(node)
    || ts.isIntersectionTypeNode(node) || ts.isTupleTypeNode(node) || ts.isFunctionTypeNode(node)) return 'inline';
  if (ts.isConditionalTypeNode(node) || ts.isIndexedAccessTypeNode(node) || ts.isInferTypeNode(node)
    || ts.isTypeQueryNode(node) || ts.isImportTypeNode(node)) return 'unavailable';
  return 'scalar';
}

function contractTypeStatusFromType(ts, checker, type, seen = new Set(), depth = 0) {
  if (!type || depth > 12 || seen.has(type)) return 'unavailable';
  if (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) return 'unavailable';
  const nextSeen = new Set(seen).add(type);
  const named = type.aliasSymbol ?? type.symbol ?? null;
  for (const wrapper of ['Promise', 'Readonly', 'Awaited', 'Array', 'ReadonlyArray']) if (builtinSymbol(ts, named, wrapper)) {
    const argumentsList = type.aliasTypeArguments ?? (checker.getTypeArguments && (type.objectFlags & ts.ObjectFlags.Reference)
      ? checker.getTypeArguments(type) : type.typeArguments) ?? [];
    return argumentsList.length === 1 ? contractTypeStatusFromType(ts, checker, argumentsList[0], nextSeen, depth + 1) : 'unavailable';
  }
  for (const anonymous of ['Record', 'Partial', 'Pick', 'Omit', 'Required']) if (builtinSymbol(ts, named, anonymous)) return 'inline';
  if (type.aliasSymbol) return 'named';
  if (type.symbol?.getDeclarations?.().some(declaration => ts.isEnumDeclaration(declaration))) return 'named';
  if (type.flags & ts.TypeFlags.TypeParameter) return 'named';
  if (type.flags & ts.TypeFlags.Boolean) return 'scalar';
  if (type.flags & (ts.TypeFlags.Union | ts.TypeFlags.Intersection)) return 'inline';
  if (type.flags & ts.TypeFlags.Object) {
    if (checker.isTupleType?.(type)) return 'inline';
    if (checker.isArrayType?.(type)) {
      const argumentsList = checker.getTypeArguments?.(type) ?? [];
      return argumentsList.length === 1 ? contractTypeStatusFromType(ts, checker, argumentsList[0], nextSeen, depth + 1) : 'unavailable';
    }
    const declarations = type.symbol?.getDeclarations?.() ?? [];
    if (type.symbol && !type.symbol.getName().startsWith('__') && declarations.some(declaration => ts.isInterfaceDeclaration(declaration)
      || ts.isClassDeclaration(declaration) || ts.isTypeAliasDeclaration(declaration) || ts.isEnumDeclaration(declaration))) return 'named';
    return 'inline';
  }
  if (type.flags & (ts.TypeFlags.Conditional | ts.TypeFlags.IndexedAccess | ts.TypeFlags.Substitution)) return 'unavailable';
  return 'scalar';
}

function callableSignatures(ts, symbol, checker, location) {
  const type = checker.getTypeOfSymbolAtLocation(symbol, location);
  const signatures = checker.getSignaturesOfType(type, ts.SignatureKind.Call);
  const bodyless = signatures.filter(signature => signature.getDeclaration() && !signature.getDeclaration().body);
  return bodyless.length ? bodyless : signatures.filter(signature => signature.getDeclaration());
}

function checkSignature(config, context, checker, signature, location, reportSource, reportNode, displayName, violations, reasons) {
  const ts = context.ts;
  const declaration = signature.getDeclaration();
  let signatureIndex = 0;
  for (let index = 0; index < (declaration.parameters?.length ?? 0); index += 1) {
    const parameter = declaration.parameters[index];
    if (parameter.name && ts.isIdentifier(parameter.name) && parameter.name.text === 'this') continue;
    if (!parameter.type) {
      violations.push(violation(config, reportSource, reportNode ?? parameter, PUBLIC_CONTRACT_RULE_ID,
        `${displayName} must declare the type of each public input.`));
      signatureIndex += 1;
      continue;
    }
    const parameterSymbol = signature.getParameters()[signatureIndex];
    signatureIndex += 1;
    const actual = parameterSymbol ? checker.getTypeOfSymbolAtLocation(parameterSymbol, location) : null;
    let status;
    if (actual && parameter.questionToken && !ts.isUnionTypeNode(parameter.type) && (actual.flags & ts.TypeFlags.Union)) {
      const selected = actual.types.filter(type => !(type.flags & ts.TypeFlags.Undefined));
      status = selected.length === 1 ? contractTypeStatusFromType(ts, checker, selected[0]) : 'inline';
    } else status = actual ? contractTypeStatusFromType(ts, checker, actual) : contractTypeStatus(ts, checker, parameter.type);
    if (status === 'inline') violations.push(violation(config, reportSource, reportNode ?? parameter.type, PUBLIC_CONTRACT_RULE_ID,
      `${displayName} uses an inline object/union input; expose a named contract or a positional primitive.`));
    else if (status === 'unavailable') reasons.push(`${relativePath(config.root, reportSource.fileName)} cannot prove the public input type of ${displayName}`);
  }
  if (!declaration.type) {
    violations.push(violation(config, reportSource, reportNode ?? declaration, PUBLIC_CONTRACT_RULE_ID,
      `${displayName} must declare an explicit public output type.`));
    return;
  }
  const actual = checker.getReturnTypeOfSignature(signature);
  const status = actual ? contractTypeStatusFromType(ts, checker, actual) : contractTypeStatus(ts, checker, declaration.type);
  if (status === 'inline') violations.push(violation(config, reportSource, reportNode ?? declaration.type, PUBLIC_CONTRACT_RULE_ID,
    `${displayName} uses an inline object/union output; expose a named result contract or a primitive.`));
  else if (status === 'unavailable') reasons.push(`${relativePath(config.root, reportSource.fileName)} cannot prove the public output type of ${displayName}`);
}

function symbolName(symbol) {
  const name = symbol.getName?.() ?? '(anonymous)';
  return name === '__call' ? '(callable)' : name;
}

function isRepositoryDeclaration(declaration, localFiles) {
  return localFiles.has(canonical(declaration.getSourceFile().fileName));
}

function callableMembers(ts, checker, symbol, location, localFiles) {
  const declarations = symbol.getDeclarations?.() ?? [];
  const classExpressions = declarations.flatMap(declaration => ts.isVariableDeclaration(declaration)
    && declaration.initializer && ts.isClassExpression(unwrapExpression(ts, declaration.initializer))
    ? [unwrapExpression(ts, declaration.initializer)] : []);
  const valueType = checker.getTypeOfSymbolAtLocation(symbol, location);
  const declaredClassLike = declarations.some(declaration => ts.isClassDeclaration(declaration) || ts.isInterfaceDeclaration(declaration));
  const primary = declaredClassLike ? checker.getDeclaredTypeOfSymbol(symbol) : valueType;
  const types = [primary];
  if (declaredClassLike || classExpressions.length) types.push(valueType);
  for (const signature of checker.getSignaturesOfType(valueType, ts.SignatureKind.Construct)) types.push(checker.getReturnTypeOfSignature(signature));
  const direct = checker.getSignaturesOfType(primary, ts.SignatureKind.Call).length ? [symbol] : [];
  const members = types.flatMap(type => checker.getPropertiesOfType(type)).filter(member => {
    if (member.getName() === 'prototype') return false;
    const selected = member.getDeclarations?.() ?? [];
    return selected.some(declaration => (ts.isMethodDeclaration(declaration) || ts.isMethodSignature(declaration)
      || ts.isPropertyDeclaration(declaration) || ts.isPropertySignature(declaration) || ts.isGetAccessorDeclaration(declaration))
      && isPublicMember(ts, declaration) && isRepositoryDeclaration(declaration, localFiles))
      && checker.getSignaturesOfType(checker.getTypeOfSymbolAtLocation(member, location), ts.SignatureKind.Call).length;
  });
  return [...new Set([...direct, ...members])];
}

function exportedSymbols(ts, checker, sourceFile) {
  const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
  return moduleSymbol ? checker.getExportsOfModule(moduleSymbol).map(symbol => normalizedSymbolValue(ts, checker, symbol)).filter(Boolean) : [];
}

function checkCallableSymbol(config, context, checker, symbol, location, reportSource, reportNode, violations, reasons, seen, localFiles) {
  if (seen.has(symbol)) return 0;
  seen.add(symbol);
  let checked = 0;
  for (const callable of callableMembers(context.ts, checker, symbol, location, localFiles)) {
    if (callable !== symbol && seen.has(callable)) continue;
    seen.add(callable);
    const signatures = callableSignatures(context.ts, callable, checker, location);
    if (!signatures.length) {
      reasons.push(`${relativePath(config.root, reportSource.fileName)} cannot resolve the callable signature of ${symbolName(callable)}`);
      continue;
    }
    for (const signature of signatures) {
      checked += 1;
      checkSignature(config, context, checker, signature, location, reportSource, reportNode,
        callable === symbol ? symbolName(symbol) : `${symbolName(symbol)}.${symbolName(callable)}`,
        violations, reasons);
    }
  }
  return checked;
}

function propertyName(ts, node) {
  const name = node.name;
  if (ts.isIdentifier(name) || ts.isStringLiteralLike(name) || ts.isPrivateIdentifier(name)) return name.text;
  return null;
}

function thisOriginStatus(ts, checker, expression, seen = new Set(), depth = 0) {
  if (!expression || depth > 8) return 'no';
  expression = unwrapExpression(ts, expression);
  if (expression.kind === ts.SyntaxKind.ThisKeyword) return 'yes';
  const symbol = normalizedSymbol(ts, checker, expression);
  if (!symbol || seen.has(symbol)) return 'no';
  const declarations = symbol.getDeclarations?.() ?? [];
  if (declarations.length !== 1 || !ts.isVariableDeclaration(declarations[0]) || !declarations[0].initializer) return 'no';
  const origin = thisOriginStatus(ts, checker, declarations[0].initializer, new Set(seen).add(symbol), depth + 1);
  if (origin === 'no') return 'no';
  return (ts.getCombinedNodeFlags(declarations[0].parent) & ts.NodeFlags.Const) ? origin : 'unavailable';
}

function instanceAssignmentTarget(ts, checker, expression) {
  expression = unwrapExpression(ts, expression);
  if (!ts.isPropertyAccessExpression(expression) && !ts.isElementAccessExpression(expression)) return { instance: false };
  const owner = thisOriginStatus(ts, checker, expression.expression);
  if (owner === 'no') return { instance: false };
  if (owner === 'unavailable') return { instance: true, name: null, supported: false };
  if (ts.isPropertyAccessExpression(expression)) return { instance: true, name: expression.name.text, supported: true };
  if (ts.isStringLiteralLike(expression.argumentExpression)) return { instance: true, name: expression.argumentExpression.text, supported: true };
  return { instance: true, name: null, supported: false };
}

function expressionOrigin(ts, checker, expression, seen = new Set(), depth = 0) {
  if (!expression || depth > 8) return null;
  expression = unwrapExpression(ts, expression);
  const shorthand = ts.isShorthandPropertyAssignment(expression) ? checker.getShorthandAssignmentValueSymbol?.(expression) : null;
  const symbol = normalizedSymbolValue(ts, checker, shorthand) ?? normalizedSymbol(ts, checker, expression);
  if (!symbol || seen.has(symbol)) return symbol;
  const declarations = symbol.getDeclarations?.() ?? [];
  if (declarations.length === 1 && ts.isVariableDeclaration(declarations[0]) && declarations[0].initializer
    && (ts.getCombinedNodeFlags(declarations[0].parent) & ts.NodeFlags.Const)) {
    return expressionOrigin(ts, checker, declarations[0].initializer, new Set(seen).add(symbol), depth + 1);
  }
  return symbol;
}

function expressionReferencesOrigin(ts, checker, expression, expected) {
  let found = false;
  const visit = node => {
    if (found) return;
    if (expressionOrigin(ts, checker, node) === expected) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(expression);
  return found;
}

function isSafePrimitiveProjection(ts, checker, expression, expected) {
  expression = unwrapExpression(ts, expression);
  if (!ts.isPropertyAccessExpression(expression) && !ts.isElementAccessExpression(expression)) return false;
  if (expressionOrigin(ts, checker, expression.expression) !== expected) return false;
  const type = checker.getTypeAtLocation(expression);
  const primitive = ts.TypeFlags.StringLike | ts.TypeFlags.NumberLike | ts.TypeFlags.BooleanLike
    | ts.TypeFlags.BigIntLike | ts.TypeFlags.ESSymbolLike | ts.TypeFlags.Null | ts.TypeFlags.Undefined
    | ts.TypeFlags.Void | ts.TypeFlags.Never;
  return Boolean(type.flags & primitive) && !(type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown));
}

function assignmentPatternHasInstanceTarget(ts, checker, expression) {
  let found = false;
  const visit = node => {
    if (found) return;
    const target = instanceAssignmentTarget(ts, checker, node);
    if (target.instance) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(expression);
  return found;
}

function globalLibraryIdentifier(ts, checker, node, expected) {
  if (!ts.isIdentifier(node) || node.text !== expected) return false;
  const symbol = normalizedSymbol(ts, checker, node);
  const declarations = symbol?.getDeclarations?.() ?? [];
  return declarations.length > 0 && declarations.every(declaration => declaration.getSourceFile().isDeclarationFile
    && /(?:^|[/\\])lib\.[^/\\]+\.d\.ts$/i.test(declaration.getSourceFile().fileName));
}

function instanceMutationCall(ts, checker, node) {
  if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return null;
  const owner = node.expression.expression;
  const method = node.expression.name.text;
  const known = (method === 'assign' || method === 'defineProperty') && globalLibraryIdentifier(ts, checker, owner, 'Object')
    || method === 'set' && globalLibraryIdentifier(ts, checker, owner, 'Reflect');
  if (!known || thisOriginStatus(ts, checker, node.arguments[0]) === 'no') return null;
  return { node, values: node.arguments.slice(method === 'assign' ? 1 : 2) };
}

function constructorAssignments(ts, checker, constructor, parameter) {
  if (!constructor.body) return [];
  const parameterSymbol = normalizedSymbol(ts, checker, parameter.name);
  const assignments = [];
  const visit = node => {
    if (node !== constructor.body && (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)
      || ts.isArrowFunction(node) || ts.isMethodDeclaration(node))) return;
    if (ts.isBinaryExpression(node) && expressionReferencesOrigin(ts, checker, node.right, parameterSymbol)
      && !isSafePrimitiveProjection(ts, checker, node.right, parameterSymbol)) {
      const target = instanceAssignmentTarget(ts, checker, node.left);
      if (target.instance) assignments.push({ node, name: target.name,
        supported: target.supported && node.operatorToken.kind === ts.SyntaxKind.EqualsToken });
      else if (assignmentPatternHasInstanceTarget(ts, checker, node.left)) assignments.push({ node, name: null, supported: false });
      else ts.forEachChild(node, visit);
    } else {
      const mutation = instanceMutationCall(ts, checker, node);
      if (mutation?.values.some(argument => expressionReferencesOrigin(ts, checker, argument, parameterSymbol))) {
        assignments.push({ node, name: null, supported: false });
      } else ts.forEachChild(node, visit);
    }
  };
  visit(constructor.body);
  return assignments;
}

function checkReadonlyProperty(config, context, sourceFile, node, label, violations) {
  if (!readonlyMember(context.ts, node)) violations.push(violation(config, sourceFile, node.name ?? node, READONLY_BOUNDARY_RULE_ID,
    `${label} must be readonly; execution state must not mutate an injected dependency or received message.`));
}

function classValuesForSymbol(ts, symbol, localFiles) {
  return (symbol?.getDeclarations?.() ?? []).flatMap(declaration => {
    if (ts.isClassDeclaration(declaration)) return [declaration];
    if (ts.isVariableDeclaration(declaration) && declaration.initializer) {
      const initializer = unwrapExpression(ts, declaration.initializer);
      if (ts.isClassExpression(initializer)) return [initializer];
    }
    return [];
  }).filter(declaration => localFiles.has(canonical(declaration.getSourceFile().fileName)));
}

function messageClass(config, context, checker, decorator, localFiles, reasons) {
  const expression = decorator.expression;
  if (!context.ts.isCallExpression(expression) || expression.arguments.length < 1) {
    reasons.push(`${relativePath(config.root, decorator.getSourceFile().fileName)} has a handler decorator without a static message class`);
    return null;
  }
  const symbol = valueSymbol(context.ts, checker, expression.arguments[0]);
  const declarations = classValuesForSymbol(context.ts, symbol, localFiles);
  if (declarations.length !== 1) {
    reasons.push(`${relativePath(config.root, decorator.getSourceFile().fileName)} cannot resolve one local message class from its handler decorator`);
    return null;
  }
  return declarations[0];
}

function checkMessageReadonly(config, context, checker, declaration, localFiles, violations, reasons) {
  const ts = context.ts;
  const visited = new Set();
  const visitClass = selected => {
    const key = `${canonical(selected.getSourceFile().fileName)}:${selected.pos}`;
    if (visited.has(key)) return;
    visited.add(key);
    const sourceFile = selected.getSourceFile();
    for (const member of selected.members) {
      if (ts.isPropertyDeclaration(member) && !hasModifier(ts, member, ts.SyntaxKind.StaticKeyword)) {
        checkReadonlyProperty(config, context, sourceFile, member, `Message field ${propertyName(ts, member) ?? '(computed)'}`, violations);
      }
      if (ts.isSetAccessorDeclaration(member)) violations.push(violation(config, sourceFile, member.name, READONLY_BOUNDARY_RULE_ID,
        `Message field ${propertyName(ts, member) ?? '(computed)'} cannot expose a setter.`));
      if (ts.isIndexSignatureDeclaration(member)) reasons.push(`${relativePath(config.root, sourceFile.fileName)} has a message index signature whose mutation boundary cannot be proved`);
      if (ts.isConstructorDeclaration(member)) {
        for (const parameter of member.parameters) if (modifiers(ts, parameter).some(modifier => [ts.SyntaxKind.PublicKeyword,
          ts.SyntaxKind.PrivateKeyword, ts.SyntaxKind.ProtectedKeyword, ts.SyntaxKind.ReadonlyKeyword].includes(modifier.kind))) {
          checkReadonlyProperty(config, context, sourceFile, parameter, `Message field ${propertyName(ts, parameter) ?? '(computed)'}`, violations);
        }
        const inspectAssign = node => {
          if (node !== member.body && (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node))) return;
          if (instanceMutationCall(ts, checker, node)) {
            reasons.push(`${relativePath(config.root, sourceFile.fileName)} constructs message fields through an unsupported instance mutation`);
          } else if (ts.isBinaryExpression(node) && assignmentPatternHasInstanceTarget(ts, checker, node.left)
            && !instanceAssignmentTarget(ts, checker, node.left).supported) {
            reasons.push(`${relativePath(config.root, sourceFile.fileName)} constructs message fields through an unsupported instance assignment`);
          } else ts.forEachChild(node, inspectAssign);
        };
        if (member.body) inspectAssign(member.body);
      }
    }
    const type = classInstanceType(ts, checker, selected);
    for (const base of type && checker.getBaseTypes ? checker.getBaseTypes(type) : []) {
      const declarations = base.symbol?.getDeclarations?.().filter(item => ts.isClassDeclaration(item)) ?? [];
      if (declarations.length !== 1) {
        reasons.push(`${relativePath(config.root, sourceFile.fileName)} inherits message fields from a class outside the checked production program`);
      } else if (localFiles.has(canonical(declarations[0].getSourceFile().fileName))) visitClass(declarations[0]);
      else if (classCarriesState(ts, declarations[0])) {
        reasons.push(`${relativePath(config.root, sourceFile.fileName)} inherits message state from a class outside the checked production program`);
      }
    }
  };
  visitClass(declaration);
}

function classCarriesState(ts, declaration) {
  return declaration.members.some(member => (ts.isPropertyDeclaration(member) && !hasModifier(ts, member, ts.SyntaxKind.StaticKeyword))
    || ts.isSetAccessorDeclaration(member) || ts.isIndexSignatureDeclaration(member)
    || (ts.isConstructorDeclaration(member) && member.parameters.length > 0));
}

function classInstanceType(ts, checker, declaration) {
  const symbol = declaration.name ? normalizedSymbol(ts, checker, declaration.name) : null;
  if (symbol && ts.isClassDeclaration(declaration)) return checker.getDeclaredTypeOfSymbol(symbol);
  const value = checker.getTypeAtLocation(declaration);
  const constructor = checker.getSignaturesOfType(value, ts.SignatureKind.Construct)[0];
  return constructor ? checker.getReturnTypeOfSignature(constructor) : value;
}

function checkInjectedClass(config, context, checker, declaration, classKind, targets, localFiles, violations, reasons, visited = new Set()) {
  const ts = context.ts;
  const classKey = `${canonical(declaration.getSourceFile().fileName)}:${declaration.pos}`;
  if (visited.has(classKey)) return;
  visited.add(classKey);
  const sourceFile = declaration.getSourceFile();
  const properties = new Map(declaration.members.filter(member => ts.isPropertyDeclaration(member))
    .map(member => [propertyName(ts, member), member]).filter(([name]) => name));
  for (const member of declaration.members) {
    if (ts.isPropertyDeclaration(member)) {
      const injected = decorators(ts, member).some(decorator => decoratorKind(ts, checker, decorator, targets) === 'Inject');
      if (injected) checkReadonlyProperty(config, context, sourceFile, member, `Injected property ${propertyName(ts, member) ?? '(computed)'}`, violations);
      continue;
    }
    if (!ts.isConstructorDeclaration(member)) continue;
    for (const parameter of member.parameters) {
      const explicitInject = decorators(ts, parameter).some(decorator => decoratorKind(ts, checker, decorator, targets) === 'Inject');
      if (!classKind && !explicitInject) continue;
      const parameterProperty = modifiers(ts, parameter).some(modifier => [ts.SyntaxKind.PublicKeyword, ts.SyntaxKind.PrivateKeyword,
        ts.SyntaxKind.ProtectedKeyword, ts.SyntaxKind.ReadonlyKeyword].includes(modifier.kind));
      if (parameterProperty) {
        checkReadonlyProperty(config, context, sourceFile, parameter, `Injected dependency ${propertyName(ts, parameter) ?? '(computed)'}`, violations);
        continue;
      }
      for (const assignment of constructorAssignments(ts, checker, member, parameter)) {
        if (!assignment.supported || !assignment.name) {
          reasons.push(`${relativePath(config.root, sourceFile.fileName)}:${sourceLocation(sourceFile, assignment.node).line} stores an injected dependency through an unsupported instance assignment`);
          continue;
        }
        const property = properties.get(assignment.name);
        if (!property) reasons.push(`${relativePath(config.root, sourceFile.fileName)} assigns injected dependency ${assignment.name} without a declared field`);
        else checkReadonlyProperty(config, context, sourceFile, property, `Injected dependency ${assignment.name}`, violations);
      }
    }
  }
  if (classKind) {
    const type = classInstanceType(ts, checker, declaration);
    for (const base of type && checker.getBaseTypes ? checker.getBaseTypes(type) : []) {
      const declarations = base.symbol?.getDeclarations?.().filter(item => ts.isClassDeclaration(item)) ?? [];
      if (declarations.length !== 1) {
        reasons.push(`${relativePath(config.root, sourceFile.fileName)} inherits an injected constructor from a class outside the checked production program`);
      } else if (localFiles.has(canonical(declarations[0].getSourceFile().fileName))) {
        checkInjectedClass(config, context, checker, declarations[0], classKind, targets, localFiles, violations, reasons, visited);
      } else if (classCarriesState(ts, declarations[0])) {
        reasons.push(`${relativePath(config.root, sourceFile.fileName)} inherits an injected constructor from a class outside the checked production program`);
      }
    }
  }
}

/** Enforce mechanically selected public contract and readonly boundaries without treating DTOs or arbitrary interfaces as APIs. */
export function checkBackendContracts(config, context) {
  const ts = context.ts;
  const localFiles = new Set(context.files.map(file => canonical(file.fileName)));
  const sourceFiles = new Map(context.files.map(file => [canonical(file.fileName), file]));
  const frameworkByChecker = new Map();
  const violations = [];
  const publicReasons = [];
  const readonlyReasons = [];
  const publicSeen = new Set();
  const messageSeen = new Set();
  let callableSignatures = 0;
  let injectedClasses = 0;
  let messages = 0;

  const frameworkFor = checker => {
    if (!frameworkByChecker.has(checker)) {
      const selected = frameworkTargets(config, context, checker, localFiles);
      frameworkByChecker.set(checker, { ...selected, ts, checker, targets: selected.bySymbol });
      readonlyReasons.push(...selected.reasons);
    }
    return frameworkByChecker.get(checker);
  };

  if (!config.owners?.length) publicReasons.push('architecture.json does not declare owners and public entries for capability API discovery');
  const ownerRoots = (config.owners ?? []).map(owner => path.resolve(config.root, ...owner.root.split('/')));
  const publicSourceRoots = [...config.backend.features, ...config.backend.modules].map(root => path.resolve(config.root, ...root.split('/')));
  for (const sourceFile of context.files) if (publicSourceRoots.some(root => isInside(root, sourceFile.fileName))
    && !ownerRoots.some(root => isInside(root, sourceFile.fileName))) {
    publicReasons.push(`${relativePath(config.root, sourceFile.fileName)} is outside every declared owner root`);
  }
  if (config.owners) for (const owner of config.owners) {
    const entry = sourceFiles.get(canonical(path.resolve(config.root, ...owner.entry.split('/'))));
    if (!entry) {
      publicReasons.push(`${owner.entry} is outside the checked production program`);
      continue;
    }
    const checker = context.checkerFor(entry.fileName);
    const framework = frameworkFor(checker);
    if (entry.statements.some(statement => ts.isExportAssignment(statement) && statement.isExportEquals)) {
      publicReasons.push(`${owner.entry} uses export =, so named capability API discovery is unavailable`);
    }
    for (const symbol of exportedSymbols(ts, checker, entry)) {
      const declarations = symbol.getDeclarations?.().filter(declaration => localFiles.has(canonical(declaration.getSourceFile().fileName))) ?? [];
      if (!declarations.length) continue;
      const representative = declarations[0];
      if (isFrameworkHelper(representative.getSourceFile(), representative, framework)) continue;
      callableSignatures += checkCallableSymbol(config, context, checker, symbol, representative, representative.getSourceFile(), representative.name ?? representative,
        violations, publicReasons, publicSeen, localFiles);
    }
  }

  for (const sourceFile of context.files) {
    const checker = context.checkerFor(sourceFile.fileName);
    const framework = frameworkFor(checker);
    const role = sourceRole(sourceFile);
    const classes = [];
    const collectClasses = node => {
      if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) classes.push(node);
      ts.forEachChild(node, collectClasses);
    };
    collectClasses(sourceFile);
    for (const statement of classes) {
      const classDecorators = decorators(ts, statement);
      const kindsByDecorator = classDecorators.map(decorator => decoratorKind(ts, checker, decorator, framework.targets));
      const directKinds = kindsByDecorator.filter(Boolean);
      for (const decorator of classDecorators) if (!decoratorKind(ts, checker, decorator, framework.targets)) {
        const constructed = constructedDecoratorKind(ts, checker, decorator, framework.targets);
        if (constructed && (NEST_CREATED.has(constructed) || MESSAGE_HANDLERS.has(constructed) || constructed.includes('framework'))) {
          readonlyReasons.push(`${relativePath(config.root, sourceFile.fileName)} has a constructed ${constructed} decorator identity`);
        }
      }
      const classKind = directKinds.find(kind => NEST_CREATED.has(kind)) ?? null;
      for (const member of statement.members) for (const decorated of [member, ...(ts.isConstructorDeclaration(member) ? member.parameters : [])]) {
        for (const decorator of decorators(ts, decorated)) if (!decoratorKind(ts, checker, decorator, framework.targets)) {
          const constructed = constructedDecoratorKind(ts, checker, decorator, framework.targets);
          if (constructed === 'Inject' || constructed === 'unproven framework') {
            readonlyReasons.push(`${relativePath(config.root, sourceFile.fileName)} has a constructed ${constructed} injection decorator identity`);
          }
        }
      }
      const hasInjectedMember = statement.members.some(member => decorators(ts, member).some(decorator => decoratorKind(ts, checker, decorator, framework.targets) === 'Inject')
        || (ts.isConstructorDeclaration(member) && member.parameters.some(parameter => decorators(ts, parameter)
          .some(decorator => decoratorKind(ts, checker, decorator, framework.targets) === 'Inject'))));
      if (classKind || hasInjectedMember) {
        injectedClasses += 1;
        checkInjectedClass(config, context, checker, statement, classKind, framework.targets, localFiles, violations, readonlyReasons);
      }
      for (let index = 0; index < classDecorators.length; index += 1) {
        const kind = kindsByDecorator[index];
        if (!MESSAGE_HANDLERS.has(kind)) continue;
        const message = messageClass(config, context, checker, classDecorators[index], localFiles, readonlyReasons);
        if (!message) continue;
        const key = `${message.getSourceFile().fileName}:${message.pos}`;
        if (messageSeen.has(key)) continue;
        messageSeen.add(key);
        messages += 1;
        checkMessageReadonly(config, context, context.checkerFor(message.getSourceFile().fileName), message, localFiles, violations, readonlyReasons);
      }
      if (role.role === 'use-case' && !role.transport && ts.isClassDeclaration(statement) && statement.name) {
        const exported = exportedSymbols(ts, checker, sourceFile).some(symbol => (symbol.getDeclarations?.() ?? []).includes(statement));
        if (!exported) continue;
        const classSymbol = normalizedSymbol(ts, checker, statement.name);
        const instanceType = classSymbol ? checker.getDeclaredTypeOfSymbol(classSymbol) : null;
        const execute = instanceType ? checker.getPropertyOfType(instanceType, 'execute') : null;
        if (!execute) publicReasons.push(`${relativePath(config.root, sourceFile.fileName)} exports a use-case class without a statically resolved execute contract`);
        else callableSignatures += checkCallableSymbol(config, context, checker, execute, statement, sourceFile, statement.name,
          violations, publicReasons, publicSeen, localFiles);
      }
    }
  }

  const publicDetails = [...new Set(publicReasons)].sort();
  const readonlyDetails = [...new Set(readonlyReasons)].sort();
  return {
    violations,
    coverage: {
      publicContracts: publicDetails.length ? { status: 'unavailable', callableSignatures, details: publicDetails }
        : { status: 'checked', callableSignatures },
      readonlyBoundaries: readonlyDetails.length ? { status: 'unavailable', injectedClasses, messages, details: readonlyDetails }
        : { status: 'checked', injectedClasses, messages },
    },
  };
}
