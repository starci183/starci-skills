// R280: declarations are not consumers. Error-kind maps, message catalogs, imports,
// re-exports and tests do not keep an otherwise unused value alive.
import path from 'node:path';
import { createRequire } from 'node:module';
import { found, readText } from './read.mjs';
import { nameText } from '../../lib/ts-ast.mjs';
import { unwrapCatalogExpression as unwrap } from '../../lib/ts-analysis.mjs';
import { argumentBindings, jsonCatalogBindings, jsonCatalogRead, staticStrings } from './unused-symbol-values.mjs';
import { catalogNamespace, translationBindings } from './unused-symbol-translators.mjs';
import { valuesOf } from './unused-symbol-flow.mjs';

export const HFS_UNUSED_SYMBOL = 'HFS_UNUSED_SYMBOL';
const SOURCE = /\.[cm]?[jt]sx?$/u;
const EXCLUDED = /(?:^|\/)(?:node_modules|__generated__|_generated|dist|tests?|__tests__|test-support)\/|(?:\.(?:spec|test)|-spec)\.[cm]?[jt]sx?$|\.d\.[cm]?ts$/u;
const CATALOG = /(?:\.messages|\.catalog)\.[cm]?[jt]s$/u;
const JSON_CATALOG = /(?:^|\/)(?:messages|locales)\/[^/]+\.json$|\.catalog\.json$/u;
const QUEUE_NAME = /(?:^QUEUE(?:_NAME)?$|_QUEUE(?:_NAME)?$)/u;
const ERROR_NAME = /(?:^ERROR_CODE$|_ERROR_CODE$)/u;
const slash = value => value.replaceAll('\\', '/');

function compilerAt(repoRoot, supplied) {
  if (supplied) return supplied;
  // TypeScript belongs to the checked product, just as in the architecture machine.
  // Its missing-compiler refusal is reported there, rather than mislabeled as dead code.
  try { return createRequire(path.join(repoRoot, 'package.json'))('typescript'); } catch { return null; }
}

