import path from 'node:path';
import { canonical, isInside } from './config.mjs';
import { parseContract, installedSWR } from './next-data-contract.mjs';
import { relativePath, unwrapExpression } from './typescript.mjs';
import { anyDescendant, normalizedSymbol, normalizedSymbolValue, selectedNode, valueSymbol as sharedValueSymbol } from './ast-walks.mjs';
import { sourceLocation } from '../../lib/ts-ast.mjs';

export const SWR_KEY_RULE_ID = 'FE_SWR_KEY_IDENTITY';
export const SWR_MUTATION_RULE_ID = 'FE_SWR_MUTATION_RESOURCE_IDENTITY';
export const SWR_DATA_RULE_IDS = [SWR_KEY_RULE_ID, SWR_MUTATION_RULE_ID];

const SWR_SPECIFIERS = new Set(['swr', 'swr/immutable', 'swr/mutation']);

/* null when the expression selects no name at all (the shared default traces the unselected node itself). */
const valueSymbol = (ts, checker, expression, seen = new Set()) =>
  sharedValueSymbol(ts, checker, expression, seen, { unselected: 'null' });

function declarationsInside(symbol, root) {
  const declarations = symbol?.getDeclarations?.() ?? [];
  return declarations.length > 0 && declarations.every(declaration => isInside(root, canonical(declaration.getSourceFile().fileName)));
}

function officialTargets(config, context, installed, reasons) {
  const wanted = new Map([
    ['swr', new Map([['default', 'query'], ['mutate', 'global-mutate'], ['useSWRConfig', 'config']])],
    ['swr/immutable', new Map([['default', 'query']])],
    ['swr/mutation', new Map([['default', 'mutation'], ['useSWRMutation', 'mutation']])],
  ]);
  const targets = new Map();
  let selectedBindings = 0;
  for (const source of context.files) {
    const checker = context.checkerFor(source.fileName);
    for (const statement of source.statements) {
      if (!context.ts.isImportDeclaration(statement) && !context.ts.isExportDeclaration(statement)) continue;
      if (!statement.moduleSpecifier || !context.ts.isStringLiteralLike(statement.moduleSpecifier)) continue;
      const selected = wanted.get(statement.moduleSpecifier.text);
      if (!selected) continue;
      const moduleSymbol = checker.getSymbolAtLocation(statement.moduleSpecifier);
      if (!moduleSymbol) {
        reasons.push(`${relativePath(config.root, source.fileName)} cannot resolve ${statement.moduleSpecifier.text} through the target TypeScript program`);
        continue;
      }
      const exports = new Map(checker.getExportsOfModule(moduleSymbol).map(symbol => [symbol.getName(), normalizedSymbolValue(context.ts, checker, symbol)]));
      for (const [name, kind] of selected) {
        const target = exports.get(name);
        if (!target) continue;
        if (!declarationsInside(target, installed.root)) {
          reasons.push(`${relativePath(config.root, source.fileName)} resolves ${statement.moduleSpecifier.text}#${name} outside installed swr ${installed.version}`);
          continue;
        }
        targets.set(target, kind);
      }
      if (context.ts.isImportDeclaration(statement) && statement.importClause) {
        const clause = statement.importClause;
        if (clause.name && selected.has('default')) selectedBindings += 1;
        const bindings = clause.namedBindings;
        if (bindings && context.ts.isNamespaceImport(bindings)) selectedBindings += 1;
        if (bindings && context.ts.isNamedImports(bindings)) selectedBindings += bindings.elements
          .filter(element => selected.has(element.propertyName?.text ?? element.name.text)).length;
      }
    }
  }
  return { targets, selectedBindings };
}

function callKind(ts, checker, call, targets, configMutates = new Set()) {
  const symbol = valueSymbol(ts, checker, call.expression);
  return configMutates.has(symbol) ? 'global-mutate' : targets.get(symbol) ?? null;
}

function bindingNames(ts, name) {
  if (ts.isIdentifier(name)) return [name.text];
  if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) return name.elements.flatMap(element => {
    if (!element || ts.isOmittedExpression(element)) return [];
    return bindingNames(ts, element.name);
  });
  return [];
}

function resultBindings(ts, call) {
  let current = call;
  while (current.parent && (ts.isParenthesizedExpression(current.parent) || ts.isAsExpression(current.parent)
    || ts.isTypeAssertionExpression(current.parent) || ts.isNonNullExpression(current.parent)
    || (ts.isSatisfiesExpression?.(current.parent) ?? false)
    || ((ts.isPropertyAccessExpression(current.parent) || ts.isElementAccessExpression(current.parent)) && current.parent.expression === current))) {
    current = current.parent;
  }
  return current.parent && ts.isVariableDeclaration(current.parent) && current.parent.initializer === current
    ? bindingNames(ts, current.parent.name) : [];
}

