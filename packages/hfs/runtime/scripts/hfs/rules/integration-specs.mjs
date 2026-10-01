// integration-specs.mjs - BE_INTEGRATION_SPEC_MISSING (R112): every integration of a back end has an integration spec that proves
// its client through the test world. An integration is the slot be.integrations: `src/modules/integrations/<provider>/` holding
// `<provider>.config.ts` (its required config boundary). Its spec is the slot be.tests.integration of the same folder name:
// `src/tests/integration/<provider>/*.integration-spec.ts`. At least one of those specs, read as a TypeScript syntax tree (never
// matched by name), must
//   1. call `useTestWorld({ modules })` where `modules` is an array (inline, a local const, or an exported const of another file,
//      spreads followed) holding a factory whose body calls `<X>.register(...)` with `<X>` imported from that integration;
//   2. reference an enum the integration exports (its ErrorCode enum): an identifier imported from the integration whose export
//      resolves to an `enum` declaration, used outside the import;
//   3. drive an outage through the world handle the call answers: `<world>.infra.<service>.cut|latency|during|connection(...)`, `<world>.fake.<name>.failNext(...)`,
//      `<world>.apps.<name>.during(...)` or `<world>.interruptDatabase(...)`.
// The finding sits on the integration folder. Imports resolve through the side's tsconfig (paths included) with the app's own
// TypeScript, the one every back end installs; the runtime's TypeScript is the fallback.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findPackage, requirePackage } from '../../lib/package-at.mjs';
import { found, readText } from './read.mjs';

export const INTEGRATION_SPEC_MISSING = 'BE_INTEGRATION_SPEC_MISSING';

const CONFIG_FILE = /^((?:[^/]+\/)*?)src\/modules\/integrations\/([^/]+)\/\2\.config\.ts$/;
const SPEC_SUFFIX = '.integration-spec.ts';
const OUTAGE_CALLS = Object.freeze({ fake: 'failNext', apps: 'during' });
/** The outage verbs of `world.infra.<service>` (`connection` leads to one connection's cut/restore/during). */
const INFRA_OUTAGES = new Set(['cut', 'latency', 'during', 'connection']);
const HERE = path.dirname(fileURLToPath(import.meta.url));

/** The TypeScript compiler of the app (else of the runtime), or null. */
function typescriptFor(repoRoot) {
  const located = findPackage([repoRoot, HERE], ['typescript']);
  return located ? requirePackage(located) : null;
}

/** The compiler options of the side (its tsconfig.json, `extends` and `paths` resolved by TypeScript itself). */
function optionsOf(ts, sideRoot) {
  const file = path.join(sideRoot, 'tsconfig.json');
  if (!fs.existsSync(file)) return {};
  const read = ts.readConfigFile(file, ts.sys.readFile);
  if (read.error) return {};
  return ts.parseJsonConfigFileContent(read.config, ts.sys, sideRoot).options;
}

/** One parsed file: its syntax tree and its imports (local name -> { source, imported }). */
function parse(ts, repoRoot, rel) {
  const text = readText(repoRoot, rel);
  if (text === null) return null;
  const sourceFile = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const imports = new Map();
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const named = statement.importClause?.namedBindings;
    if (!named || !ts.isNamedImports(named)) continue;
    for (const element of named.elements) imports.set(element.name.text, { source: statement.moduleSpecifier.text, imported: (element.propertyName ?? element.name).text, node: element });
  }
  return { rel, sourceFile, imports };
}

/** Walks every node under `node`. */
function walk(ts, node, visit) {
  visit(node);
  ts.forEachChild(node, (child) => walk(ts, child, visit));
}

/** The names of a property chain `a.b.c` from its root identifier, or null when the chain does not start at an identifier. */
function chainOf(ts, expression) {
  const names = [];
  let current = expression;
  while (ts.isPropertyAccessExpression(current)) {
    names.unshift(current.name.text);
    current = current.expression;
  }
  return ts.isIdentifier(current) ? [current.text, ...names] : null;
}

/**
 * The judge of one app: resolves an import of a parsed file to a repository-relative path, finds the top-level const of a file,
 * and reads files once.
 */