function sourceFiles(ts, repoRoot, files) {
  const sources = new Map();
  for (const file of files) {
    if (!SOURCE.test(file) || EXCLUDED.test(file) || !/(?:^|\/)src\//u.test(file)) continue;
    const text = readText(repoRoot, file);
    if (text !== null) sources.set(slash(path.resolve(repoRoot, file)), ts.createSourceFile(path.resolve(repoRoot, file), text, ts.ScriptTarget.Latest, true));
  }
  return sources;
}

function projectOptions(ts, repoRoot, files) {
  const projects = [];
  for (const file of files.filter(file => /(?:^|\/)tsconfig\.json$/u.test(file))) {
    const text = readText(repoRoot, file);
    if (text === null) continue;
    const absolute = path.resolve(repoRoot, file);
    const config = ts.parseConfigFileTextToJson(absolute, text);
    if (config.error) continue;
    const host = { ...ts.sys, readFile: target => {
      const rel = slash(path.relative(repoRoot, target));
      return rel.startsWith('../') ? undefined : readText(repoRoot, rel) ?? undefined;
    } };
    const parsed = ts.parseJsonConfigFileContent(config.config, host, path.dirname(absolute), {}, absolute);
    projects.push({ directory: `${slash(path.dirname(absolute))}/`, options: parsed.options });
  }
  return projects.sort((a, b) => b.directory.length - a.directory.length);
}

function trackedProgram(ts, repoRoot, files, sources) {
  const options = { noLib: true, types: [], allowJs: true, resolveJsonModule: true, jsx: ts.JsxEmit.Preserve, target: ts.ScriptTarget.Latest, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler };
  const projects = projectOptions(ts, repoRoot, files);
  const catalogs = new Set(files.filter(file => JSON_CATALOG.test(file)).map(file => slash(path.resolve(repoRoot, file))));
  const host = {
    getSourceFile: file => sources.get(slash(path.resolve(file))),
    getDefaultLibFileName: () => '', writeFile: () => {},
    getCurrentDirectory: () => repoRoot, getDirectories: () => [],
    fileExists: file => sources.has(slash(path.resolve(file))) || catalogs.has(slash(path.resolve(file))),
    readFile: file => sources.get(slash(path.resolve(file)))?.text,
    getCanonicalFileName: slash, useCaseSensitiveFileNames: () => true,
    getNewLine: () => '\n',
  };
  const resolveModule = (name, containing) => {
    const project = projects.find(project => slash(containing).startsWith(project.directory));
    return ts.resolveModuleName(name, containing, { ...options, ...project?.options }, host).resolvedModule;
  };
  host.resolveModuleNames = (names, containing) => names.map(name => resolveModule(name, containing));
  return { program: ts.createProgram([...sources.keys()], options, host), resolveModule };
}

const symbolOf = (ts, checker, node) => {
  const shorthand = ts.isShorthandPropertyAssignment(node.parent) && node.parent.name === node;
  const symbol = shorthand ? checker.getShorthandAssignmentValueSymbol(node.parent) : checker.getSymbolAtLocation(node);
  return symbol?.flags === ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
};

function addCandidate(state, source, node, kind, name, value, symbol) {
  const at = source.getLineAndCharacterOfPosition(node.getStart(source));
  const candidate = { path: slash(path.relative(state.repoRoot, source.fileName)), line: at.line + 1, column: at.character + 1, kind, name, value, used: false };
  state.candidates.push(candidate);
  if (symbol) state.symbols.set(symbol, candidate);
  if (symbol?.valueDeclaration) state.decls.set(symbol.valueDeclaration, candidate);
  return candidate;
}

function enumCandidates(state, source, declaration) {
  const members = [];
  for (const member of declaration.members) {
    const name = nameText(state.ts, member.name, { numbers: true });
    if (name === null) continue;
    const kind = declaration.name.text.endsWith('ErrorCode') ? 'error code' : 'enum member';
    const value = state.checker.getConstantValue(member) ?? null;
    members.push(addCandidate(state, source, member, kind, `${declaration.name.text}.${name}`, value, state.checker.getSymbolAtLocation(member.name)));
  }
  state.containers.set(state.checker.getSymbolAtLocation(declaration.name), members);
}

function catalogProperties(state, source, object, prefix = '') {
  for (const property of object.properties) {
    if (!state.ts.isPropertyAssignment(property)) continue;
    const name = nameText(state.ts, property.name, { numbers: true });
    if (name === null) continue;
    const child = unwrap(state.ts, property.initializer);
    if (state.ts.isObjectLiteralExpression(child) && !child.properties.some(item => ['vi', 'en'].includes(nameText(state.ts, item.name, { numbers: true })))) {
      catalogProperties(state, source, child, ['vi', 'en'].includes(name) ? prefix : `${prefix}${name}.`);
    } else {
      const key = `${prefix}${name}`;
      addCandidate(state, source, property, 'catalog key', key, key, state.checker.getSymbolAtLocation(property.name));
    }
  }
}

function variableCandidates(state, source, declaration) {
  const { ts, checker } = state;
  if (!ts.isIdentifier(declaration.name) || !declaration.initializer) return;
  const value = unwrap(ts, declaration.initializer);
  const name = declaration.name.text;
  if (CATALOG.test(source.fileName) && ts.isObjectLiteralExpression(value)) {
    catalogProperties(state, source, value);
    return;
  }
  if (ts.isStringLiteralLike(value) && (QUEUE_NAME.test(name) || ERROR_NAME.test(name))) {
    addCandidate(state, source, declaration, QUEUE_NAME.test(name) ? 'queue constant' : 'error code', name, value.text, checker.getSymbolAtLocation(declaration.name));
  } else if (/(?:ErrorCodes|ERROR_CODES)$/u.test(name) && ts.isObjectLiteralExpression(value)) {
    const members = value.properties.filter(property => ts.isPropertyAssignment(property) && ts.isStringLiteralLike(unwrap(ts, property.initializer))).map(property =>
      addCandidate(state, source, property, 'error code', `${name}.${nameText(ts, property.name, { numbers: true })}`, unwrap(ts, property.initializer).text, checker.getSymbolAtLocation(property.name)));
    state.containers.set(checker.getSymbolAtLocation(declaration.name), members);
  }
}

function collectCandidates(state, sources) {
  for (const source of sources.values()) {
    const visit = node => {
      if (state.ts.isEnumDeclaration(node)) enumCandidates(state, source, node);
      else if (state.ts.isVariableDeclaration(node)) variableCandidates(state, source, node);
      state.ts.forEachChild(node, visit);
    };
    visit(source);
  }
}

function metadataDeclaration(ts, node, source) {
  if (!ts.isVariableDeclaration(node)) return false;
  if (CATALOG.test(source.fileName)) return true;
  const name = nameText(ts, node.name, { numbers: true }) ?? '';
  return /(?:ERROR_KINDS|ERROR_MESSAGES|ERROR_CODES|errorKinds|errorMessages)$/u.test(name) && ts.isObjectLiteralExpression(unwrap(ts, node.initializer) ?? node);
}

function declarationName(ts, node) {
  const parent = node.parent;
  return parent?.name === node && (ts.isVariableDeclaration(parent) || ts.isParameter(parent) || ts.isBindingElement(parent) || ts.isPropertyAssignment(parent)
    || ts.isPropertyDeclaration(parent) || ts.isMethodDeclaration(parent) || ts.isFunctionDeclaration(parent) || ts.isClassDeclaration(parent));
}

const matchesMember = (member, key) => key === null || member.name.endsWith(`.${key}`) || typeof member.value === 'number' && String(member.value) === key;
const markMembers = (members, key) => { for (const member of members) if (matchesMember(member, key)) member.used = true; };

function markContainerRead(ts, members, node) {
  const receiver = ts.isPropertyAccessExpression(node.parent) && node.parent.name === node ? node.parent : node;
  const parent = receiver.parent;
  if (ts.isPropertyAccessExpression(parent) && parent.expression === receiver) {
    markMembers(members, parent.name.text);
    return;
  }
  if (ts.isElementAccessExpression(parent) && parent.expression === receiver) {
    const key = nameText(ts, parent.argumentExpression, { identifiers: false, numbers: true });
    markMembers(members, key);
    return;
  }
  // An enum handed to a consumer or enumerated dynamically can read any member.
  for (const member of members) member.used = true;
}

function markReference(state, node) {
  const { ts, checker } = state;
  if (declarationName(ts, node)) return;
  const symbol = symbolOf(ts, checker, node);
  // A property read through an imported object resolves to a transient widened symbol; its declaration is the candidate's.
  const candidate = state.symbols.get(symbol) ?? state.decls.get(symbol?.valueDeclaration);
  if (candidate) candidate.used = true;
  const members = state.containers.get(symbol);
  if (members) markContainerRead(ts, members, node);
}

function ignoredRead(state, node, source) {
  const { ts } = state;
  if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node) || ts.isEnumDeclaration(node) || ts.isTypeNode(node) || metadataDeclaration(ts, node, source)) return true;
  return ts.isVariableDeclaration(node) && (state.symbols.has(state.checker.getSymbolAtLocation(node.name)) || state.containers.has(state.checker.getSymbolAtLocation(node.name)));
}

