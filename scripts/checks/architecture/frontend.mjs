import fs from 'node:fs';
import path from 'node:path';
import { isInside } from './config.mjs';
import { isUnshadowedCommonJsRequire, reachableViolation, relativePath, sourceLocation } from './typescript.mjs';

const FEATURE_TIERS = new Set(['pages', 'layouts', 'overlays']);
const COMPONENT_TIERS = new Set(['blocks', 'composites', 'branches', 'leaves']);
const LOWER_COMPONENT_TIERS = new Set(['composites', 'branches', 'leaves']);
const FORBIDDEN_UPWARD = {
  leaves: new Set(['branches', 'composites', 'blocks']),
  branches: new Set(['composites', 'blocks']),
  composites: new Set(['blocks']),
  blocks: new Set(),
};
const WORLD_NAVIGATION_CALLS = new Set(['useParams', 'usePathname', 'useRouter', 'useSearchParams', 'useSelectedLayoutSegment', 'useSelectedLayoutSegments']);
const WORLD_INTL_CALLS = new Set(['useLocale', 'useMessages', 'useNow', 'useTimeZone', 'useTranslations']);
const WORLD_SWR_CALLS = new Set(['default', 'useSWR', 'useSWRConfig', 'useSWRImmutable', 'useSWRMutation']);

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
  return COMPONENT_TIERS.has(tier) ? { tier, root } : null;
}

function featureTierOf(featureRoots, fileName) {
  const root = rootFor(featureRoots, fileName);
  if (!root) return null;
  const tier = relativePath(root, fileName).split('/')[0];
  return FEATURE_TIERS.has(tier) ? { tier, root } : null;
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

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function exportTargets(value) {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(exportTargets);
  if (value && typeof value === 'object' && !Array.isArray(value)) return Object.values(value).flatMap(exportTargets);
  return [];
}

function grammarExport(manifest, packageName, specifier) {
  const key = specifier === packageName ? '.' : `.${specifier.slice(packageName.length)}`;
  const value = manifest?.exports?.[key];
  const targets = exportTargets(value);
  return targets.length > 0 && targets.every(target => target.startsWith('./') && !target.includes('\\') && !target.split('/').includes('..'));
}

function canonical(file) {
  const absolute = path.resolve(file);
  try { return path.resolve(fs.realpathSync(absolute)); } catch { return absolute; }
}

function grammarExportTargets(manifest, packageRoot, packageName, specifier) {
  const key = specifier === packageName ? '.' : `.${specifier.slice(packageName.length)}`;
  return exportTargets(manifest?.exports?.[key]).filter(target => target.startsWith('./') && !target.includes('\\') && !target.split('/').includes('..'))
    .map(target => canonical(path.resolve(packageRoot, target)));
}

function literalModules(ts, sourceFile, checker) {
  const modules = [];
  const visit = node => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && ts.isStringLiteralLike(node.moduleSpecifier)) {
      modules.push({ node: node.moduleSpecifier, specifier: node.moduleSpecifier.text });
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)
      && node.moduleReference.expression && ts.isStringLiteralLike(node.moduleReference.expression)) {
      modules.push({ node: node.moduleReference.expression, specifier: node.moduleReference.expression.text });
    } else if (ts.isCallExpression(node) && node.arguments.length > 0 && ts.isStringLiteralLike(node.arguments[0])
      && (node.expression.kind === ts.SyntaxKind.ImportKeyword || isUnshadowedCommonJsRequire(ts, checker, node.expression))) {
      modules.push({ node: node.arguments[0], specifier: node.arguments[0].text });
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return modules;
}

