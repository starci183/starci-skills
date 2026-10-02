import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { canonical, isInside, slash } from './config.mjs';
import { sameOrUnder } from '../../lib/path-key.mjs';
import { createTypeScriptProgram, readTypeScriptProject, resolveTypeScriptModule, sharedInProgramRun, typeScriptProjectReferencePath } from '../typescript-programs.mjs';
import { readJsonFile } from '../../lib/json.mjs';
import { sourceLocation } from '../../lib/ts-ast.mjs';
import { locateDeclaration } from '../slots.mjs';

const CODE_EXTENSIONS = /\.(?:[cm]?[jt]sx?)$/i;
const TEST_FILE = /(?:^|[.-])(?:spec|test)\.[cm]?[jt]sx?$/i;
const ASSET_EXTENSION = /\.(?:css|scss|sass|less|svg|png|jpe?g|gif|webp|avif|ico|woff2?|ttf|eot|ya?ml|json)$/i;
// Framework build output a tsconfig may include (Next writes `.next/types/**/*.ts` back into tsconfig.json on
// every build) is compiled for type resolution but is never source: it is gitignored, regenerated, and no
// canon or architecture rule applies to it (nivo inc-ffe60c49f502).
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
  if (!fs.existsSync(packageFile)) throw Error('ARCH_TYPESCRIPT_MISSING: target package.json is required to resolve target-installed TypeScript.');
  const targetRequire = createRequire(packageFile);
  let resolved;
  let ts;
  try {
    resolved = targetRequire.resolve('typescript');
    ts = targetRequire('typescript');
  } catch {
    throw Error('ARCH_TYPESCRIPT_MISSING: install TypeScript in the checked repository; StarCi does not substitute its own parser.');
  }
  if (!ts?.createProgram || !ts?.resolveModuleName || !ts?.readConfigFile) {
    throw Error('ARCH_TYPESCRIPT_INVALID: the target TypeScript package does not expose the compiler API.');
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

function runtimeImport(ts, node) {
  if (ts.isImportDeclaration(node)) {
    const clause = node.importClause;
    if (!clause) return true;
    if (clause.isTypeOnly) return false;
    if (clause.name) return true;
    const named = clause.namedBindings;
    if (named && ts.isNamedImports(named)) return named.elements.some(element => !element.isTypeOnly);
    return Boolean(named);
  }
  if (ts.isExportDeclaration(node)) {
    if (node.isTypeOnly) return false;
    if (node.exportClause && ts.isNamedExports(node.exportClause)) return node.exportClause.elements.some(element => !element.isTypeOnly);
  }
  return true;
}

function isUnshadowedCommonJsRequire(ts, checker, expression) {
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
function assetContextSpecifiers(ts, sourceFile, argument) {
  if (!argument || !ts.isTemplateExpression(argument)) return null;
  const head = argument.head.text;
  const spans = argument.templateSpans;
  const tail = spans[spans.length - 1].literal.text;
  if (!/^\.\.?\//.test(head) || !head.endsWith('/') || !/^\.[a-z0-9]+$/i.test(tail) || !ASSET_EXTENSION.test(tail)) return null;
  if (spans.slice(0, -1).some(span => span.literal.text.split('/').includes('..'))) return null;
  const directory = path.resolve(path.dirname(sourceFile.fileName), head);
  let stat;
  try { stat = fs.statSync(directory); } catch { return null; }
  if (!stat.isDirectory()) return null;
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
  return specifiers.length ? specifiers : null;
}

function moduleReferences(ts, sourceFile, checker) {
  const found = [];
  const unproven = [];
  const visit = node => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) {
      found.push({ node: node.moduleSpecifier, specifier: node.moduleSpecifier.text, runtime: runtimeImport(ts, node), declaration: node });
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)
      && node.moduleReference.expression && ts.isStringLiteralLike(node.moduleReference.expression)) {
      found.push({ node: node.moduleReference.expression, specifier: node.moduleReference.expression.text, runtime: !node.isTypeOnly, declaration: node });
    } else if (ts.isImportTypeNode(node)) {
      const literal = ts.isLiteralTypeNode(node.argument) && ts.isStringLiteralLike(node.argument.literal) ? node.argument.literal : null;
      if (literal) found.push({ node: literal, specifier: literal.text, runtime: false, declaration: node });
      else unproven.push({ node, kind: 'TypeScript import type' });
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const context = [1, 2].includes(node.arguments.length) ? assetContextSpecifiers(ts, sourceFile, node.arguments[0]) : null;
      if ([1, 2].includes(node.arguments.length) && ts.isStringLiteralLike(node.arguments[0])) {
        found.push({ node: node.arguments[0], specifier: node.arguments[0].text, runtime: true, declaration: node });
      } else if (context) {
        for (const specifier of context) found.push({ node: node.arguments[0], specifier, runtime: true, declaration: node });
      } else unproven.push({ node, kind: 'dynamic import()' });
    } else if (ts.isCallExpression(node) && isUnshadowedCommonJsRequire(ts, checker, node.expression)) {
      if (node.arguments.length === 1 && ts.isStringLiteralLike(node.arguments[0])) {
        found.push({ node: node.arguments[0], specifier: node.arguments[0].text, runtime: true, declaration: node });
      } else unproven.push({ node, kind: 'dynamic require()' });
    }
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
function exportCandidates(workspace, specifier) {
  if (!workspace.name || !sameOrUnder(specifier, workspace.name)) return [];
  const request = specifier === workspace.name ? '.' : `.${specifier.slice(workspace.name.length)}`;
  const declaration = workspace.exports;
  let candidates = [];
  if (typeof declaration === 'string' || Array.isArray(declaration)) {
    if (request !== '.') return [];
    candidates = exportTargetStrings(declaration);
  } else if (declaration && typeof declaration === 'object') {
    const keys = Object.keys(declaration);
    if (!keys.some(key => key.startsWith('.'))) {
      if (request !== '.') return [];
      candidates = exportTargetStrings(declaration);
    } else {
      for (const key of keys) {
        const capture = exportPatternCapture(key, request);
        if (capture !== null) candidates.push(...exportTargetStrings(declaration[key]).map(target => target.replaceAll('*', capture)));
      }
    }
  }
  return candidates;
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

/** The source entry a workspace import resolves to without a build: its export targets mapped back to source, `src/index.ts` for the package root. */
function workspaceSourceEntry(ts, workspace, specifier) {
  if (!workspace.workspace || !workspace.name || !sameOrUnder(specifier, workspace.name)) return null;
  let candidates = exportCandidates(workspace, specifier);
  if (specifier === workspace.name && !workspace.exports) candidates = [workspace.manifest?.types, workspace.manifest?.typings, workspace.manifest?.module, workspace.manifest?.main].filter(item => typeof item === 'string');
  for (const target of candidates) {
    if (!target.startsWith('./') || target.includes('..')) continue;
    const source = sourceOfTarget(ts, workspace, target);
    if (source) return source;
  }
  if (specifier === workspace.name) {
    for (const name of ['index.ts', 'index.tsx']) if (fs.existsSync(path.join(workspace.root, 'src', name))) return canonical(path.join(workspace.root, 'src', name));
  }
  return null;
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
  const { ts } = loaded;
  const errors = [];
  const projects = [];
  const parsedProjects = new Map();
  const invalidProjects = new Set();
  const queue = [...config.projects];
  const seenProjects = new Set();
  while (queue.length) {
    const relative = queue.shift();
    if (seenProjects.has(relative)) continue;
    seenProjects.add(relative);
    const configFile = path.join(config.root, ...relative.split('/'));
    if (!fs.existsSync(configFile)) {
      errors.push({ ruleId: 'ARCH_TSCONFIG_MISSING', project: relative, message: `${relative} does not exist.` });
      invalidProjects.add(relative);
      continue;
    }
    const { read, parsed } = readTypeScriptProject(ts, configFile);
    if (read.error) {
      errors.push(compilerError(ts, config.root, read.error, relative));
      invalidProjects.add(relative);
      continue;
    }
    if (parsed.errors.length) {
      errors.push(...parsed.errors.map(item => compilerError(ts, config.root, item, relative)));
      invalidProjects.add(relative);
      continue;
    }
    for (const reference of parsed.projectReferences ?? []) {
      const referencedFile = typeScriptProjectReferencePath(ts, reference);
      const absoluteReference = path.resolve(referencedFile);
      if (!isInside(config.root, absoluteReference)) {
        errors.push({ ruleId: 'ARCH_TSCONFIG_REFERENCE_OUTSIDE', project: relative, message: `Project reference leaves the repository: ${slash(path.relative(config.root, absoluteReference))}.` });
      } else {
        queue.push(slash(path.relative(config.root, absoluteReference)));
      }
    }
    parsedProjects.set(relative, parsed);
  }
  const matches = file => paths.some(prefix => {
    const relative = slash(path.relative(config.root, file));
    const normalized = slash(prefix).replace(/\/$/, '');
    return sameOrUnder(relative, normalized);
  });
  const selected = new Set();
  const direct = new Set();
  if (paths.length) {
    // TypeScript follows imports from these root files. Referenced projects need their declared
    // roots as well, since a project reference need not be an import in the selected source.
    const visit = relative => {
      if (selected.has(relative)) return;
      selected.add(relative);
      for (const reference of parsedProjects.get(relative)?.projectReferences ?? []) {
        const referencedFile = typeScriptProjectReferencePath(ts, reference);
        const referenced = slash(path.relative(config.root, path.resolve(referencedFile)));
        if (parsedProjects.has(referenced)) visit(referenced);
      }
    };
    for (const [relative, parsed] of parsedProjects) if (parsed.fileNames.some(matches)) {
      direct.add(relative);
      visit(relative);
    }
    for (const relative of invalidProjects) {
      const directory = path.dirname(path.join(config.root, ...relative.split('/')));
      if (paths.some(prefix => {
        const absolute = path.join(config.root, ...slash(prefix).split('/'));
        return isInside(directory, absolute);
      })) selected.add(relative);
    }
    errors.splice(0, errors.length, ...errors.filter(error => !error.project || selected.has(error.project)));
  }
  for (const [relative, parsed] of parsedProjects) {
    if (paths.length && !selected.has(relative)) continue;
    const rootNames = paths.length && direct.has(relative) ? parsed.fileNames.filter(matches) : parsed.fileNames;
    const program = createTypeScriptProgram(ts, { rootNames, options: parsed.options, projectReferences: parsed.projectReferences });
    errors.push(...program.getSyntacticDiagnostics().filter(item => !item.file || isInside(config.root, item.file.fileName))
      .map(item => compilerError(ts, config.root, item, relative, 'ARCH_SYNTAX_INVALID')));
    projects.push({ relative, program, options: parsed.options });
  }
  const occurrences = new Map();
  const sourceIn = new Map();
  for (const project of projects) {
    for (const sourceFile of project.program.getSourceFiles().filter(file => isProductionSource(config.root, file))) {
      const name = canonical(sourceFile.fileName);
      if (!occurrences.has(name)) occurrences.set(name, []);
      occurrences.get(name).push(project);
      sourceIn.set(`${project.relative}|${name}`, sourceFile);
    }
  }
  // The deepest project directory holding a file owns it: its source file, its checker and its resolution. A side or repository
  // root tsconfig without paths must not shadow the app project whose aliases (`@/*`) the file actually uses.
  const owningProject = (candidates, file) => candidates.filter(item => isInside(path.dirname(path.join(config.root, ...item.relative.split('/'))), file))
    .sort((x, y) => y.relative.split('/').length - x.relative.split('/').length)[0] ?? candidates[0];
  const fileMap = new Map();
  const checkerByFile = new Map();
  const ownerByFile = new Map();
  for (const [name, candidates] of occurrences) {
    const owner = owningProject(candidates, name);
    ownerByFile.set(name, owner);
    fileMap.set(name, sourceIn.get(`${owner.relative}|${name}`));
    checkerByFile.set(name, owner.program.getTypeChecker());
  }
  const files = [...fileMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, file]) => file);
  const edges = new Map([...fileMap.keys()].map(file => [file, []]));
  for (const [file, sourceFile] of fileMap) {
    const sourceName = path.resolve(sourceFile.fileName);
    if (sourceName !== file) edges.set(sourceName, edges.get(file));
  }
  const edgeKeys = new Set();
  const host = { ...ts.sys, fileExists: ts.sys.fileExists, readFile: ts.sys.readFile, realpath: ts.sys.realpath };
  const workspaces = workspaceMetadata(config);
  const workspaceNames = new Set(workspaces.map(item => item.name).filter(Boolean));
  for (const [from, sourceFile] of fileMap) {
    const owningWorkspace = workspaceOf(workspaces, from);
    const project = ownerByFile.get(from);
    if (!project) continue;
    const references = moduleReferences(ts, sourceFile, project.program.getTypeChecker());
    for (const item of references.unproven) errors.push({
      ruleId: 'ARCH_DYNAMIC_DEPENDENCY_UNPROVEN',
      project: project.relative,
      path: relativePath(config.root, sourceFile.fileName),
      ...sourceLocation(sourceFile, item.node),
      message: `${item.kind} must use a string-literal module name so architecture coverage can resolve its dependency.`,
    });
    for (const reference of references.found) {
      // A workspace package is read at its source, never at its build: the same import resolves whether or not dist exists.
      const workspaceTarget = workspaces.filter(item => item.root !== canonical(config.root)).map(item => workspaceSourceEntry(ts, item, reference.specifier)).find(Boolean);
      const resolvedName = workspaceTarget ?? resolveTypeScriptModule(ts, reference.specifier, sourceFile.fileName, project.options, host);
      if (!resolvedName) {
        const codeLike = !ASSET_EXTENSION.test(reference.specifier);
        const workspaceImport = [...workspaceNames].some(name => sameOrUnder(reference.specifier, name));
        const internal = reference.specifier.startsWith('.') || pathAliasMatches(reference.specifier, project.options.paths) || workspaceImport;
        if (codeLike && internal) {
          errors.push({
            ruleId: 'ARCH_INTERNAL_IMPORT_UNRESOLVED',
            project: project.relative,
            path: relativePath(config.root, sourceFile.fileName),
            ...sourceLocation(sourceFile, reference.node),
            specifier: reference.specifier,
            message: `Internal import ${reference.specifier} is not resolvable with ${project.relative}.`,
          });
        }
        continue;
      }
      const actualTarget = canonical(resolvedName);
      const workspaceImport = [...workspaceNames].some(name => reference.specifier === name || reference.specifier.startsWith(`${name}/`));
      const internal = reference.specifier.startsWith('.') || pathAliasMatches(reference.specifier, project.options.paths) || workspaceImport;
      // The boundary is the checkout, not the checked project: a path alias that lands in a sibling
      // package of the same repository (`@fe-kit/*` -> packages/fe-kit) is still source a reviewer can
      // open, while anything past the repository, or anything inside an installed dependency tree, is
      // not. `config.repository` is null when there is no git checkout around the project, and the
      // project is then the boundary it always was.
      const reviewable = isInside(config.root, actualTarget)
        || (config.repository && isInside(config.repository, actualTarget) && !slash(actualTarget).includes('/node_modules/'));
      // A side of an app (config.root is be/ or fe/) imports nothing of the app outside itself: the root holds no source, the other
      // side is another program, and a declared read (sides.fe.reads, be/contracts/) is codegen input, never an import.
      const crossesSide = config.packageRoot !== undefined && config.packageRoot !== config.root
        && isInside(config.packageRoot, actualTarget) && !isInside(config.root, actualTarget) && !slash(actualTarget).includes('/node_modules/');
      if (internal && crossesSide) {
        errors.push({
          ruleId: 'ARCH_INTERNAL_IMPORT_OUTSIDE',
          project: project.relative,
          path: relativePath(config.root, sourceFile.fileName),
          ...sourceLocation(sourceFile, reference.node),
          specifier: reference.specifier,
          message: `Internal import ${reference.specifier} leaves the ${path.basename(config.root)} side for ${slash(path.relative(config.packageRoot, actualTarget))}; nothing crosses the sides of an app.`,
        });
        continue;
      }
      if (internal && !reviewable) {
        errors.push({
          ruleId: 'ARCH_INTERNAL_IMPORT_OUTSIDE',
          project: project.relative,
          path: relativePath(config.root, sourceFile.fileName),
          ...sourceLocation(sourceFile, reference.node),
          specifier: reference.specifier,
          message: `Internal import ${reference.specifier} resolves outside the checked repository.`,
        });
        continue;
      }
      if (!fileMap.has(actualTarget)) continue;
      const edge = {
        from,
        to: actualTarget,
        runtime: reference.runtime,
        specifier: reference.specifier,
        node: reference.node,
        declaration: reference.declaration,
        reexport: ts.isExportDeclaration(reference.declaration),
        sourceFile,
        project: project.relative,
        ...sourceLocation(sourceFile, reference.node),
      };
      const key = `${from}\0${actualTarget}\0${reference.node.getStart(sourceFile)}\0${reference.specifier}`;
      if (!edgeKeys.has(key)) { edges.get(from).push(edge); edgeKeys.add(key); }
      const targetWorkspace = workspaceOf(workspaces, actualTarget);
      if (owningWorkspace && targetWorkspace && owningWorkspace !== targetWorkspace) {
        if (!owningWorkspace.app && targetWorkspace.app) {
          errors.push(boundaryViolation(config.root, edge, owningWorkspace, targetWorkspace, 'ARCH_PACKAGE_IMPORTS_APP', 'A reusable workspace package cannot depend on an application workspace.'));
        }
        if (!packageExported(ts, targetWorkspace, reference.specifier, actualTarget)) {
          errors.push(boundaryViolation(config.root, edge, owningWorkspace, targetWorkspace, 'ARCH_PACKAGE_EXPORT_BYPASS', 'Cross-package imports must use the target package name and a declared package export.'));
        }
      }
    }
  }
  if (projects.length && files.length === 0) errors.push({ ruleId: 'ARCH_NO_SOURCE', message: 'The configured TypeScript projects contain no production TypeScript or JavaScript source.' });
  return { loaded, errors, files, edges, programs: projects.map(item => item.program), program: projects[0]?.program ?? null, projects, ts, workspaces,
    checkerFor: file => checkerByFile.get(canonical(file)) ?? null,
    workspaceOf: file => workspaceOf(workspaces, canonical(file)) };
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

/** `expression` unwrapped by the caller's own predicate set (a predicate absent on an older ts reads as never). */
export function unwrapEach(ts, expression, predicates) {
  while (expression && predicates.some((predicate) => predicate?.(expression))) expression = expression.expression;
  return expression;
}

/** `value` with every TS alias hop resolved (a re-exported import reads as its target symbol). */
export function normalizedSymbolValue(ts, checker, value) {
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

/** The symbol `node` names, aliases resolved. */
export function normalizedSymbol(ts, checker, node) {
  return normalizedSymbolValue(ts, checker, checker?.getSymbolAtLocation(node) ?? null);
}

/** The identifier or member-name node an expression selects through unwrapExpression, or null. */
export function selectedNode(ts, expression) {
  expression = unwrapExpression(ts, expression);
  if (ts.isIdentifier(expression)) return expression;
  if (ts.isPropertyAccessExpression(expression)) return expression.name;
  if (ts.isElementAccessExpression(expression) && ts.isStringLiteralLike(expression.argumentExpression)) return expression.argumentExpression;
  return null;
}

/**
 * The symbol `node` ultimately evaluates to: its own symbol, followed through a single `const` variable
 * initializer (and so on). `unselected: 'null'` answers null when `node` selects no name at all.
 */
export function valueSymbol(ts, checker, node, seen = new Set(), { unselected = 'node' } = {}) {
  const selected = selectedNode(ts, node);
  if (!selected && unselected === 'null') return null;
  const symbol = normalizedSymbol(ts, checker, selected ?? node);
  if (!symbol || seen.has(symbol)) return symbol;
  seen.add(symbol);
  const declarations = symbol.getDeclarations?.() ?? [];
  if (declarations.length === 1 && ts.isVariableDeclaration(declarations[0]) && declarations[0].initializer
    && (ts.getCombinedNodeFlags(declarations[0].parent) & ts.NodeFlags.Const)) {
    return valueSymbol(ts, checker, declarations[0].initializer, seen, { unselected });
  }
  return symbol;
}

/**
 * The expressions `declaration` returns: its body when it is an expression-bodied arrow/function, else every
 * `return`'s argument without descending into nested functions. `functionLike` overrides which node kinds bound
 * that descent (default the four callable declaration kinds; pass `ts.isFunctionLike` for the wider set).
 */
export function returnedExpressions(ts, declaration, { functionLike = null } = {}) {
  const boundary = functionLike ?? ((node) => ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)
    || ts.isArrowFunction(node) || ts.isFunctionExpression(node));
  if ((ts.isArrowFunction(declaration) || ts.isFunctionExpression(declaration)) && !ts.isBlock(declaration.body)) return [declaration.body];
  const body = boundary(declaration) ? declaration.body : null;
  if (!body || !ts.isBlock(body)) return [];
  const returned = [];
  const visit = (node) => {
    if (node !== body && boundary(node)) return;
    if (ts.isReturnStatement(node) && node.expression) returned.push(node.expression);
    else ts.forEachChild(node, visit);
  };
  visit(body);
  return returned;
}

/** A node's decorators across TS versions (ts.getDecorators, else the legacy `decorators` property). */
export function nodeDecorators(ts, node) {
  return ts.canHaveDecorators(node) ? ts.getDecorators(node) ?? [] : node.decorators ?? [];
}

/** One finding row: rule id, root-relative path, node position and message, plus rule extras. */
export function violation(config, sourceFile, node, ruleId, message, extra = {}) {
  return { ruleId, path: relativePath(config.root, sourceFile.fileName), ...sourceLocation(sourceFile, node), message, ...extra };
}

/** Whether `match` holds for `node` or a descendant (the walk stops at the first match). */
export function anyDescendant(ts, node, match) {
  let found = false;
  const visit = (current) => {
    if (found) return;
    if (match(current)) { found = true; return; }
    ts.forEachChild(current, visit);
  };
  visit(node);
  return found;
}

/**
 * The framework kinds `expression` can produce: `directOf(ts, checker, {symbol, selected, targets})` maps a
 * selected node's symbols to a kind (default `targets.get(symbol)`); `shorthandOf` (when set) also resolves
 * shorthand-property declarations and descends property assignments; `newExpression` descends `new X()` callees.
 */
export function tracedFrameworkKinds(ts, checker, expression, targets,
  { seen = new Set(), depth = 0, directOf = null, shorthandOf = null, newExpression = false } = {}) {
  if (!expression) return new Set();
  if (depth > 10) return new Set([UNPROVEN_FRAMEWORK]);
  expression = unwrapExpression(ts, expression);
  const selected = selectedNode(ts, expression);
  const symbol = selected ? normalizedSymbol(ts, checker, selected) : null;
  const direct = symbol ? (directOf ?? ((ts2, c, { symbol: s, targets: t }) => t.get(s) ?? null))(ts, checker, { symbol, selected, targets }) : null;
  if (direct) return new Set([direct]);
  const opts = { depth: depth + 1, directOf, shorthandOf, newExpression };
  if (ts.isArrowFunction(expression) || ts.isFunctionExpression(expression)) {
    const kinds = new Set();
    for (const returned of returnedExpressions(ts, expression)) {
      for (const kind of tracedFrameworkKinds(ts, checker, returned, targets, { ...opts, seen })) kinds.add(kind);
    }
    return kinds;
  }
  if (ts.isCallExpression(expression)) {
    const kinds = tracedFrameworkKinds(ts, checker, expression.expression, targets, { ...opts, seen });
    if (kinds.size) return kinds;
  }
  if (newExpression && ts.isNewExpression(expression)) {
    return tracedFrameworkKinds(ts, checker, expression.expression, targets, { ...opts, seen });
  }
  if (!symbol || seen.has(symbol)) return new Set();
  const nextSeen = new Set(seen).add(symbol);
  const kinds = new Set();
  for (const declaration of symbol.getDeclarations?.() ?? []) {
    if (ts.isVariableDeclaration(declaration) && declaration.initializer) {
      for (const kind of tracedFrameworkKinds(ts, checker, declaration.initializer, targets, { ...opts, seen: nextSeen })) kinds.add(kind);
    }
    if (shorthandOf && ts.isShorthandPropertyAssignment(declaration)) {
      const target = normalizedSymbolValue(ts, checker, checker.getShorthandAssignmentValueSymbol?.(declaration));
      const kind = shorthandOf(ts, checker, target, targets);
      if (kind) kinds.add(kind);
    }
    if (shorthandOf && ts.isPropertyAssignment(declaration)) {
      for (const kind of tracedFrameworkKinds(ts, checker, declaration.initializer, targets, { ...opts, seen: nextSeen })) kinds.add(kind);
    }
    for (const returned of returnedExpressions(ts, declaration)) {
      for (const kind of tracedFrameworkKinds(ts, checker, returned, targets, { ...opts, seen: nextSeen })) kinds.add(kind);
    }
  }
  return kinds;
}

/** 'unproven framework' | 'multiple framework' | the one kind | null, for a decorator whose expression constructs. */
export function constructedDecoratorKind(ts, checker, decorator, targets, traceOpts = {}) {
  const callee = ts.isCallExpression(decorator.expression) ? decorator.expression.expression : decorator.expression;
  const kinds = tracedFrameworkKinds(ts, checker, callee, targets, traceOpts);
  if (kinds.has(UNPROVEN_FRAMEWORK)) return 'unproven framework';
  return kinds.size === 1 ? [...kinds][0] : kinds.size ? 'multiple framework' : null;
}

/** The target a decorator resolves to through a `let`/`var` alias's single initializer, or null. */
export function mutableDecoratorKind(ts, checker, decorator, targets) {
  const callee = ts.isCallExpression(decorator.expression) ? decorator.expression.expression : decorator.expression;
  const selected = selectedNode(ts, callee);
  const symbol = selected ? normalizedSymbol(ts, checker, selected) : null;
  const declarations = symbol?.getDeclarations?.() ?? [];
  if (declarations.length !== 1 || !ts.isVariableDeclaration(declarations[0]) || !declarations[0].initializer
    || (ts.getCombinedNodeFlags(declarations[0].parent) & ts.NodeFlags.Const)) return null;
  return targets.get(valueSymbol(ts, checker, declarations[0].initializer)) ?? null;
}

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

/** The callee expression of a decorator (the called expression of `@x(...)`, else the expression itself). */
export function decoratorCallee(ts, decorator) {
  return ts.isCallExpression(decorator.expression) ? decorator.expression.expression : decorator.expression;
}

/**
 * The module `statement` (import, export-from or import-equals) statically binds: its specifier text, the
 * module's symbol and its exported symbols by name (aliases resolved); `symbol` is null when the module does
 * not resolve. Null when the statement names no static specifier.
 */
export function moduleExportsOf(ts, checker, statement) {
  const moduleSpecifier = (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement))
    && statement.moduleSpecifier && ts.isStringLiteralLike(statement.moduleSpecifier) ? statement.moduleSpecifier : null;
  const importEquals = ts.isImportEqualsDeclaration(statement) && ts.isExternalModuleReference(statement.moduleReference)
    && statement.moduleReference.expression && ts.isStringLiteralLike(statement.moduleReference.expression)
    ? statement.moduleReference.expression : null;
  const specifierNode = moduleSpecifier ?? importEquals;
  const specifier = specifierNode?.text;
  if (specifier == null) return null;
  const symbol = checker.getSymbolAtLocation(specifierNode) ?? null;
  const exports = new Map((symbol ? checker.getExportsOfModule(symbol) : []).map(item => [item.getName(), normalizedSymbolValue(ts, checker, item)]));
  return { specifierNode, specifier, symbol, exports };
}

/**
 * The program source files a framework-target scan of `checker` judges: every file in `localFiles`, plus (when
 * `root` is given) declaration files inside the root but outside node_modules. Null when no program of the
 * context owns the checker.
 */
export function programSourcesOf(context, checker, localFiles, { root = null } = {}) {
  const program = context.programs.find(candidate => candidate.getTypeChecker() === checker) ?? null;
  if (!program) return null;
  return program.getSourceFiles().filter(sourceFile => localFiles.has(canonical(sourceFile.fileName))
    || (root && sourceFile.isDeclarationFile && isInside(root, sourceFile.fileName)
      && !sourceFile.fileName.replaceAll('\\', '/').includes('/node_modules/')));
}

/**
 * The CommonJS require() caveat every framework scan reports: each `require('<specifier>')` `accepted` pushes
 * `${filePath} uses a CommonJS <specifier> <detail>` (the import-shape reasoning cannot prove that binding).
 */
export function commonJsRequireReasons(ts, checker, sourceFile, accepted, reasons, filePath, detail) {
  const visit = node => {
    if (ts.isCallExpression(node) && isUnshadowedCommonJsRequire(ts, checker, node.expression)
      && node.arguments.length === 1 && ts.isStringLiteralLike(node.arguments[0]) && accepted(node.arguments[0].text)) {
      reasons.push(`${filePath} uses a CommonJS ${node.arguments[0].text} ${detail}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
}

export { isUnshadowedCommonJsRequire };