const readKey = (state, prefix, value) => (prefix === null ? state.looseReads : state.catalogReads).add(prefix === null ? value : `${prefix}${value}`);

function catalogArguments(state, node, prefix) {
  const { ts } = state;
  const argument = unwrap(ts, node);
  if (!argument) return;
  if (ts.isConditionalExpression(argument)) {
    catalogArguments(state, argument.whenTrue, prefix);
    catalogArguments(state, argument.whenFalse, prefix);
  } else if (ts.isStringLiteralLike(argument)) readKey(state, prefix, argument.text);
  else if (ts.isTemplateExpression(argument)) {
    // A static head is a key prefix: every defined key below it is read. A template with no static head proves nothing.
    if (prefix !== null) state.templates.push([`${prefix}${argument.head.text}`, ...argument.templateSpans.map(span => span.literal.text)]);
  } else {
    for (const value of staticStrings(state, argument)) readKey(state, prefix, value);
    // A key handed to a wrapper parameter can be a template at the call site.
    for (const leaf of valuesOf(state, argument)) if (leaf !== argument) catalogArguments(state, leaf, prefix);
  }
}

function namespacePrefix(namespace) {
  if (namespace === null) return null;
  return namespace ? `${namespace}.` : '';
}

function collectLiteralReads(state, node) {
  const { ts } = state;
  if (ts.isStringLiteralLike(node) && !declarationName(ts, node)) state.reads.add(node.text);
  jsonCatalogRead(state, node);
  if (!ts.isCallExpression(node)) return;
  for (const namespace of catalogNamespace(state, node.expression)) catalogArguments(state, node.arguments[0], namespacePrefix(namespace));
}

