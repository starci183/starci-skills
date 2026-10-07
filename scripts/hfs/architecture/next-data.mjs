import path from 'node:path';
import { canonical, isInside } from './config.mjs';
import { parseContract, installedSWR } from './next-data-contract.mjs';
import { relativePath, unwrapExpression } from './typescript.mjs';
import { anyDescendant, normalizedSymbol, normalizedSymbolValue, valueSymbol as sharedValueSymbol } from './ast-walks.mjs';
import { isConstVariable, sourceLocation } from '../../lib/ts-ast.mjs';
import { byCodeUnit } from '../../lib/list.mjs';
import { createNextDataKeyInspector } from './next-data-key.mjs';
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

function selectedImportBindings(ts, statement, selected) {
  if (!ts.isImportDeclaration(statement) || !statement.importClause) return 0;
  const clause = statement.importClause;
  let count = clause.name && selected.has('default') ? 1 : 0;
  const bindings = clause.namedBindings;
  if (bindings && ts.isNamespaceImport(bindings)) count += 1;
  if (bindings && ts.isNamedImports(bindings)) count += bindings.elements
    .filter(element => selected.has(element.propertyName?.text ?? element.name.text)).length;
  return count;
}

function addOfficialExports(official, checker, statement, selected, targets) {
  const { config, context, installed, reasons } = official;
  const moduleSymbol = checker.getSymbolAtLocation(statement.moduleSpecifier);
  if (!moduleSymbol) {
    reasons.push(`${relativePath(config.root, statement.getSourceFile().fileName)} cannot resolve ${statement.moduleSpecifier.text} through the target TypeScript program`);
    return false;
  }
  const exports = new Map(checker.getExportsOfModule(moduleSymbol).map(symbol => [symbol.getName(), normalizedSymbolValue(context.ts, checker, symbol)]));
  for (const [name, kind] of selected) {
    const target = exports.get(name);
    if (!target) continue;
    if (!declarationsInside(target, installed.root)) {
      reasons.push(`${relativePath(config.root, statement.getSourceFile().fileName)} resolves ${statement.moduleSpecifier.text}#${name} outside installed swr ${installed.version}`);
      continue;
    }
    targets.set(target, kind);
  }
  return true;
}

function addOfficialStatement(official, wanted, checker, statement, targets) {
  const ts = official.context.ts;
  if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) return 0;
  if (!statement.moduleSpecifier || !ts.isStringLiteralLike(statement.moduleSpecifier)) return 0;
  const selected = wanted.get(statement.moduleSpecifier.text);
  if (!selected) return 0;
  if (!addOfficialExports(official, checker, statement, selected, targets)) return 0;
  return selectedImportBindings(ts, statement, selected);
}

