import fs from 'node:fs';
import path from 'node:path';
import { contextFromProjects } from './type-context.mjs';
import { createRequire } from 'node:module';
import { canonical, isInside, slash } from './config.mjs';
import { crossesSide } from './side-boundary.mjs';
import { sameOrUnder } from '../../lib/path-key.mjs';
import { createTypeScriptProgram, readTypeScriptProject, resolveTypeScriptModule, sharedInProgramRun, typeScriptProjectReferencePath } from '../typescript-programs.mjs';
import { readJsonFile } from '../../lib/json.mjs';
import { sourceLocation } from '../../lib/ts-ast.mjs';
import { locateDeclaration } from '../slots.mjs';

const CODE_EXTENSIONS = /\.(?:[cm]?[jt]sx?)$/i;
const SCRIPT_TAIL = String.raw`[cm]?[jt]sx?`;
const TEST_FILE = new RegExp(String.raw`(?:^|[.-])(?:spec|test)\.${SCRIPT_TAIL}$`, 'i');
const ASSET_EXTENSION_NAMES = 'css|scss|sass|less|svg|png|jpe?g|gif|webp|avif|ico|woff2?|ttf|eot|ya?ml|json';
const ASSET_EXTENSION = new RegExp(String.raw`\.(?:${ASSET_EXTENSION_NAMES})$`, 'i');
// Framework build output a tsconfig may include (Next writes `.next/types/**/*.ts` back into tsconfig.json on
// every build) is compiled for type resolution but is never source: it is gitignored, regenerated, and no
// canon or architecture rule applies to it (inc-ffe60c49f502).
const GENERATED_SEGMENTS = new Set(['.next', '.turbo', '.vercel', '.output', '.nuxt', '.svelte-kit', '.expo', '.docusaurus', '.swc', '.cache']);
function isGeneratedPath(root, fileName) {
  return slash(path.relative(root, fileName)).split('/').slice(0, -1).some(segment => GENERATED_SEGMENTS.has(segment));
}
function diagnosticMessage(ts, diagnostic) {
  return ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
}

function compilerError(ts, root, diagnostic, project, ruleId = 'ARCH_TSCONFIG_INVALID') {
  const fileName = diagnostic.file?.fileName;
  let line;
  let column;
  if (diagnostic.file && Number.isInteger(diagnostic.start)) {
    const point = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
    line = point.line + 1;
    column = point.character + 1;
  }
  return {
    ruleId,
    project,
    ...(fileName && isInside(root, fileName) ? { path: slash(path.relative(root, fileName)) } : {}),
    ...(line ? { line, column } : {}),
    message: diagnosticMessage(ts, diagnostic),
  };
}

/**
 * Load TypeScript through the target package boundary, never through StarCi's own dependency graph. A side folder of an app has no
 * package.json of its own: the app root's one manifest is the boundary its TypeScript is installed under.
 */
function loadTargetTypeScript(repositoryRoot) {
  const packageFile = path.join(locateDeclaration(repositoryRoot).appRoot, 'package.json');
  if (!fs.existsSync(packageFile)) throw new Error('ARCH_TYPESCRIPT_MISSING: target package.json is required to resolve target-installed TypeScript.');
  const targetRequire = createRequire(packageFile);
  let resolved;
  let ts;
  try {
    resolved = targetRequire.resolve('typescript');
    ts = targetRequire('typescript');
  } catch {
    throw new Error('ARCH_TYPESCRIPT_MISSING: install TypeScript in the checked repository; StarCi does not substitute its own parser.');
  }
  if (!ts?.createProgram || !ts?.resolveModuleName || !ts?.readConfigFile) {
    throw new Error('ARCH_TYPESCRIPT_INVALID: the target TypeScript package does not expose the compiler API.');
  }
  return { ts, resolved, version: String(ts.version ?? 'unknown') };
}

const readJson = (file) => readJsonFile(file, {});

function pathAliasMatches(specifier, paths = {}) {
  return Object.keys(paths).some(pattern => {
    if (!pattern.includes('*')) return pattern === specifier;
    const [before, after] = pattern.split('*');
    return specifier.startsWith(before) && specifier.endsWith(after ?? '');
  });
}

