import path from 'node:path';
import { isInside } from './config.mjs';
import { reachableViolation, relativePath, sourceLocation } from './typescript.mjs';

const TIERS = new Set(['leaves', 'branches', 'overlays', 'composites', 'blocks', 'layouts', 'product-shells', 'pages']);
const FORBIDDEN_UPWARD = {
  leaves: new Set(['branches', 'overlays', 'composites', 'blocks', 'layouts', 'product-shells', 'pages']),
  branches: new Set(['overlays', 'composites', 'blocks', 'layouts', 'product-shells', 'pages']),
  overlays: new Set(['layouts', 'product-shells', 'pages']),
  composites: new Set(['layouts', 'product-shells', 'pages']),
  blocks: new Set(['layouts', 'product-shells', 'pages']),
  layouts: new Set(['pages']),
  'product-shells': new Set(['pages']),
  pages: new Set(),
};

function absolute(root, relative) {
  return path.resolve(root, ...relative.split('/'));
}

function absoluteRoots(root, relatives) {
  return relatives.map(relative => absolute(root, relative)).sort((a, b) => b.length - a.length);
}

function rootFor(candidates, fileName) {
  return candidates.find(root => isInside(root, fileName)) ?? null;
}

function insideAny(candidates, fileName) {
  return Boolean(rootFor(candidates, fileName));
}

function tierOf(componentRoots, fileName) {
  const root = rootFor(componentRoots, fileName);
  if (!root) return null;
  const tier = relativePath(root, fileName).split('/')[0];
  return TIERS.has(tier) ? { tier, root } : null;
}

function violation(config, sourceFile, node, ruleId, message, extra = {}) {
  return {
    ruleId,
    path: relativePath(config.root, sourceFile.fileName),
    ...sourceLocation(sourceFile, node),
    message,
    ...Object.fromEntries(Object.entries(extra).filter(([key]) => key !== 'ts')),
  };
}

function hasClientDirective(ts, sourceFile) {
  return sourceFile.statements.find(statement => ts.isExpressionStatement(statement)
    && ts.isStringLiteral(statement.expression) && statement.expression.text === 'use client');
}

function importsForSource(context, fileName) {
  return context.edges.get(path.resolve(fileName)) ?? [];
}

function importBindings(ts, sourceFile, edges) {
  const byStart = new Map(edges.map(edge => [edge.node.getStart(sourceFile), edge]));
  const bindings = new Map();
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !statement.importClause || !ts.isStringLiteralLike(statement.moduleSpecifier)) continue;
    const edge = byStart.get(statement.moduleSpecifier.getStart(sourceFile));
    if (!edge) continue;
    const clause = statement.importClause;
    if (clause.name && !clause.isTypeOnly) bindings.set(clause.name.text, edge);
    if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings)) bindings.set(clause.namedBindings.name.text, edge);
    if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      for (const element of clause.namedBindings.elements) if (!element.isTypeOnly && !clause.isTypeOnly) bindings.set(element.name.text, edge);
    }
  }
  return bindings;
}

function importedNames(ts, sourceFile, moduleName) {
  const names = new Map();
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || statement.moduleSpecifier.text !== moduleName || !statement.importClause || statement.importClause.isTypeOnly) continue;
    const named = statement.importClause.namedBindings;
    if (!named || !ts.isNamedImports(named)) continue;
    for (const element of named.elements) if (!element.isTypeOnly) names.set(element.name.text, element.propertyName?.text ?? element.name.text);
  }
  return names;
}

function jsxRootName(ts, tagName) {
  if (ts.isIdentifier(tagName)) return tagName.text;
  if (ts.isPropertyAccessExpression(tagName)) {
    let current = tagName;
    while (ts.isPropertyAccessExpression(current)) current = current.expression;
    return ts.isIdentifier(current) ? current.text : null;
  }
  return null;
}

