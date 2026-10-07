import path from 'node:path';
import { normalizedSymbolValue, returnedExpressions as sharedReturnedExpressions } from './ast-walks.mjs';
import { reachableViolation, relativePath, unwrapExpression } from './typescript.mjs';
import { WorldRenderAnalysis } from './frontend-world-render.mjs';
const WORLD_NAVIGATION_CALLS = new Set(['useParams', 'usePathname', 'useRouter', 'useSearchParams', 'useSelectedLayoutSegment', 'useSelectedLayoutSegments']);
const WORLD_INTL_CALLS = new Set(['useLocale', 'useMessages', 'useNow', 'useTimeZone', 'useTranslations']);
const WORLD_SWR_CALLS = new Set(['default', 'useSWR', 'useSWRConfig', 'useSWRImmutable', 'useSWRMutation']);
const LOWER_COMPONENT_TIERS = new Set(['composites', 'branches', 'leaves']);
function selectedSymbol(ts, checker, expression) {
  const selected = unwrapExpression(ts, expression);
  if (!selected) return null;
  if (ts.isIdentifier(selected)) return checker.getSymbolAtLocation(selected) ?? null;
  if (ts.isPropertyAccessExpression(selected)) return checker.getSymbolAtLocation(selected.name) ?? null;
  if (ts.isElementAccessExpression(selected) && ts.isStringLiteralLike(selected.argumentExpression)) {
    return checker.getSymbolAtLocation(selected.argumentExpression)
      ?? checker.getTypeAtLocation(selected.expression).getProperty(selected.argumentExpression.text)
      ?? null;
  }
  return null;
}

/* The wider boundary set: `ts.isFunctionLike` (includes call signatures' declarations) rather than the
 * four default callable kinds. */
const returnedExpressions = (ts, declaration) => sharedReturnedExpressions(ts, declaration, { functionLike: ts.isFunctionLike });

function knownWorldImport(specifier, imported) {
  if (specifier === 'next-intl') return WORLD_INTL_CALLS.has(imported);
  if (specifier === 'next/navigation' || /(?:^|\/)i18n\/navigation$/.test(specifier)) return WORLD_NAVIGATION_CALLS.has(imported);
  if (specifier === 'swr' || specifier === 'swr/immutable' || specifier === 'swr/mutation') return WORLD_SWR_CALLS.has(imported);
  if (specifier === 'next-auth/react') return imported === 'useSession';
  return false;
}

class WorldAnalysis {
  constructor(config, context, roots, helpers) {
    this.config = config;
    this.context = context;
    this.roots = roots;
    this.ts = context.ts;
    Object.assign(this, helpers);
    this.violations = [];
    this.sourceSet = new Set(context.files.map(source => path.resolve(source.fileName)));
    this.worldInfoCache = new Map();
    this.functionWorldCache = new Map();
    this.renderOutputCache = new Map();
    this.intrinsicUiHookCache = new Map();
    this.renderer = new WorldRenderAnalysis(this, { selectedSymbol, returnedExpressions });
  }

  forbiddenIntrinsicEdge(edge, nextVisiting) {
    const forbidden = reachableViolation(this.context.edges, edge, target => this.insideAny(this.roots.transport, target)
      || this.insideAny(this.roots.modules, target) || this.insideAny(this.roots.features, target) || this.insideAny(this.roots.routes, target)
      || (this.insideAny(this.roots.hooks, target) && relativePath(this.rootFor(this.roots.hooks, target), target).split('/')[0] !== 'ui'),
    { follow: candidate => candidate.runtime });
    return Boolean(forbidden || (this.insideAny(this.roots.hooks, edge.to) && !this.intrinsicUiHookFile(edge.to, nextVisiting)));
  }

  forbiddenWorldImport(statement) {
    if (!this.ts.isImportDeclaration(statement) || !statement.importClause || statement.importClause.isTypeOnly
      || !this.ts.isStringLiteralLike(statement.moduleSpecifier)) return false;
    const specifier = statement.moduleSpecifier.text;
    const bindings = [];
    if (statement.importClause.name) bindings.push('default');
    const named = statement.importClause.namedBindings;
    if (named && this.ts.isNamespaceImport(named)
      && ['next/navigation', 'next-intl', 'swr', 'swr/immutable', 'swr/mutation', 'next-auth/react'].includes(specifier)) return true;
    if (named && this.ts.isNamedImports(named)) {
      for (const element of named.elements) if (!element.isTypeOnly) bindings.push(element.propertyName?.text ?? element.name.text);
    }
    return bindings.some(imported => knownWorldImport(specifier, imported));
  }

