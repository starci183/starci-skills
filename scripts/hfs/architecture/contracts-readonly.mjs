import path from 'node:path';
import { relativePath, unwrapExpression } from './typescript.mjs';
import { anyDescendant, nodeDecorators, normalizedSymbol, normalizedSymbolValue, valueSymbol, violation } from './ast-walks.mjs';
import { isConstVariable, sourceLocation } from '../../lib/ts-ast.mjs';

export const READONLY_BOUNDARY_RULE_ID = 'BE_READONLY_BOUNDARY';

export function canonical(file) {
  return path.resolve(file);
}

export function modifiers(ts, node) {
  return ts.canHaveModifiers(node) ? ts.getModifiers(node) ?? [] : node.modifiers ?? [];
}

export function hasModifier(ts, node, kind) {
  return modifiers(ts, node).some(modifier => modifier.kind === kind);
}

export function isPublicMember(ts, node) {
  return !hasModifier(ts, node, ts.SyntaxKind.PrivateKeyword) && !hasModifier(ts, node, ts.SyntaxKind.ProtectedKeyword);
}

function readonlyMember(ts, node) {
  return hasModifier(ts, node, ts.SyntaxKind.ReadonlyKeyword);
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
  return isConstVariable(ts, declarations[0]) ? origin : 'unavailable';
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
    && isConstVariable(ts, declarations[0])) {
    return expressionOrigin(ts, checker, declarations[0].initializer, new Set(seen).add(symbol), depth + 1);
  }
  return symbol;
}

const expressionReferencesOrigin = (ts, checker, expression, expected) =>
  anyDescendant(ts, expression, node => expressionOrigin(ts, checker, node) === expected);

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

const isFunctionBoundary = (ts, node) => ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)
  || ts.isArrowFunction(node) || ts.isMethodDeclaration(node);

/** The instance assignment a `<left> = <origin-derived>` expression performs, or null when its target is no instance member. */
function instanceAssignment(ts, checker, node) {
  const target = instanceAssignmentTarget(ts, checker, node.left);
  if (target.instance) {
    return { node, name: target.name, supported: target.supported && node.operatorToken.kind === ts.SyntaxKind.EqualsToken };
  }
  return assignmentPatternHasInstanceTarget(ts, checker, node.left) ? { node, name: null, supported: false } : null;
}

/** The assignment or mutation call at `node` that stores the constructor parameter on the instance, or null. */
function constructorFinding(ts, checker, node, parameterSymbol) {
  if (ts.isBinaryExpression(node) && expressionReferencesOrigin(ts, checker, node.right, parameterSymbol)
    && !isSafePrimitiveProjection(ts, checker, node.right, parameterSymbol)) {
    return instanceAssignment(ts, checker, node);
  }
  const mutation = instanceMutationCall(ts, checker, node);
  return mutation?.values.some(argument => expressionReferencesOrigin(ts, checker, argument, parameterSymbol))
    ? { node, name: null, supported: false }
    : null;
}