function nearestFunction(ts, node) {
  for (let current = node.parent; current; current = current.parent) if (ts.isFunctionDeclaration(current)
    || ts.isFunctionExpression(current) || ts.isArrowFunction(current) || ts.isMethodDeclaration(current)) return current;
  return null;
}

function configMutateSymbols(config, context, targets) {
  const symbols = new Set();
  for (const source of context.files) {
    const checker = context.checkerFor(source.fileName);
    const visit = node => {
      if (context.ts.isVariableDeclaration(node) && context.ts.isObjectBindingPattern(node.name) && node.initializer
        && context.ts.isCallExpression(unwrapExpression(context.ts, node.initializer))
        && callKind(context.ts, checker, unwrapExpression(context.ts, node.initializer), targets) === 'config') {
        for (const element of node.name.elements) {
          const property = element.propertyName && context.ts.isIdentifier(element.propertyName) ? element.propertyName.text
            : context.ts.isIdentifier(element.name) ? element.name.text : null;
          if (property === 'mutate' && context.ts.isIdentifier(element.name)) symbols.add(normalizedSymbol(context.ts, checker, element.name));
        }
      }
      context.ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return symbols;
}

function discoverCalls(config, context, targets) {
  const configMutates = configMutateSymbols(config, context, targets);
  const calls = [];
  for (const source of context.files) {
    const checker = context.checkerFor(source.fileName);
    const visit = node => {
      if (context.ts.isCallExpression(node)) {
        const kind = callKind(context.ts, checker, node, targets, configMutates);
        if (kind && kind !== 'config') calls.push({ kind, node, source, checker, owner: nearestFunction(context.ts, node), bindings: resultBindings(context.ts, node) });
      }
      context.ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return calls;
}

function functionNode(ts, declaration) {
  if (ts.isFunctionDeclaration(declaration) && declaration.body) return declaration;
  if (ts.isVariableDeclaration(declaration) && declaration.initializer) {
    const value = unwrapExpression(ts, declaration.initializer);
    if (ts.isArrowFunction(value) || ts.isFunctionExpression(value)) return value;
  }
  return null;
}

function exportedHook(config, context, entry, reasons) {
  const source = context.files.find(candidate => canonical(candidate.fileName) === canonical(path.join(config.root, ...entry.path.split('/'))));
  if (!source) {
    reasons.push(`${entry.path} is outside the canonical production TypeScript program`);
    return null;
  }
  const checker = context.checkerFor(source.fileName);
  const moduleSymbol = checker.getSymbolAtLocation(source);
  const exported = moduleSymbol ? checker.getExportsOfModule(moduleSymbol).find(symbol => symbol.getName() === entry.export) : null;
  const symbol = normalizedSymbolValue(context.ts, checker, exported);
  const declarations = (symbol?.getDeclarations?.() ?? []).filter(declaration => canonical(declaration.getSourceFile().fileName) === canonical(source.fileName));
  const functions = declarations.map(declaration => functionNode(context.ts, declaration)).filter(Boolean);
  if (functions.length !== 1) {
    reasons.push(`${entry.path}#${entry.export} does not resolve to one local exported hook implementation`);
    return null;
  }
  return { source, checker, fn: functions[0] };
}

function bindingSymbols(ts, checker, fn) {
  const found = new Map();
  const addName = name => {
    if (ts.isIdentifier(name)) {
      const symbol = normalizedSymbol(ts, checker, name);
      if (symbol) {
        if (!found.has(name.text)) found.set(name.text, new Set());
        found.get(name.text).add(symbol);
      }
      return;
    }
    if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) for (const element of name.elements) {
      if (element && !ts.isOmittedExpression(element)) addName(element.name);
    }
  };
  for (const parameter of fn.parameters) addName(parameter.name);
  const visit = node => {
    if (node !== fn && (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node) || ts.isMethodDeclaration(node))) return;
    if (ts.isVariableDeclaration(node)) addName(node.name);
    ts.forEachChild(node, visit);
  };
  if (fn.body) visit(fn.body);
  return found;
}

function resolvedIdentities(ts, checker, fn, entry, reasons) {
  const symbols = bindingSymbols(ts, checker, fn);
  const identities = [];
  for (const identity of entry.identities) {
    const parts = identity.binding.split('.');
    const candidates = symbols.get(parts[0]) ?? new Set();
    if (candidates.size !== 1) {
      reasons.push(`${entry.path}#${entry.export} cannot resolve one local binding for identity ${identity.id} (${identity.binding})`);
      continue;
    }
    identities.push({ ...identity, parts, symbol: [...candidates][0] });
  }
  return identities.length === entry.identities.length ? identities : null;
}

function accessPath(ts, checker, node) {
  node = unwrapExpression(ts, node);
  if (ts.isIdentifier(node)) return { symbol: normalizedSymbol(ts, checker, node), parts: [node.text] };
  if (ts.isPropertyAccessExpression(node)) {
    const base = accessPath(ts, checker, node.expression);
    return base ? { symbol: base.symbol, parts: [...base.parts, node.name.text] } : null;
  }
  if (ts.isElementAccessExpression(node) && ts.isStringLiteralLike(node.argumentExpression)) {
    const base = accessPath(ts, checker, node.expression);
    return base ? { symbol: base.symbol, parts: [...base.parts, node.argumentExpression.text] } : null;
  }
  return null;
}

function expandedAccessPath(ts, checker, node, seen = new Set(), depth = 0) {
  if (!node || depth > 10) return null;
  node = unwrapExpression(ts, node);
  if (ts.isIdentifier(node)) {
    const symbol = normalizedSymbol(ts, checker, node);
    if (!symbol || seen.has(symbol)) return symbol ? { symbol, parts: [node.text] } : null;
    const initializer = constInitializer(ts, symbol);
    return initializer ? expandedAccessPath(ts, checker, initializer, new Set(seen).add(symbol), depth + 1)
      ?? { symbol, parts: [node.text] } : { symbol, parts: [node.text] };
  }
  if (ts.isPropertyAccessExpression(node)) {
    const base = expandedAccessPath(ts, checker, node.expression, seen, depth + 1);
    return base ? { symbol: base.symbol, parts: [...base.parts, node.name.text] } : null;
  }
  if (ts.isElementAccessExpression(node) && ts.isStringLiteralLike(node.argumentExpression)) {
    const base = expandedAccessPath(ts, checker, node.expression, seen, depth + 1);
    return base ? { symbol: base.symbol, parts: [...base.parts, node.argumentExpression.text] } : null;
  }
  return null;
}

function matchesIdentityAccess(ts, checker, node, identity) {
  const matches = access => access?.symbol === identity.symbol && access.parts.length >= identity.parts.length
    && identity.parts.every((part, index) => access.parts[index] === part);
  return matches(accessPath(ts, checker, node)) || matches(expandedAccessPath(ts, checker, node));
}

const expressionReferences = (ts, checker, expression, identity) =>
  anyDescendant(ts, expression, (node) => matchesIdentityAccess(ts, checker, node, identity));

function constInitializer(ts, symbol) {
  const declarations = symbol?.getDeclarations?.() ?? [];
  if (declarations.length !== 1 || !ts.isVariableDeclaration(declarations[0]) || !declarations[0].initializer
    || !(ts.getCombinedNodeFlags(declarations[0].parent) & ts.NodeFlags.Const)) return null;
  return declarations[0].initializer;
}

function propertyKey(ts, name) {
  if (ts.isIdentifier(name) || ts.isStringLiteralLike(name) || ts.isNumericLiteral(name)) return name.text;
  return null;
}

function effectiveObjectValues(ts, expression) {
  const selected = new Map();
  for (let index = expression.properties.length - 1; index >= 0; index -= 1) {
    const property = expression.properties[index];
    if (ts.isSpreadAssignment(property) || ts.isMethodDeclaration(property) || ts.isGetAccessorDeclaration(property)
      || ts.isSetAccessorDeclaration(property)) return null;
    const key = propertyKey(ts, property.name);
    if (key === null) return null;
    if (!selected.has(key)) selected.set(key, ts.isShorthandPropertyAssignment(property) ? property.name : property.initializer);
  }
  return [...selected.entries()].sort(([left], [right]) => left.localeCompare(right));
}

function identityContribution(ts, checker, expression, identity, seen = new Set(), depth = 0) {
  if (!expression || depth > 12) return 'unproven';
  expression = unwrapExpression(ts, expression);
  if (matchesIdentityAccess(ts, checker, expression, identity)) return 'yes';
  if (ts.isIdentifier(expression)) {
    const symbol = normalizedSymbol(ts, checker, expression);
    if (!symbol || seen.has(symbol)) return 'no';
    const initializer = constInitializer(ts, symbol);
    return initializer ? identityContribution(ts, checker, initializer, identity, new Set(seen).add(symbol), depth + 1) : 'no';
  }
  if (ts.isConditionalExpression(expression)) {
    const whenTrue = identityContribution(ts, checker, expression.whenTrue, identity, seen, depth + 1);
    const whenFalse = identityContribution(ts, checker, expression.whenFalse, identity, seen, depth + 1);
    if (whenTrue === 'yes' && whenFalse === 'yes') return 'yes';
    if (whenTrue === 'unproven' || whenFalse === 'unproven') return 'unproven';
    return 'no';
  }
  if (ts.isBinaryExpression(expression)) {
    if (expression.operatorToken.kind === ts.SyntaxKind.CommaToken) return identityContribution(ts, checker, expression.right, identity, seen, depth + 1);
    if (expression.operatorToken.kind !== ts.SyntaxKind.QuestionQuestionToken) {
      return expressionReferences(ts, checker, expression, identity) ? 'unproven' : 'no';
    }
    const left = identityContribution(ts, checker, expression.left, identity, seen, depth + 1);
    const right = identityContribution(ts, checker, expression.right, identity, seen, depth + 1);
    return left === 'yes' || right === 'yes' ? 'yes' : left === 'unproven' || right === 'unproven' ? 'unproven' : 'no';
  }
  if (ts.isPrefixUnaryExpression(expression)) return expressionReferences(ts, checker, expression, identity) ? 'unproven' : 'no';
  if (ts.isTemplateExpression(expression)) {
    const values = expression.templateSpans.map(span => identityContribution(ts, checker, span.expression, identity, seen, depth + 1));
    return values.includes('yes') ? 'yes' : values.includes('unproven') ? 'unproven' : 'no';
  }
  if (ts.isArrayLiteralExpression(expression)) {
    if (expression.elements.some(element => ts.isSpreadElement(element))) return 'unproven';
    const values = expression.elements.map(element => identityContribution(ts, checker, element, identity, seen, depth + 1));
    return values.includes('yes') ? 'yes' : values.includes('unproven') ? 'unproven' : 'no';
  }
  if (ts.isObjectLiteralExpression(expression)) {
    const values = effectiveObjectValues(ts, expression);
    if (!values || values.length !== expression.properties.length) return 'unproven';
    const states = values.map(([, value]) => identityContribution(ts, checker, value, identity, seen, depth + 1));
    return states.includes('yes') ? 'yes' : states.includes('unproven') ? 'unproven' : 'no';
  }
  if (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression)) return 'no';
  if (ts.isCallExpression(expression) || ts.isNewExpression(expression) || ts.isAwaitExpression(expression)) return 'unproven';
  return 'no';
}

function returnedExpression(ts, fn) {
  if (ts.isArrowFunction(fn) && !ts.isBlock(fn.body)) return fn.body;
  if (!fn.body || !ts.isBlock(fn.body)) return null;
  const returns = [];
  const visit = node => {
    if (node !== fn.body && (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node) || ts.isMethodDeclaration(node))) return;
    if (ts.isReturnStatement(node) && node.expression) returns.push(node.expression);
    else ts.forEachChild(node, visit);
  };
  visit(fn.body);
  return returns.length === 1 ? returns[0] : null;
}