function judgeOf(ts, repoRoot, side) {
  const options = optionsOf(ts, path.join(repoRoot, side));
  const cache = new Map();
  const parsed = (rel) => {
    if (!cache.has(rel)) cache.set(rel, parse(ts, repoRoot, rel));
    return cache.get(rel);
  };
  const resolve = (fromRel, source) => {
    const resolved = ts.resolveModuleName(source, path.join(repoRoot, fromRel), options, ts.sys).resolvedModule?.resolvedFileName;
    if (!resolved) return null;
    const rel = path.relative(repoRoot, resolved).split(path.sep).join('/');
    return rel.startsWith('..') ? null : rel;
  };
  /** The initializer of `const <name> = ...` at the top level of `file`. */
  const constOf = (file, name) => {
    for (const statement of file.sourceFile.statements) {
      if (!ts.isVariableStatement(statement)) continue;
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && declaration.name.text === name && declaration.initializer) return declaration.initializer;
      }
    }
    return null;
  };
  return { parsed, resolve, constOf };
}

/** Whether `rel` lies in the integration folder `folder` (its index or any file of it). */
const insideFolder = (rel, folder) => rel !== null && (rel === `${folder}/index.ts` || rel.startsWith(`${folder}/`));

/** The array elements `expression` evaluates to in `file`, each with the file it is written in (identifiers, spreads and imports followed). */
function elementsOf(ts, judge, file, expression, depth = 0) {
  if (!expression || depth > 6) return [];
  let node = expression;
  while (ts.isAsExpression(node) || ts.isSatisfiesExpression?.(node) || ts.isParenthesizedExpression(node)) node = node.expression;
  if (ts.isArrayLiteralExpression(node)) {
    return node.elements.flatMap((element) => (ts.isSpreadElement(element) ? elementsOf(ts, judge, file, element.expression, depth + 1) : [{ file, node: element }]));
  }
  if (!ts.isIdentifier(node)) return [];
  const local = judge.constOf(file, node.text);
  if (local) return elementsOf(ts, judge, file, local, depth + 1);
  const imported = file.imports.get(node.text);
  if (!imported) return [];
  const target = judge.resolve(file.rel, imported.source);
  const other = target ? judge.parsed(target) : null;
  return other ? elementsOf(ts, judge, other, judge.constOf(other, imported.imported), depth + 1) : [];
}

/** Whether a factory element calls `<X>.register(...)` with `<X>` imported (in the element's file) from the integration folder. */
function registersIntegration(ts, judge, element, folder) {
  let registers = false;
  walk(ts, element.node, (node) => {
    if (registers || !ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return;
    if (node.expression.name.text !== 'register' || !ts.isIdentifier(node.expression.expression)) return;
    const binding = element.file.imports.get(node.expression.expression.text);
    if (binding && insideFolder(judge.resolve(element.file.rel, binding.source), folder)) registers = true;
  });
  return registers;
}

/** Whether `name`, exported by the module `rel`, is declared as an enum there or in the file it is re-exported from. */
function exportsEnum(ts, judge, rel, name, depth = 0) {
  const file = rel ? judge.parsed(rel) : null;
  if (!file || depth > 4) return false;
  for (const statement of file.sourceFile.statements) {
    if (ts.isEnumDeclaration(statement) && statement.name.text === name) return true;
    if (!ts.isExportDeclaration(statement) || !statement.exportClause || !ts.isNamedExports(statement.exportClause)) continue;
    for (const element of statement.exportClause.elements) {
      if (element.name.text !== name) continue;
      const original = (element.propertyName ?? element.name).text;
      if (statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)) return exportsEnum(ts, judge, judge.resolve(rel, statement.moduleSpecifier.text), original, depth + 1);
      return exportsEnum(ts, judge, rel, original, depth + 1);
    }
  }
  return false;
}