function importDeclarationRuntime(ts, node) {
  const clause = node.importClause;
  if (!clause) return true;
  if (clause.isTypeOnly) return false;
  if (clause.name) return true;
  const named = clause.namedBindings;
  if (named && ts.isNamedImports(named)) return named.elements.some(element => !element.isTypeOnly);
  return Boolean(named);
}

function exportDeclarationRuntime(ts, node) {
  if (node.isTypeOnly) return false;
  if (node.exportClause && ts.isNamedExports(node.exportClause)) return node.exportClause.elements.some(element => !element.isTypeOnly);
  return true;
}

function runtimeImport(ts, node) {
  if (ts.isImportDeclaration(node)) return importDeclarationRuntime(ts, node);
  if (ts.isExportDeclaration(node)) return exportDeclarationRuntime(ts, node);
  return true;
}

export function isUnshadowedCommonJsRequire(ts, checker, expression) {
  if (!ts.isIdentifier(expression) || expression.text !== 'require') return false;
  const symbol = checker?.getSymbolAtLocation(expression);
  if (!symbol) return true;
  const declarations = symbol.getDeclarations?.() ?? [];
  return declarations.length > 0 && declarations.every(declaration => declaration.getSourceFile().isDeclarationFile);
}

/**
 * The files a template-literal import of data can load. import(`../messages/${locale}.json`) - the
 * next-intl request config - is bundled as a context of every file under ../messages whose name ends in
 * .json, so that set is the dependency, exactly and statically. Only a relative static head naming an
 * existing directory and a data-asset extension tail qualify; code never does, since a context of code would
 * be an import graph nobody wrote down. Returns the specifiers, or null when the import stays unproven.
 */
/** The data-asset extension tail and relative head of an import template, or null when the template cannot name a data context. */
function assetContextParts(ts, argument) {
  if (!argument || !ts.isTemplateExpression(argument)) return null;
  const head = argument.head.text;
  const spans = argument.templateSpans;
  const tail = spans[spans.length - 1].literal.text;
  if (!/^\.\.?\//.test(head) || !head.endsWith('/') || !/^\.[a-z0-9]+$/i.test(tail) || !ASSET_EXTENSION.test(tail)) return null;
  if (spans.slice(0, -1).some(span => span.literal.text.split('/').includes('..'))) return null;
  return { head, tail };
}

/** The specifiers of every file below `directory` (node_modules skipped) whose name ends in `tail`, sorted by name at each level. */
function assetFileSpecifiers(directory, head, tail) {
  const specifiers = [];
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name === 'node_modules') continue;
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith(tail.toLowerCase())) specifiers.push(`${head}${slash(path.relative(directory, absolute))}`);
    }
  };
  visit(directory);
  return specifiers;
}

function assetContextSpecifiers(ts, sourceFile, argument) {
  const parts = assetContextParts(ts, argument);
  if (!parts) return null;
  const directory = path.resolve(path.dirname(sourceFile.fileName), parts.head);
  let stat;
  try { stat = fs.statSync(directory); } catch { return null; }
  if (!stat.isDirectory()) return null;
  const specifiers = assetFileSpecifiers(directory, parts.head, parts.tail);
  return specifiers.length ? specifiers : null;
}

function staticModuleReference(ts, node, found, unproven) {
  if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) {
    found.push({ node: node.moduleSpecifier, specifier: node.moduleSpecifier.text, runtime: runtimeImport(ts, node), declaration: node });
    return true;
  } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)
    && node.moduleReference.expression && ts.isStringLiteralLike(node.moduleReference.expression)) {
    found.push({ node: node.moduleReference.expression, specifier: node.moduleReference.expression.text, runtime: !node.isTypeOnly, declaration: node });
    return true;
  } else if (ts.isImportTypeNode(node)) {
    const literal = ts.isLiteralTypeNode(node.argument) && ts.isStringLiteralLike(node.argument.literal) ? node.argument.literal : null;
    if (literal) found.push({ node: literal, specifier: literal.text, runtime: false, declaration: node });
    else unproven.push({ node, kind: 'TypeScript import type' });
    return true;
  }
  return false;
}