function rootKeyExpression(ts, checker, expression, identities, seen = new Set(), depth = 0) {
  if (!expression || depth > 10) return null;
  expression = unwrapExpression(ts, expression);
  if (ts.isArrowFunction(expression) || ts.isFunctionExpression(expression)) {
    const returned = returnedExpression(ts, expression);
    return returned ? rootKeyExpression(ts, checker, returned, identities, seen, depth + 1) : null;
  }
  if (ts.isIdentifier(expression) && !identities.some(identity => identity.symbol === normalizedSymbol(ts, checker, expression))) {
    const symbol = normalizedSymbol(ts, checker, expression);
    if (symbol && !seen.has(symbol)) {
      const declarations = symbol.getDeclarations?.() ?? [];
      if (declarations.length === 1 && ts.isVariableDeclaration(declarations[0]) && declarations[0].initializer
        && (ts.getCombinedNodeFlags(declarations[0].parent) & ts.NodeFlags.Const)) {
        return rootKeyExpression(ts, checker, declarations[0].initializer, identities, new Set(seen).add(symbol), depth + 1);
      }
    }
  }
  return expression;
}

function staticKeyExpression(ts, checker, expression, identities, seen = new Set(), depth = 0) {
  if (!expression || depth > 12) return false;
  expression = unwrapExpression(ts, expression);
  if (expression.kind === ts.SyntaxKind.NullKeyword || expression.kind === ts.SyntaxKind.TrueKeyword
    || expression.kind === ts.SyntaxKind.FalseKeyword || ts.isStringLiteralLike(expression)
    || ts.isNumericLiteral(expression) || ts.isBigIntLiteral(expression)) return true;
  if (ts.isNoSubstitutionTemplateLiteral(expression)) return true;
  if (ts.isTemplateExpression(expression)) return expression.templateSpans.every(span => staticKeyExpression(ts, checker, span.expression, identities, seen, depth + 1));
  if (ts.isArrayLiteralExpression(expression)) return expression.elements.every(element => !ts.isSpreadElement(element)
    && staticKeyExpression(ts, checker, element, identities, seen, depth + 1));
  if (ts.isObjectLiteralExpression(expression)) {
    const values = effectiveObjectValues(ts, expression);
    return values !== null && values.length === expression.properties.length
      && values.every(([, value]) => staticKeyExpression(ts, checker, value, identities, seen, depth + 1));
  }
  if (ts.isConditionalExpression(expression)) return staticKeyExpression(ts, checker, expression.condition, identities, seen, depth + 1)
    && staticKeyExpression(ts, checker, expression.whenTrue, identities, seen, depth + 1)
    && staticKeyExpression(ts, checker, expression.whenFalse, identities, seen, depth + 1);
  if (ts.isBinaryExpression(expression)) return staticKeyExpression(ts, checker, expression.left, identities, seen, depth + 1)
    && staticKeyExpression(ts, checker, expression.right, identities, seen, depth + 1);
  if (ts.isPrefixUnaryExpression(expression)) return staticKeyExpression(ts, checker, expression.operand, identities, seen, depth + 1);
  if (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression)) {
    if (identities.some(identity => expressionReferences(ts, checker, expression, identity))) return true;
    return false;
  }
  if (ts.isIdentifier(expression)) {
    if (expression.text === 'undefined' || identities.some(identity => identity.symbol === normalizedSymbol(ts, checker, expression))) return true;
    const symbol = normalizedSymbol(ts, checker, expression);
    if (!symbol || seen.has(symbol)) return false;
    const declarations = symbol.getDeclarations?.() ?? [];
    if (declarations.length !== 1 || !ts.isVariableDeclaration(declarations[0]) || !declarations[0].initializer
      || !(ts.getCombinedNodeFlags(declarations[0].parent) & ts.NodeFlags.Const)) return false;
    return staticKeyExpression(ts, checker, declarations[0].initializer, identities, new Set(seen).add(symbol), depth + 1);
  }
  return false;
}

