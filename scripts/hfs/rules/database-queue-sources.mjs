// TypeScript queue constants and scheduler references for migration parity.
import pg from 'libpg-query';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTypescript } from '../../lib/package-at.mjs';
import { sqlParser } from '../../lib/sql-ast.mjs';
import { found, readText } from './read.mjs';
import { DB_PGMQ_DECLARED } from './database-constants.mjs';

await pg.loadModule();
const HERE = path.dirname(fileURLToPath(import.meta.url));
const QUEUE_FILE = /^(?:be\/)?src\/modules\/queues\/.*\.ts$/;
const SOURCE_FILE = /^(?:be\/)?(?:src|apps)\/.*\.[cm]?[jt]s$/;
const TEST_FILE = /(?:\.(?:spec|test)|-spec)\.[cm]?[jt]s$|\/(?:tests|__tests__)\//;
const sqlTree = sqlParser(pg);

export function queueProblem(state, code, file, message) {
  state.findings.push(found(code, file, `${file}: ${message}`));
}

function sourceValue(ts, node) {
  while (node && (ts.isAsExpression(node) || ts.isParenthesizedExpression(node) || ts.isSatisfiesExpression(node))) node = node.expression;
  return node;
}

function sourceImports(ts, source) {
  const imports = new Map();
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const module = statement.moduleSpecifier.text;
    const clause = statement.importClause;
    if (clause?.name) imports.set(clause.name.text, { name: 'default', module });
    const named = clause?.namedBindings;
    if (named && ts.isNamespaceImport(named)) imports.set(named.name.text, { name: '*', module });
    for (const item of named?.elements ?? []) imports.set(item.name.text, { name: (item.propertyName ?? item.name).text, module });
  }
  return imports;
}

function sourceExports(ts, source) {
  const exports = new Map();
  const stars = [];
  for (const statement of source.statements) {
    if (!ts.isExportDeclaration(statement)) continue;
    const module = statement.moduleSpecifier?.text ?? null;
    if (!statement.exportClause && module) stars.push(module);
    for (const item of statement.exportClause?.elements ?? []) exports.set(item.name.text, { name: (item.propertyName ?? item.name).text, module });
  }
  return { exports, stars };
}