function officialTargets(config, context, installed, reasons) {
  const wanted = new Map([
    ['swr', new Map([['default', 'query'], ['mutate', 'global-mutate'], ['useSWRConfig', 'config']])],
    ['swr/immutable', new Map([['default', 'query']])],
    ['swr/mutation', new Map([['default', 'mutation'], ['useSWRMutation', 'mutation']])],
  ]);
  const targets = new Map();
  const official = { config, context, installed, reasons };
  let selectedBindings = 0;
  for (const source of context.files) {
    const checker = context.checkerFor(source.fileName);
    for (const statement of source.statements) selectedBindings += addOfficialStatement(official, wanted, checker, statement, targets);
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

function configElementProperty(ts, element) {
  return element.propertyName && ts.isIdentifier(element.propertyName) ? element.propertyName.text
    : (ts.isIdentifier(element.name) && element.name.text) || null;
}

function addConfigMutateSymbols(ts, checker, node, targets, symbols) {
  if (!(ts.isVariableDeclaration(node) && ts.isObjectBindingPattern(node.name) && node.initializer
    && ts.isCallExpression(unwrapExpression(ts, node.initializer))
    && callKind(ts, checker, unwrapExpression(ts, node.initializer), targets) === 'config')) return;
  for (const element of node.name.elements) {
    if (configElementProperty(ts, element) === 'mutate' && ts.isIdentifier(element.name)) symbols.add(normalizedSymbol(ts, checker, element.name));
  }
}

function configMutateSymbols(config, context, targets) {
  const { ts } = context;
  const symbols = new Set();
  for (const source of context.files) {
    const checker = context.checkerFor(source.fileName);
    const visit = node => {
      addConfigMutateSymbols(ts, checker, node, targets, symbols);
      ts.forEachChild(node, visit);
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

function addBindingName(ts, checker, found, name) {
  if (ts.isIdentifier(name)) {
    const symbol = normalizedSymbol(ts, checker, name);
    if (!symbol) return;
    if (!found.has(name.text)) found.set(name.text, new Set());
    found.get(name.text).add(symbol);
    return;
  }
  if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) for (const element of name.elements) {
    if (element && !ts.isOmittedExpression(element)) addBindingName(ts, checker, found, element.name);
  }
}

function bindingSymbols(ts, checker, fn) {
  const found = new Map();
  for (const parameter of fn.parameters) addBindingName(ts, checker, found, parameter.name);
  const visit = node => {
    if (node !== fn && (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node) || ts.isMethodDeclaration(node))) return;
    if (ts.isVariableDeclaration(node)) addBindingName(ts, checker, found, node.name);
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

function constInitializer(ts, symbol) {
  const declarations = symbol?.getDeclarations?.() ?? [];
  if (declarations.length !== 1 || !ts.isVariableDeclaration(declarations[0]) || !declarations[0].initializer
    || !isConstVariable(ts, declarations[0])) return null;
  return declarations[0].initializer;
}

function violation(config, call, ruleId, message, extra = {}) {
  return { ruleId, path: relativePath(config.root, call.source.fileName), ...sourceLocation(call.source, call.node), message, ...extra };
}

const inspectKey = createNextDataKeyInspector({ anyDescendant, normalizedSymbol, unwrapExpression, constInitializer, sourceLocation, violation,
  SWR_KEY_RULE_ID, SWR_MUTATION_RULE_ID });

function isUnshadowedCommonJsRequire(ts, checker, expression, seen = new Set(), depth = 0) {
  expression = unwrapExpression(ts, expression);
  if (!ts.isIdentifier(expression) || depth > 10) return false;
  const symbol = checker.getSymbolAtLocation(expression);
  const declarations = symbol?.getDeclarations?.() ?? [];
  if (expression.text === 'require' && (!symbol
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

function isSwrModuleDeclaration(ts, node) {
  return (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier
    && ts.isStringLiteralLike(node.moduleSpecifier) && SWR_SPECIFIERS.has(node.moduleSpecifier.text);
}

/** The kind of unsupported SWR binding the node declares, else null. */
function unsupportedSwrBinding(ts, checker, node) {
  if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)
    && node.moduleReference.expression && ts.isStringLiteralLike(node.moduleReference.expression)
    && SWR_SPECIFIERS.has(node.moduleReference.expression.text)) return 'import-equals binding';
  if (ts.isCallExpression(node) && node.arguments.length >= 1 && ts.isStringLiteralLike(node.arguments[0])
    && SWR_SPECIFIERS.has(node.arguments[0].text)) {
    if (node.expression.kind === ts.SyntaxKind.ImportKeyword) return 'dynamic import binding';
    if (isUnshadowedCommonJsRequire(ts, checker, node.expression)) return 'CommonJS require binding';
  }
  return null;
}

function swrReferences(config, context) {
  const { ts } = context;
  let found = false;
  const unsupported = [];
  for (const source of context.files) {
    const checker = context.checkerFor(source.fileName);
    const visit = node => {
      if (isSwrModuleDeclaration(ts, node)) found = true;
      const kind = unsupportedSwrBinding(ts, checker, node);
      if (kind) {
        found = true;
        unsupported.push(`${relativePath(config.root, source.fileName)}:${sourceLocation(source, node).line} uses unsupported ${kind} for SWR`);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return { found, unsupported };
}

function unavailableDataLifecycle(ruleIds, details) {
  return { violations: [], coverage: { status: 'unavailable', ruleIds, details } };
}

function lifecycleCallSets(config, context, installed, reasons) {
  const official = officialTargets(config, context, installed, reasons);
  const calls = discoverCalls(config, context, official.targets);
  const lifecycleCalls = calls.filter(call => call.kind === 'query' || call.kind === 'mutation');
  const globalMutates = calls.filter(call => call.kind === 'global-mutate');
  if (official.selectedBindings && lifecycleCalls.length === 0) reasons.push('selected SWR hook imports have no statically resolved lifecycle call');
  for (const call of globalMutates) reasons.push(`${relativePath(config.root, call.source.fileName)}:${sourceLocation(call.source, call.node).line} uses global mutate; resource matching or filter semantics are not statically declared`);
  return { lifecycleCalls };
}

function hookEntries(config, context, contract, reasons) {
  const hookCache = new Map();
  const entriesByHook = new Map();
  for (const entry of contract.hooks) {
    const key = `${entry.path}\0${entry.export}`;
    if (!entriesByHook.has(key)) entriesByHook.set(key, []);
    entriesByHook.get(key).push(entry);
    if (!hookCache.has(key)) hookCache.set(key, exportedHook(config, context, entry, reasons));
  }
  return { hookCache, entriesByHook };
}

function inspectLifecycleEntry(scope, entry, hookCalls, mapped) {
  const { config, context, violations, reasons } = scope;
  const { entries, owned, hook } = hookCalls;
  let candidates;
  if (entry.resultBinding !== undefined) candidates = owned.filter(call => call.bindings.includes(entry.resultBinding));
  else candidates = owned.length === 1 && entries.length === 1 ? owned : [];
  if (candidates.length !== 1) {
    reasons.push(`${entry.path}#${entry.export} lifecycle ${entry.id} must select exactly one SWR call${owned.length > 1 ? ' with resultBinding' : ''}`);
    return;
  }
  const call = candidates[0];
  mapped.set(call, (mapped.get(call) ?? 0) + 1);
  if (call.kind !== entry.kind) {
    reasons.push(`${entry.path}#${entry.export} lifecycle ${entry.id} declares ${entry.kind} but resolves ${call.kind}`);
    return;
  }
  const identities = resolvedIdentities(context.ts, hook.checker, hook.fn, entry, reasons);
  if (identities) inspectKey(config, context, entry, call, identities, violations, reasons);
}

function inspectHookLifecycle(config, context, lifecycleCalls, hookCache, entriesByHook, violations, reasons) {
  const mapped = new Map();
  const scope = { config, context, violations, reasons };
  for (const [key, entries] of entriesByHook) {
    const hook = hookCache.get(key);
    if (!hook) continue;
    const owned = lifecycleCalls.filter(call => call.owner === hook.fn);
    if (!owned.length) {
      reasons.push(`${entries[0].path}#${entries[0].export} contains no statically resolved SWR lifecycle call`);
      continue;
    }
    for (const entry of entries) inspectLifecycleEntry(scope, entry, { entries, owned, hook }, mapped);
    for (const call of owned) if ((mapped.get(call) ?? 0) !== 1) {
      reasons.push(`${relativePath(config.root, call.source.fileName)}:${sourceLocation(call.source, call.node).line} SWR call is not matched by exactly one declared lifecycle`);
    }
  }
  return mapped;
}

function addUndeclaredLifecycleReasons(config, lifecycleCalls, hookCache, reasons) {
  const declaredFunctions = new Set([...hookCache.values()].filter(Boolean).map(item => item.fn));
  for (const call of lifecycleCalls) if (!declaredFunctions.has(call.owner)) {
    reasons.push(`${relativePath(config.root, call.source.fileName)}:${sourceLocation(call.source, call.node).line} SWR call is outside every declared lifecycle hook`);
  }
}

function lifecycleCoverage(ruleIds, contract, installed, calls, details) {
  return details.length ? { status: 'unavailable', ruleIds, hooks: contract.hooks.length, calls,
    swr: { name: installed.name, version: installed.version, major: installed.major }, details }
    : { status: 'checked', ruleIds, hooks: contract.hooks.length, calls,
      swr: { name: installed.name, version: installed.version, major: installed.major } };
}

/** Check explicitly declared SWR lifecycle keys against the target program and installed SWR identity. */
export function checkFrontendDataLifecycle(config, context) {
  const ruleIds = [...SWR_DATA_RULE_IDS];
  const references = swrReferences(config, context);
  let contract;
  try { contract = parseContract(config); } catch (error) {
    return unavailableDataLifecycle(ruleIds, [String(error.message ?? error)]);
  }
  if (!contract && !references.found) return { violations: [], coverage: { status: 'not-applicable', ruleIds } };
  if (!contract) return { violations: [], coverage: { status: 'unavailable', ruleIds,
    details: ['package.json#starci.codePatterns.next.dataLifecycle is required when production source selects SWR', ...references.unsupported] } };
  const reasons = [];
  const violations = [];
  reasons.push(...references.unsupported);
  let installed;
  try { installed = installedSWR(config.packageRoot ?? config.root); } catch (error) {
    return { violations, coverage: { status: 'unavailable', ruleIds, details: [String(error.message ?? error)] } };
  }
  if (installed.major !== contract.swr.major) reasons.push(`installed swr ${installed.version} does not match declared major ${contract.swr.major}`);
  const { lifecycleCalls } = lifecycleCallSets(config, context, installed, reasons);
  const { hookCache, entriesByHook } = hookEntries(config, context, contract, reasons);
  inspectHookLifecycle(config, context, lifecycleCalls, hookCache, entriesByHook, violations, reasons);
  addUndeclaredLifecycleReasons(config, lifecycleCalls, hookCache, reasons);
  const details = [...new Set(reasons)].sort(byCodeUnit);
  return { violations, coverage: lifecycleCoverage(ruleIds, contract, installed, lifecycleCalls.length, details) };
}