function keyLeaves(ts, checker, expression, identities, decisions = [], depth = 0) {
  if (depth > 12) return null;
  expression = rootKeyExpression(ts, checker, expression, identities);
  if (!expression) return null;
  if (ts.isConditionalExpression(expression)) {
    if (!staticKeyExpression(ts, checker, expression.condition, identities)) return null;
    const whenTrue = keyLeaves(ts, checker, expression.whenTrue, identities, [...decisions, { condition: expression.condition, branch: true }], depth + 1);
    const whenFalse = keyLeaves(ts, checker, expression.whenFalse, identities, [...decisions, { condition: expression.condition, branch: false }], depth + 1);
    return whenTrue && whenFalse ? [...whenTrue, ...whenFalse] : null;
  }
  if (expression.kind === ts.SyntaxKind.NullKeyword) return [{ kind: 'null', expression, decisions }];
  return staticKeyExpression(ts, checker, expression, identities) ? [{ kind: 'active', expression, decisions }] : null;
}

function nullish(ts, checker, expression) {
  expression = unwrapExpression(ts, expression);
  if (expression.kind === ts.SyntaxKind.NullKeyword) return true;
  if (!ts.isIdentifier(expression) || expression.text !== 'undefined') return false;
  const symbol = checker.getSymbolAtLocation(expression);
  return !symbol || (symbol.getDeclarations?.() ?? []).every(declaration => declaration.getSourceFile().isDeclarationFile);
}

