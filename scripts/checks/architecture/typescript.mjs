import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { isInside, slash } from './config.mjs';
import { createTypeScriptProgram, sharedInProgramRun } from '../typescript-programs.mjs';

const CODE_EXTENSIONS = /\.(?:[cm]?[jt]sx?)$/i;
const TEST_FILE = /(?:^|[.-])(?:spec|test)\.[cm]?[jt]sx?$/i;
const ASSET_EXTENSION = /\.(?:css|scss|sass|less|svg|png|jpe?g|gif|webp|avif|ico|woff2?|ttf|eot|ya?ml|json)$/i;
// Framework build output a tsconfig may include (Next writes `.next/types/**/*.ts` back into tsconfig.json on
// every build) is compiled for type resolution but is never source: it is gitignored, regenerated, and no
// canon or architecture rule applies to it (starci-next inc-2260b3754afa, nivo inc-ffe60c49f502).
export const GENERATED_SEGMENTS = new Set(['.next', '.turbo', '.vercel', '.output', '.nuxt', '.svelte-kit', '.expo', '.docusaurus', '.swc', '.cache']);
export function isGeneratedPath(root, fileName) {
  return slash(path.relative(root, fileName)).split('/').slice(0, -1).some(segment => GENERATED_SEGMENTS.has(segment));
}
// A `<tool>.config.*` or `<tool>.setup.*` module beside a package manifest (next.config.ts, vitest.config.ts,
// vitest.setup.ts) is build tooling a broad `**/*.ts` include pulls in; a `*.config.ts` inside a source tree
// (src/config/database.config.ts) has no manifest beside it and stays source. The architecture program still
// reads tooling modules (a profile may declare one as source); check-scoped-lint does not make one a canon
// lint subject unless the profile's sourceGlobs name it.
const TOOLING_MODULE = /^[^/]+\.(?:config|setup)\.[cm]?[jt]sx?$/i;
export function isToolingModule(fileName) {
  return TOOLING_MODULE.test(path.basename(fileName)) && fs.existsSync(path.join(path.dirname(fileName), 'package.json'));
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

/** Load TypeScript through the target package boundary, never through StarCi's own dependency graph. */
export function loadTargetTypeScript(repositoryRoot) {
  const packageFile = path.join(repositoryRoot, 'package.json');
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

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; }
}

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
export function assetContextSpecifiers(ts, sourceFile, argument) {
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

function sourceLocation(sourceFile, node) {
  const point = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return { line: point.line + 1, column: point.character + 1 };
}

function isProductionSource(root, sourceFile) {
  return isInside(root, sourceFile.fileName)
    && CODE_EXTENSIONS.test(sourceFile.fileName)
    && !sourceFile.isDeclarationFile
    && !TEST_FILE.test(sourceFile.fileName)
    && !slash(sourceFile.fileName).includes('/node_modules/')
    && !isGeneratedPath(root, sourceFile.fileName);
}

function canonical(file) {
  const absolute = path.resolve(file);
  try { return path.resolve(fs.realpathSync(absolute)); } catch { return absolute; }
}

function workspaceMetadata(config) {
  const backendAppRoots = config.backend.apps.map(item => path.join(config.root, ...item.split('/')));
  const create = relative => {
    const root = path.join(config.root, ...relative.split('/'));
    const pkg = readJson(path.join(root, 'package.json'));
    const routeRoots = config.frontend.routes.map(item => path.join(config.root, ...item.split('/')));
    return { root: canonical(root), relative, name: typeof pkg.name === 'string' ? pkg.name : null, exports: pkg.exports,
      app: routeRoots.some(route => isInside(root, route))
        || backendAppRoots.some(appRoot => isInside(appRoot, root) || isInside(root, appRoot)) };
  };
  const roots = config.workspaces.map(create);
  const rootPackage = readJson(path.join(config.root, 'package.json'));
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

function exportTargetStrings(value) {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(exportTargetStrings);
  if (value && typeof value === 'object' && !Object.keys(value).some(key => key.startsWith('.'))) return Object.values(value).flatMap(exportTargetStrings);
  return [];
}

function packageExported(workspace, specifier, actualTarget) {
  if (!workspace.name || (specifier !== workspace.name && !specifier.startsWith(`${workspace.name}/`))) return false;
  const request = specifier === workspace.name ? '.' : `.${specifier.slice(workspace.name.length)}`;
  const declaration = workspace.exports;
  let candidates = [];
  if (typeof declaration === 'string' || Array.isArray(declaration)) {
    if (request !== '.') return false;
    candidates = exportTargetStrings(declaration);
  } else if (declaration && typeof declaration === 'object') {
    const keys = Object.keys(declaration);
    if (!keys.some(key => key.startsWith('.'))) {
      if (request !== '.') return false;
      candidates = exportTargetStrings(declaration);
    } else {
      for (const key of keys) {
        const capture = exportPatternCapture(key, request);
        if (capture !== null) candidates.push(...exportTargetStrings(declaration[key]).map(target => target.replaceAll('*', capture)));
      }
    }
  }
  return candidates.some(target => {
    if (!target.startsWith('./') || target.includes('..')) return false;
    const expected = canonical(path.resolve(workspace.root, target));
    return expected === canonical(actualTarget);
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

/** Parse every declared target tsconfig and build one source and package dependency graph, once per program run. */
export function buildTypeScriptContext(config, injectedTypeScript) {
  const loaded = injectedTypeScript ? { ts: injectedTypeScript, resolved: '(injected test compiler)', version: String(injectedTypeScript.version) }
    : loadTargetTypeScript(config.root);
  const context = sharedInProgramRun('architecture-context', loaded.ts, config, () => typeScriptContext(config, loaded));
  // Callers add to and sort the errors: each gets its own list.
  return { ...context, errors: [...context.errors] };
}

function typeScriptContext(config, loaded) {
  const { ts } = loaded;
  const errors = [];
  const projects = [];
  const queue = [...config.projects];
  const seenProjects = new Set();
  while (queue.length) {
    const relative = queue.shift();
    if (seenProjects.has(relative)) continue;
    seenProjects.add(relative);
    const configFile = path.join(config.root, ...relative.split('/'));
    if (!fs.existsSync(configFile)) {
      errors.push({ ruleId: 'ARCH_TSCONFIG_MISSING', project: relative, message: `${relative} does not exist.` });
      continue;
    }
    const read = ts.readConfigFile(configFile, ts.sys.readFile);
    if (read.error) {
      errors.push(compilerError(ts, config.root, read.error, relative));
      continue;
    }
    const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, path.dirname(configFile), undefined, configFile);
    if (parsed.errors.length) {
      errors.push(...parsed.errors.map(item => compilerError(ts, config.root, item, relative)));
      continue;
    }
    for (const reference of parsed.projectReferences ?? []) {
      const referencedFile = ts.resolveProjectReferencePath ? ts.resolveProjectReferencePath(reference)
        : (path.extname(reference.path) ? reference.path : path.join(reference.path, 'tsconfig.json'));
      const absoluteReference = path.resolve(referencedFile);
      if (!isInside(config.root, absoluteReference)) {
        errors.push({ ruleId: 'ARCH_TSCONFIG_REFERENCE_OUTSIDE', project: relative, message: `Project reference leaves the repository: ${slash(path.relative(config.root, absoluteReference))}.` });
      } else {
        queue.push(slash(path.relative(config.root, absoluteReference)));
      }
    }
    const program = createTypeScriptProgram(ts, { rootNames: parsed.fileNames, options: parsed.options, projectReferences: parsed.projectReferences });
    errors.push(...program.getSyntacticDiagnostics().filter(item => !item.file || isInside(config.root, item.file.fileName))
      .map(item => compilerError(ts, config.root, item, relative, 'ARCH_SYNTAX_INVALID')));
    projects.push({ relative, program, options: parsed.options });
  }
  const fileMap = new Map();
  const checkerByFile = new Map();
  const occurrences = new Map();
  for (const project of projects) {
    for (const sourceFile of project.program.getSourceFiles().filter(file => isProductionSource(config.root, file))) {
      const name = canonical(sourceFile.fileName);
      if (!fileMap.has(name)) {
        fileMap.set(name, sourceFile);
        checkerByFile.set(name, project.program.getTypeChecker());
      }
      if (!occurrences.has(name)) occurrences.set(name, []);
      occurrences.get(name).push(project);
    }
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
    const candidates = occurrences.get(from) ?? [];
    const project = candidates.find(item => isInside(path.dirname(path.join(config.root, ...item.relative.split('/'))), from)) ?? candidates[0];
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
      const resolvedName = ts.resolveModuleName(reference.specifier, sourceFile.fileName, project.options, host).resolvedModule?.resolvedFileName;
      if (!resolvedName) {
        const codeLike = !ASSET_EXTENSION.test(reference.specifier);
        const workspaceImport = [...workspaceNames].some(name => reference.specifier === name || reference.specifier.startsWith(`${name}/`));
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
        if (!packageExported(targetWorkspace, reference.specifier, actualTarget)) {
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

export { isUnshadowedCommonJsRequire, sourceLocation };