function dynamicImportReference(ts, sourceFile, node, found, unproven) {
  const context = [1, 2].includes(node.arguments.length) ? assetContextSpecifiers(ts, sourceFile, node.arguments[0]) : null;
  if ([1, 2].includes(node.arguments.length) && ts.isStringLiteralLike(node.arguments[0])) {
    found.push({ node: node.arguments[0], specifier: node.arguments[0].text, runtime: true, declaration: node });
  } else if (context) {
    for (const specifier of context) found.push({ node: node.arguments[0], specifier, runtime: true, declaration: node });
  } else unproven.push({ node, kind: 'dynamic import()' });
}

function requireReference(ts, checker, node, found, unproven) {
  if (node.arguments.length === 1 && ts.isStringLiteralLike(node.arguments[0])) {
    found.push({ node: node.arguments[0], specifier: node.arguments[0].text, runtime: true, declaration: node });
  } else unproven.push({ node, kind: 'dynamic require()' });
}

function callModuleReference(ts, sourceFile, checker, node, found, unproven) {
  if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) dynamicImportReference(ts, sourceFile, node, found, unproven);
  else if (ts.isCallExpression(node) && isUnshadowedCommonJsRequire(ts, checker, node.expression)) requireReference(ts, checker, node, found, unproven);
}

