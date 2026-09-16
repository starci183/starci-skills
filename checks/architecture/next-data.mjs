import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { isInside } from './config.mjs';
import { relativePath, sourceLocation } from './typescript.mjs';

export const SWR_KEY_RULE_ID = 'FE_SWR_KEY_IDENTITY';
export const SWR_MUTATION_RULE_ID = 'FE_SWR_MUTATION_RESOURCE_IDENTITY';
export const SWR_DATA_RULE_IDS = [SWR_KEY_RULE_ID, SWR_MUTATION_RULE_ID];

const CONTRACT_SCHEMA = 'starci/next-data-lifecycle@1';
const SOURCE = /\.[cm]?[jt]sx?$/i;
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;
const BINDING = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/;
const TOP_KEYS = new Set(['schema', 'swr', 'hooks']);
const SWR_KEYS = new Set(['package', 'major']);
const HOOK_KEYS = new Set(['id', 'path', 'export', 'kind', 'resultBinding', 'identities']);
const IDENTITY_KEYS = new Set(['id', 'binding', 'gatesRequest', 'resource']);

function canonical(file) {
  const absolute = path.resolve(file);
  try { return path.resolve(fs.realpathSync(absolute)); } catch { return absolute; }
}

function slash(value) {
  return value.replaceAll('\\', '/');
}

function exactKeys(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error(`${label} must be an object.`);
  const unknown = Object.keys(value).filter(key => !allowed.has(key));
  if (unknown.length) throw Error(`${label} has unsupported fields: ${unknown.sort().join(', ')}.`);
}

