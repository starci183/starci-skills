import path from 'node:path';
import { isInside } from './config.mjs';
import { frameworkPinnedRootFiles } from './framework-pinned.mjs';
import { reachableViolation, relativePath } from './typescript.mjs';
import { normalizedSymbolValue } from './ast-walks.mjs';
import { sourceLocation } from '../../lib/ts-ast.mjs';
import { checkWorldRenderBoundaries } from './frontend-world.mjs';
import { checkGrammar } from './frontend-grammar.mjs';
import { checkRoute } from './frontend-routing.mjs';
const FEATURE_TIERS = new Set(['pages', 'layouts', 'overlays']);
const COMPONENT_TIERS = new Set(['blocks', 'composites', 'branches', 'leaves']);

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

function roleEntry(relative) {
  const parts = String(relative).replaceAll('\\', '/').split('/');
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

// The files Next.js loads only from the source root (the directory holding app/: src/ or the project
// root) are authored in knowledge/patterns/fe/folder.yaml FE-FOLDER-1 and read by ./framework-pinned.mjs.
export { FRAMEWORK_PINNED_KNOWLEDGE, frameworkPinnedRootFiles } from './framework-pinned.mjs';

/** The source root that directly holds this file when it is a framework-pinned root file, else null. */
function frameworkPinnedRoot(roots, fileName) {
  if (!roots.pinnedRootFiles.has(path.basename(fileName))) return null;
  const directory = path.resolve(path.dirname(fileName));
  return roots.sourceRoots.find(root => path.resolve(root) === directory) ?? null;
}

function checkFrontendSourceLayout(config, sourceFile, roots) {
  const located = roleFor(roots, sourceFile.fileName);
  if (!located && frameworkPinnedRoot(roots, sourceFile.fileName)) return [];
  if (!located) return insideAny(roots.sourceRoots, sourceFile.fileName)
    ? [{ ruleId: 'FE_SOURCE_LAYOUT_INVALID', path: relativePath(config.root, sourceFile.fileName), line: 1, column: 1,
      message: 'Production source under a Next application root must belong to app, features, components, hooks or modules, or be a framework-pinned root file Next.js loads from the source root (knowledge/patterns/fe/folder.yaml FE-FOLDER-1 frameworkPinnedRootFiles); configuration cannot hide an unclassified owner.' }]
    : [];
  if (located.role === 'routes' || located.role === 'modules') return [];
  const first = located.relative.split('/')[0];
  let valid = true;
  if (located.role === 'features') valid = FEATURE_TIERS.has(first) || roleEntry(located.relative);
  if (located.role === 'components') valid = COMPONENT_TIERS.has(first) || roleEntry(located.relative);
  if (located.role === 'hooks') valid = located.relative.includes('/') || roleEntry(located.relative);
  return valid ? [] : [{ ruleId: 'FE_SOURCE_LAYOUT_INVALID', path: relativePath(config.root, sourceFile.fileName), line: 1, column: 1,
    message: ({ features: 'Frontend features contain only pages, layouts and overlays plus an optional root public entry.',
      components: 'Frontend components contain only blocks, composites, branches and leaves plus an optional root public entry.',
      hooks: 'Every authored custom hook is grouped below a domain folder under hooks; only the root public entry may sit directly under hooks.' })[located.role] }];
}

function declarationName(ts, declaration) {
  if ((ts.isFunctionDeclaration(declaration) || ts.isMethodDeclaration(declaration) || ts.isVariableDeclaration(declaration))
    && declaration.name && ts.isIdentifier(declaration.name)) return declaration.name;
  if ((ts.isArrowFunction(declaration) || ts.isFunctionExpression(declaration))
    && ts.isVariableDeclaration(declaration.parent) && ts.isIdentifier(declaration.parent.name)) return declaration.parent.name;
  return null;
}

const HOOK_NAME = /^use[A-Z0-9]/;

function reportCustomHook(state, symbol, node) {
  const { ts, checker, seen, violations, config, sourceFile } = state;
  const identity = normalizedSymbolValue(ts, checker, symbol) ?? symbol;
  if (!identity || seen.has(identity) || checker.getTypeOfSymbolAtLocation(identity, node).getCallSignatures().length === 0) return;
  seen.add(identity);
  violations.push(violation(config, sourceFile, node, 'FE_CUSTOM_HOOK_LOCATION',
    'Every authored custom useX hook declaration belongs under the configured hooks root; calling built-in React hooks inside a visual is still valid.', { ts }));
}

function inspectHookDeclaration(state, declaration) {
  const name = declarationName(state.ts, declaration);
  if (!name || !HOOK_NAME.test(name.text)) return;
  const symbol = state.checker.getSymbolAtLocation(name);
  reportCustomHook(state, symbol, name);
}

function visitHookDeclarations(state, node) {
  const { ts } = state;
  if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isVariableDeclaration(node)) inspectHookDeclaration(state, node);
  ts.forEachChild(node, child => visitHookDeclarations(state, child));
}