function moduleReferences(ts, sourceFile, checker) {
  const found = [];
  const unproven = [];
  const visit = node => {
    if (!staticModuleReference(ts, node, found, unproven)) callModuleReference(ts, sourceFile, checker, node, found, unproven);
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return { found, unproven };
}

function isProductionSource(root, sourceFile) {
  return isInside(root, sourceFile.fileName)
    && CODE_EXTENSIONS.test(sourceFile.fileName)
    && !sourceFile.isDeclarationFile
    && !TEST_FILE.test(sourceFile.fileName)
    && !slash(sourceFile.fileName).includes('/node_modules/')
    && !isGeneratedPath(root, sourceFile.fileName);
}

function workspaceMetadata(config) {
  const backendAppRoots = config.backend.apps.map(item => path.join(config.root, ...item.split('/')));
  const create = relative => {
    const root = path.join(config.root, ...relative.split('/'));
    const pkg = readJson(path.join(root, 'package.json'));
    const routeRoots = config.frontend.routes.map(item => path.join(config.root, ...item.split('/')));
    return { root: canonical(root), relative, name: typeof pkg.name === 'string' ? pkg.name : null, exports: pkg.exports, manifest: pkg, workspace: true,
      app: routeRoots.some(route => isInside(root, route))
        || backendAppRoots.some(appRoot => isInside(appRoot, root) || isInside(root, appRoot)) };
  };
  const roots = config.workspaces.map(create);
  // A side of an app has no package.json: the app root's one manifest names the package the side's root files belong to.
  const rootPackage = readJson(path.join(config.packageRoot ?? config.root, 'package.json')) ?? {};
  roots.push({ root: canonical(config.root), relative: '.', name: typeof rootPackage.name === 'string' ? rootPackage.name : null, exports: rootPackage.exports,
    app: config.frontend.routes.some(item => isInside(config.root, path.join(config.root, ...item.split('/')))) || config.kinds.includes('backend') });
  return roots.sort((a, b) => b.root.length - a.root.length);
}

function workspaceOf(workspaces, file) {
  return workspaces.find(workspace => isInside(workspace.root, file)) ?? null;
}

function exportPatternCapture(pattern, request) {
  if (!pattern.includes('*')) return pattern === request ? '' : null;
  const [before, after = ''] = pattern.split('*');
  return request.startsWith(before) && request.endsWith(after) ? request.slice(before.length, request.length - after.length) : null;
}

export function exportTargetStrings(value) {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(exportTargetStrings);
  if (value && typeof value === 'object' && !Object.keys(value).some(key => key.startsWith('.'))) return Object.values(value).flatMap(exportTargetStrings);
  return [];
}

/** The package-relative export targets a request (`.` or `./sub`) of a workspace package declares, from exports, else types/main. */
function rootExportCandidates(declaration, request) {
  if (request !== '.') return [];
  return exportTargetStrings(declaration);
}

function exportMapCandidates(declaration, request) {
  const keys = Object.keys(declaration);
  if (!keys.some(key => key.startsWith('.'))) return rootExportCandidates(declaration, request);
  const candidates = [];
  for (const key of keys) {
    const capture = exportPatternCapture(key, request);
    if (capture !== null) candidates.push(...exportTargetStrings(declaration[key]).map(target => target.replaceAll('*', capture)));
  }
  return candidates;
}

function exportCandidates(workspace, specifier) {
  if (!workspace.name || !sameOrUnder(specifier, workspace.name)) return [];
  const request = specifier === workspace.name ? '.' : `.${specifier.slice(workspace.name.length)}`;
  const declaration = workspace.exports;
  if (typeof declaration === 'string' || Array.isArray(declaration)) return rootExportCandidates(declaration, request);
  if (declaration && typeof declaration === 'object') return exportMapCandidates(declaration, request);
  return [];
}

const SOURCE_EXTENSIONS = { '.d.ts': ['.ts', '.tsx'], '.d.mts': ['.mts'], '.d.cts': ['.cts'], '.js': ['.ts', '.tsx'], '.jsx': ['.tsx'], '.mjs': ['.mts'], '.cjs': ['.cts'] };

/** rootDir and outDir of a workspace package's build tsconfig (tsconfig.build.json, else tsconfig.json), extends followed; null when it declares none. */
function workspaceBuildLayout(ts, workspace) {
  if (workspace.layout !== undefined) return workspace.layout;
  workspace.layout = null;
  for (const name of ['tsconfig.build.json', 'tsconfig.json']) {
    const file = path.join(workspace.root, name);
    if (!fs.existsSync(file)) continue;
    const read = ts.readConfigFile(file, ts.sys.readFile);
    if (read.error) continue;
    const { options } = ts.parseJsonConfigFileContent(read.config, ts.sys, workspace.root, undefined, file);
    if (options.outDir) { workspace.layout = { rootDir: options.rootDir ? path.resolve(options.rootDir) : path.join(workspace.root, 'src'), outDir: path.resolve(options.outDir) }; break; }
  }
  return workspace.layout;
}

/** The source file a built export target (`./dist/sub/index.js`, `.d.ts`) stands for: outDir back to rootDir, else the dist-to-src layout; null when none exists. */
function sourceOfTarget(ts, workspace, target) {
  const absolute = path.resolve(workspace.root, target);
  const layout = workspaceBuildLayout(ts, workspace);
  const extension = Object.keys(SOURCE_EXTENSIONS).filter(item => absolute.endsWith(item)).sort((a, b) => b.length - a.length)[0];
  const sourceRoots = [];
  if (layout && isInside(layout.outDir, absolute)) sourceRoots.push([layout.outDir, layout.rootDir]);
  const first = slash(path.relative(workspace.root, absolute)).split('/')[0];
  if (first) sourceRoots.push([path.join(workspace.root, first), path.join(workspace.root, 'src')]);
  if (!extension) return null;
  for (const [from, to] of sourceRoots) {
    const stem = path.join(to, path.relative(from, absolute)).slice(0, -extension.length);
    for (const candidate of SOURCE_EXTENSIONS[extension]) if (fs.existsSync(stem + candidate)) return canonical(stem + candidate);
  }
  return null;
}

const manifestEntryTargets = manifest => [manifest?.types, manifest?.typings, manifest?.module, manifest?.main].filter(item => typeof item === 'string');

const packageIndexSource = workspace => {
  for (const name of ['index.ts', 'index.tsx']) if (fs.existsSync(path.join(workspace.root, 'src', name))) return canonical(path.join(workspace.root, 'src', name));
  return null;
};

/** The source entry a workspace import resolves to without a build: its export targets mapped back to source, `src/index.ts` for the package root. */
function workspaceSourceEntry(ts, workspace, specifier) {
  if (!workspace.workspace || !workspace.name || !sameOrUnder(specifier, workspace.name)) return null;
  const isRoot = specifier === workspace.name;
  const candidates = isRoot && !workspace.exports ? manifestEntryTargets(workspace.manifest) : exportCandidates(workspace, specifier);
  for (const target of candidates) {
    if (!target.startsWith('./') || target.includes('..')) continue;
    const source = sourceOfTarget(ts, workspace, target);
    if (source) return source;
  }
  return isRoot ? packageIndexSource(workspace) : null;
}

/** Every source file the package.json `exports` of a workspace package maps (each non-wildcard subpath, dist back to source): its public entries. */
export function workspaceExportSources(ts, workspace) {
  const declaration = workspace.exports;
  if (!declaration || typeof declaration !== 'object' || Array.isArray(declaration)) return [];
  const sources = new Set();
  for (const [key, value] of Object.entries(declaration)) {
    if (!key.startsWith('.') || key.includes('*')) continue;
    for (const target of exportTargetStrings(value)) {
      if (!target.startsWith('./') || target.includes('..')) continue;
      const source = sourceOfTarget(ts, workspace, target);
      if (source) sources.add(source);
    }
  }
  return [...sources];
}

function packageExported(ts, workspace, specifier, actualTarget) {
  return exportCandidates(workspace, specifier).some(target => {
    if (!target.startsWith('./') || target.includes('..')) return false;
    const expected = canonical(path.resolve(workspace.root, target));
    return expected === canonical(actualTarget) || sourceOfTarget(ts, workspace, target) === canonical(actualTarget);
  });
}

function boundaryViolation(root, edge, fromWorkspace, toWorkspace, ruleId, message) {
  return {
    ruleId,
    path: relativePath(root, edge.from),
    line: edge.line,
    column: edge.column,
    specifier: edge.specifier,
    resolvedPath: relativePath(root, edge.to),
    message,
    fromPackage: fromWorkspace?.name ?? fromWorkspace?.relative,
    toPackage: toWorkspace?.name ?? toWorkspace?.relative,
  };
}

/** Parse configured tsconfigs, then build only selected programs and their project-reference closure. */
export function buildTypeScriptContext(config, injectedTypeScript, paths = []) {
  const loaded = injectedTypeScript ? { ts: injectedTypeScript, resolved: '(injected test compiler)', version: String(injectedTypeScript.version) }
    : loadTargetTypeScript(config.root);
  // config.hfs is the opened slot resolver (functions), so it never keys a shared value: the repository declaration it was opened
  // from (plain data) identifies it, the manifest being the runtime's one.
  const context = sharedInProgramRun('architecture-context', loaded.ts, { config: { ...config, hfs: config.hfs?.repo ?? null }, paths }, () => typeScriptContext(config, loaded, paths));
  // Callers add to and sort the errors: each gets its own list.
  return { ...context, errors: [...context.errors] };
}

function typeScriptContext(config, loaded, paths) {
  return contextFromProjects(config, loaded, paths, {
    canonical, compilerError, isInside, slash, readTypeScriptProject, typeScriptProjectReferencePath,
    sameOrUnder, createTypeScriptProgram, isProductionSource, sourceLocation, workspaceMetadata, workspaceOf,
    pathAliasMatches, moduleReferences, workspaceSourceEntry, resolveTypeScriptModule, crossesSide, assetExtension: ASSET_EXTENSION,
    relativePath, packageExported, boundaryViolation,
  });
}
export function relativePath(root, fileName) {
  return slash(path.relative(root, fileName));
}

export function reachableViolation(edges, firstEdge, forbidden, { follow = () => true } = {}) {
  const queue = [{ file: firstEdge.to, chain: [firstEdge.from, firstEdge.to] }];
  const visited = new Set();
  while (queue.length) {
    const current = queue.shift();
    if (visited.has(current.file)) continue;
    visited.add(current.file);
    if (forbidden(current.file)) return current.chain;
    for (const edge of edges.get(current.file) ?? []) if (follow(edge)) queue.push({ file: edge.to, chain: [...current.chain, edge.to] });
  }
  return null;
}

/** A framework identity the checkers cannot prove statically. */
export const UNPROVEN_FRAMEWORK = '(unproven framework identity)';

/** The expression under parentheses, type assertions, non-null and satisfies wrappers. */
export function unwrapExpression(ts, expression) {
  while (expression && (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression)
    || ts.isTypeAssertionExpression(expression) || ts.isNonNullExpression(expression)
    || (ts.isSatisfiesExpression?.(expression) ?? false))) expression = expression.expression;
  return expression;
}

/* ---- the AST walks every architecture checker shares ---- */

/** The names of `expected` an import or re-export statement binds (all of them for a namespace or star form). */
export function referencedExports(ts, statement, expected) {
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