/** True when taking `branch` of `condition` proves the declared identity is available. */
function branchMeansAvailable(ts, checker, condition, identity, branch) {
  condition = unwrapExpression(ts, condition);
  if (expressionReferences(ts, checker, condition, identity) && (ts.isIdentifier(condition)
    || ts.isPropertyAccessExpression(condition) || ts.isElementAccessExpression(condition))) return branch;
  if (ts.isPrefixUnaryExpression(condition) && condition.operator === ts.SyntaxKind.ExclamationToken) {
    return branchMeansAvailable(ts, checker, condition.operand, identity, !branch);
  }
  if (ts.isBinaryExpression(condition)) {
    const operator = condition.operatorToken.kind;
    if (operator === ts.SyntaxKind.AmpersandAmpersandToken || operator === ts.SyntaxKind.BarBarToken) {
      // `a && b` is true only when both sides are true; `a || b` is false only when both sides are false.
      const decisive = operator === ts.SyntaxKind.AmpersandAmpersandToken ? branch : !branch;
      return decisive && [condition.left, condition.right]
        .some(side => branchMeansAvailable(ts, checker, side, identity, branch));
    }
    const leftIdentity = expressionReferences(ts, checker, condition.left, identity) && nullish(ts, checker, condition.right);
    const rightIdentity = expressionReferences(ts, checker, condition.right, identity) && nullish(ts, checker, condition.left);
    if (!leftIdentity && !rightIdentity) return false;
    if ([ts.SyntaxKind.ExclamationEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken].includes(operator)) return branch;
    if ([ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.EqualsEqualsEqualsToken].includes(operator)) return !branch;
  }
  return false;
}