function reportExportedHooks(state) {
  const { ts, checker, sourceFile } = state;
  const module = checker.getSymbolAtLocation(sourceFile);
  for (const exposed of module ? checker.getExportsOfModule(module) : []) {
    if (!HOOK_NAME.test(exposed.name)) continue;
    const identity = normalizedSymbolValue(ts, checker, exposed);
    for (const declaration of identity?.getDeclarations?.() ?? []) {
      if (declaration.getSourceFile() !== sourceFile) continue;
      reportCustomHook(state, identity, declarationName(ts, declaration) ?? declaration);
    }
  }
}

function checkCustomHookLocations(config, context, sourceFile, roots) {
  if (insideAny(roots.hooks, sourceFile.fileName)) return [];
  const { ts } = context;
  const state = { ts, config, sourceFile, checker: context.checkerFor(sourceFile.fileName), violations: [], seen: new Set() };
  visitHookDeclarations(state, sourceFile);
  reportExportedHooks(state);
  return state.violations;
}

function importsForSource(context, fileName) {
  return context.edges.get(path.resolve(fileName)) ?? [];
}

function inspectComponentEdge(config, context, roots, fileName, pure, edge, violations) {
  if (!edge.runtime) return;
  const configuredHookBarrel = insideAny(roots.hooks, edge.to) && /^index\.[cm]?[jt]sx?$/i.test(path.basename(edge.to));
  const hookChain = configuredHookBarrel ? null
    : reachableViolation(context.edges, edge, target => insideAny(roots.hooks, target), { follow: candidate => candidate.reexport && candidate.runtime });
  if (hookChain) {
    violations.push({ ruleId: 'FE_COMPONENT_DEEP_HOOK_IMPORT', path: relativePath(config.root, fileName), line: edge.line, column: edge.column,
      specifier: edge.specifier, resolvedPath: relativePath(config.root, hookChain.at(-1)), dependencyChain: hookChain.map(item => relativePath(config.root, item)),
      message: 'Components must enter data hooks through the owning hooks barrel.' });
  }
  if (pure) inspectPureDataReachability(config, context, roots, fileName, edge, violations);
}

function inspectPureDataReachability(config, context, roots, fileName, edge, violations) {
  const chain = reachableViolation(context.edges, edge, target => insideAny(roots.hooks, target) || insideAny(roots.transport, target),
    { follow: candidate => candidate.reexport && candidate.runtime });
  if (chain) violations.push({ ruleId: 'FE_PURE_REACHES_DATA', path: relativePath(config.root, fileName), line: edge.line, column: edge.column,
    specifier: edge.specifier, resolvedPath: relativePath(config.root, chain.at(-1)), dependencyChain: chain.map(item => relativePath(config.root, item)),
    message: 'Pure component.tsx cannot reach hooks or API transport through an alias, relative import, package, or barrel.' });
}