function routeFunction(ts, sourceFile) {
  const variables = new Map();
  const functions = new Map();
  let directDefault = null;
  let exportNode = null;
  for (const statement of sourceFile.statements) {
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && declaration.initializer
          && (ts.isArrowFunction(declaration.initializer) || ts.isFunctionExpression(declaration.initializer))) variables.set(declaration.name.text, declaration.initializer);
      }
    }
    if (ts.isFunctionDeclaration(statement) && statement.name) functions.set(statement.name.text, statement);
    if (ts.isFunctionDeclaration(statement) && statement.modifiers?.some(item => item.kind === ts.SyntaxKind.DefaultKeyword)) directDefault = statement;
    if (ts.isExportAssignment(statement) && !statement.isExportEquals) exportNode = statement;
  }
  if (directDefault) return { fn: directDefault, exportNode: directDefault };
  if (!exportNode || !ts.isIdentifier(exportNode.expression)) return { fn: null, exportNode };
  return { fn: variables.get(exportNode.expression.text) ?? functions.get(exportNode.expression.text) ?? null, exportNode };
}

function routePageRoots(context, sourceFile, componentRoots) {
  const workspace = context.workspaceOf(sourceFile.fileName);
  if (!workspace) return componentRoots.map(root => path.join(root, 'pages'));
  const local = componentRoots.filter(root => context.workspaceOf(root) === workspace);
  return (local.length ? local : componentRoots).map(root => path.join(root, 'pages'));
}

function checkRoute(config, context, sourceFile, roots) {
  const { ts } = context;
  const violations = [];
  const edges = importsForSource(context, sourceFile.fileName);
  const bindings = importBindings(ts, sourceFile, edges);
  const route = routeFunction(ts, sourceFile);
  if (!route.exportNode || !route.fn) {
    violations.push({ ruleId: 'FE_ROUTE_DEFAULT_EXPORT', path: relativePath(config.root, sourceFile.fileName), line: 1, column: 1,
      message: 'A page.tsx must default-export one local route function.' });
    return violations;
  }
  const jsx = [];
  const navigation = importedNames(ts, sourceFile, 'next/navigation');
  const adapterCalls = [];
  let decision = null;
  const visit = node => {
    if (ts.isJsxSelfClosingElement(node) || ts.isJsxElement(node)) jsx.push(node);
    if (!decision && (ts.isIfStatement(node) || ts.isSwitchStatement(node) || ts.isConditionalExpression(node))) decision = node;
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && ['redirect', 'notFound'].includes(navigation.get(node.expression.text))) adapterCalls.push(node);
    ts.forEachChild(node, visit);
  };
  visit(route.fn);
  const pages = routePageRoots(context, sourceFile, roots.components);
  const mountedPages = jsx.filter(node => {
    const opening = ts.isJsxElement(node) ? node.openingElement : node;
    const local = jsxRootName(ts, opening.tagName);
    const edge = local ? bindings.get(local) : null;
    return edge && Boolean(reachableViolation(context.edges, edge, target => insideAny(pages, target), { follow: candidate => candidate.reexport }));
  });
  const navigationOnly = jsx.length === 0 && adapterCalls.length === 1;
  if (!navigationOnly && (mountedPages.length !== 1 || jsx.length !== 1)) {
    violations.push(violation(config, sourceFile, route.fn, 'FE_ROUTE_ONE_PAGE', 'A page.tsx route must mount exactly one pages-tier component, or be a zero-JSX redirect/notFound adapter.', { ts }));
  }
  if (decision) violations.push(violation(config, sourceFile, decision, 'FE_ROUTE_DRAWING_DECISION', 'Route files cannot make drawing decisions.', { ts }));
  const clientDirective = hasClientDirective(ts, sourceFile);
  if (clientDirective) violations.push(violation(config, sourceFile, clientDirective, 'FE_ROUTE_CLIENT_BOUNDARY', 'A page.tsx route adapter cannot own the client boundary.', { ts }));
  const forbiddenRouteHooks = new Set(['useRouter', 'usePathname', 'useSearchParams', 'useParams', 'useSelectedLayoutSegment', 'useSelectedLayoutSegments']);
  for (const [local, imported] of navigation) if (forbiddenRouteHooks.has(imported)) {
    const identifier = sourceFile.statements.flatMap(statement => ts.isImportDeclaration(statement) && statement.importClause?.namedBindings && ts.isNamedImports(statement.importClause.namedBindings)
      ? statement.importClause.namedBindings.elements.filter(item => item.name.text === local).map(item => item.name) : [])[0];
    if (identifier) violations.push(violation(config, sourceFile, identifier, 'FE_ROUTE_CLIENT_HOOK', `Server route adapter imports ${imported}.`, { ts }));
  }
  return violations;
}