  containsUnshadowedFetch(sourceFile, checker) {
    let found = false;
    const visit = node => {
      if (!found && this.ts.isCallExpression(node) && this.ts.isIdentifier(node.expression) && node.expression.text === 'fetch'
        && !checker.getSymbolAtLocation(node.expression)) found = true;
      if (!found) this.ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    return found;
  }

  intrinsicUiHookFile(fileName, visiting = new Set()) {
    const resolved = path.resolve(fileName);
    if (this.intrinsicUiHookCache.has(resolved)) return this.intrinsicUiHookCache.get(resolved);
    const hookRoot = this.rootFor(this.roots.hooks, resolved);
    if (!hookRoot || relativePath(hookRoot, resolved).split('/')[0] !== 'ui' || visiting.has(resolved)) return false;
    const sourceFile = this.context.files.find(source => path.resolve(source.fileName) === resolved);
    if (!sourceFile) return false;
    this.intrinsicUiHookCache.set(resolved, false);
    const nextVisiting = new Set(visiting).add(resolved);
    const checker = this.context.checkerFor(resolved);
    const edges = this.importsForSource(this.context, resolved);
    let intrinsic = true;
    for (const edge of edges.filter(candidate => candidate.runtime)) {
      if (this.forbiddenIntrinsicEdge(edge, nextVisiting)) {
        intrinsic = false;
        break;
      }
    }
    for (const statement of sourceFile.statements) {
      if (!intrinsic) break;
      if (this.forbiddenWorldImport(statement)) { intrinsic = false; break; }
    }
    if (intrinsic && this.containsUnshadowedFetch(sourceFile, checker)) intrinsic = false;
    this.intrinsicUiHookCache.set(resolved, intrinsic);
    return intrinsic;
  }

  intrinsicUiHookSymbol(symbol, checker) {
    const identity = normalizedSymbolValue(this.ts, checker, symbol);
    const declarations = identity?.getDeclarations?.() ?? [];
    return declarations.length > 0 && declarations.every(declaration => this.intrinsicUiHookFile(declaration.getSourceFile().fileName));
  }

  inspectWorldImportStatement(sourceFile, checker, byStart, symbols, namespaces, statement) {
    if (!this.ts.isImportDeclaration(statement) || !statement.importClause || statement.importClause.isTypeOnly
      || !this.ts.isStringLiteralLike(statement.moduleSpecifier)) return;
    const specifier = statement.moduleSpecifier.text;
    const edge = byStart.get(statement.moduleSpecifier.getStart(sourceFile));
    const worldEdge = edge && Boolean(reachableViolation(this.context.edges, edge,
      target => this.insideAny(this.roots.hooks, target) || this.insideAny(this.roots.transport, target),
      { follow: candidate => candidate.reexport && candidate.runtime }));
    const clause = statement.importClause;
    if (clause.name) {
      const symbol = checker.getSymbolAtLocation(clause.name);
      if (symbol && (worldEdge || knownWorldImport(specifier, 'default'))) symbols.add(symbol);
    }
    const named = clause.namedBindings;
    if (named && this.ts.isNamedImports(named)) for (const element of named.elements) {
      if (element.isTypeOnly) continue;
      const imported = element.propertyName?.text ?? element.name.text;
      const symbol = checker.getSymbolAtLocation(element.name);
      if (symbol && (worldEdge || knownWorldImport(specifier, imported))) symbols.add(symbol);
    }
    if (named && this.ts.isNamespaceImport(named)) {
      const symbol = checker.getSymbolAtLocation(named.name);
      if (symbol) namespaces.set(symbol, { specifier, worldEdge });
    }
  }

  importInfo(sourceFile) {
    const key = path.resolve(sourceFile.fileName);
    if (this.worldInfoCache.has(key)) return this.worldInfoCache.get(key);
    const checker = this.context.checkerFor(sourceFile.fileName);
    const edges = this.importsForSource(this.context, sourceFile.fileName);
    const byStart = new Map(edges.map(edge => [edge.node.getStart(sourceFile), edge]));
    const symbols = new Set();
    const namespaces = new Map();
    for (const statement of sourceFile.statements) this.inspectWorldImportStatement(sourceFile, checker, byStart, symbols, namespaces, statement);
    const value = { checker, symbols, namespaces };
    this.worldInfoCache.set(key, value);
    return value;
  }

  collectExpressionFunctions(declaration, checker, seen, functions) {
    if (this.ts.isFunctionDeclaration(declaration) || this.ts.isMethodDeclaration(declaration)) functions.push(declaration);
    else if (this.ts.isVariableDeclaration(declaration) && declaration.initializer) {
      functions.push(...this.expressionFunctions(declaration.initializer, checker, seen));
    } else if (this.ts.isClassDeclaration(declaration)) {
      functions.push(...declaration.members.filter(member => this.ts.isMethodDeclaration(member)
        && member.name && (this.ts.isIdentifier(member.name) || this.ts.isStringLiteralLike(member.name)) && member.name.text === 'render'));
    }
  }

  expressionFunctions(expression, checker, seen = new Set()) {
    expression = unwrapExpression(this.ts, expression);
    if (!expression) return [];
    if (this.ts.isArrowFunction(expression) || this.ts.isFunctionExpression(expression) || this.ts.isMethodDeclaration(expression)
      || this.ts.isFunctionDeclaration(expression)) return [expression];
    if (this.ts.isConditionalExpression(expression)) {
      return [...this.expressionFunctions(expression.whenTrue, checker, seen), ...this.expressionFunctions(expression.whenFalse, checker, seen)];
    }
    if (this.ts.isCallExpression(expression)) {
      const selected = unwrapExpression(this.ts, expression.expression);
      const name = (this.ts.isIdentifier(selected) && selected.text) || (this.ts.isPropertyAccessExpression(selected) && selected.name.text) || null;
      if (['forwardRef', 'memo'].includes(name) && expression.arguments[0]) return this.expressionFunctions(expression.arguments[0], checker, seen);
    }
    const symbol = normalizedSymbolValue(this.ts, checker, selectedSymbol(this.ts, checker, expression));
    if (!symbol || seen.has(symbol)) return [];
    const nextSeen = new Set(seen).add(symbol);
    const functions = [];
    for (const declaration of symbol.getDeclarations?.() ?? []) this.collectExpressionFunctions(declaration, checker, nextSeen, functions);
    return [...new Set(functions.filter(fn => fn.body))];
  }

  symbolIsWorld(raw, sourceFile, propertyName = null) {
    if (!raw) return false;
    const info = this.importInfo(sourceFile);
    if (this.intrinsicUiHookSymbol(raw, info.checker)) return false;
    if (info.symbols.has(raw)) return true;
    for (const [namespace, declaration] of info.namespaces) if (namespace === raw) {
      return declaration.worldEdge || knownWorldImport(declaration.specifier, propertyName ?? '');
    }
    const identity = normalizedSymbolValue(this.ts, info.checker, raw);
    return (identity?.getDeclarations?.() ?? []).some(declaration => {
      const fileName = declaration.getSourceFile().fileName;
      return this.insideAny(this.roots.hooks, fileName) || this.insideAny(this.roots.transport, fileName);
    });
  }

  namespaceIsWorld(raw, sourceFile, propertyName) {
    const info = this.importInfo(sourceFile);
    const declaration = info.namespaces.get(raw);
    return Boolean(declaration && (declaration.worldEdge || knownWorldImport(declaration.specifier, propertyName ?? '')));
  }

  worldMemberCallee(expression, checker, sourceFile) {
    let property = this.ts.isPropertyAccessExpression(expression) ? expression.name.text : null;
    if (property === null && this.ts.isStringLiteralLike(expression.argumentExpression)) property = expression.argumentExpression.text;
    const namespace = checker.getSymbolAtLocation(expression.expression);
    if (this.intrinsicUiHookSymbol(selectedSymbol(this.ts, checker, expression), checker)) return false;
    if (this.namespaceIsWorld(namespace, sourceFile, property)) return true;
    return this.symbolIsWorld(selectedSymbol(this.ts, checker, expression), sourceFile);
  }

  worldVariableInitializer(symbol, checker, nextSeen) {
    for (const declaration of symbol.getDeclarations?.() ?? []) {
      if (this.ts.isVariableDeclaration(declaration) && declaration.initializer
        && this.calleeIsWorld(declaration.initializer, checker, declaration.getSourceFile(), nextSeen)) return true;
    }
    return false;
  }

  calleeIsWorld(input, checker, sourceFile, seen = new Set()) {
    const expression = unwrapExpression(this.ts, input);
    if (this.ts.isIdentifier(expression) && this.symbolIsWorld(checker.getSymbolAtLocation(expression), sourceFile)) return true;
    if (this.ts.isPropertyAccessExpression(expression) || this.ts.isElementAccessExpression(expression))
      if (this.worldMemberCallee(expression, checker, sourceFile)) return true;
    const symbol = normalizedSymbolValue(this.ts, checker, selectedSymbol(this.ts, checker, expression));
    if (!symbol || seen.has(symbol)) return false;
    const nextSeen = new Set(seen).add(symbol);
    if (this.worldVariableInitializer(symbol, checker, nextSeen)) return true;
    return this.expressionFunctions(expression, checker).some(fn => this.functionUsesWorld(fn, checker, nextSeen));
  }

  callIsWorld(call, checker, sourceFile, seen) { return this.calleeIsWorld(call.expression, checker, sourceFile, seen); }

  functionUsesWorld(fn, checker, seen = new Set()) {
    if (this.functionWorldCache.has(fn)) return this.functionWorldCache.get(fn);
    this.functionWorldCache.set(fn, false);
    let found = false;
    const sourceFile = fn.getSourceFile();
    const visit = node => {
      if (found) return;
      if (this.ts.isCallExpression(node) && this.callIsWorld(node, checker, sourceFile, seen)) { found = true; return; }
      this.ts.forEachChild(node, visit);
    };
    visit(fn.body ?? fn);
    this.functionWorldCache.set(fn, found);
    return found;
  }

  

  collectFunctionNodes(node, functions) {
    if (this.ts.isFunctionDeclaration(node) || this.ts.isMethodDeclaration(node) || this.ts.isArrowFunction(node) || this.ts.isFunctionExpression(node)) functions.push(node);
    this.ts.forEachChild(node, child => this.collectFunctionNodes(child, functions));
  }

  inspectBlockProductHooks(sourceFile, checker, tier, functions) {
    for (const fn of functions) {
      const name = this.declarationName(this.ts, fn);
      if (tier?.tier === 'blocks' && name && /^use[A-Z0-9]/.test(name.text) && this.functionUsesWorld(fn, checker)) {
        this.violations.push(this.violation(this.config, sourceFile, name, 'FE_BLOCK_PRODUCT_HOOK_DEFINITION',
          'A block may call a product hook from hooks but cannot define product-world or data lifecycle under the block.', { ts: this.ts }));
      }
    }
  }

  inspectWorldOwner(sourceFile, checker, tier, fn) {
    if (!this.renderer.functionHasRender(fn, checker) || !this.functionUsesWorld(fn, checker)) return;
    const returned = returnedExpressions(this.ts, fn);
    if (!returned.length || returned.some(expression => !this.renderer.renderBoundary(expression, checker, new Set(), true))) {
      this.violations.push(this.violation(this.config, sourceFile, fn, 'FE_WORLD_OWNER_RENDER_BOUNDARY',
        'A visual owner that reads product/world state must hand every render path to a statically resolved pure render function or component; intrinsic-only interaction does not select this rule.', { ts: this.ts }));
    }
    if (tier && LOWER_COMPONENT_TIERS.has(tier.tier)) {
      this.violations.push(this.violation(this.config, sourceFile, fn, 'FE_COMPONENT_WORLD_OWNERSHIP',
        `${tier.tier} may own intrinsic browser interaction but cannot own product-world, navigation, locale, session or data lifecycle.`, { ts: this.ts }));
    }
    if (tier?.tier === 'blocks') this.inspectConnectedBlock(sourceFile, checker, fn, returned);
  }

  inspectConnectedBlock(sourceFile, checker, fn, returned) {
    const expected = path.resolve(path.dirname(sourceFile.fileName), 'component.tsx');
    const index = path.basename(sourceFile.fileName).toLowerCase() === 'index.tsx';
    if (!index || !this.sourceSet.has(expected) || !returned.length
      || returned.some(expression => !this.renderer.renderBoundary(expression, checker, new Set(), true, expected))) {
      this.violations.push(this.violation(this.config, sourceFile, fn, 'FE_CONNECTED_BLOCK_RENDER_PAIR',
        'A connected blocks/index.tsx must hand every nonempty render path to a resolved pure export from its sibling component.tsx; pure blocks and lower tiers need no twin.', { ts: this.ts }));
    }
  }

  inspectWorldOwners(sourceFile, checker, tier, functions) {
    for (const fn of functions) this.inspectWorldOwner(sourceFile, checker, tier, fn);
  }

  inspectSourceFile(sourceFile) {
    if ((!this.insideAny(this.roots.components, sourceFile.fileName) && !this.insideAny(this.roots.features, sourceFile.fileName))
      || !/\.[cm]?tsx$/i.test(sourceFile.fileName)) return;
    const checker = this.context.checkerFor(sourceFile.fileName);
    const tier = this.tierOf(this.roots.components, sourceFile.fileName);
    const functions = [];
    this.collectFunctionNodes(sourceFile, functions);
    this.inspectBlockProductHooks(sourceFile, checker, tier, functions);
    this.inspectWorldOwners(sourceFile, checker, tier, functions);
  }

  check() {
    for (const sourceFile of this.context.files) this.inspectSourceFile(sourceFile);
    return this.violations;
  }
}

export function checkWorldRenderBoundaries(config, context, roots, helpers) {
  return new WorldAnalysis(config, context, roots, helpers).check();
}