function reportWorldHookImports(config, sourceFile, named, state, violation) {
  const { ts, worldHooks, violations } = state;
  for (const element of named.elements) {
    const imported = element.propertyName?.text ?? element.name.text;
    if (!element.isTypeOnly && worldHooks.has(imported)) violations.push(violation(config, sourceFile, element, 'FE_PURE_WORLD_HOOK', `Pure component.tsx imports ${imported}; its connected index.tsx owns application/world state.`, { ts }));
  }
}

function recordReactNamespaces(ts, clause, named, reactNamespaces) {
  if (clause?.name) reactNamespaces.add(clause.name.text);
  if (named && ts.isNamespaceImport(named)) reactNamespaces.add(named.name.text);
}

function inspectPureImport(config, sourceFile, statement, state, violation) {
  const { ts, reactNamespaces, violations } = state;
  if (!ts.isImportDeclaration(statement) || !ts.isStringLiteralLike(statement.moduleSpecifier) || statement.importClause?.isTypeOnly) return;
  const source = statement.moduleSpecifier.text;
  const named = statement.importClause?.namedBindings;
  if (source === 'react') {
    if (named && ts.isNamedImports(named)) reportWorldHookImports(config, sourceFile, named, state, violation);
    recordReactNamespaces(ts, statement.importClause, named, reactNamespaces);
  }
  if ((source === 'next/navigation' || source === 'next-intl') && statement.importClause) {
    violations.push(violation(config, sourceFile, statement, 'FE_PURE_WORLD_IMPORT', `Pure component.tsx imports ${source}; its connected index.tsx owns router and locale context.`, { ts }));
  }
}

function inspectPureWorldHookAccess(config, sourceFile, node, state, violation) {
  const { ts, worldHooks, reactNamespaces, violations } = state;
  if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) && reactNamespaces.has(node.expression.text)
    && worldHooks.has(node.name.text)) {
    violations.push(violation(config, sourceFile, node, 'FE_PURE_WORLD_HOOK', `Pure component.tsx accesses ${node.expression.text}.${node.name.text}; its connected index.tsx owns application/world state.`, { ts }));
  }
  ts.forEachChild(node, child => inspectPureWorldHookAccess(config, sourceFile, child, state, violation));
}

function inspectPureModule(config, context, sourceFile, violations, violation) {
  const ts = context.ts;
  const state = { ts, worldHooks: new Set(['createContext', 'useContext', 'useSyncExternalStore']), reactNamespaces: new Set(), violations };
  for (const statement of sourceFile.statements) inspectPureImport(config, sourceFile, statement, state, violation);
  inspectPureWorldHookAccess(config, sourceFile, sourceFile, state, violation);
}

function checkPureAndData(config, context, sourceFile, roots) {
  const violations = [];
  const fileName = path.resolve(sourceFile.fileName);
  if (!insideAny(roots.components, fileName)) return violations;
  const pure = path.basename(fileName).toLowerCase() === 'component.tsx';
  for (const edge of importsForSource(context, fileName)) inspectComponentEdge(config, context, roots, fileName, pure, edge, violations);
  if (pure) inspectPureModule(config, context, sourceFile, violations, violation);
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
  roots.pinnedRootFiles = frameworkPinnedRootFiles();
  const violations = checkGrammar(config, context, violation);
  for (const sourceFile of context.files) {
    if (insideAny(roots.routes, sourceFile.fileName) && path.basename(sourceFile.fileName).toLowerCase() === 'page.tsx') {
      violations.push(...checkRoute(config, context, sourceFile, roots, { violation, insideAny, importsForSource }));
    }
    violations.push(...checkFrontendSourceLayout(config, sourceFile, roots), ...checkCustomHookLocations(config, context, sourceFile, roots), ...checkPureAndData(config, context, sourceFile, roots));
  }
  violations.push(...checkWorldRenderBoundaries(config, context, roots, { insideAny, rootFor, tierOf, violation, declarationName, importsForSource }));
  return violations;
}