function constructorAssignments(ts, checker, constructor, parameter) {
  if (!constructor.body) return [];
  const parameterSymbol = normalizedSymbol(ts, checker, parameter.name);
  const assignments = [];
  const visit = node => {
    if (node !== constructor.body && isFunctionBoundary(ts, node)) return;
    const finding = constructorFinding(ts, checker, node, parameterSymbol);
    if (finding) assignments.push(finding);
    else ts.forEachChild(node, visit);
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

export function messageClass(config, context, checker, decorator, localFiles, reasons) {
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

function inspectMessageConstructor(state, constructor) {
  const { config, context, checker, sourceFile, violations, reasons } = state;
  const ts = context.ts;
  for (const parameter of constructor.parameters) {
    if (modifiers(ts, parameter).some(modifier => [ts.SyntaxKind.PublicKeyword,
      ts.SyntaxKind.PrivateKeyword, ts.SyntaxKind.ProtectedKeyword, ts.SyntaxKind.ReadonlyKeyword].includes(modifier.kind))) {
      checkReadonlyProperty(config, context, sourceFile, parameter, `Message field ${propertyName(ts, parameter) ?? '(computed)'}`, violations);
    }
  }
  if (!constructor.body) return;
  const inspectAssign = node => {
    if (node !== constructor.body && (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node))) return;
    if (instanceMutationCall(ts, checker, node)) {
      reasons.push(`${relativePath(config.root, sourceFile.fileName)} constructs message fields through an unsupported instance mutation`);
    } else if (ts.isBinaryExpression(node) && assignmentPatternHasInstanceTarget(ts, checker, node.left)
      && !instanceAssignmentTarget(ts, checker, node.left).supported) {
      reasons.push(`${relativePath(config.root, sourceFile.fileName)} constructs message fields through an unsupported instance assignment`);
    } else ts.forEachChild(node, inspectAssign);
  };
  inspectAssign(constructor.body);
}

function inspectMessageMembers(state) {
  const { config, context, checker, declaration, violations, reasons } = state;
  const ts = context.ts;
  const sourceFile = declaration.getSourceFile();
  const classState = { ...state, sourceFile };
  for (const member of declaration.members) {
    if (ts.isPropertyDeclaration(member) && !hasModifier(ts, member, ts.SyntaxKind.StaticKeyword)) {
      checkReadonlyProperty(config, context, sourceFile, member, `Message field ${propertyName(ts, member) ?? '(computed)'}`, violations);
    }
    if (ts.isSetAccessorDeclaration(member)) violations.push(violation(config, sourceFile, member.name, READONLY_BOUNDARY_RULE_ID,
      `Message field ${propertyName(ts, member) ?? '(computed)'} cannot expose a setter.`));
    if (ts.isIndexSignatureDeclaration(member)) reasons.push(`${relativePath(config.root, sourceFile.fileName)} has a message index signature whose mutation boundary cannot be proved`);
    if (ts.isConstructorDeclaration(member)) inspectMessageConstructor(classState, member);
  }
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

function inspectMessageBases(state) {
  const { config, context, checker, declaration, localFiles, sourceFile, visited, reasons } = state;
  const ts = context.ts;
  const type = classInstanceType(ts, checker, declaration);
  for (const base of type && checker.getBaseTypes ? checker.getBaseTypes(type) : []) {
    const declarations = (base.symbol?.getDeclarations?.() ?? []).filter(item => ts.isClassDeclaration(item)) ?? [];
    if (declarations.length !== 1) {
      reasons.push(`${relativePath(config.root, sourceFile.fileName)} inherits message fields from a class outside the checked production program`);
    } else if (localFiles.has(canonical(declarations[0].getSourceFile().fileName))) {
      visitMessageClass({ ...state, declaration: declarations[0], sourceFile: declarations[0].getSourceFile() });
    } else if (classCarriesState(ts, declarations[0])) {
      reasons.push(`${relativePath(config.root, sourceFile.fileName)} inherits message state from a class outside the checked production program`);
    }
  }
}

function visitMessageClass(state) {
  const { declaration, visited } = state;
  const key = `${canonical(declaration.getSourceFile().fileName)}:${declaration.pos}`;
  if (visited.has(key)) return;
  visited.add(key);
  const classState = { ...state, sourceFile: declaration.getSourceFile() };
  inspectMessageMembers(classState);
  inspectMessageBases(classState);
}

export function checkMessageReadonly(config, context, checker, declaration, localFiles, violations, reasons) {
  visitMessageClass({ config, context, checker, declaration, localFiles, visited: new Set(), violations, reasons });
}

function inspectInjectedParameter(state, member, parameter) {
  const { config, context, checker, sourceFile, classKind, properties, framework, violations, reasons } = state;
  const ts = context.ts;
  const explicitInject = nodeDecorators(ts, parameter).some(decorator => framework.decoratorKind(ts, checker, decorator, framework.targets) === 'Inject');
  if (!classKind && !explicitInject) return;
  const parameterProperty = modifiers(ts, parameter).some(modifier => [ts.SyntaxKind.PublicKeyword, ts.SyntaxKind.PrivateKeyword,
    ts.SyntaxKind.ProtectedKeyword, ts.SyntaxKind.ReadonlyKeyword].includes(modifier.kind));
  if (parameterProperty) {
    checkReadonlyProperty(config, context, sourceFile, parameter, `Injected dependency ${propertyName(ts, parameter) ?? '(computed)'}`, violations);
    return;
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

function inspectInjectedConstructor(state, member) {
  for (const parameter of member.parameters) {
    inspectInjectedParameter(state, member, parameter);
  }
}

function inspectInjectedMembers(state) {
  const { config, context, checker, declaration, framework, violations } = state;
  const ts = context.ts;
  const sourceFile = declaration.getSourceFile();
  const classState = { ...state, sourceFile };
  for (const member of declaration.members) {
    if (ts.isPropertyDeclaration(member)) {
      const injected = nodeDecorators(ts, member).some(decorator => framework.decoratorKind(ts, checker, decorator, framework.targets) === 'Inject');
      if (injected) checkReadonlyProperty(config, context, sourceFile, member, `Injected property ${propertyName(ts, member) ?? '(computed)'}`, violations);
      continue;
    }
    if (!ts.isConstructorDeclaration(member)) continue;
    inspectInjectedConstructor(classState, member);
  }
}

function inspectInjectedBases(state) {
  const { config, context, checker, declaration, classKind, framework, localFiles, violations, reasons, visited } = state;
  const ts = context.ts;
  const sourceFile = declaration.getSourceFile();
  const type = classInstanceType(ts, checker, declaration);
  for (const base of type && checker.getBaseTypes ? checker.getBaseTypes(type) : []) {
    const declarations = (base.symbol?.getDeclarations?.() ?? []).filter(item => ts.isClassDeclaration(item)) ?? [];
    if (declarations.length !== 1) {
      reasons.push(`${relativePath(config.root, sourceFile.fileName)} inherits an injected constructor from a class outside the checked production program`);
    } else if (localFiles.has(canonical(declarations[0].getSourceFile().fileName))) {
      checkInjectedClass({ ...state, declaration: declarations[0] });
    } else if (classCarriesState(ts, declarations[0])) {
      reasons.push(`${relativePath(config.root, sourceFile.fileName)} inherits an injected constructor from a class outside the checked production program`);
    }
  }
}

export function checkInjectedClass({ config, context, checker, declaration, classKind, targets, decoratorKind, localFiles, violations, reasons, visited = new Set() }) {
  const ts = context.ts;
  const classKey = `${canonical(declaration.getSourceFile().fileName)}:${declaration.pos}`;
  if (visited.has(classKey)) return;
  visited.add(classKey);
  const properties = new Map(declaration.members.filter(member => ts.isPropertyDeclaration(member))
    .map(member => [propertyName(ts, member), member]).filter(([name]) => name));
  const state = { config, context, checker, declaration, classKind, properties, targets, decoratorKind,
    framework: { targets, decoratorKind }, localFiles, violations, reasons, visited };
  inspectInjectedMembers(state);
  if (classKind) inspectInjectedBases(state);
}