function checkPureAndData(config, context, sourceFile, roots) {
  const { ts } = context;
  const violations = [];
  const fileName = path.resolve(sourceFile.fileName);
  if (!insideAny(roots.components, fileName)) return violations;
  const pure = path.basename(fileName).toLowerCase() === 'component.tsx';
  for (const edge of importsForSource(context, fileName)) {
    if (!edge.runtime) continue;
    const transportChain = reachableViolation(context.edges, edge, target => insideAny(roots.transport, target), { follow: candidate => candidate.reexport });
    if (transportChain) {
      violations.push({ ruleId: 'FE_COMPONENT_IMPORTS_TRANSPORT', path: relativePath(config.root, fileName), line: edge.line, column: edge.column,
        specifier: edge.specifier, resolvedPath: relativePath(config.root, transportChain.at(-1)), dependencyChain: transportChain.map(item => relativePath(config.root, item)),
        message: 'Components cannot import the API transport at runtime; a data hook or server route adapter owns the request.' });
    }
    const configuredHookBarrel = insideAny(roots.hooks, edge.to) && /^index\.[cm]?[jt]sx?$/i.test(path.basename(edge.to));
    const hookChain = configuredHookBarrel ? null
      : reachableViolation(context.edges, edge, target => insideAny(roots.hooks, target), { follow: candidate => candidate.reexport });
    if (hookChain) {
      violations.push({ ruleId: 'FE_COMPONENT_DEEP_HOOK_IMPORT', path: relativePath(config.root, fileName), line: edge.line, column: edge.column,
        specifier: edge.specifier, resolvedPath: relativePath(config.root, hookChain.at(-1)), dependencyChain: hookChain.map(item => relativePath(config.root, item)),
        message: 'Components must enter data hooks through the owning hooks barrel.' });
    }
    if (pure) {
      const chain = reachableViolation(context.edges, edge, target => insideAny(roots.hooks, target) || insideAny(roots.transport, target),
        { follow: candidate => candidate.reexport });
      if (chain) violations.push({ ruleId: 'FE_PURE_REACHES_DATA', path: relativePath(config.root, fileName), line: edge.line, column: edge.column,
        specifier: edge.specifier, resolvedPath: relativePath(config.root, chain.at(-1)), dependencyChain: chain.map(item => relativePath(config.root, item)),
        message: 'Pure component.tsx cannot reach hooks or API transport through an alias, relative import, package, or barrel.' });
    }
  }
  if (pure) {
    const worldHooks = new Set(['createContext', 'useContext', 'useSyncExternalStore']);
    const reactNamespaces = new Set();
    for (const statement of sourceFile.statements) {
      if (!ts.isImportDeclaration(statement) || !ts.isStringLiteralLike(statement.moduleSpecifier) || statement.importClause?.isTypeOnly) continue;
      const source = statement.moduleSpecifier.text;
      const named = statement.importClause?.namedBindings;
      if (source === 'react' && named && ts.isNamedImports(named)) {
        for (const element of named.elements) {
          const imported = element.propertyName?.text ?? element.name.text;
          if (!element.isTypeOnly && worldHooks.has(imported)) violations.push(violation(config, sourceFile, element, 'FE_PURE_WORLD_HOOK', `Pure component.tsx imports ${imported}; its connected index.tsx owns application/world state.`, { ts }));
        }
      }
      if (source === 'react' && statement.importClause?.name) reactNamespaces.add(statement.importClause.name.text);
      if (source === 'react' && named && ts.isNamespaceImport(named)) reactNamespaces.add(named.name.text);
      if ((source === 'next/navigation' || source === 'next-intl') && statement.importClause) {
        violations.push(violation(config, sourceFile, statement, 'FE_PURE_WORLD_IMPORT', `Pure component.tsx imports ${source}; its connected index.tsx owns router and locale context.`, { ts }));
      }
    }
    const visitWorldHooks = node => {
      if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) && reactNamespaces.has(node.expression.text)
        && worldHooks.has(node.name.text)) violations.push(violation(config, sourceFile, node, 'FE_PURE_WORLD_HOOK', `Pure component.tsx accesses ${node.expression.text}.${node.name.text}; its connected index.tsx owns application/world state.`, { ts }));
      ts.forEachChild(node, visitWorldHooks);
    };
    visitWorldHooks(sourceFile);
  }
  return violations;
}

