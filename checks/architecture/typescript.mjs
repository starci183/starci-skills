import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { isInside, slash } from './config.mjs';

const CODE_EXTENSIONS = /\.(?:[cm]?[jt]sx?)$/i;
const TEST_FILE = /\.(?:spec|test)\.[cm]?[jt]sx?$/i;
const ASSET_EXTENSION = /\.(?:css|scss|sass|less|svg|png|jpe?g|gif|webp|avif|ico|woff2?|ttf|eot|ya?ml|json)$/i;

function diagnosticMessage(ts, diagnostic) {
  return ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
}

function compilerError(ts, root, diagnostic, ruleId = 'ARCH_TSCONFIG_INVALID') {
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

function moduleReferences(ts, sourceFile) {
  const found = [];
  const visit = node => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) {
      found.push({ node: node.moduleSpecifier, specifier: node.moduleSpecifier.text, runtime: runtimeImport(ts, node), declaration: node });
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)
      && node.moduleReference.expression && ts.isStringLiteralLike(node.moduleReference.expression)) {
      found.push({ node: node.moduleReference.expression, specifier: node.moduleReference.expression.text, runtime: !node.isTypeOnly, declaration: node });
    } else if (ts.isCallExpression(node) && node.arguments.length === 1 && ts.isStringLiteralLike(node.arguments[0])
      && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) {
      found.push({ node: node.arguments[0], specifier: node.arguments[0].text, runtime: true, declaration: node });
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
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
    && !slash(sourceFile.fileName).includes('/node_modules/');
}

/** Parse the real target tsconfig and build an internal runtime dependency graph. */
export function buildTypeScriptContext(config, injectedTypeScript) {
  const loaded = injectedTypeScript ? { ts: injectedTypeScript, resolved: '(injected test compiler)', version: String(injectedTypeScript.version) }
    : loadTargetTypeScript(config.root);
  const { ts } = loaded;
  const configFile = path.join(config.root, config.tsconfig);
  if (!fs.existsSync(configFile)) throw Error(`ARCH_TSCONFIG_MISSING: ${config.tsconfig} does not exist.`);
  const read = ts.readConfigFile(configFile, ts.sys.readFile);
  if (read.error) return { loaded, errors: [compilerError(ts, config.root, read.error)], files: [], edges: new Map(), program: null };
  const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, path.dirname(configFile), undefined, configFile);
  if (parsed.errors.length) {
    return { loaded, errors: parsed.errors.map(item => compilerError(ts, config.root, item)), files: [], edges: new Map(), program: null };
  }
  const program = ts.createProgram({ rootNames: parsed.fileNames, options: parsed.options, projectReferences: parsed.projectReferences });
  const files = program.getSourceFiles().filter(file => isProductionSource(config.root, file)).sort((a, b) => a.fileName.localeCompare(b.fileName));
  if (files.length === 0) {
    return { loaded, errors: [{ ruleId: 'ARCH_NO_SOURCE', message: 'The target tsconfig contains no production TypeScript or JavaScript source.' }], files, edges: new Map(), program };
  }
  const errors = program.getSyntacticDiagnostics().filter(item => !item.file || isInside(config.root, item.file.fileName))
    .map(item => compilerError(ts, config.root, item, 'ARCH_SYNTAX_INVALID'));
  const sourceNames = new Set(files.map(file => path.resolve(file.fileName)));
  const edges = new Map(files.map(file => [path.resolve(file.fileName), []]));
  const host = { ...ts.sys, fileExists: ts.sys.fileExists, readFile: ts.sys.readFile, realpath: ts.sys.realpath };
  for (const sourceFile of files) {
    const from = path.resolve(sourceFile.fileName);
    for (const reference of moduleReferences(ts, sourceFile)) {
      const resolved = ts.resolveModuleName(reference.specifier, sourceFile.fileName, parsed.options, host).resolvedModule?.resolvedFileName;
      if (!resolved) {
        const codeLike = !ASSET_EXTENSION.test(reference.specifier);
        const internal = reference.specifier.startsWith('.') || pathAliasMatches(reference.specifier, parsed.options.paths);
        if (codeLike && internal) {
          errors.push({
            ruleId: 'ARCH_INTERNAL_IMPORT_UNRESOLVED',
            path: slash(path.relative(config.root, sourceFile.fileName)),
            ...sourceLocation(sourceFile, reference.node),
            specifier: reference.specifier,
            message: `Internal import ${reference.specifier} is not resolvable with ${config.tsconfig}.`,
          });
        }
        continue;
      }
      const actualTarget = path.resolve(resolved);
      if (!sourceNames.has(actualTarget)) continue;
      edges.get(from).push({
        from,
        to: actualTarget,
        runtime: reference.runtime,
        specifier: reference.specifier,
        node: reference.node,
        declaration: reference.declaration,
        reexport: ts.isExportDeclaration(reference.declaration),
        sourceFile,
        ...sourceLocation(sourceFile, reference.node),
      });
    }
  }
  return { loaded, errors, files, edges, program, ts, options: parsed.options };
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
    for (const edge of edges.get(current.file) ?? []) {
      if (edge.runtime && follow(edge)) queue.push({ file: edge.to, chain: [...current.chain, edge.to] });
    }
  }
  return null;
}

export { sourceLocation };