function violation(config, call, ruleId, message, extra = {}) {
  return { ruleId, path: relativePath(config.root, call.source.fileName), ...sourceLocation(call.source, call.node), message, ...extra };
}

function isUnshadowedCommonJsRequire(ts, checker, expression, seen = new Set(), depth = 0) {
  expression = unwrapExpression(ts, expression);
  if (!ts.isIdentifier(expression) || depth > 10) return false;
  const symbol = checker.getSymbolAtLocation(expression);
  const declarations = symbol?.getDeclarations?.() ?? [];
  if (expression.text === 'require' && (!symbol || declarations.length === 0
    || declarations.every(declaration => declaration.getSourceFile().isDeclarationFile))) return true;
  const normalized = symbolOfRequireAlias(ts, checker, expression);
  if (!normalized || seen.has(normalized)) return false;
  const initializer = constInitializer(ts, normalized);
  return initializer ? isUnshadowedCommonJsRequire(ts, checker, initializer, new Set(seen).add(normalized), depth + 1) : false;
}

function symbolOfRequireAlias(ts, checker, expression) {
  const symbol = checker.getSymbolAtLocation(expression);
  return normalizedSymbolValue(ts, checker, symbol);
}

function swrReferences(config, context) {
  let found = false;
  const unsupported = [];
  for (const source of context.files) {
    const checker = context.checkerFor(source.fileName);
    const report = (node, kind) => {
      found = true;
      unsupported.push(`${relativePath(config.root, source.fileName)}:${sourceLocation(source, node).line} uses unsupported ${kind} for SWR`);
    };
    const visit = node => {
      if ((context.ts.isImportDeclaration(node) || context.ts.isExportDeclaration(node)) && node.moduleSpecifier
        && context.ts.isStringLiteralLike(node.moduleSpecifier) && SWR_SPECIFIERS.has(node.moduleSpecifier.text)) found = true;
      if (context.ts.isImportEqualsDeclaration(node) && context.ts.isExternalModuleReference(node.moduleReference)
        && node.moduleReference.expression && context.ts.isStringLiteralLike(node.moduleReference.expression)
        && SWR_SPECIFIERS.has(node.moduleReference.expression.text)) report(node, 'import-equals binding');
      if (context.ts.isCallExpression(node) && node.arguments.length >= 1 && context.ts.isStringLiteralLike(node.arguments[0])
        && SWR_SPECIFIERS.has(node.arguments[0].text)) {
        if (node.expression.kind === context.ts.SyntaxKind.ImportKeyword) report(node, 'dynamic import binding');
        else if (isUnshadowedCommonJsRequire(context.ts, checker, node.expression)) report(node, 'CommonJS require binding');
      }
      context.ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return { found, unsupported };
}

function nonNullFalsy(ts, expression) {
  expression = unwrapExpression(ts, expression);
  return expression.kind === ts.SyntaxKind.FalseKeyword || ts.isStringLiteralLike(expression) && expression.text === ''
    || ts.isNumericLiteral(expression) && Number(expression.text) === 0
    || ts.isIdentifier(expression) && expression.text === 'undefined';
}

function containerSymbolsFromKey(ts, checker, expression, found = new Set(), seen = new Set(), depth = 0) {
  if (!expression || depth > 12) return found;
  expression = unwrapExpression(ts, expression);
  if (ts.isIdentifier(expression)) {
    const symbol = normalizedSymbol(ts, checker, expression);
    if (!symbol || seen.has(symbol)) return found;
    const initializer = constInitializer(ts, symbol);
    if (!initializer) return found;
    const value = unwrapExpression(ts, initializer);
    if (ts.isArrayLiteralExpression(value) || ts.isObjectLiteralExpression(value)) found.add(symbol);
    containerSymbolsFromKey(ts, checker, initializer, found, new Set(seen).add(symbol), depth + 1);
    return found;
  }
  ts.forEachChild(expression, child => { containerSymbolsFromKey(ts, checker, child, found, seen, depth + 1); });
  return found;
}

function keyContainerRisks(ts, checker, key, owner) {
  const symbols = containerSymbolsFromKey(ts, checker, key);
  if (!symbols.size || !owner?.body) return [];
  const declarationNames = new Set([...symbols].flatMap(symbol => (symbol.getDeclarations?.() ?? [])
    .filter(ts.isVariableDeclaration).map(declaration => declaration.name)));
  const risks = [];
  const visit = node => {
    if (ts.isIdentifier(node) && symbols.has(normalizedSymbol(ts, checker, node)) && !declarationNames.has(node)
      && !(node.pos >= key.pos && node.end <= key.end)) risks.push(node);
    ts.forEachChild(node, visit);
  };
  visit(owner.body);
  return risks;
}

function inspectKey(config, context, entry, call, identities, violations, reasons) {
  const key = call.node.arguments[0];
  if (!key) {
    reasons.push(`${entry.path}#${entry.export} has an SWR call without a key`);
    return;
  }
  const containerRisks = keyContainerRisks(context.ts, call.checker, key, call.owner);
  if (containerRisks.length) {
    const locations = containerRisks.map(node => sourceLocation(call.source, node).line).filter((line, index, all) => all.indexOf(line) === index);
    reasons.push(`${entry.path}#${entry.export} key container is referenced outside its declaration and selected SWR key${locations.length ? ` (line${locations.length === 1 ? '' : 's'} ${locations.join(', ')})` : ''}`);
    return;
  }
  const leaves = keyLeaves(context.ts, call.checker, key, identities);
  if (!leaves) {
    reasons.push(`${entry.path}#${entry.export} uses a dynamic SWR key whose identity cannot be proved`);
    return;
  }
  const active = leaves.filter(leaf => leaf.kind === 'active');
  if (active.some(leaf => nonNullFalsy(context.ts, leaf.expression))) violations.push(violation(config, call, SWR_KEY_RULE_ID,
    `${entry.id} uses explicit null, rather than another falsy value, for a disabled SWR key.`, { lifecycle: entry.id }));
  for (const identity of identities) {
    if (!active.length) {
      violations.push(violation(config, call, entry.kind === 'mutation' && identity.resource ? SWR_MUTATION_RULE_ID : SWR_KEY_RULE_ID,
        `${entry.id} has no active key path carrying declared identity ${identity.id} (${identity.binding}).`,
        { lifecycle: entry.id, identity: identity.id }));
      continue;
    }
    const contributions = active.map(leaf => identityContribution(context.ts, call.checker, leaf.expression, identity));
    if (contributions.includes('unproven')) {
      reasons.push(`${entry.path}#${entry.export} key value contribution for identity ${identity.id} (${identity.binding}) cannot be proved on every active path`);
    } else if (contributions.includes('no')) {
      const ruleId = entry.kind === 'mutation' && identity.resource ? SWR_MUTATION_RULE_ID : SWR_KEY_RULE_ID;
      violations.push(violation(config, call, ruleId,
        `${entry.id} key must include declared ${identity.resource ? 'resource ' : ''}identity ${identity.id} (${identity.binding}) on every active key path.`,
        { lifecycle: entry.id, identity: identity.id }));
    }
    if (identity.gatesRequest) {
      const gated = active.every(leaf => leaf.decisions.some(decision => {
        return branchMeansAvailable(context.ts, call.checker, decision.condition, identity, decision.branch);
      }));
      if (!gated) violations.push(violation(config, call, SWR_KEY_RULE_ID,
        `${entry.id} must produce an explicit null key when ${identity.id} (${identity.binding}) is unavailable.`,
        { lifecycle: entry.id, identity: identity.id }));
    }
  }
}

/** Check explicitly declared SWR lifecycle keys against the target program and installed SWR identity. */
export function checkFrontendDataLifecycle(config, context) {
  const ruleIds = [...SWR_DATA_RULE_IDS];
  const reasons = [];
  const violations = [];
  const references = swrReferences(config, context);
  let contract;
  try { contract = parseContract(config); } catch (error) {
    return { violations, coverage: { status: 'unavailable', ruleIds, details: [String(error.message ?? error)] } };
  }
  if (!contract && !references.found) return { violations, coverage: { status: 'not-applicable', ruleIds } };
  if (!contract) return { violations, coverage: { status: 'unavailable', ruleIds,
    details: ['package.json#starci.codePatterns.next.dataLifecycle is required when production source selects SWR', ...references.unsupported] } };
  reasons.push(...references.unsupported);
  let installed;
  try { installed = installedSWR(config.packageRoot ?? config.root); } catch (error) {
    return { violations, coverage: { status: 'unavailable', ruleIds, details: [String(error.message ?? error)] } };
  }
  if (installed.major !== contract.swr.major) reasons.push(`installed swr ${installed.version} does not match declared major ${contract.swr.major}`);
  const official = officialTargets(config, context, installed, reasons);
  const calls = discoverCalls(config, context, official.targets);
  const lifecycleCalls = calls.filter(call => call.kind === 'query' || call.kind === 'mutation');
  const globalMutates = calls.filter(call => call.kind === 'global-mutate');
  if (official.selectedBindings && lifecycleCalls.length === 0) reasons.push('selected SWR hook imports have no statically resolved lifecycle call');
  for (const call of globalMutates) reasons.push(`${relativePath(config.root, call.source.fileName)}:${sourceLocation(call.source, call.node).line} uses global mutate; resource matching or filter semantics are not statically declared`);

  const hookCache = new Map();
  const entriesByHook = new Map();
  for (const entry of contract.hooks) {
    const key = `${entry.path}\0${entry.export}`;
    if (!entriesByHook.has(key)) entriesByHook.set(key, []);
    entriesByHook.get(key).push(entry);
    if (!hookCache.has(key)) hookCache.set(key, exportedHook(config, context, entry, reasons));
  }
  const mapped = new Map();
  for (const [key, entries] of entriesByHook) {
    const hook = hookCache.get(key);
    if (!hook) continue;
    const owned = lifecycleCalls.filter(call => call.owner === hook.fn);
    if (!owned.length) {
      reasons.push(`${entries[0].path}#${entries[0].export} contains no statically resolved SWR lifecycle call`);
      continue;
    }
    for (const entry of entries) {
      let candidates;
      if (entry.resultBinding !== undefined) candidates = owned.filter(call => call.bindings.includes(entry.resultBinding));
      else candidates = owned.length === 1 && entries.length === 1 ? owned : [];
      if (candidates.length !== 1) {
        reasons.push(`${entry.path}#${entry.export} lifecycle ${entry.id} must select exactly one SWR call${owned.length > 1 ? ' with resultBinding' : ''}`);
        continue;
      }
      const call = candidates[0];
      mapped.set(call, (mapped.get(call) ?? 0) + 1);
      if (call.kind !== entry.kind) {
        reasons.push(`${entry.path}#${entry.export} lifecycle ${entry.id} declares ${entry.kind} but resolves ${call.kind}`);
        continue;
      }
      const identities = resolvedIdentities(context.ts, hook.checker, hook.fn, entry, reasons);
      if (identities) inspectKey(config, context, entry, call, identities, violations, reasons);
    }
    for (const call of owned) if ((mapped.get(call) ?? 0) !== 1) {
      reasons.push(`${relativePath(config.root, call.source.fileName)}:${sourceLocation(call.source, call.node).line} SWR call is not matched by exactly one declared lifecycle`);
    }
  }
  const declaredFunctions = new Set([...hookCache.values()].filter(Boolean).map(item => item.fn));
  for (const call of lifecycleCalls) if (!declaredFunctions.has(call.owner)) {
    reasons.push(`${relativePath(config.root, call.source.fileName)}:${sourceLocation(call.source, call.node).line} SWR call is outside every declared lifecycle hook`);
  }
  const details = [...new Set(reasons)].sort();
  return {
    violations,
    coverage: details.length ? { status: 'unavailable', ruleIds, hooks: contract.hooks.length, calls: lifecycleCalls.length,
      swr: { name: installed.name, version: installed.version, major: installed.major }, details }
      : { status: 'checked', ruleIds, hooks: contract.hooks.length, calls: lifecycleCalls.length,
        swr: { name: installed.name, version: installed.version, major: installed.major } },
  };
}