function sourceBindings(ts, source) {
  const bindings = new Map();
  const visit = (node) => {
    if ((ts.isVariableDeclaration(node) || ts.isFunctionDeclaration(node)) && node.name && ts.isIdentifier(node.name)) bindings.set(node.name.text, node.initializer ?? node.body);
    if (ts.isExportAssignment(node)) bindings.set('default', node.expression);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return { source, bindings, imports: sourceImports(ts, source), ...sourceExports(ts, source) };
}

export function queueSourceFacts(state, files, inspectSql) {
  const ts = loadTypescript(state.repoRoot, HERE);
  const sources = new Map();
  if (!ts) {
    if (files.some((file) => QUEUE_FILE.test(file))) queueProblem(state, DB_PGMQ_DECLARED, 'hfs.json', 'queue declarations require the TypeScript parser');
    return { ts, sources };
  }
  for (const file of files.filter((item) => SOURCE_FILE.test(item) && !TEST_FILE.test(item))) {
    const text = readText(state.repoRoot, file);
    if (text === null) continue;
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    sources.set(file, sourceBindings(ts, source));
    if (QUEUE_FILE.test(file)) addQueueConstants(state, ts, source, file);
    addSourceSql(state, ts, source, file, inspectSql);
  }
  return { ts, sources };
}

function addQueueConstants(state, ts, source, file) {
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && /(?:^QUEUE$|_QUEUE(?:_NAME)?$|^QUEUE_)/.test(node.name.text)) {
      const value = sourceValue(ts, node.initializer);
      if (value && ts.isStringLiteralLike(value)) state.constants.set(value.text, file);
      else queueProblem(state, DB_PGMQ_DECLARED, file, 'queue names must be literal constants so migration parity can be checked');
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}

function templateSql(ts, node) {
  if (ts.isStringLiteralLike(node)) return node.text;
  if (!ts.isTemplateExpression(node)) return null;
  return node.head.text + node.templateSpans.map((span) => `NULL${span.literal.text}`).join('');
}

function addSourceSql(state, ts, source, file, inspectSql) {
  const visit = (node) => {
    let text = null;
    if (ts.isTaggedTemplateExpression(node) && /(?:^|\.)sql$/.test(node.tag.getText(source))) text = templateSql(ts, node.template);
    if (ts.isCallExpression(node) && /(?:^|\.)(?:query|execute)$/.test(node.expression.getText(source)) && node.arguments[0]) text = templateSql(ts, node.arguments[0]);
    if (text !== null) inspectSql(state, sqlTree(text), file, false);
    ts.forEachChild(node, visit);
  };
  visit(source);
}

function importedFile(files, from, specifier) {
  const prefix = from.startsWith('be/') ? 'be/' : '';
  let target = null;
  if (specifier.startsWith('@modules/')) target = `${prefix}src/modules/${specifier.slice(9)}`;
  else if (specifier.startsWith('.')) target = path.posix.normalize(path.posix.join(path.posix.dirname(from), specifier));
  if (target === null) return null;
  return [target, target.replace(/\.js$/, '.ts'), `${target}.ts`, `${target}/index.ts`].find((file) => files.has(file)) ?? null;
}

function schedulerBinding(ts, sources, file, name, seen) {
  const key = `binding:${file}:${name}`;
  if (seen.has(key)) return [];
  seen.add(key);
  const info = sources.get(file);
  const local = info?.bindings.get(name);
  if (local) return schedulerValues(ts, sources, file, local, seen);
  const imported = info?.imports.get(name) ?? info?.exports.get(name);
  if (imported) {
    const target = imported.module ? importedFile(sources, file, imported.module) : file;
    return target ? schedulerBinding(ts, sources, target, imported.name, seen) : [];
  }
  const values = [];
  for (const module of info?.stars ?? []) {
    const target = importedFile(sources, file, module);
    if (target) values.push(...schedulerBinding(ts, sources, target, name, seen));
  }
  return values;
}

function schedulerMember(ts, sources, file, node, seen) {
  if (!ts.isPropertyAccessExpression(node) || !ts.isIdentifier(node.expression)) return null;
  const imported = sources.get(file)?.imports.get(node.expression.text);
  if (imported?.name !== '*') return null;
  const target = importedFile(sources, file, imported.module);
  return target ? schedulerBinding(ts, sources, target, node.name.text, seen) : [];
}

function schedulerValues(ts, sources, file, node, seen = new Set()) {
  node = sourceValue(ts, node);
  if (!node) return [];
  const key = `${file}:${node.pos}`;
  if (seen.has(key)) return [];
  seen.add(key);
  if (ts.isIdentifier(node)) return schedulerBinding(ts, sources, file, node.text, seen);
  const member = schedulerMember(ts, sources, file, node, seen);
  if (member) return member;
  const values = [];
  if (ts.isStringLiteralLike(node)) values.push(node.text);
  ts.forEachChild(node, (child) => { values.push(...schedulerValues(ts, sources, file, child, seen)); });
  return values;
}

export function queueSchedulers({ ts, sources }) {
  const values = new Map();
  if (!ts) return values;
  for (const [file, info] of sources) {
    if (!/^(?:be\/)?apps\//.test(file)) continue;
    const visit = (node) => {
      if ((ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node)) && node.name.getText(info.source).replaceAll('"', '').replaceAll("'", '') === 'schedulers') {
        for (const value of schedulerValues(ts, sources, file, node.initializer ?? node.name)) values.set(value, file);
      }
      ts.forEachChild(node, visit);
    };
    visit(info.source);
  }
  return values;
}