/** What one spec proves about the integration in `folder`: { modules, errorCode, outage }. */
function judgeSpec(ts, judge, rel, folder) {
  const spec = judge.parsed(rel);
  const result = { modules: false, errorCode: false, outage: false };
  if (!spec) return result;
  const worlds = new Set();
  walk(ts, spec.sourceFile, (node) => {
    if (!ts.isCallExpression(node) || !ts.isIdentifier(node.expression) || node.expression.text !== 'useTestWorld' || !spec.imports.has('useTestWorld')) return;
    const [argument] = node.arguments;
    if (!argument || !ts.isObjectLiteralExpression(argument)) return;
    const modules = argument.properties.find((property) => ts.isPropertyAssignment(property) && ts.isIdentifier(property.name) && property.name.text === 'modules');
    if (!modules) return;
    if (ts.isVariableDeclaration(node.parent) && ts.isIdentifier(node.parent.name)) worlds.add(node.parent.name.text);
    if (elementsOf(ts, judge, spec, modules.initializer).some((element) => registersIntegration(ts, judge, element, folder))) result.modules = true;
  });
  const enumBindings = new Set(
    [...spec.imports].filter(([, binding]) => {
      const target = judge.resolve(rel, binding.source);
      return insideFolder(target, folder) && exportsEnum(ts, judge, target, binding.imported);
    }).map(([local]) => local),
  );
  walk(ts, spec.sourceFile, (node) => {
    if (ts.isIdentifier(node) && enumBindings.has(node.text) && !ts.isImportSpecifier(node.parent)) result.errorCode = true;
    if (!ts.isPropertyAccessExpression(node)) return;
    const chain = chainOf(ts, node);
    if (!chain || !worlds.has(chain[0])) return;
    const [, area, name, call] = chain;
    const called = ts.isCallExpression(node.parent) && node.parent.expression === node;
    if (area === 'infra' && name !== undefined && INFRA_OUTAGES.has(call) && called) result.outage = true;
    else if (area === 'interruptDatabase' && called) result.outage = true;
    else if (OUTAGE_CALLS[area] !== undefined && name !== undefined && call === OUTAGE_CALLS[area] && called) result.outage = true;
  });
  return result;
}

const MISSING_PARTS = Object.freeze({
  modules: 'call useTestWorld({ modules }) with a factory that registers the integration module (<Provider>Module.register) imported from the integration',
  errorCode: "reference the integration's ErrorCode enum (its refusal mapping)",
  outage: 'drive an outage through the world: world.infra.<service>, world.fake.<name>.failNext(...), world.apps.<peer>.during(...) or world.interruptDatabase(...)',
});

/** The findings of R112 over the tracked paths `files` of the app at `repoRoot`. */
export function integrationSpecFindings({ repoRoot, files }) {
  const integrations = files.map((file) => CONFIG_FILE.exec(file)).filter(Boolean).map(([, side, provider]) => ({ side, provider, folder: `${side}src/modules/integrations/${provider}` }));
  if (integrations.length === 0) return [];
  const ts = typescriptFor(repoRoot);
  const findings = [];
  for (const { side, provider, folder } of integrations) {
    const specDir = `${side}src/tests/integration/${provider}/`;
    const specs = files.filter((file) => file.startsWith(specDir) && file.endsWith(SPEC_SUFFIX) && !file.slice(specDir.length).includes('/')).sort();
    if (specs.length === 0) {
      findings.push(found(INTEGRATION_SPEC_MISSING, `${folder}/`, `${folder}/ is an integration with no integration spec: add ${specDir}<name>${SPEC_SUFFIX} that ${MISSING_PARTS.modules}, ${MISSING_PARTS.errorCode}, and ${MISSING_PARTS.outage}.`, { provider, missing: ['spec'] }));
      continue;
    }
    if (ts === null) {
      findings.push(found(INTEGRATION_SPEC_MISSING, `${folder}/`, `${folder}/ cannot be judged: no TypeScript resolves from the app; install the app's dependencies.`, { provider, missing: ['typescript'] }));
      continue;
    }
    const judge = judgeOf(ts, repoRoot, side);
    const verdicts = specs.map((spec) => ({ spec, ...judgeSpec(ts, judge, spec, folder) }));
    if (verdicts.some((verdict) => verdict.modules && verdict.errorCode && verdict.outage)) continue;
    const best = [...verdicts].sort((a, b) => Number(b.modules) + Number(b.errorCode) + Number(b.outage) - (Number(a.modules) + Number(a.errorCode) + Number(a.outage)))[0];
    const missing = Object.keys(MISSING_PARTS).filter((part) => !best[part]);
    findings.push(found(INTEGRATION_SPEC_MISSING, `${folder}/`, `${folder}/ has integration specs (${specs.join(', ')}), but none proves the integration: ${best.spec} must also ${missing.map((part) => MISSING_PARTS[part]).join('; and ')}.`, { provider, missing }));
  }
  return findings;
}