function cssImports(content) {
  const imports = [];
  const withoutComments = content.replace(/\/\*[\s\S]*?\*\//g, match => match.replace(/[^\r\n]/g, ' '));
  const pattern = /@import\s+(?:url\(\s*(?:(["'])(.*?)\1|([^\s)]+))\s*\)|(["'])(.*?)\4)/gi;
  for (const match of withoutComments.matchAll(pattern)) {
    imports.push({ specifier: match[2] ?? match[3] ?? match[5], index: match.index });
  }
  return imports;
}

function checkGrammar(config, context) {
  const grammar = config.frontend.grammar;
  if (!grammar) return [];
  const violations = [];
  const local = context.workspaces.find(workspace => workspace.name === grammar.package);
  // Node resolution per consumer: in an npm-workspaces monorepo a consumer whose range differs from the
  // hoisted copy gets its own apps/<app>/node_modules/<package> (nivo-fe: apps/app on 0.5.0 beside a hoisted
  // 0.4.11). Every consumer is judged against the copy it actually resolves, never the hoisted one alone.
  const installedFrom = (from) => {
    for (let dir = from; isInside(config.root, dir); dir = path.dirname(dir)) {
      const candidate = path.join(dir, 'node_modules', ...grammar.package.split('/'));
      if (fs.existsSync(path.join(candidate, 'package.json'))) return candidate;
      if (dir === config.root || path.dirname(dir) === dir) break;
    }
    return path.join(config.root, 'node_modules', ...grammar.package.split('/'));
  };
  const consumers = grammar.consumerManifests.map(relative => {
    const root = path.dirname(path.join(config.root, ...relative.split('/')));
    const packageRoot = local?.root ?? installedFrom(root);
    return { relative, root, packageRoot, packageManifest: readJson(path.join(packageRoot, 'package.json')),
      manifest: readJson(path.join(config.root, ...relative.split('/'))) ?? {} };
  });
  const installs = [...new Map(consumers.map(consumer => [consumer.packageRoot, consumer])).values()];
  const packageRoot = installs[0]?.packageRoot ?? local?.root ?? path.join(config.root, 'node_modules', ...grammar.package.split('/'));
  const manifestFile = path.join(packageRoot, 'package.json');
  const manifest = readJson(manifestFile);
  const ownerOf = (fileName) => consumers.filter(consumer => isInside(consumer.root, fileName))
    .sort((a, b) => b.root.length - a.root.length)[0] ?? null;
  const contractProblems = [];
  const styleBypasses = [];
  for (const install of installs) {
    const where = installs.length > 1 ? ` (as ${install.relative} resolves it, ${relativePath(config.root, install.packageRoot)})` : '';
    if (install.packageManifest?.name !== grammar.package) contractProblems.push(`installed package ${grammar.package} is unavailable or has a different name${where}`);
    if (!grammarExport(install.packageManifest, grammar.package, grammar.entry)) contractProblems.push(`${grammar.entry} is not a safe declared package export${where}`);
    if (!grammarExport(install.packageManifest, grammar.package, grammar.styleEntry)) contractProblems.push(`${grammar.styleEntry} is not a safe declared style export${where}`);
    const actualPeers = Object.keys(install.packageManifest?.peerDependencies ?? {}).sort();
    const selectedPeers = [...grammar.peers].sort();
    if (JSON.stringify(actualPeers) !== JSON.stringify(selectedPeers)) {
      contractProblems.push(`${grammar.package} peerDependencies must exactly match the selected peers ${selectedPeers.join(', ')}${where}`);
    }
  }
  for (const consumer of consumers) if (!Object.hasOwn(consumer.manifest.dependencies ?? {}, grammar.package)) {
    contractProblems.push(`${consumer.relative} does not declare ${grammar.package} as a runtime dependency`);
  }
  for (const peer of grammar.peers) {
    for (const consumer of consumers) if (!Object.hasOwn(consumer.manifest.dependencies ?? {}, peer) && !Object.hasOwn(consumer.manifest.peerDependencies ?? {}, peer)) {
      contractProblems.push(`${consumer.relative} does not declare Grammar peer ${peer}`);
    }
  }
  for (const source of grammar.styleSources) {
    const content = fs.readFileSync(path.join(config.root, ...source.split('/')), 'utf8');
    const grammarStyles = cssImports(content).filter(item => item.specifier === grammar.package || item.specifier.startsWith(`${grammar.package}/`));
    if (!grammarStyles.some(item => item.specifier === grammar.styleEntry)) contractProblems.push(`${source} does not import ${grammar.styleEntry}`);
    for (const imported of grammarStyles) if (imported.specifier !== grammar.styleEntry) {
      contractProblems.push(`${source} imports Grammar style ${imported.specifier} outside the selected style entry`);
      styleBypasses.push({ ruleId: 'ARCH_GRAMMAR_EXPORT_BYPASS', path: source,
        line: content.slice(0, imported.index).split(/\r?\n/).length, column: 1, package: grammar.package, specifier: imported.specifier,
        message: `Style source must use the selected Grammar style entry ${grammar.styleEntry}; ${imported.specifier} is outside that contract.` });
    }
  }
  if (contractProblems.length) violations.push({
    ruleId: 'ARCH_GRAMMAR_CONTRACT_INVALID',
    path: fs.existsSync(manifestFile) && isInside(config.root, manifestFile) ? relativePath(config.root, manifestFile) : 'package.json',
    line: 1,
    column: 1,
    package: grammar.package,
    message: `Grammar contract is invalid: ${contractProblems.join('; ')}.`,
  });
  const allowed = new Set([grammar.entry, grammar.styleEntry]);
  violations.push(...styleBypasses);
  for (const sourceFile of context.files) {
    if (installs.some(install => isInside(install.packageRoot, sourceFile.fileName))) continue;
    const owner = ownerOf(sourceFile.fileName);
    if (!owner) continue;
    const edgesByStart = new Map((context.edges.get(path.resolve(sourceFile.fileName)) ?? []).map(edge => [edge.node.getStart(sourceFile), edge]));
    for (const reference of literalModules(context.ts, sourceFile, context.checkerFor(sourceFile.fileName))) {
      if (reference.specifier !== grammar.package && !reference.specifier.startsWith(`${grammar.package}/`)) continue;
      if (allowed.has(reference.specifier)) {
        const edge = edgesByStart.get(reference.node.getStart(sourceFile));
        const expected = grammarExportTargets(owner.packageManifest, owner.packageRoot, grammar.package, reference.specifier);
        if (!edge || expected.includes(canonical(edge.to))) continue;
      }
      violations.push(violation(config, sourceFile, reference.node, 'ARCH_GRAMMAR_EXPORT_BYPASS',
        `Product source must import the selected Grammar code entry ${grammar.entry} or style entry ${grammar.styleEntry}; ${reference.specifier} is outside that contract.`,
        { specifier: reference.specifier, package: grammar.package }));
    }
  }
  return violations;
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

function routePageRoots(context, sourceFile, featureRoots) {
  const workspace = context.workspaceOf(sourceFile.fileName);
  if (!workspace) return featureRoots.map(root => path.join(root, 'pages'));
  const local = featureRoots.filter(root => context.workspaceOf(root) === workspace);
  return (local.length ? local : featureRoots).map(root => path.join(root, 'pages'));
}

function routingTermination(ts, statement, navigation) {
  if (ts.isThrowStatement(statement)) return true;
  if (ts.isBlock(statement)) return statement.statements.length > 0 && routingTermination(ts, statement.statements.at(-1), navigation);
  const expression = ts.isExpressionStatement(statement) ? statement.expression : (ts.isReturnStatement(statement) ? statement.expression : null);
  return Boolean(expression && ts.isCallExpression(expression) && ts.isIdentifier(expression.expression)
    && ['redirect', 'notFound'].includes(navigation.get(expression.expression.text)));
}

function routingGuard(ts, node, navigation) {
  return ts.isIfStatement(node) && !node.elseStatement && routingTermination(ts, node.thenStatement, navigation);
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
  const decisions = [];
  const visit = (node, insideNavigationArgument = false) => {
    if (ts.isJsxSelfClosingElement(node) || ts.isJsxElement(node)) jsx.push(node);
    if (ts.isIfStatement(node) || ts.isSwitchStatement(node) || (ts.isConditionalExpression(node) && !insideNavigationArgument)) decisions.push(node);
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && ['redirect', 'notFound'].includes(navigation.get(node.expression.text))) {
      adapterCalls.push(node);
      for (const argument of node.arguments) visit(argument, true);
      return;
    }
    ts.forEachChild(node, child => visit(child, insideNavigationArgument));
  };
  visit(route.fn);
  const pages = routePageRoots(context, sourceFile, roots.features);
  const mountedPages = jsx.filter(node => {
    const opening = ts.isJsxElement(node) ? node.openingElement : node;
    const local = jsxRootName(ts, opening.tagName);
    const edge = local ? bindings.get(local) : null;
    return edge && Boolean(reachableViolation(context.edges, edge, target => insideAny(pages, target), { follow: candidate => candidate.reexport && candidate.runtime }));
  });
  const navigationOnly = jsx.length === 0 && adapterCalls.length === 1;
  if (!navigationOnly && (mountedPages.length !== 1 || jsx.length !== 1)) {
    violations.push(violation(config, sourceFile, route.fn, 'FE_ROUTE_ONE_PAGE', 'A page.tsx route must mount exactly one pages-tier component, or be a zero-JSX redirect/notFound adapter.', { ts }));
  }
  if (!navigationOnly) for (const decision of decisions) if (!routingGuard(ts, decision, navigation)) {
    violations.push(violation(config, sourceFile, decision, 'FE_ROUTE_DRAWING_DECISION', 'Visual route files may use terminal redirect/notFound guards but cannot select or omit visual composition.', { ts }));
  }
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

function roleEntry(relative) {
  const parts = String(relative).replace(/\\/g, '/').split('/');
  return parts.length === 1 && /^index\.[cm]?[jt]sx?$/i.test(parts[0]);
}

function roleFor(roots, fileName) {
  for (const [role, candidates] of Object.entries(roots)) {
    if (!['routes', 'features', 'components', 'hooks', 'modules'].includes(role)) continue;
    const root = rootFor(candidates, fileName);
    if (root) return { role, root, relative: relativePath(root, fileName) };
  }
  return null;
}

function checkFrontendSourceLayout(config, sourceFile, roots) {
  const located = roleFor(roots, sourceFile.fileName);
  if (!located) return insideAny(roots.sourceRoots, sourceFile.fileName)
    ? [{ ruleId: 'FE_SOURCE_LAYOUT_INVALID', path: relativePath(config.root, sourceFile.fileName), line: 1, column: 1,
      message: 'Production source under a Next application root must belong to app, features, components, hooks or modules; configuration cannot hide an unclassified owner.' }]
    : [];
  if (located.role === 'routes' || located.role === 'modules') return [];
  const first = located.relative.split('/')[0];
  let valid = true;
  if (located.role === 'features') valid = FEATURE_TIERS.has(first) || roleEntry(located.relative);
  if (located.role === 'components') valid = COMPONENT_TIERS.has(first) || roleEntry(located.relative);
  if (located.role === 'hooks') valid = located.relative.includes('/') || roleEntry(located.relative);
  return valid ? [] : [{ ruleId: 'FE_SOURCE_LAYOUT_INVALID', path: relativePath(config.root, sourceFile.fileName), line: 1, column: 1,
    message: located.role === 'features'
      ? 'Frontend features contain only pages, layouts and overlays plus an optional root public entry.'
      : located.role === 'components'
        ? 'Frontend components contain only blocks, composites, branches and leaves plus an optional root public entry.'
        : 'Every authored custom hook is grouped below a domain folder under hooks; only the root public entry may sit directly under hooks.' }];
}

function publicFeatureEntry(config, roots, fileName) {
  const root = rootFor(roots.features, fileName);
  if (!root) return false;
  const parts = relativePath(root, fileName).split('/');
  const shaped = parts.length === 1 ? roleEntry(parts[0])
    : parts.length === 3 && FEATURE_TIERS.has(parts[0]) && /^index\.[cm]?[jt]sx?$/i.test(parts[2]);
  if (!shaped) return false;
  if (config.owners === null) return true;
  const target = canonical(fileName);
  return Boolean(config.owners?.some(owner => canonical(path.resolve(config.root, ...owner.entry.split('/'))) === target));
}

function checkFrontendDirection(config, context, sourceFile, roots) {
  const located = roleFor(roots, sourceFile.fileName);
  if (!located) return [];
  const violations = [];
  for (const edge of importsForSource(context, sourceFile.fileName)) {
    if (located.role === 'routes' && (!insideAny(roots.features, edge.to) || !publicFeatureEntry(config, roots, edge.to))) {
      violations.push({ ruleId: 'FE_APP_INTERNAL_IMPORT_OUTSIDE_FEATURES', path: relativePath(config.root, sourceFile.fileName), line: edge.line, column: edge.column,
        specifier: edge.specifier, resolvedPath: relativePath(config.root, edge.to),
        message: 'Next app adapters may import internal project code only through a feature public entry; framework and external package imports remain valid.' });
      continue;
    }
    const forbidden = located.role === 'features' ? roots.routes
      : located.role === 'components' ? [...roots.routes, ...roots.features]
        : located.role === 'hooks' ? [...roots.routes, ...roots.features, ...roots.components]
          : located.role === 'modules' ? [...roots.routes, ...roots.features, ...roots.components, ...roots.hooks]
            : [];
    if (!forbidden.length) continue;
    const chain = reachableViolation(context.edges, edge, target => insideAny(forbidden, target), { follow: () => true });
    if (!chain) continue;
    violations.push({ ruleId: 'FE_FEATURE_DEPENDENCY_DIRECTION', path: relativePath(config.root, sourceFile.fileName), line: edge.line, column: edge.column,
      specifier: edge.specifier, resolvedPath: relativePath(config.root, chain.at(-1)), dependencyChain: chain.map(item => relativePath(config.root, item)),
      message: `${located.role} cannot depend upward on app, features, components or hooks outside its allowed responsibility direction.` });
  }
  return violations;
}

function declarationName(ts, declaration) {
  if ((ts.isFunctionDeclaration(declaration) || ts.isMethodDeclaration(declaration) || ts.isVariableDeclaration(declaration))
    && declaration.name && ts.isIdentifier(declaration.name)) return declaration.name;
  if ((ts.isArrowFunction(declaration) || ts.isFunctionExpression(declaration))
    && ts.isVariableDeclaration(declaration.parent) && ts.isIdentifier(declaration.parent.name)) return declaration.parent.name;
  return null;
}

function checkCustomHookLocations(config, context, sourceFile, roots) {
  if (insideAny(roots.hooks, sourceFile.fileName)) return [];
  const { ts } = context;
  const checker = context.checkerFor(sourceFile.fileName);
  const violations = [];
  const seen = new Set();
  const report = (symbol, node) => {
    const identity = unaliasSymbol(ts, checker, symbol) ?? symbol;
    if (!identity || seen.has(identity) || checker.getTypeOfSymbolAtLocation(identity, node).getCallSignatures().length === 0) return;
    seen.add(identity);
    violations.push(violation(config, sourceFile, node, 'FE_CUSTOM_HOOK_LOCATION',
      'Every authored custom useX hook declaration belongs under the configured hooks root; calling built-in React hooks inside a visual is still valid.', { ts }));
  };
  const inspect = declaration => {
    const name = declarationName(ts, declaration);
    if (!name || !/^use[A-Z0-9]/.test(name.text)) return;
    const symbol = checker.getSymbolAtLocation(name);
    report(symbol, name);
  };
  const visit = node => {
    if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isVariableDeclaration(node)) inspect(node);
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  const module = checker.getSymbolAtLocation(sourceFile);
  for (const exposed of module ? checker.getExportsOfModule(module) : []) {
    if (!/^use[A-Z0-9]/.test(exposed.name)) continue;
    const identity = unaliasSymbol(ts, checker, exposed);
    for (const declaration of identity?.getDeclarations?.() ?? []) if (declaration.getSourceFile() === sourceFile) {
      const node = declarationName(ts, declaration) ?? declaration;
      report(identity, node);
    }
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
    const transportChain = reachableViolation(context.edges, edge, target => insideAny(roots.transport, target), { follow: candidate => candidate.reexport && candidate.runtime });
    if (transportChain) {
      violations.push({ ruleId: 'FE_COMPONENT_IMPORTS_TRANSPORT', path: relativePath(config.root, fileName), line: edge.line, column: edge.column,
        specifier: edge.specifier, resolvedPath: relativePath(config.root, transportChain.at(-1)), dependencyChain: transportChain.map(item => relativePath(config.root, item)),
        message: 'Components cannot import the API transport at runtime; a data hook or server route adapter owns the request.' });
    }
    const configuredHookBarrel = insideAny(roots.hooks, edge.to) && /^index\.[cm]?[jt]sx?$/i.test(path.basename(edge.to));
    const hookChain = configuredHookBarrel ? null
      : reachableViolation(context.edges, edge, target => insideAny(roots.hooks, target), { follow: candidate => candidate.reexport && candidate.runtime });
    if (hookChain) {
      violations.push({ ruleId: 'FE_COMPONENT_DEEP_HOOK_IMPORT', path: relativePath(config.root, fileName), line: edge.line, column: edge.column,
        specifier: edge.specifier, resolvedPath: relativePath(config.root, hookChain.at(-1)), dependencyChain: hookChain.map(item => relativePath(config.root, item)),
        message: 'Components must enter data hooks through the owning hooks barrel.' });
    }
    if (pure) {
      const chain = reachableViolation(context.edges, edge, target => insideAny(roots.hooks, target) || insideAny(roots.transport, target),
        { follow: candidate => candidate.reexport && candidate.runtime });
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

function unwrapExpression(ts, expression) {
  while (expression && (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression)
    || ts.isTypeAssertionExpression(expression) || ts.isNonNullExpression(expression)
    || (ts.isSatisfiesExpression?.(expression) ?? false))) expression = expression.expression;
  return expression;
}

function unaliasSymbol(ts, checker, value) {
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

function returnedExpressions(ts, declaration) {
  if ((ts.isArrowFunction(declaration) || ts.isFunctionExpression(declaration)) && !ts.isBlock(declaration.body)) return [declaration.body];
  const body = ts.isFunctionLike(declaration) ? declaration.body : null;
  if (!body || !ts.isBlock(body)) return [];
  const returned = [];
  const visit = node => {
    if (node !== body && ts.isFunctionLike(node)) return;
    if (ts.isReturnStatement(node) && node.expression) returned.push(node.expression);
    else ts.forEachChild(node, visit);
  };
  visit(body);
  return returned;
}

function knownWorldImport(specifier, imported) {
  if (specifier === 'next-intl') return WORLD_INTL_CALLS.has(imported);
  if (specifier === 'next/navigation' || /(?:^|\/)i18n\/navigation$/.test(specifier)) return WORLD_NAVIGATION_CALLS.has(imported);
  if (specifier === 'swr' || specifier === 'swr/immutable' || specifier === 'swr/mutation') return WORLD_SWR_CALLS.has(imported);
  if (specifier === 'next-auth/react') return imported === 'useSession';
  return false;
}

function importDeclarationFor(ts, node) {
  for (let current = node; current; current = current.parent) if (ts.isImportDeclaration(current)) return current;
  return null;
}

function isReactCreateElement(ts, checker, call) {
  const expression = unwrapExpression(ts, call.expression);
  if (ts.isIdentifier(expression)) {
    const symbol = checker.getSymbolAtLocation(expression);
    return (symbol?.declarations ?? []).some(declaration => {
      const imported = ts.isImportSpecifier(declaration) ? declaration.propertyName?.text ?? declaration.name.text : null;
      const parent = importDeclarationFor(ts, declaration);
      return imported === 'createElement' && parent && ts.isStringLiteralLike(parent.moduleSpecifier) && parent.moduleSpecifier.text === 'react';
    });
  }
  if (!ts.isPropertyAccessExpression(expression) || expression.name.text !== 'createElement') return false;
  const symbol = checker.getSymbolAtLocation(expression.expression);
  return (symbol?.declarations ?? []).some(declaration => {
    const parent = importDeclarationFor(ts, declaration);
    return (ts.isNamespaceImport(declaration) || ts.isImportClause(declaration))
      && parent && ts.isStringLiteralLike(parent.moduleSpecifier) && parent.moduleSpecifier.text === 'react';
  });
}

function jsxTagName(ts, tagName) {
  if (ts.isIdentifier(tagName)) return tagName.text;
  if (ts.isPropertyAccessExpression(tagName)) return tagName.name.text;
  return null;
}

function wrapperTag(ts, tagName) {
  const name = jsxTagName(ts, tagName);
  return name === 'Suspense' || name === 'SWRConfig' || name === 'Provider'
    || Boolean(name && (name.endsWith('Provider') || name.endsWith('ErrorBoundary')));
}

function checkWorldRenderBoundaries(config, context, roots) {
  const { ts } = context;
  const violations = [];
  const sourceSet = new Set(context.files.map(source => path.resolve(source.fileName)));
  const worldInfoCache = new Map();
  const functionWorldCache = new Map();
  const renderOutputCache = new Map();
  const intrinsicUiHookCache = new Map();

  const intrinsicUiHookFile = (fileName, visiting = new Set()) => {
    const resolved = path.resolve(fileName);
    if (intrinsicUiHookCache.has(resolved)) return intrinsicUiHookCache.get(resolved);
    const hookRoot = rootFor(roots.hooks, resolved);
    if (!hookRoot || relativePath(hookRoot, resolved).split('/')[0] !== 'ui' || visiting.has(resolved)) return false;
    const sourceFile = context.files.find(source => path.resolve(source.fileName) === resolved);
    if (!sourceFile) return false;
    intrinsicUiHookCache.set(resolved, false);
    const nextVisiting = new Set(visiting).add(resolved);
    const checker = context.checkerFor(resolved);
    const edges = importsForSource(context, resolved);
    let intrinsic = true;
    for (const edge of edges.filter(candidate => candidate.runtime)) {
      const forbidden = reachableViolation(context.edges, edge, target => insideAny(roots.transport, target)
        || insideAny(roots.modules, target) || insideAny(roots.features, target) || insideAny(roots.routes, target)
        || (insideAny(roots.hooks, target) && relativePath(rootFor(roots.hooks, target), target).split('/')[0] !== 'ui'),
      { follow: candidate => candidate.runtime });
      if (forbidden || (insideAny(roots.hooks, edge.to) && !intrinsicUiHookFile(edge.to, nextVisiting))) {
        intrinsic = false;
        break;
      }
    }
    for (const statement of sourceFile.statements) {
      if (!intrinsic) break;
      if (!ts.isImportDeclaration(statement) || !statement.importClause || statement.importClause.isTypeOnly
        || !ts.isStringLiteralLike(statement.moduleSpecifier)) continue;
      const specifier = statement.moduleSpecifier.text;
      const bindings = [];
      if (statement.importClause.name) bindings.push('default');
      const named = statement.importClause.namedBindings;
      if (named && ts.isNamedImports(named)) for (const element of named.elements) if (!element.isTypeOnly) bindings.push(element.propertyName?.text ?? element.name.text);
      if (named && ts.isNamespaceImport(named) && ['next/navigation', 'next-intl', 'swr', 'swr/immutable', 'swr/mutation', 'next-auth/react'].includes(specifier)) { intrinsic = false; break; }
      if (bindings.some(imported => knownWorldImport(specifier, imported))) { intrinsic = false; break; }
    }
    const visit = node => {
      if (!intrinsic) return;
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'fetch'
        && !checker.getSymbolAtLocation(node.expression)) { intrinsic = false; return; }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    intrinsicUiHookCache.set(resolved, intrinsic);
    return intrinsic;
  };

  const intrinsicUiHookSymbol = (symbol, checker) => {
    const identity = unaliasSymbol(ts, checker, symbol);
    const declarations = identity?.getDeclarations?.() ?? [];
    return declarations.length > 0 && declarations.every(declaration => intrinsicUiHookFile(declaration.getSourceFile().fileName));
  };

  const importInfo = sourceFile => {
    const key = path.resolve(sourceFile.fileName);
    if (worldInfoCache.has(key)) return worldInfoCache.get(key);
    const checker = context.checkerFor(sourceFile.fileName);
    const edges = importsForSource(context, sourceFile.fileName);
    const byStart = new Map(edges.map(edge => [edge.node.getStart(sourceFile), edge]));
    const symbols = new Set();
    const namespaces = new Map();
    for (const statement of sourceFile.statements) {
      if (!ts.isImportDeclaration(statement) || !statement.importClause || statement.importClause.isTypeOnly
        || !ts.isStringLiteralLike(statement.moduleSpecifier)) continue;
      const specifier = statement.moduleSpecifier.text;
      const edge = byStart.get(statement.moduleSpecifier.getStart(sourceFile));
      const worldEdge = edge && Boolean(reachableViolation(context.edges, edge,
        target => insideAny(roots.hooks, target) || insideAny(roots.transport, target),
        { follow: candidate => candidate.reexport && candidate.runtime }));
      const clause = statement.importClause;
      if (clause.name) {
        const symbol = checker.getSymbolAtLocation(clause.name);
        if (symbol && (worldEdge || knownWorldImport(specifier, 'default'))) symbols.add(symbol);
      }
      const named = clause.namedBindings;
      if (named && ts.isNamedImports(named)) for (const element of named.elements) {
        if (element.isTypeOnly) continue;
        const imported = element.propertyName?.text ?? element.name.text;
        const symbol = checker.getSymbolAtLocation(element.name);
        if (symbol && (worldEdge || knownWorldImport(specifier, imported))) symbols.add(symbol);
      }
      if (named && ts.isNamespaceImport(named)) {
        const symbol = checker.getSymbolAtLocation(named.name);
        if (symbol) namespaces.set(symbol, { specifier, worldEdge });
      }
    }
    const value = { checker, symbols, namespaces };
    worldInfoCache.set(key, value);
    return value;
  };

  const expressionFunctions = (expression, checker, seen = new Set()) => {
    expression = unwrapExpression(ts, expression);
    if (!expression) return [];
    if (ts.isArrowFunction(expression) || ts.isFunctionExpression(expression) || ts.isMethodDeclaration(expression)
      || ts.isFunctionDeclaration(expression)) return [expression];
    if (ts.isConditionalExpression(expression)) {
      return [...expressionFunctions(expression.whenTrue, checker, seen), ...expressionFunctions(expression.whenFalse, checker, seen)];
    }
    if (ts.isCallExpression(expression)) {
      const selected = unwrapExpression(ts, expression.expression);
      const name = ts.isIdentifier(selected) ? selected.text
        : ts.isPropertyAccessExpression(selected) ? selected.name.text : null;
      if (['forwardRef', 'memo'].includes(name) && expression.arguments[0]) return expressionFunctions(expression.arguments[0], checker, seen);
    }
    const symbol = unaliasSymbol(ts, checker, selectedSymbol(ts, checker, expression));
    if (!symbol || seen.has(symbol)) return [];
    const nextSeen = new Set(seen).add(symbol);
    const functions = [];
    for (const declaration of symbol.getDeclarations?.() ?? []) {
      if (ts.isFunctionDeclaration(declaration) || ts.isMethodDeclaration(declaration)) functions.push(declaration);
      else if (ts.isVariableDeclaration(declaration) && declaration.initializer) {
        functions.push(...expressionFunctions(declaration.initializer, checker, nextSeen));
      } else if (ts.isClassDeclaration(declaration)) {
        functions.push(...declaration.members.filter(member => ts.isMethodDeclaration(member)
          && member.name && (ts.isIdentifier(member.name) || ts.isStringLiteralLike(member.name)) && member.name.text === 'render'));
      }
    }
    return [...new Set(functions.filter(fn => fn.body))];
  };

  const symbolIsWorld = (raw, sourceFile, propertyName = null) => {
    if (!raw) return false;
    const info = importInfo(sourceFile);
    if (intrinsicUiHookSymbol(raw, info.checker)) return false;
    if (info.symbols.has(raw)) return true;
    for (const [namespace, declaration] of info.namespaces) if (namespace === raw) {
      return declaration.worldEdge || knownWorldImport(declaration.specifier, propertyName ?? '');
    }
    const identity = unaliasSymbol(ts, info.checker, raw);
    return (identity?.getDeclarations?.() ?? []).some(declaration => {
      const fileName = declaration.getSourceFile().fileName;
      return insideAny(roots.hooks, fileName) || insideAny(roots.transport, fileName);
    });
  };

  const namespaceIsWorld = (raw, sourceFile, propertyName) => {
    const info = importInfo(sourceFile);
    const declaration = info.namespaces.get(raw);
    return Boolean(declaration && (declaration.worldEdge || knownWorldImport(declaration.specifier, propertyName ?? '')));
  };

  const calleeIsWorld = (input, checker, sourceFile, seen = new Set()) => {
    const expression = unwrapExpression(ts, input);
    if (ts.isIdentifier(expression) && symbolIsWorld(checker.getSymbolAtLocation(expression), sourceFile)) return true;
    if ((ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression))) {
      const property = ts.isPropertyAccessExpression(expression) ? expression.name.text
        : ts.isStringLiteralLike(expression.argumentExpression) ? expression.argumentExpression.text : null;
      const namespace = checker.getSymbolAtLocation(expression.expression);
      if (intrinsicUiHookSymbol(selectedSymbol(ts, checker, expression), checker)) return false;
      if (namespaceIsWorld(namespace, sourceFile, property)) return true;
      if (symbolIsWorld(selectedSymbol(ts, checker, expression), sourceFile)) return true;
    }
    const symbol = unaliasSymbol(ts, checker, selectedSymbol(ts, checker, expression));
    if (!symbol || seen.has(symbol)) return false;
    const nextSeen = new Set(seen).add(symbol);
    const declarations = symbol.getDeclarations?.() ?? [];
    for (const declaration of declarations) {
      if (ts.isVariableDeclaration(declaration) && declaration.initializer) {
        if (calleeIsWorld(declaration.initializer, checker, declaration.getSourceFile(), nextSeen)) return true;
      }
    }
    return expressionFunctions(expression, checker).some(fn => functionUsesWorld(fn, checker, nextSeen));
  };

  const callIsWorld = (call, checker, sourceFile, seen) => calleeIsWorld(call.expression, checker, sourceFile, seen);

  const functionUsesWorld = (fn, checker, seen = new Set()) => {
    if (functionWorldCache.has(fn)) return functionWorldCache.get(fn);
    functionWorldCache.set(fn, false);
    let found = false;
    const sourceFile = fn.getSourceFile();
    const visit = node => {
      if (found) return;
      if (ts.isCallExpression(node) && callIsWorld(node, checker, sourceFile, seen)) { found = true; return; }
      ts.forEachChild(node, visit);
    };
    visit(fn.body ?? fn);
    functionWorldCache.set(fn, found);
    return found;
  };

  const expressionHasRender = (expression, checker, seen = new Set()) => {
    expression = unwrapExpression(ts, expression);
    if (!expression) return false;
    if (ts.isJsxElement(expression) || ts.isJsxSelfClosingElement(expression) || ts.isJsxFragment(expression)) return true;
    if (ts.isCallExpression(expression) && isReactCreateElement(ts, checker, expression)) return true;
    if (ts.isConditionalExpression(expression)) return expressionHasRender(expression.whenTrue, checker, seen)
      || expressionHasRender(expression.whenFalse, checker, seen);
    if (ts.isBinaryExpression(expression) && [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken,
      ts.SyntaxKind.QuestionQuestionToken].includes(expression.operatorToken.kind)) {
      return expressionHasRender(expression.left, checker, seen) || expressionHasRender(expression.right, checker, seen);
    }
    if (ts.isCallExpression(expression) && (ts.isPropertyAccessExpression(expression.expression)
      || ts.isElementAccessExpression(expression.expression))) {
      const name = ts.isPropertyAccessExpression(expression.expression) ? expression.expression.name.text
        : ts.isStringLiteralLike(expression.expression.argumentExpression) ? expression.expression.argumentExpression.text : null;
      if (name === 'map' && expression.arguments[0]) return expressionFunctions(expression.arguments[0], checker)
        .some(fn => functionHasRender(fn, checker, seen));
    }
    const symbol = unaliasSymbol(ts, checker, selectedSymbol(ts, checker, ts.isCallExpression(expression) ? expression.expression : expression));
    if (!symbol || seen.has(symbol)) return false;
    const nextSeen = new Set(seen).add(symbol);
    if (ts.isIdentifier(expression)) for (const declaration of symbol.getDeclarations?.() ?? []) {
      if (ts.isVariableDeclaration(declaration) && declaration.initializer && expressionHasRender(declaration.initializer, checker, nextSeen)) return true;
    }
    if (ts.isCallExpression(expression)) return expressionFunctions(expression.expression, checker, seen)
      .some(fn => functionHasRender(fn, checker, nextSeen));
    return false;
  };

  const functionHasRender = (fn, checker, seen = new Set()) => {
    if (renderOutputCache.has(fn)) return renderOutputCache.get(fn);
    renderOutputCache.set(fn, false);
    const found = returnedExpressions(ts, fn).some(expression => expressionHasRender(expression, checker, seen));
    renderOutputCache.set(fn, found);
    return found;
  };

  const capturesOuterFunction = (fn, checker) => {
    const outers = [];
    for (let parent = fn.parent; parent; parent = parent.parent) if (ts.isFunctionLike(parent)) outers.push(parent);
    if (!outers.length) return false;
    let captured = false;
    const visit = node => {
      if (captured) return;
      if (ts.isIdentifier(node)) {
        const symbol = checker.getSymbolAtLocation(node);
        for (const declaration of symbol?.getDeclarations?.() ?? []) {
          if (declaration.pos >= fn.pos && declaration.end <= fn.end) continue;
          if (outers.some(outer => declaration.pos >= outer.pos && declaration.end <= outer.end)) { captured = true; return; }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(fn.body ?? fn);
    return captured;
  };

  const pureRenderTarget = (expression, checker, expectedFile = null) => {
    const functions = expressionFunctions(expression, checker);
    return functions.length > 0 && functions.every(fn => sourceSet.has(path.resolve(fn.getSourceFile().fileName))
      && (insideAny(roots.components, fn.getSourceFile().fileName) || insideAny(roots.features, fn.getSourceFile().fileName))
      && (!expectedFile || path.resolve(fn.getSourceFile().fileName) === expectedFile)
      && functionHasRender(fn, checker) && !functionUsesWorld(fn, checker) && !capturesOuterFunction(fn, checker));
  };

  const expressionSuppliesRender = (expression, checker) => expressionHasRender(expression, checker)
    || expressionFunctions(expression, checker).some(fn => functionHasRender(fn, checker));

  const renderBoundary = (expression, checker, seen = new Set(), allowEmpty = false, expectedFile = null) => {
    expression = unwrapExpression(ts, expression);
    if (!expression) return allowEmpty;
    if (expression.kind === ts.SyntaxKind.NullKeyword || expression.kind === ts.SyntaxKind.FalseKeyword) return allowEmpty;
    if (ts.isConditionalExpression(expression)) return renderBoundary(expression.whenTrue, checker, seen, allowEmpty, expectedFile)
      && renderBoundary(expression.whenFalse, checker, seen, allowEmpty, expectedFile);
    if (ts.isBinaryExpression(expression) && expression.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
      return renderBoundary(expression.right, checker, seen, true, expectedFile);
    }
    if (ts.isArrayLiteralExpression(expression)) return expression.elements.length > 0
      && expression.elements.every(item => renderBoundary(item, checker, seen, allowEmpty, expectedFile));
    if (ts.isIdentifier(expression)) {
      const symbol = unaliasSymbol(ts, checker, checker.getSymbolAtLocation(expression));
      if (!symbol || seen.has(symbol)) return false;
      const nextSeen = new Set(seen).add(symbol);
      const values = (symbol.getDeclarations?.() ?? []).flatMap(declaration => ts.isVariableDeclaration(declaration) && declaration.initializer
        ? [declaration.initializer] : []);
      if (values.length) return values.every(value => renderBoundary(value, checker, nextSeen, allowEmpty, expectedFile));
    }
    if (ts.isCallExpression(expression)) {
      if (isReactCreateElement(ts, checker, expression)) {
        const target = expression.arguments[0] ? unwrapExpression(ts, expression.arguments[0]) : null;
        if (!target || ts.isStringLiteralLike(target)) return false;
        const pureTarget = pureRenderTarget(target, checker, expectedFile) && !wrapperTag(ts, target);
        const wrapper = wrapperTag(ts, target);
        if (!pureTarget && !wrapper) return false;
        const props = expression.arguments[1] ? unwrapExpression(ts, expression.arguments[1]) : null;
        let hasBoundary = pureTarget;
        if (props && props.kind !== ts.SyntaxKind.NullKeyword) {
          if (!ts.isObjectLiteralExpression(props) || props.properties.some(property => ts.isSpreadAssignment(property))) return false;
          for (const property of props.properties) {
            if (!ts.isPropertyAssignment(property)) continue;
            const value = unwrapExpression(ts, property.initializer);
            if (!expressionSuppliesRender(value, checker)) continue;
            if (!pureRenderTarget(value, checker, expectedFile) && !renderBoundary(value, checker, seen, true, expectedFile)) return false;
            const name = property.name && (ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name)) ? property.name.text : null;
            if (['children', 'component', 'content', 'render', 'view'].includes(name)) hasBoundary = true;
          }
        }
        const children = expression.arguments.slice(2);
        if (children.length) {
          if (!children.every(child => renderBoundary(child, checker, seen, false, expectedFile))) return false;
          hasBoundary = true;
        }
        return hasBoundary;
      }
      if ((ts.isPropertyAccessExpression(expression.expression) || ts.isElementAccessExpression(expression.expression))) {
        const name = ts.isPropertyAccessExpression(expression.expression) ? expression.expression.name.text
          : ts.isStringLiteralLike(expression.expression.argumentExpression) ? expression.expression.argumentExpression.text : null;
        if (name === 'map' && expression.arguments[0]) {
          const renderers = expressionFunctions(expression.arguments[0], checker);
          return renderers.length > 0 && renderers.every(fn => !functionUsesWorld(fn, checker)
            && returnedExpressions(ts, fn).length > 0
          && returnedExpressions(ts, fn).every(value => renderBoundary(value, checker, seen, true, expectedFile)));
        }
      }
      return pureRenderTarget(expression.expression, checker, expectedFile);
    }
    if (ts.isJsxFragment(expression)) {
      const children = expression.children.filter(child => !ts.isJsxText(child) || child.text.trim());
      return children.length > 0 && children.every(child => ts.isJsxExpression(child)
        ? renderBoundary(child.expression, checker, seen, false, expectedFile)
        : ts.isJsxText(child) ? false : renderBoundary(child, checker, seen, false, expectedFile));
    }
    if (ts.isJsxElement(expression) || ts.isJsxSelfClosingElement(expression)) {
      const opening = ts.isJsxElement(expression) ? expression.openingElement : expression;
      const pureTarget = pureRenderTarget(opening.tagName, checker, expectedFile) && !wrapperTag(ts, opening.tagName);
      const wrapper = wrapperTag(ts, opening.tagName);
      if (!pureTarget && !wrapper) return false;
      const children = ts.isJsxElement(expression)
        ? expression.children.filter(child => !ts.isJsxText(child) || child.text.trim()) : [];
      let hasBoundary = pureTarget;
      if (children.length) {
        if (!children.every(child => ts.isJsxExpression(child)
          ? renderBoundary(child.expression, checker, seen, false, expectedFile)
          : ts.isJsxText(child) ? false : renderBoundary(child, checker, seen, false, expectedFile))) return false;
        hasBoundary = true;
      }
      for (const attribute of opening.attributes.properties) {
        if (!ts.isJsxAttribute(attribute) || !attribute.initializer) continue;
        const name = attribute.name.text;
        if (['fallback', 'errorElement'].includes(name)) {
          if (ts.isStringLiteral(attribute.initializer)) return false;
          if (ts.isJsxExpression(attribute.initializer)
            && !renderBoundary(attribute.initializer.expression, checker, seen, true, expectedFile)) return false;
        }
        if (ts.isJsxExpression(attribute.initializer) && attribute.initializer.expression
          && expressionSuppliesRender(attribute.initializer.expression, checker)) {
          if (!pureRenderTarget(attribute.initializer.expression, checker, expectedFile)
            && !renderBoundary(attribute.initializer.expression, checker, seen, true, expectedFile)) return false;
          if (['component', 'content', 'render', 'view'].includes(name)) hasBoundary = true;
        }
      }
      return hasBoundary;
    }
    return false;
  };

  for (const sourceFile of context.files) {
    if ((!insideAny(roots.components, sourceFile.fileName) && !insideAny(roots.features, sourceFile.fileName))
      || !/\.[cm]?tsx$/i.test(sourceFile.fileName)) continue;
    const checker = context.checkerFor(sourceFile.fileName);
    const tier = tierOf(roots.components, sourceFile.fileName);
    const functions = [];
    const collect = node => {
      if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isArrowFunction(node) || ts.isFunctionExpression(node)) functions.push(node);
      ts.forEachChild(node, collect);
    };
    collect(sourceFile);
    for (const fn of functions) {
      const name = declarationName(ts, fn);
      if (tier?.tier === 'blocks' && name && /^use[A-Z0-9]/.test(name.text) && functionUsesWorld(fn, checker)) {
        violations.push(violation(config, sourceFile, name, 'FE_BLOCK_PRODUCT_HOOK_DEFINITION',
          'A block may call a product hook from hooks but cannot define product-world or data lifecycle under the block.', { ts }));
      }
    }
    for (const fn of functions) {
      if (!functionHasRender(fn, checker) || !functionUsesWorld(fn, checker)) continue;
      const returned = returnedExpressions(ts, fn);
      if (!returned.length || returned.some(expression => !renderBoundary(expression, checker, new Set(), true))) {
        violations.push(violation(config, sourceFile, fn, 'FE_WORLD_OWNER_RENDER_BOUNDARY',
          'A visual owner that reads product/world state must hand every render path to a statically resolved pure render function or component; intrinsic-only interaction does not select this rule.', { ts }));
      }
      if (tier && LOWER_COMPONENT_TIERS.has(tier.tier)) {
        violations.push(violation(config, sourceFile, fn, 'FE_COMPONENT_WORLD_OWNERSHIP',
          `${tier.tier} may own intrinsic browser interaction but cannot own product-world, navigation, locale, session or data lifecycle.`, { ts }));
      }
      if (tier?.tier === 'blocks') {
        const expected = path.resolve(path.dirname(sourceFile.fileName), 'component.tsx');
        const index = path.basename(sourceFile.fileName).toLowerCase() === 'index.tsx';
        if (!index || !sourceSet.has(expected) || !returned.length
          || returned.some(expression => !renderBoundary(expression, checker, new Set(), true, expected))) {
          violations.push(violation(config, sourceFile, fn, 'FE_CONNECTED_BLOCK_RENDER_PAIR',
            'A connected blocks/index.tsx must hand every nonempty render path to a resolved pure export from its sibling component.tsx; pure blocks and lower tiers need no twin.', { ts }));
        }
      }
    }
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
    features: absoluteRoots(config.root, config.frontend.features),
    components: absoluteRoots(config.root, config.frontend.components),
    hooks: absoluteRoots(config.root, config.frontend.hooks),
    modules: absoluteRoots(config.root, config.frontend.modules),
    transport: absoluteRoots(config.root, config.frontend.transport),
  };
  roots.sourceRoots = [...new Set(roots.routes.map(root => path.dirname(root)))];
  const violations = checkGrammar(config, context);
  for (const sourceFile of context.files) {
    if (insideAny(roots.routes, sourceFile.fileName) && path.basename(sourceFile.fileName).toLowerCase() === 'page.tsx') {
      violations.push(...checkRoute(config, context, sourceFile, roots));
    }
    violations.push(...checkFrontendSourceLayout(config, sourceFile, roots));
    violations.push(...checkFrontendDirection(config, context, sourceFile, roots));
    violations.push(...checkCustomHookLocations(config, context, sourceFile, roots));
    violations.push(...checkPureAndData(config, context, sourceFile, roots));
    violations.push(...checkTierDirection(config, context, sourceFile, roots));
    violations.push(...checkRawFetch(config, context, sourceFile, roots));
  }
  violations.push(...checkWorldRenderBoundaries(config, context, roots));
  return violations;
}
