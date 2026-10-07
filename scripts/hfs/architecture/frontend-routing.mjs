import path from 'node:path';
import { reachableViolation, relativePath } from './typescript.mjs';

function hasClientDirective(ts, sourceFile) {
  return sourceFile.statements.find(statement => ts.isExpressionStatement(statement)
    && ts.isStringLiteral(statement.expression) && statement.expression.text === 'use client');
}

function bindImportClause(ts, clause, edge, bindings) {
  if (clause.name && !clause.isTypeOnly) bindings.set(clause.name.text, edge);
  if (!clause.namedBindings) return;
  if (ts.isNamespaceImport(clause.namedBindings)) bindings.set(clause.namedBindings.name.text, edge);
  if (!ts.isNamedImports(clause.namedBindings)) return;
  for (const element of clause.namedBindings.elements) {
    if (!element.isTypeOnly && !clause.isTypeOnly) bindings.set(element.name.text, edge);
  }
}

function importBindings(ts, sourceFile, edges) {
  const byStart = new Map(edges.map(edge => [edge.node.getStart(sourceFile), edge]));
  const bindings = new Map();
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !statement.importClause || !ts.isStringLiteralLike(statement.moduleSpecifier)) continue;
    const edge = byStart.get(statement.moduleSpecifier.getStart(sourceFile));
    if (!edge) continue;
    bindImportClause(ts, statement.importClause, edge, bindings);
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

function addRouteVariableFunctions(ts, statement, variables) {
  for (const declaration of statement.declarationList.declarations) {
    if (ts.isIdentifier(declaration.name) && declaration.initializer
      && (ts.isArrowFunction(declaration.initializer) || ts.isFunctionExpression(declaration.initializer))) variables.set(declaration.name.text, declaration.initializer);
  }
}

function recordRouteStatement(ts, statement, state) {
  if (ts.isVariableStatement(statement)) addRouteVariableFunctions(ts, statement, state.variables);
  if (ts.isFunctionDeclaration(statement) && statement.name) state.functions.set(statement.name.text, statement);
  if (ts.isFunctionDeclaration(statement) && statement.modifiers?.some(item => item.kind === ts.SyntaxKind.DefaultKeyword)) state.directDefault = statement;
  if (ts.isExportAssignment(statement) && !statement.isExportEquals) state.exportNode = statement;
}

function routeFunction(ts, sourceFile) {
  const state = { variables: new Map(), functions: new Map(), directDefault: null, exportNode: null };
  for (const statement of sourceFile.statements) recordRouteStatement(ts, statement, state);
  if (state.directDefault) return { fn: state.directDefault, exportNode: state.directDefault };
  if (!state.exportNode || !ts.isIdentifier(state.exportNode.expression)) return { fn: null, exportNode: state.exportNode };
  return { fn: state.variables.get(state.exportNode.expression.text) ?? state.functions.get(state.exportNode.expression.text) ?? null, exportNode: state.exportNode };
}

function routePageRoots(context, sourceFile, featureRoots) {
  const workspace = context.workspaceOf(sourceFile.fileName);
  if (!workspace) return featureRoots.map(root => path.join(root, 'pages'));
  const local = featureRoots.filter(root => context.workspaceOf(root) === workspace);
  return (local.length ? local : featureRoots).map(root => path.join(root, 'pages'));
}

function routingTermination(ts, statement, navigation) {
  if (ts.isThrowStatement(statement)) return true;
  if (ts.isBlock(statement)) return statement.statements.length > 0 && routingTermination(ts, statement.statements.at(-1), navigation);
  const expression = ts.isExpressionStatement(statement) ? statement.expression : (ts.isReturnStatement(statement) && statement.expression) || null;
  return Boolean(expression && ts.isCallExpression(expression) && ts.isIdentifier(expression.expression)
    && ['redirect', 'notFound'].includes(navigation.get(expression.expression.text)));
}

function routingGuard(ts, node, navigation) {
  return ts.isIfStatement(node) && !node.elseStatement && routingTermination(ts, node.thenStatement, navigation);
}

function routeNavigationCall(ts, node, navigation) {
  return ts.isCallExpression(node) && ts.isIdentifier(node.expression)
    && ['redirect', 'notFound'].includes(navigation.get(node.expression.text));
}

function recordRouteNode(ts, node, state, insideNavigationArgument) {
  if (ts.isJsxSelfClosingElement(node) || ts.isJsxElement(node)) state.jsx.push(node);
  if (ts.isIfStatement(node) || ts.isSwitchStatement(node) || (ts.isConditionalExpression(node) && !insideNavigationArgument)) state.decisions.push(node);
}