function checkTierDirection(config, context, sourceFile, roots) {
  const violations = [];
  const source = tierOf(roots.components, sourceFile.fileName);
  if (!source) return violations;
  for (const edge of importsForSource(context, sourceFile.fileName)) {
    const chain = reachableViolation(context.edges, edge, candidate => {
      const targetTier = tierOf(roots.components, candidate);
      return targetTier && FORBIDDEN_UPWARD[source.tier].has(targetTier.tier);
    });
    if (!chain) continue;
    const target = tierOf(roots.components, chain.at(-1));
    violations.push({ ruleId: 'FE_TIER_IMPORTS_UPWARD', path: relativePath(config.root, sourceFile.fileName), line: edge.line, column: edge.column,
      specifier: edge.specifier, resolvedPath: relativePath(config.root, chain.at(-1)), dependencyChain: chain.map(item => relativePath(config.root, item)),
      message: `${source.tier} cannot depend on ${target.tier}, including through an alias, package export, or barrel.` });
  }
  return violations;
}

function checkRawFetch(config, context, sourceFile, roots) {
  if (insideAny(roots.transport, sourceFile.fileName) || insideAny(roots.routes, sourceFile.fileName)) return [];
  const { ts } = context;
  const violations = [];
  const visit = node => {
    if (ts.isCallExpression(node)) {
      const direct = ts.isIdentifier(node.expression) && node.expression.text === 'fetch';
      const member = ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'fetch'
        && ts.isIdentifier(node.expression.expression) && ['globalThis', 'window'].includes(node.expression.expression.text);
      if (direct || member) violations.push(violation(config, sourceFile, node, 'FE_FETCH_OUTSIDE_TRANSPORT', 'Raw fetch belongs under the configured API transport root or a server route adapter.', { ts }));
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return violations;
}

/** Enforce route adapters, UI responsibility tiers, pure/connected, and transport boundaries. */
export function checkFrontend(config, context) {
  const roots = {
    routes: absoluteRoots(config.root, config.frontend.routes),
    components: absoluteRoots(config.root, config.frontend.components),
    hooks: absoluteRoots(config.root, config.frontend.hooks),
    transport: absoluteRoots(config.root, config.frontend.transport),
  };
  const violations = [];
  for (const sourceFile of context.files) {
    if (insideAny(roots.routes, sourceFile.fileName) && path.basename(sourceFile.fileName).toLowerCase() === 'page.tsx') {
      violations.push(...checkRoute(config, context, sourceFile, roots));
    }
    violations.push(...checkPureAndData(config, context, sourceFile, roots));
    violations.push(...checkTierDirection(config, context, sourceFile, roots));
    violations.push(...checkRawFetch(config, context, sourceFile, roots));
  }
  return violations;
}