function relativeSource(repository, value, label) {
  if (typeof value !== 'string' || !value.trim() || path.isAbsolute(value)) throw Error(`${label} must be a non-empty repository-relative source path.`);
  const relative = slash(value.trim()).replace(/^\.\//, '');
  if (relative.split('/').includes('..') || !SOURCE.test(relative) || /\.d\.[cm]?[jt]s$/i.test(relative)) {
    throw Error(`${label} must be a production TypeScript or JavaScript source path.`);
  }
  const absolute = path.resolve(repository, ...relative.split('/'));
  if (!isInside(repository, absolute)) throw Error(`${label} must stay inside the repository.`);
  const stat = fs.lstatSync(absolute);
  if (!stat.isFile() || stat.isSymbolicLink()) throw Error(`${label} must be a regular non-link source file.`);
  return relative;
}

function parseContract(config) {
  const manifest = JSON.parse(fs.readFileSync(path.join(config.root, 'package.json'), 'utf8'));
  const next = manifest?.starci?.codePatterns?.next;
  const value = next?.dataLifecycle;
  if (value === undefined) return null;
  if (next.schema !== 'starci/next-code-pattern-contract@1') throw Error('package.json#starci.codePatterns.next must use starci/next-code-pattern-contract@1.');
  exactKeys(value, TOP_KEYS, 'package.json#starci.codePatterns.next.dataLifecycle');
  if (value.schema !== CONTRACT_SCHEMA) throw Error(`dataLifecycle.schema must be ${CONTRACT_SCHEMA}.`);
  exactKeys(value.swr, SWR_KEYS, 'dataLifecycle.swr');
  if (value.swr.package !== 'swr' || !Number.isInteger(value.swr.major) || value.swr.major < 1) {
    throw Error('dataLifecycle.swr must bind package swr and one positive integer major version.');
  }
  if (!Array.isArray(value.hooks) || value.hooks.length === 0) throw Error('dataLifecycle.hooks must contain at least one declared lifecycle call.');
  const ids = new Set();
  const hooks = value.hooks.map((hook, index) => {
    const label = `dataLifecycle.hooks[${index}]`;
    exactKeys(hook, HOOK_KEYS, label);
    if (typeof hook.id !== 'string' || !hook.id.trim() || ids.has(hook.id.trim())) throw Error(`${label}.id must be unique and non-empty.`);
    ids.add(hook.id.trim());
    const source = relativeSource(config.root, hook.path, `${label}.path`);
    if (typeof hook.export !== 'string' || !/^use[A-Z0-9_$][\w$]*$/.test(hook.export)) throw Error(`${label}.export must name one exported use* hook.`);
    if (!['query', 'mutation'].includes(hook.kind)) throw Error(`${label}.kind must be query or mutation.`);
    if (hook.resultBinding !== undefined && (typeof hook.resultBinding !== 'string' || !IDENTIFIER.test(hook.resultBinding))) {
      throw Error(`${label}.resultBinding must be one local identifier.`);
    }
    if (!Array.isArray(hook.identities)) throw Error(`${label}.identities must be an array.`);
    const identityIds = new Set(), bindings = new Set();
    const identities = hook.identities.map((identity, identityIndex) => {
      const identityLabel = `${label}.identities[${identityIndex}]`;
      exactKeys(identity, IDENTITY_KEYS, identityLabel);
      if (typeof identity.id !== 'string' || !identity.id.trim() || identityIds.has(identity.id.trim())) throw Error(`${identityLabel}.id must be unique and non-empty.`);
      if (typeof identity.binding !== 'string' || !BINDING.test(identity.binding) || bindings.has(identity.binding)) throw Error(`${identityLabel}.binding must be a unique identifier or property path.`);
      if (typeof identity.gatesRequest !== 'boolean' || typeof identity.resource !== 'boolean') throw Error(`${identityLabel} must explicitly declare gatesRequest and resource booleans.`);
      identityIds.add(identity.id.trim());
      bindings.add(identity.binding);
      return { id: identity.id.trim(), binding: identity.binding, gatesRequest: identity.gatesRequest, resource: identity.resource };
    });
    if (hook.kind === 'mutation' && !identities.some(identity => identity.resource)) throw Error(`${label} mutation must declare at least one resource identity.`);
    return { id: hook.id.trim(), path: source, export: hook.export, kind: hook.kind,
      ...(hook.resultBinding === undefined ? {} : { resultBinding: hook.resultBinding }), identities };
  });
  return { schema: value.schema, swr: { package: 'swr', major: value.swr.major }, hooks };
}

function installedSWR(repository) {
  const require = createRequire(path.join(repository, 'package.json'));
  let manifest;
  try { manifest = require.resolve('swr/package.json'); } catch {
    let entry;
    try { entry = require.resolve('swr'); } catch { throw Error('Installed swr package is unavailable.'); }
    let current = path.dirname(entry);
    while (isInside(repository, current) && current !== repository) {
      const candidate = path.join(current, 'package.json');
      if (fs.existsSync(candidate)) { manifest = candidate; break; }
      current = path.dirname(current);
    }
  }
  if (!manifest) throw Error('Installed swr package.json is unavailable.');
  const actualManifest = canonical(manifest);
  const parsed = JSON.parse(fs.readFileSync(actualManifest, 'utf8'));
  const major = Number.parseInt(String(parsed.version ?? '').split('.')[0], 10);
  if (parsed.name !== 'swr' || !Number.isInteger(major)) throw Error('Installed swr package identity or version is invalid.');
  return { name: parsed.name, version: parsed.version, major, root: canonical(path.dirname(actualManifest)) };
}

function normalizedSymbol(ts, checker, value) {
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

function selectedNode(ts, expression) {
  expression = unwrap(ts, expression);
  if (ts.isIdentifier(expression)) return expression;
  if (ts.isPropertyAccessExpression(expression)) return expression.name;
  if (ts.isElementAccessExpression(expression) && ts.isStringLiteralLike(expression.argumentExpression)) return expression.argumentExpression;
  return null;
}

function symbolAt(ts, checker, node) {
  return normalizedSymbol(ts, checker, checker.getSymbolAtLocation(node));
}

function valueSymbol(ts, checker, expression, seen = new Set()) {
  const selected = selectedNode(ts, expression);
  const symbol = selected ? symbolAt(ts, checker, selected) : null;
  if (!symbol || seen.has(symbol)) return symbol;
  const declarations = symbol.getDeclarations?.() ?? [];
  if (declarations.length === 1 && ts.isVariableDeclaration(declarations[0]) && declarations[0].initializer
    && (ts.getCombinedNodeFlags(declarations[0].parent) & ts.NodeFlags.Const)) {
    return valueSymbol(ts, checker, declarations[0].initializer, new Set(seen).add(symbol));
  }
  return symbol;
}

function unwrap(ts, expression) {
  while (expression && (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression)
    || ts.isTypeAssertionExpression(expression) || ts.isNonNullExpression(expression)
    || (ts.isSatisfiesExpression?.(expression) ?? false))) expression = expression.expression;
  return expression;
}

function declarationsInside(symbol, root) {
  return (symbol?.getDeclarations?.() ?? []).every(declaration => isInside(root, canonical(declaration.getSourceFile().fileName)));
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
      const exports = new Map(checker.getExportsOfModule(moduleSymbol).map(symbol => [symbol.getName(), normalizedSymbol(context.ts, checker, symbol)]));
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
        && context.ts.isCallExpression(unwrap(context.ts, node.initializer))
        && callKind(context.ts, checker, unwrap(context.ts, node.initializer), targets) === 'config') {
        for (const element of node.name.elements) {
          const property = element.propertyName && context.ts.isIdentifier(element.propertyName) ? element.propertyName.text
            : context.ts.isIdentifier(element.name) ? element.name.text : null;
          if (property === 'mutate' && context.ts.isIdentifier(element.name)) symbols.add(symbolAt(context.ts, checker, element.name));
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
    const value = unwrap(ts, declaration.initializer);
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
  const symbol = normalizedSymbol(context.ts, checker, exported);
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
      const symbol = symbolAt(ts, checker, name);
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
  node = unwrap(ts, node);
  if (ts.isIdentifier(node)) return { symbol: symbolAt(ts, checker, node), parts: [node.text] };
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

function expressionReferences(ts, checker, expression, identity) {
  let found = false;
  const visit = node => {
    if (found) return;
    const access = accessPath(ts, checker, node);
    if (access?.symbol === identity.symbol && access.parts.length >= identity.parts.length
      && identity.parts.every((part, index) => access.parts[index] === part)) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(expression);
  return found;
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
  expression = unwrap(ts, expression);
  if (ts.isArrowFunction(expression) || ts.isFunctionExpression(expression)) {
    const returned = returnedExpression(ts, expression);
    return returned ? rootKeyExpression(ts, checker, returned, identities, seen, depth + 1) : null;
  }
  if (ts.isIdentifier(expression) && !identities.some(identity => identity.symbol === symbolAt(ts, checker, expression))) {
    const symbol = symbolAt(ts, checker, expression);
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
  expression = unwrap(ts, expression);
  if (expression.kind === ts.SyntaxKind.NullKeyword || expression.kind === ts.SyntaxKind.TrueKeyword
    || expression.kind === ts.SyntaxKind.FalseKeyword || ts.isStringLiteralLike(expression)
    || ts.isNumericLiteral(expression) || ts.isBigIntLiteral(expression)) return true;
  if (ts.isNoSubstitutionTemplateLiteral(expression)) return true;
  if (ts.isTemplateExpression(expression)) return expression.templateSpans.every(span => staticKeyExpression(ts, checker, span.expression, identities, seen, depth + 1));
  if (ts.isArrayLiteralExpression(expression)) return expression.elements.every(element => !ts.isSpreadElement(element)
    && staticKeyExpression(ts, checker, element, identities, seen, depth + 1));
  if (ts.isObjectLiteralExpression(expression)) return expression.properties.every(property => {
    if (ts.isShorthandPropertyAssignment(property)) return staticKeyExpression(ts, checker, property.name, identities, seen, depth + 1);
    if (!ts.isPropertyAssignment(property) || property.name && ts.isComputedPropertyName(property.name)) return false;
    return staticKeyExpression(ts, checker, property.initializer, identities, seen, depth + 1);
  });
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
    if (expression.text === 'undefined' || identities.some(identity => identity.symbol === symbolAt(ts, checker, expression))) return true;
    const symbol = symbolAt(ts, checker, expression);
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
  expression = unwrap(ts, expression);
  if (expression.kind === ts.SyntaxKind.NullKeyword) return true;
  if (!ts.isIdentifier(expression) || expression.text !== 'undefined') return false;
  const symbol = checker.getSymbolAtLocation(expression);
  return !symbol || (symbol.getDeclarations?.() ?? []).every(declaration => declaration.getSourceFile().isDeclarationFile);
}

function trueMeansAvailable(ts, checker, condition, identity) {
  condition = unwrap(ts, condition);
  if (expressionReferences(ts, checker, condition, identity) && (ts.isIdentifier(condition)
    || ts.isPropertyAccessExpression(condition) || ts.isElementAccessExpression(condition))) return true;
  if (ts.isPrefixUnaryExpression(condition) && condition.operator === ts.SyntaxKind.ExclamationToken) {
    const nested = trueMeansAvailable(ts, checker, condition.operand, identity);
    return nested === null ? null : !nested;
  }
  if (ts.isBinaryExpression(condition)) {
    const leftIdentity = expressionReferences(ts, checker, condition.left, identity) && nullish(ts, checker, condition.right);
    const rightIdentity = expressionReferences(ts, checker, condition.right, identity) && nullish(ts, checker, condition.left);
    if (!leftIdentity && !rightIdentity) return null;
    if ([ts.SyntaxKind.ExclamationEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken].includes(condition.operatorToken.kind)) return true;
    if ([ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.EqualsEqualsEqualsToken].includes(condition.operatorToken.kind)) return false;
  }
  return null;
}

function violation(config, call, ruleId, message, extra = {}) {
  return { ruleId, path: relativePath(config.root, call.source.fileName), ...sourceLocation(call.source, call.node), message, ...extra };
}

function nonNullFalsy(ts, expression) {
  expression = unwrap(ts, expression);
  return expression.kind === ts.SyntaxKind.FalseKeyword || ts.isStringLiteralLike(expression) && expression.text === ''
    || ts.isNumericLiteral(expression) && Number(expression.text) === 0
    || ts.isIdentifier(expression) && expression.text === 'undefined';
}

function inspectKey(config, context, entry, call, identities, violations, reasons) {
  const key = call.node.arguments[0];
  if (!key) {
    reasons.push(`${entry.path}#${entry.export} has an SWR call without a key`);
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
    if (active.some(leaf => !expressionReferences(context.ts, call.checker, leaf.expression, identity))) {
      const ruleId = entry.kind === 'mutation' && identity.resource ? SWR_MUTATION_RULE_ID : SWR_KEY_RULE_ID;
      violations.push(violation(config, call, ruleId,
        `${entry.id} key must include declared ${identity.resource ? 'resource ' : ''}identity ${identity.id} (${identity.binding}) on every active key path.`,
        { lifecycle: entry.id, identity: identity.id }));
    }
    if (identity.gatesRequest) {
      const gated = leaves.filter(leaf => leaf.kind === 'null').some(leaf => leaf.decisions.some(decision => {
        const available = trueMeansAvailable(context.ts, call.checker, decision.condition, identity);
        return available !== null && decision.branch !== available;
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
  const hasSWRSpecifier = context.files.some(source => source.statements.some(statement => (context.ts.isImportDeclaration(statement)
    || context.ts.isExportDeclaration(statement)) && statement.moduleSpecifier && context.ts.isStringLiteralLike(statement.moduleSpecifier)
    && ['swr', 'swr/immutable', 'swr/mutation'].includes(statement.moduleSpecifier.text)));
  let contract;
  try { contract = parseContract(config); } catch (error) {
    return { violations, coverage: { status: 'unavailable', ruleIds, details: [String(error.message ?? error)] } };
  }
  if (!contract && !hasSWRSpecifier) return { violations, coverage: { status: 'not-applicable', ruleIds } };
  if (!contract) return { violations, coverage: { status: 'unavailable', ruleIds, details: ['package.json#starci.codePatterns.next.dataLifecycle is required when production source selects SWR'] } };
  let installed;
  try { installed = installedSWR(config.root); } catch (error) {
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