function visitRouteNode(ts, node, state, insideNavigationArgument = false) {
  recordRouteNode(ts, node, state, insideNavigationArgument);
  if (routeNavigationCall(ts, node, state.navigation)) {
    state.adapterCalls.push(node);
    for (const argument of node.arguments) visitRouteNode(ts, argument, state, true);
    return;
  }
  ts.forEachChild(node, child => visitRouteNode(ts, child, state, insideNavigationArgument));
}

function collectRouteNodes(ts, routeFunction, navigation) {
  const state = { jsx: [], adapterCalls: [], decisions: [], navigation };
  visitRouteNode(ts, routeFunction, state);
  return state;
}

function mountedRoutePages(ts, context, sourceFile, featureRoots, bindings, jsx, insideAny) {
  const pages = routePageRoots(context, sourceFile, featureRoots);
  return jsx.filter(node => {
    const opening = ts.isJsxElement(node) ? node.openingElement : node;
    const local = jsxRootName(ts, opening.tagName);
    const edge = local ? bindings.get(local) : null;
    return edge && Boolean(reachableViolation(context.edges, edge, target => insideAny(pages, target), { follow: candidate => candidate.reexport && candidate.runtime }));
  });
}

function reportRouteComposition(at, route, scan, mountedPages) {
  const { config, context, sourceFile, violations, violation } = at;
  const navigationOnly = scan.jsx.length === 0 && scan.adapterCalls.length === 1;
  if (!navigationOnly && (mountedPages.length !== 1 || scan.jsx.length !== 1)) {
    violations.push(violation(config, sourceFile, route.fn, 'FE_ROUTE_ONE_PAGE', 'A page.tsx route must mount exactly one pages-tier component, or be a zero-JSX redirect/notFound adapter.', { ts: context.ts }));
  }
  return navigationOnly;
}

function reportRouteDecisions(at, decisions, navigation, navigationOnly) {
  if (navigationOnly) return;
  const { config, context, sourceFile, violations, violation } = at;
  for (const decision of decisions) if (!routingGuard(context.ts, decision, navigation)) {
    violations.push(violation(config, sourceFile, decision, 'FE_ROUTE_DRAWING_DECISION', 'Visual route files may use terminal redirect/notFound guards but cannot select or omit visual composition.', { ts: context.ts }));
  }
}

function reportClientDirective(config, context, sourceFile, violations, violation) {
  const clientDirective = hasClientDirective(context.ts, sourceFile);
  if (clientDirective) violations.push(violation(config, sourceFile, clientDirective, 'FE_ROUTE_CLIENT_BOUNDARY', 'A page.tsx route adapter cannot own the client boundary.', { ts: context.ts }));
}

function routeHookName(ts, sourceFile, local) {
  return sourceFile.statements.flatMap(statement => ts.isImportDeclaration(statement) && statement.importClause?.namedBindings && ts.isNamedImports(statement.importClause.namedBindings)
    ? statement.importClause.namedBindings.elements.filter(item => item.name.text === local).map(item => item.name) : [])[0];
}

function reportForbiddenRouteHooks(config, context, sourceFile, navigation, violations, violation) {
  const { ts } = context;
  const forbiddenRouteHooks = new Set(['useRouter', 'usePathname', 'useSearchParams', 'useParams', 'useSelectedLayoutSegment', 'useSelectedLayoutSegments']);
  for (const [local, imported] of navigation) if (forbiddenRouteHooks.has(imported)) {
    const identifier = routeHookName(ts, sourceFile, local);
    if (identifier) violations.push(violation(config, sourceFile, identifier, 'FE_ROUTE_CLIENT_HOOK', `Server route adapter imports ${imported}.`, { ts }));
  }
}

export function checkRoute(config, context, sourceFile, roots, helpers) {
  const { violation, insideAny, importsForSource } = helpers;
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
  const navigation = importedNames(ts, sourceFile, 'next/navigation');
  const scan = collectRouteNodes(ts, route.fn, navigation);
  const mountedPages = mountedRoutePages(ts, context, sourceFile, roots.features, bindings, scan.jsx, insideAny);
  const at = { config, context, sourceFile, violations, violation };
  const navigationOnly = reportRouteComposition(at, route, scan, mountedPages);
  reportRouteDecisions(at, scan.decisions, navigation, navigationOnly);
  reportClientDirective(config, context, sourceFile, violations, violation);
  reportForbiddenRouteHooks(config, context, sourceFile, navigation, violations, violation);
  return violations;
}