function sourceReads(state, sources) {
  for (const source of sources.values()) {
    const visit = node => {
      const { ts } = state;
      if (ignoredRead(state, node, source)) return;
      if (ts.isIdentifier(node)) markReference(state, node);
      collectLiteralReads(state, node);
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
}

function jsonCandidates(state, files) {
  for (const file of files.filter(file => JSON_CATALOG.test(file) && !EXCLUDED.test(file))) {
    let json;
    try { json = JSON.parse(readText(state.repoRoot, file)); } catch { continue; }
    const leaves = (value, prefix = '') => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        for (const [key, child] of Object.entries(value)) leaves(child, prefix ? `${prefix}.${key}` : key);
      } else if (prefix) state.candidates.push({ path: file, line: 1, column: 1, kind: 'catalog key', name: prefix, value: prefix, used: false });
    };
    leaves(json);
  }
}

/** R106's rule for a translator handed in without its namespace: a key is read when a string equals any tail of its dotted path. */
function looseRead(state, name) {
  const segments = name.split('.');
  return segments.some((_, index) => state.looseReads.has(segments.slice(index).join('.')));
}

function catalogRead(state, candidate, liveCodes) {
  if (candidate.name.startsWith('errors.') && liveCodes.has(candidate.name.slice(7))) return true;
  if (state.catalogReads.has(candidate.name) || looseRead(state, candidate.name)) return true;
  return state.templates.some(parts => parts.some(Boolean) && (() => {
    const tail = candidate.name;
    let offset = 0;
    for (const [index, part] of parts.entries()) {
      const next = tail.indexOf(part, offset);
      if (next < 0 || index === 0 && next !== 0) return false;
      offset = next + part.length;
    }
    return tail.endsWith(parts.at(-1));
  })());
}

/** The same rule applies to lite and full. Analyze all tracked consumers before filtering findings to a fast-check scope. */
export function unusedSymbolFindings({ repoRoot, files, repo = {}, isRoot = false, inScope = () => true, ts: supplied }) {
  const edition = repo.edition ?? 'full';
  if (isRoot || repo.kind === 'runtime' || !['lite', 'full'].includes(edition)) return [];
  const ts = compilerAt(repoRoot, supplied);
  if (!ts) return [];
  const sources = sourceFiles(ts, repoRoot, files);
  const { program, resolveModule } = trackedProgram(ts, repoRoot, files, sources);
  const state = { ts, checker: program.getTypeChecker(), resolveModule, repoRoot, candidates: [], symbols: new Map(), containers: new Map(), reads: new Set(), catalogReads: new Set(), translators: new Map(), templates: [], arguments: new Map(), catalogObjects: new Map(), decls: new Map(), looseReads: new Set() };
  collectCandidates(state, sources);
  argumentBindings(state, sources);
  jsonCatalogBindings(state, sources, files);
  translationBindings(state, sources);
  sourceReads(state, sources);
  jsonCandidates(state, files);
  for (const candidate of state.candidates) if (candidate.kind === 'error code' && state.reads.has(candidate.value)) candidate.used = true;
  const liveCodes = new Set(state.candidates.filter(candidate => candidate.kind === 'error code' && candidate.used).map(candidate => candidate.value));
  const findings = new Map();
  for (const candidate of state.candidates) {
    if (candidate.used || candidate.kind === 'catalog key' && catalogRead(state, candidate, liveCodes) || !inScope(candidate.path)) continue;
    const { used: _used, ...extra } = candidate;
    findings.set(`${candidate.path}:${candidate.name}`, found(HFS_UNUSED_SYMBOL, candidate.path, `${candidate.path} declares unused ${candidate.kind} ${candidate.name}; remove it or read it in production source (declarations, metadata maps and tests do not count).`, extra));
  }
  return [...findings.values()].sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line || a.name.localeCompare(b.name));
}
